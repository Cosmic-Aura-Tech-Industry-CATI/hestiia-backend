import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import {
  JWT_SECRET,
  JWT_ACCESS_SECRET,
  JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN,
  BCRYPT_SALT_ROUNDS,
  INITIAL_SUPERADMIN_NAME,
  INITIAL_SUPERADMIN_EMAIL,
  INITIAL_SUPERADMIN_PASSWORD,
  ADMIN_SETUP_SECRET,
} from '../../shared/config/utils.js';
import { db } from '../../shared/config/store.js';
import { AppError } from '../../shared/utils/appError.js';
import { IAdminUser, UserRole, UserStatus } from './auth.interface.js';
import { userRepository } from '../users/user.repository.js';
import { User, IUserDocument } from '../users/user.model.js';
import { otpService } from '../otp/otp.service.js';

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email || '';
  const [name, domain] = email.split('@');
  if (name.length <= 2) {
    return `${name[0]}*@${domain}`;
  }
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(1, name.length - 3))}${name.slice(-1)}@${domain}`;
}

function sanitizeUser(user: IUserDocument | any): IAdminUser {
  const rawRole = (user.role || '').toUpperCase();
  const canonicalRole: UserRole = rawRole === 'STAFF' ? 'STAFF' : 'ADMIN';

  return {
    id: user._id ? String(user._id) : user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    role: canonicalRole,
    status: (user.status || (user.active ? 'ACTIVE' : 'INACTIVE')) as UserStatus,
    tokenVersion: user.tokenVersion || 0,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// In-memory rate limiting tracker for failed attempts
const loginAttempts: Record<string, { count: number; lockUntil: number }> = {};

export const authService = {
  /**
   * One-time Superadmin bootstrap on system startup
   * Only seeds if custom non-demo credentials are explicitly configured in environment variables.
   * Demo accounts (admin@hestiia.com & manager@hestiia.com) have been removed.
   */
  async bootstrapSuperadmin(): Promise<void> {
    if (mongoose.connection.readyState !== 1) {
      return;
    }
    try {
      const customEmail = process.env.INITIAL_SUPERADMIN_EMAIL;
      const customPassword = process.env.INITIAL_SUPERADMIN_PASSWORD;

      if (customEmail && customPassword && customEmail !== 'admin@hestiia.com') {
        const existingUser = await userRepository.findByEmail(customEmail);

        if (!existingUser) {
          const saltRounds = Number(BCRYPT_SALT_ROUNDS) || 12;
          const user = new User({
            name: process.env.INITIAL_SUPERADMIN_NAME || 'Superadmin',
            email: customEmail,
            username: customEmail.split('@')[0],
            passwordHash: await bcrypt.hash(customPassword, saltRounds),
            role: 'ADMIN',
            status: 'ACTIVE',
            tokenVersion: 0,
          });
          await user.save();
          console.log(`[Bootstrap] Configured ADMIN account seeded in MongoDB Atlas (${customEmail})`);
        }
      }
    } catch (err: any) {
      console.warn('[Bootstrap] Superadmin bootstrap notice:', err?.message || err);
    }
  },

  /**
   * Step 1 of Login: Validates credentials and creates session
   * Supports role-specific login validation (ADMIN vs STAFF)
   */
  async login(identifier?: string, password?: string, ip = 'unknown', requiredRole?: 'ADMIN' | 'STAFF') {
    if (!identifier || !password) {
      throw new AppError('Email/username and password are required.', 400);
    }

    const cleanInput = identifier.trim().toLowerCase();
    const attemptKey = `${ip}_${cleanInput}`;
    const now = Date.now();
    const attempt = loginAttempts[attemptKey];

    if (attempt && attempt.lockUntil > now) {
      const remainingSeconds = Math.ceil((attempt.lockUntil - now) / 1000);
      throw new AppError(
        `Too many failed login attempts. Please wait ${remainingSeconds} seconds before trying again.`,
        429
      );
    }

    // 1. Fetch user from MongoDB Atlas (if connection active)
    let user = null;
    if (mongoose.connection.readyState === 1) {
      try {
        user = await userRepository.findByUsernameOrEmail(cleanInput, true);
      } catch {
        user = null;
      }
    }

    // Fallback sync with local store
    if (!user) {
      const storeUser = db.getState().users.find(
        (u) => u.email.toLowerCase() === cleanInput || u.username.toLowerCase() === cleanInput
      );
      if (storeUser) {
        user = new User({
          _id: storeUser.id,
          name: storeUser.name,
          email: storeUser.email,
          username: storeUser.username,
          passwordHash: storeUser.passwordHash,
          role: (storeUser.role || '').toUpperCase() === 'STAFF' ? 'STAFF' : 'ADMIN',
          status: storeUser.active ? 'ACTIVE' : 'INACTIVE',
          tokenVersion: storeUser.tokenVersion || 0,
        });
      }
    }

    if (!user) {
      this.recordFailedAttempt(attemptKey, cleanInput, ip);
      throw new AppError('Invalid credentials. Please verify your email/username and password.', 401);
    }

    // 2. Securely verify password with bcrypt
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      this.recordFailedAttempt(attemptKey, cleanInput, ip);
      throw new AppError('Invalid credentials. Please verify your email/username and password.', 401);
    }

    // 3. Reject inactive accounts
    if (user.status === 'INACTIVE') {
      throw new AppError('Your account has been deactivated. Please contact the administrator.', 401);
    }

    // 4. Role-specific portal validation
    const userRole = ((user.role || '').toUpperCase() === 'STAFF') ? 'STAFF' : 'ADMIN';

    if (requiredRole === 'ADMIN' && userRole === 'STAFF') {
      db.logAudit('AUTH_ADMIN_LOGIN_REJECTED', cleanInput, 'Staff member attempted to log into Admin Portal', ip);
      throw new AppError(
        'Access denied: Staff accounts cannot log into the Admin Management Portal. Please use the Staff Operations login.',
        403
      );
    }

    // Reset failed counter
    delete loginAttempts[attemptKey];

    // 5. Create a direct authenticated session. OTP verification is disabled.
    const { accessToken, refreshToken } = this.generateTokenPair(user);

    db.logAudit(
      requiredRole ? `AUTH_${requiredRole}_LOGIN_SUCCESS` : 'AUTH_LOGIN_SUCCESS',
      user.email,
      `User authenticated as ${userRole} via ${requiredRole || 'Standard'} portal`,
      ip
    );

    const welcomeMessage = userRole === 'STAFF'
      ? 'Authentication successful. Welcome to Hestiia Staff Operations.'
      : 'Authentication successful. Welcome to Hestiia Restaurant Administration.';

    return {
      success: true,
      requireOtp: false,
      message: welcomeMessage,
      token: accessToken,
      accessToken,
      refreshToken,
      user: sanitizeUser(user),
    };
  },

  /**
   * Helper to record brute-force login attempts
   */
  recordFailedAttempt(attemptKey: string, identifier: string, ip: string) {
    const now = Date.now();
    const current = loginAttempts[attemptKey] || { count: 0, lockUntil: 0 };
    current.count += 1;
    if (current.count >= 5) {
      current.lockUntil = now + 15 * 60 * 1000; // 15-minute lockout
    }
    loginAttempts[attemptKey] = current;
    db.logAudit('FAILED_LOGIN_ATTEMPT', identifier, `Failed login attempt from IP ${ip}`, ip);
  },

  /**
   * Step 2 of Login: Verifies OTP and generates session tokens (access + refresh)
   */
  async verifyLoginOtp(email: string, otp: string, ip = 'unknown') {
    if (!email || !otp) {
      throw new AppError('Email address and 6-digit verification code are required.', 400);
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Verify OTP with MongoDB Atlas Otp collection
    await otpService.verifyOtp(cleanEmail, otp, 'LOGIN_2FA');

    // 2. Fetch authenticated user
    const user = await userRepository.findByEmail(cleanEmail);
    if (!user) {
      throw new AppError('Account not found or has been deactivated.', 404);
    }

    if (user.status === 'INACTIVE') {
      throw new AppError('Your account has been deactivated. Please contact the Superadmin.', 401);
    }

    // 3. Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // 4. Generate JWT tokens
    const { accessToken, refreshToken } = this.generateTokenPair(user);

    db.logAudit('AUTH_LOGIN_SUCCESS', user.email, `User successfully authenticated as ${user.role}`, ip);

    return {
      success: true,
      message: 'Authentication successful. Welcome to Hestiia Restaurant Administration.',
      token: accessToken,
      accessToken,
      refreshToken,
      user: sanitizeUser(user),
    };
  },

  /**
   * Token Generator for Access Token and Refresh Token
   */
  generateTokenPair(user: IUserDocument | any): { accessToken: string; refreshToken: string } {
    const rawRole = (user.role || '').toUpperCase();
    const canonicalRole: UserRole = rawRole === 'STAFF' ? 'STAFF' : 'ADMIN';

    const payload = {
      id: user._id ? String(user._id) : user.id,
      email: user.email,
      name: user.name,
      role: canonicalRole,
      status: (user.status || 'ACTIVE') as UserStatus,
      tokenVersion: user.tokenVersion || 0,
    };

    const accessToken = jwt.sign(payload, JWT_ACCESS_SECRET, {
      expiresIn: JWT_ACCESS_EXPIRES_IN as any,
    });

    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRES_IN as any,
    });

    return { accessToken, refreshToken };
  },

  /**
   * Refresh Token Endpoint with Token Rotation
   */
  async refreshTokens(refreshTokenString?: string, ip = 'unknown') {
    if (!refreshTokenString) {
      throw new AppError('Refresh token is required.', 401);
    }

    let decoded: any;
    try {
      decoded = jwt.verify(refreshTokenString, JWT_REFRESH_SECRET);
    } catch {
      throw new AppError('Invalid or expired refresh token. Please sign in again.', 401);
    }

    const user = await userRepository.findById(decoded.id);
    if (!user || user.status === 'INACTIVE') {
      throw new AppError('User account not found or has been deactivated.', 401);
    }

    // Check for revoked/reused token via tokenVersion
    if ((user.tokenVersion || 0) !== (decoded.tokenVersion || 0)) {
      throw new AppError('Refresh token has been revoked. Please sign in again.', 401);
    }

    // Generate rotated tokens
    const tokens = this.generateTokenPair(user);
    db.logAudit('TOKEN_REFRESH', user.email, 'Tokens refreshed with rotation', ip);

    return {
      success: true,
      token: tokens.accessToken,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: sanitizeUser(user),
    };
  },

  /**
   * Logout: Invalidates all active tokens by incrementing tokenVersion
   */
  async logout(userId: string, email = 'admin', ip = 'unknown') {
    const user = await userRepository.findById(userId);
    if (user) {
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save({ validateBeforeSave: false });
    }

    // Sync in-memory store
    db.updateState((s) => {
      const target = s.users.find((u) => u.id === userId);
      if (target) {
        target.tokenVersion = (target.tokenVersion || 0) + 1;
      }
    });

    db.logAudit('AUTH_LOGOUT', email, 'Session invalidated and logged out', ip);
  },

  /**
   * Resend OTP
   */
  async resendOtp(email: string, ip = 'unknown') {
    if (!email) {
      throw new AppError('Email address is required.', 400);
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await userRepository.findByEmail(cleanEmail);

    const userId = user ? String(user._id) : 'guest';
    const userName = user ? user.name : 'Staff Member';

    const otpResult = await otpService.generateAndSendOtp(userId, cleanEmail, 'LOGIN_2FA', userName);

    db.logAudit('OTP_RESENT', cleanEmail, `OTP resent to ${maskEmail(cleanEmail)}`, ip);

    return {
      success: true,
      message: `A new verification code has been dispatched to ${otpResult.maskedEmail}.`,
      expiresInSeconds: otpResult.expiresInSeconds,
      devOtp: otpResult.devOtp,
    };
  },

  /**
   * Step 1 of Password Recovery: Send OTP to email
   */
  async forgotPassword(emailOrUsername: string, ip = 'unknown') {
    if (!emailOrUsername) {
      throw new AppError('Email address is required.', 400);
    }

    const cleanInput = emailOrUsername.trim().toLowerCase();
    const user = await userRepository.findByUsernameOrEmail(cleanInput);

    if (!user || user.status === 'INACTIVE') {
      // Do not reveal account existence for security
      return {
        success: true,
        message: 'If an active account exists with that email address, a password reset code has been dispatched.',
      };
    }

    const otpResult = await otpService.generateAndSendOtp(
      String(user._id),
      user.email,
      'FORGOT_PASSWORD',
      user.name
    );

    db.logAudit('FORGOT_PASSWORD_REQUEST', user.email, `Password reset OTP dispatched to ${maskEmail(user.email)}`, ip);

    return {
      success: true,
      email: user.email,
      maskedEmail: otpResult.maskedEmail,
      message: `A password reset code has been dispatched to ${otpResult.maskedEmail}.`,
      devOtp: otpResult.devOtp,
    };
  },

  /**
   * Step 2 of Password Recovery: Verify OTP and update password
   */
  async resetPassword(email: string, otp: string, newPassword?: string, ip = 'unknown') {
    if (!email || !otp || !newPassword) {
      throw new AppError('Email, OTP verification code, and new password are required.', 400);
    }

    if (newPassword.length < 8) {
      throw new AppError('New password must be at least 8 characters long.', 400);
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Verify OTP with MongoDB Atlas Otp collection
    await otpService.verifyOtp(cleanEmail, otp, 'FORGOT_PASSWORD');

    // 2. Update user password
    const user = await userRepository.findByEmail(cleanEmail, true);
    if (!user || user.status === 'INACTIVE') {
      throw new AppError('Associated account not found or has been deactivated.', 404);
    }

    user.password = newPassword;
    user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate all prior sessions
    await user.save();

    // Sync in-memory store
    const saltRounds = Number(BCRYPT_SALT_ROUNDS) || 12;
    const newHash = bcrypt.hashSync(newPassword, saltRounds);
    db.updateState((s) => {
      const target = s.users.find((u) => u.email.toLowerCase() === cleanEmail);
      if (target) {
        target.passwordHash = newHash;
        target.tokenVersion = (target.tokenVersion || 0) + 1;
      }
    });

    db.logAudit('PASSWORD_RESET_SUCCESS', user.email, 'Password successfully reset via OTP', ip);

    return {
      success: true,
      message: 'Your password has been successfully reset. Please log in with your new credentials.',
    };
  },

  /**
   * User Management: Create new user (Admin Only)
   */
  async createUser(
    userData: { name: string; email: string; username?: string; password: string; role?: string; status?: string },
    actorUser: any
  ) {
    const actorRole = (actorUser.role || '').toUpperCase();
    const isActorAdmin = actorRole === 'ADMIN' || actorRole === 'SUPERADMIN' || actorRole === 'MANAGER';
    if (!isActorAdmin) {
      throw new AppError('Forbidden: Only an Admin can create user accounts.', 403);
    }

    const { name, email, username, password, role = 'STAFF', status = 'ACTIVE' } = userData;

    if (!name || !email || !password) {
      throw new AppError('Name, email, and password are required.', 400);
    }

    if (password.length < 8) {
      throw new AppError('Password must be at least 8 characters long.', 400);
    }

    const cleanEmail = email.toLowerCase().trim();
    const rawRole = role.toUpperCase().trim();
    const cleanStatus = status.toUpperCase().trim() as UserStatus;

    if (rawRole !== 'ADMIN' && rawRole !== 'STAFF' && rawRole !== 'SUPERADMIN' && rawRole !== 'MANAGER') {
      throw new AppError("Invalid role. Role must strictly be 'ADMIN' or 'STAFF'.", 400);
    }

    const canonicalRole: UserRole = rawRole === 'STAFF' ? 'STAFF' : 'ADMIN';

    if (cleanStatus !== 'ACTIVE' && cleanStatus !== 'INACTIVE') {
      throw new AppError("Invalid status. Status must strictly be 'ACTIVE' or 'INACTIVE'.", 400);
    }

    // Check duplicate email
    const existing = await userRepository.findByEmail(cleanEmail);
    if (existing) {
      throw new AppError('A user with that email address already exists.', 400);
    }

    const newUser = await userRepository.createUser({
      name: name.trim(),
      email: cleanEmail,
      username: username ? username.toLowerCase().trim() : cleanEmail.split('@')[0],
      password,
      role: canonicalRole,
      status: cleanStatus,
      tokenVersion: 0,
    });

    // Synchronize to in-memory store
    const saltRounds = Number(BCRYPT_SALT_ROUNDS) || 12;
    const passwordHash = bcrypt.hashSync(password, saltRounds);
    db.updateState((s) => {
      s.users.push({
        id: String(newUser._id),
        name: newUser.name,
        email: newUser.email,
        username: newUser.username || newUser.email,
        passwordHash,
        role: canonicalRole === 'STAFF' ? 'staff' : 'admin',
        active: newUser.status === 'ACTIVE',
        tokenVersion: 0,
        createdAt: new Date().toISOString(),
      });
    });

    db.logAudit('USER_CREATED', actorUser.email, `Created new ${canonicalRole} user '${cleanEmail}'`);

    return sanitizeUser(newUser);
  },

  /**
   * User Management: List users with pagination and filtering (Superadmin Only)
   */
  async getUsers(query: { role?: string; status?: string; page?: number; limit?: number }) {
    const filter: any = {};

    if (query.role) {
      filter.role = query.role.toUpperCase().trim();
    }
    if (query.status) {
      filter.status = query.status.toUpperCase().trim();
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const { users, total } = await userRepository.findUsers(filter, skip, limit);

    return {
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      users: users.map(sanitizeUser),
    };
  },

  /**
   * User Management: Get user by ID (Superadmin Only)
   */
  async getUserById(id: string) {
    const user = await userRepository.findById(id);
    if (!user) {
      throw new AppError('User not found.', 404);
    }
    return sanitizeUser(user);
  },

  /**
   * User Management: Update basic details (Superadmin Only)
   */
  async updateUser(id: string, updateData: { name?: string; email?: string }, actorUser: any) {
    const user = await userRepository.findById(id);
    if (!user) {
      throw new AppError('User not found.', 404);
    }

    if (updateData.email) {
      const cleanEmail = updateData.email.toLowerCase().trim();
      if (cleanEmail !== user.email) {
        const existing = await userRepository.findByEmail(cleanEmail);
        if (existing) {
          throw new AppError('A user with that email address already exists.', 400);
        }
        user.email = cleanEmail;
      }
    }

    if (updateData.name) {
      user.name = updateData.name.trim();
    }

    await user.save();
    db.logAudit('USER_UPDATED', actorUser.email, `Updated user details for ${user.email}`);

    return sanitizeUser(user);
  },

  /**
   * User Management: Update User Role (Admin Only)
   * Prevents self-role change and ensures at least one active Admin remains.
   */
  async updateUserRole(id: string, newRole: string, actorUser: any) {
    const actorRole = (actorUser.role || '').toUpperCase();
    const isActorAdmin = actorRole === 'ADMIN' || actorRole === 'SUPERADMIN' || actorRole === 'MANAGER';
    if (!isActorAdmin) {
      throw new AppError('Forbidden: Only an Admin can update user roles.', 403);
    }

    if (!newRole) {
      throw new AppError("Field 'role' is required.", 400);
    }

    const rawRole = newRole.toUpperCase().trim();
    if (rawRole !== 'ADMIN' && rawRole !== 'STAFF' && rawRole !== 'SUPERADMIN' && rawRole !== 'MANAGER') {
      throw new AppError("Invalid role. Role must strictly be 'ADMIN' or 'STAFF'.", 400);
    }

    const canonicalRole: UserRole = rawRole === 'STAFF' ? 'STAFF' : 'ADMIN';

    // Constraint 1: Prevent user from modifying their own role
    if (actorUser.id === id) {
      throw new AppError('Security constraint: You cannot modify your own role.', 400);
    }

    const user = await userRepository.findById(id);
    if (!user) {
      throw new AppError('User not found.', 404);
    }

    const isCurrentAdmin = (user.role || '').toUpperCase() !== 'STAFF';

    // Constraint 2: Prevent demoting the last active Admin
    if (isCurrentAdmin && canonicalRole === 'STAFF') {
      const activeAdmins = await userRepository.countActiveSuperadmins();
      if (activeAdmins <= 1) {
        throw new AppError('Security constraint: Cannot demote the last active Admin in the system.', 400);
      }
    }

    user.role = canonicalRole;
    user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate target user's active session
    await user.save();

    // Sync in-memory store
    db.updateState((s) => {
      const target = s.users.find((u) => u.id === id);
      if (target) {
        target.role = canonicalRole === 'STAFF' ? 'staff' : 'admin';
        target.tokenVersion = (target.tokenVersion || 0) + 1;
      }
    });

    db.logAudit('ROLE_UPDATED', actorUser.email, `Updated role of ${user.email} to ${canonicalRole}`);

    return sanitizeUser(user);
  },

  /**
   * User Management: Update User Status (Admin Only)
   * Prevents deactivating self and the last active Admin.
   */
  async updateUserStatus(id: string, newStatus: string, actorUser: any) {
    const actorRole = (actorUser.role || '').toUpperCase();
    const isActorAdmin = actorRole === 'ADMIN' || actorRole === 'SUPERADMIN' || actorRole === 'MANAGER';
    if (!isActorAdmin) {
      throw new AppError('Forbidden: Only an Admin can update user status.', 403);
    }

    if (!newStatus) {
      throw new AppError("Field 'status' is required.", 400);
    }

    const cleanStatus = newStatus.toUpperCase().trim() as UserStatus;
    if (cleanStatus !== 'ACTIVE' && cleanStatus !== 'INACTIVE') {
      throw new AppError("Invalid status. Status must strictly be 'ACTIVE' or 'INACTIVE'.", 400);
    }

    // Constraint 1: Prevent user from deactivating themselves
    if (actorUser.id === id && cleanStatus === 'INACTIVE') {
      throw new AppError('Security constraint: You cannot deactivate your own account.', 400);
    }

    const user = await userRepository.findById(id);
    if (!user) {
      throw new AppError('User not found.', 404);
    }

    // Constraint 2: Prevent deactivating the last active Admin
    const isTargetAdmin = (user.role || '').toUpperCase() !== 'STAFF';
    if (isTargetAdmin && cleanStatus === 'INACTIVE') {
      const activeAdmins = await userRepository.countActiveSuperadmins();
      if (activeAdmins <= 1) {
        throw new AppError('Security constraint: Cannot deactivate the last active Admin in the system.', 400);
      }
    }

    user.status = cleanStatus;
    if (cleanStatus === 'INACTIVE') {
      user.tokenVersion = (user.tokenVersion || 0) + 1; // Immediately terminate active sessions
    }
    await user.save();

    // Sync in-memory store
    db.updateState((s) => {
      const target = s.users.find((u) => u.id === id);
      if (target) {
        target.active = cleanStatus === 'ACTIVE';
        if (cleanStatus === 'INACTIVE') {
          target.tokenVersion = (target.tokenVersion || 0) + 1;
        }
      }
    });

    db.logAudit('STATUS_UPDATED', actorUser.email, `Updated status of ${user.email} to ${cleanStatus}`);

    return sanitizeUser(user);
  },

  /**
   * User Management: Delete user (Admin Only)
   */
  async deleteUser(id: string, actorUser: any) {
    const actorRole = (actorUser.role || '').toUpperCase();
    const isActorAdmin = actorRole === 'ADMIN' || actorRole === 'SUPERADMIN' || actorRole === 'MANAGER';
    if (!isActorAdmin) {
      throw new AppError('Forbidden: Only an Admin can delete user accounts.', 403);
    }

    if (actorUser.id === id) {
      throw new AppError('Security constraint: You cannot delete your own account.', 400);
    }

    const user = await userRepository.findById(id);
    if (!user) {
      throw new AppError('User not found.', 404);
    }

    const isTargetAdmin = (user.role || '').toUpperCase() !== 'STAFF';
    if (isTargetAdmin) {
      const activeAdmins = await userRepository.countActiveSuperadmins();
      if (activeAdmins <= 1) {
        throw new AppError('Security constraint: Cannot delete the last active Admin.', 400);
      }
    }

    await userRepository.deleteUser(id);

    // Sync in-memory store
    db.updateState((s) => {
      const idx = s.users.findIndex((u) => u.id === id);
      if (idx !== -1) {
        s.users.splice(idx, 1);
      }
    });

    db.logAudit('USER_DELETED', actorUser.email, `Deleted user ${user.email}`);

    return { success: true, message: `User '${user.email}' was successfully deleted.` };
  },

  /**
   * Dedicated Superadmin Creation Endpoint Handler
   * Accepts strictly: { name, email, password }
   * Creates or updates a Superadmin account directly in MongoDB Atlas and local store.
   */
  async createSuperAdmin(data: { name: string; email: string; password: string }) {
    const { name, email, password } = data;

    if (!name || !email || !password) {
      throw new AppError('Name, email, and password are required to create a Superadmin.', 400);
    }

    if (password.length < 8) {
      throw new AppError('Password must be at least 8 characters long.', 400);
    }

    const cleanEmail = email.toLowerCase().trim();
    const saltRounds = Number(BCRYPT_SALT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const isMongoActive = mongoose.connection.readyState === 1;
    let user: any;

    if (isMongoActive) {
      user = await userRepository.findByEmail(cleanEmail);

      if (user) {
        user.name = name.trim();
        user.passwordHash = hashedPassword;
        user.role = 'ADMIN';
        user.status = 'ACTIVE';
        user.tokenVersion = (user.tokenVersion || 0) + 1;
        await user.save();
      } else {
        user = await userRepository.createUser({
          name: name.trim(),
          email: cleanEmail,
          username: cleanEmail.split('@')[0],
          passwordHash: hashedPassword,
          role: 'ADMIN',
          status: 'ACTIVE',
          tokenVersion: 0,
        });
      }
    } else {
      user = {
        _id: 'usr_' + Date.now(),
        name: name.trim(),
        email: cleanEmail,
        username: cleanEmail.split('@')[0],
        role: 'ADMIN',
        status: 'ACTIVE',
        tokenVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    // Sync in-memory store
    db.updateState((s) => {
      const idx = s.users.findIndex((u) => u.email.toLowerCase() === cleanEmail);
      if (idx !== -1) {
        s.users[idx].name = name.trim();
        s.users[idx].passwordHash = hashedPassword;
        s.users[idx].role = 'admin';
        s.users[idx].active = true;
      } else {
        s.users.push({
          id: String(user?._id),
          name: user!.name,
          email: cleanEmail,
          username: cleanEmail.split('@')[0],
          passwordHash: hashedPassword,
          role: 'admin',
          active: true,
          tokenVersion: 0,
          createdAt: new Date().toISOString(),
        });
      }
    });

    db.logAudit(
      'SUPERADMIN_CREATED',
      cleanEmail,
      `Superadmin account created/updated for '${cleanEmail}'`
    );

    return sanitizeUser(user);
  },
};

export default authService;
