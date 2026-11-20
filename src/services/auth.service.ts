import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_EXPIRES_IN, JWT_SECRET } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { connectDB } from '@/lib/mongodb';
import { logAudit } from '@/lib/audit';
import { IAdminUser, UserModel } from '@/models/User.model';
import { LoginAttemptModel } from '@/models/LoginAttempt.model';
import { cleanDoc, cleanDocs } from '@/models/_schema';

const ALLOWED_ROLES = ['superadmin', 'manager', 'staff'] as const;
const IP_MAX_ATTEMPTS = 5;
const USER_MAX_ATTEMPTS = 10;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,50}$/;

function validatePasswordStrength(password?: string): string {
  if (!password || typeof password !== 'string' || password.length < 8) {
    throw new AppError('Password must be at least 8 characters long.', 400);
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new AppError(
      'Password must include at least one uppercase letter, one lowercase letter, and one number.',
      400
    );
  }
  return password;
}

function getAttemptKeys(ip: string, identifier: string) {
  return {
    ipKey: `ip:${ip}:${identifier}`,
    userKey: `user:${identifier}`,
  };
}

export const authService = {
  async login(username?: string, password?: string, ip = 'unknown') {
    if (!username || !password) {
      throw new AppError('Username/email and password are required.', 400);
    }

    await connectDB();

    const normalizedIdentifier = username.trim().toLowerCase();
    const { ipKey, userKey } = getAttemptKeys(ip, normalizedIdentifier);
    const now = Date.now();

    const activeLocks = await LoginAttemptModel.find({
      key: { $in: [ipKey, userKey] },
      lockUntil: { $gt: now },
    }).lean();

    if (activeLocks.length > 0) {
      const maxLockUntil = Math.max(...activeLocks.map((l) => l.lockUntil));
      const remainingSeconds = Math.ceil((maxLockUntil - now) / 1000);
      throw new AppError(
        `Too many failed login attempts. Please wait ${remainingSeconds} seconds before trying again.`,
        429
      );
    }

    const userDoc = await UserModel.findOne({
      active: true,
      $or: [
        { username: new RegExp(`^${normalizedIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        { email: normalizedIdentifier },
      ],
    }).lean();

    if (!userDoc || !bcrypt.compareSync(password, userDoc.passwordHash)) {
      let lockedNow = false;

      const incrementKey = async (key: string, maxAttempts: number) => {
        const existing = await LoginAttemptModel.findOne({ key }).lean();
        const isExpired = existing && existing.lockUntil > 0 && existing.lockUntil <= now;
        const count = (existing && !isExpired ? existing.count : 0) + 1;
        const lockUntil = count >= maxAttempts ? now + LOCK_DURATION_MS : 0;
        if (lockUntil > 0) lockedNow = true;
        const expiresAt = new Date(lockUntil > 0 ? lockUntil : now + LOCK_DURATION_MS);

        await LoginAttemptModel.updateOne(
          { key },
          { $set: { count, lockUntil, expiresAt } },
          { upsert: true }
        );
      };

      await incrementKey(ipKey, IP_MAX_ATTEMPTS);
      await incrementKey(userKey, USER_MAX_ATTEMPTS);

      await logAudit(
        lockedNow ? 'SECURITY_LOCKOUT' : 'FAILED_LOGIN_ATTEMPT',
        normalizedIdentifier,
        lockedNow
          ? `Account/IP locked for 15 minutes after repeated failed attempts from IP ${ip}`
          : `Failed login attempt from IP ${ip}`,
        ip
      );
      throw new AppError(
        'Invalid credentials. Please verify your username and password.',
        401
      );
    }

    await LoginAttemptModel.deleteMany({ key: { $in: [ipKey, userKey] } });
    await UserModel.updateOne(
      { id: userDoc.id },
      { $set: { lastLogin: new Date().toISOString() } }
    );

    await logAudit(
      'ADMIN_LOGIN',
      userDoc.username,
      `Successful login by ${userDoc.name} (${userDoc.role})`,
      ip
    );

    const tokenVersion = userDoc.tokenVersion ?? 0;
    const token = jwt.sign(
      {
        id: userDoc.id,
        username: userDoc.username,
        role: userDoc.role,
        name: userDoc.name,
        tokenVersion,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    const cleanUser = cleanDoc<IAdminUser>(userDoc);
    const { passwordHash: _removed, ...safeUser } = cleanUser;
    return { token, user: safeUser };
  },

  async logout(userId: string, username: string) {
    await connectDB();
    await UserModel.updateOne({ id: userId }, { $inc: { tokenVersion: 1 } });
    await logAudit(
      'ADMIN_LOGOUT',
      username,
      'User logged out and active session tokens invalidated'
    );
  },

  async changePassword(userId: string, currentPassword?: string, newPassword?: string) {
    if (!currentPassword) {
      throw new AppError('Current password is required.', 400);
    }
    const validatedPassword = validatePasswordStrength(newPassword);

    await connectDB();
    const user = await UserModel.findOne({ id: userId }).lean();
    if (!user || !bcrypt.compareSync(currentPassword, user.passwordHash)) {
      throw new AppError('Current password is incorrect.', 400);
    }
    if (bcrypt.compareSync(validatedPassword, user.passwordHash)) {
      throw new AppError(
        'New password must be different from your current password.',
        400
      );
    }

    const newHash = bcrypt.hashSync(validatedPassword, 10);
    await UserModel.updateOne(
      { id: userId },
      { $set: { passwordHash: newHash }, $inc: { tokenVersion: 1 } }
    );

    await logAudit(
      'PASSWORD_CHANGED',
      user.username,
      'Password updated and previous sessions invalidated'
    );
  },

  async getAllUsers() {
    await connectDB();
    const users = await UserModel.find({}).lean();
    return cleanDocs<IAdminUser>(users).map(({ passwordHash: _removed, ...safe }) => safe);
  },

  async createUser(
    userData: {
      name?: string;
      email?: string;
      username?: string;
      password?: string;
      role?: string;
    },
    creatorUsername: string
  ) {
    const name = userData.name?.trim();
    const email = userData.email?.trim().toLowerCase();
    const username = userData.username?.trim();
    const role = userData.role?.trim() as (typeof ALLOWED_ROLES)[number] | undefined;

    if (!name || !email || !username || !userData.password || !role) {
      throw new AppError(
        'All fields (name, email, username, password, role) are required.',
        400
      );
    }
    if (!EMAIL_REGEX.test(email)) {
      throw new AppError('Please provide a valid email address.', 400);
    }
    if (!USERNAME_REGEX.test(username)) {
      throw new AppError(
        'Username must be 3-50 characters and contain only letters, numbers, dots, underscores, or hyphens.',
        400
      );
    }
    if (!ALLOWED_ROLES.includes(role)) {
      throw new AppError(
        `Invalid role. Allowed roles: ${ALLOWED_ROLES.join(', ')}.`,
        400
      );
    }

    const validatedPassword = validatePasswordStrength(userData.password);

    await connectDB();
    const existing = await UserModel.findOne({
      $or: [
        { email },
        { username: new RegExp(`^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      ],
    }).lean();

    if (existing) {
      throw new AppError('Username or email already exists.', 400);
    }

    const newUser: IAdminUser = {
      id: `usr_${Date.now()}`,
      name,
      email,
      username,
      passwordHash: bcrypt.hashSync(validatedPassword, 10),
      role,
      active: true,
      tokenVersion: 0,
      createdAt: new Date().toISOString(),
    };

    await UserModel.create(newUser);
    await logAudit('USER_CREATED', creatorUsername, `Created user ${username} (${role})`);

    const { passwordHash: _removed, ...safeUser } = newUser;
    return safeUser;
  },
};
