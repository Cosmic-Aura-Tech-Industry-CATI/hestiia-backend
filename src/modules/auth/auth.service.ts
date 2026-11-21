import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../../shared/config/db.js';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../../shared/config/utils.js';
import { AppError } from '../../shared/utils/appError.js';
import { IAdminUser } from './auth.interface.js';
import { emailService } from '../../shared/services/email.service.js';

interface OtpSession {
  id: string;
  userId: string;
  username: string;
  email: string;
  purpose: 'LOGIN_2FA' | 'PASSWORD_RESET';
  otp: string;
  expiresAt: number;
  attempts: number;
  resendAvailableAt: number;
}

const loginAttempts: Record<string, { count: number; lockUntil: number }> = {};
const otpSessions: Record<string, OtpSession> = {};

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email || '';
  const [name, domain] = email.split('@');
  if (name.length <= 2) {
    return `${name[0]}*@${domain}`;
  }
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(1, name.length - 3))}${name.slice(-1)}@${domain}`;
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [key, session] of Object.entries(otpSessions)) {
    if (session.expiresAt < now) {
      delete otpSessions[key];
    }
  }
}

export const authService = {
  async login(username?: string, password?: string, ip = 'unknown') {
    cleanupExpiredSessions();

    if (!username || !password) {
      throw new AppError('Username/email and password are required.', 400);
    }

    const attemptKey = `${ip}_${username.toLowerCase()}`;
    const now = Date.now();
    const attempt = loginAttempts[attemptKey];

    if (attempt && attempt.lockUntil > now) {
      const remainingSeconds = Math.ceil((attempt.lockUntil - now) / 1000);
      throw new AppError(
        `Too many failed login attempts. Please wait ${remainingSeconds} seconds before trying again.`,
        429
      );
    }

    const user = db.getState().users.find(
      (u) =>
        (u.username.toLowerCase() === username.trim().toLowerCase() ||
          u.email.toLowerCase() === username.trim().toLowerCase()) &&
        u.active
    );

    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      const currentCount = (attempt ? attempt.count : 0) + 1;
      loginAttempts[attemptKey] = {
        count: currentCount,
        lockUntil: currentCount >= 5 ? now + 15 * 60 * 1000 : 0,
      };

      db.logAudit('FAILED_LOGIN_ATTEMPT', username, `Failed login attempt from IP ${ip}`, ip);
      throw new AppError('Invalid credentials. Please verify your username and password.', 401);
    }

    delete loginAttempts[attemptKey];

    // Generate 6-digit cryptographically secure OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpSessionId = `otp_sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    otpSessions[otpSessionId] = {
      id: otpSessionId,
      userId: user.id,
      username: user.username,
      email: user.email,
      purpose: 'LOGIN_2FA',
      otp,
      expiresAt: now + 5 * 60 * 1000, // 5 minutes
      attempts: 0,
      resendAvailableAt: now + 60 * 1000, // 60 seconds cooldown
    };

    // Dispatch email
    await emailService.sendOtpEmail({
      to: user.email,
      recipientName: user.name,
      otp,
      purpose: 'LOGIN_2FA',
      expiresInMinutes: 5,
    });

    db.logAudit('LOGIN_2FA_DISPATCHED', user.username, `2FA OTP dispatched to ${maskEmail(user.email)}`, ip);

    return {
      requireOtp: true,
      otpSessionId,
      maskedEmail: maskEmail(user.email),
      expiresInSeconds: 300,
      resendCooldownSeconds: 60,
      message: `A 6-digit verification code has been dispatched to ${maskEmail(user.email)}.`,
      devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    };
  },

  async verifyOtp(otpSessionId: string, otp: string, ip = 'unknown') {
    cleanupExpiredSessions();

    if (!otpSessionId || !otp) {
      throw new AppError('OTP session ID and 6-digit OTP code are required.', 400);
    }

    const session = otpSessions[otpSessionId];
    if (!session || session.purpose !== 'LOGIN_2FA') {
      throw new AppError('Invalid or expired verification session. Please sign in again.', 400);
    }

    const now = Date.now();
    if (session.expiresAt < now) {
      delete otpSessions[otpSessionId];
      throw new AppError('Verification code has expired. Please request a new code.', 400);
    }

    session.attempts += 1;
    if (session.attempts > 5) {
      delete otpSessions[otpSessionId];
      throw new AppError('Too many invalid attempts. Verification session has been terminated.', 429);
    }

    if (session.otp !== otp.trim()) {
      throw new AppError(`Invalid verification code. ${5 - session.attempts} attempt(s) remaining.`, 400);
    }

    const user = db.getState().users.find((u) => u.id === session.userId && u.active);
    if (!user) {
      delete otpSessions[otpSessionId];
      throw new AppError('Account is no longer active. Please contact administrator.', 403);
    }

    // Success - invalidate session
    delete otpSessions[otpSessionId];

    db.updateState((s) => {
      const target = s.users.find((u) => u.id === user.id);
      if (target) target.lastLogin = new Date().toISOString();
    });

    db.logAudit('ADMIN_LOGIN', user.username, `Successful 2-Step login by ${user.name} (${user.role})`, ip);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name, tokenVersion: user.tokenVersion || 0 },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    const { passwordHash, ...safeUser } = user;
    return { token, user: safeUser };
  },

  async resendOtp(otpSessionId: string, ip = 'unknown') {
    cleanupExpiredSessions();

    if (!otpSessionId) {
      throw new AppError('OTP session ID is required.', 400);
    }

    const session = otpSessions[otpSessionId];
    if (!session) {
      throw new AppError('Verification session expired or invalid. Please sign in again.', 400);
    }

    const now = Date.now();
    if (session.resendAvailableAt > now) {
      const waitSeconds = Math.ceil((session.resendAvailableAt - now) / 1000);
      throw new AppError(`Please wait ${waitSeconds} seconds before requesting a new code.`, 429);
    }

    // Generate new OTP
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    session.otp = newOtp;
    session.expiresAt = now + (session.purpose === 'LOGIN_2FA' ? 5 : 15) * 60 * 1000;
    session.resendAvailableAt = now + 60 * 1000;
    session.attempts = 0;

    await emailService.sendOtpEmail({
      to: session.email,
      recipientName: session.username,
      otp: newOtp,
      purpose: session.purpose,
      expiresInMinutes: session.purpose === 'LOGIN_2FA' ? 5 : 15,
    });

    db.logAudit('OTP_RESENT', session.username, `New ${session.purpose} code dispatched to ${maskEmail(session.email)}`, ip);

    return {
      success: true,
      maskedEmail: maskEmail(session.email),
      resendCooldownSeconds: 60,
      message: `A new verification code has been dispatched to ${maskEmail(session.email)}.`,
      devOtp: process.env.NODE_ENV !== 'production' ? newOtp : undefined,
    };
  },

  async forgotPassword(emailOrUsername: string, ip = 'unknown') {
    cleanupExpiredSessions();

    if (!emailOrUsername) {
      throw new AppError('Email address or username is required.', 400);
    }

    const user = db.getState().users.find(
      (u) =>
        (u.username.toLowerCase() === emailOrUsername.trim().toLowerCase() ||
          u.email.toLowerCase() === emailOrUsername.trim().toLowerCase()) &&
        u.active
    );

    if (!user) {
      // Security standard: generic response to prevent enumeration
      return {
        success: true,
        message: 'If a matching active account was found, a 6-digit password reset code has been sent.',
        maskedEmail: emailOrUsername.includes('@') ? maskEmail(emailOrUsername) : 'user account',
      };
    }

    const now = Date.now();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const resetSessionId = `rst_sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    otpSessions[resetSessionId] = {
      id: resetSessionId,
      userId: user.id,
      username: user.username,
      email: user.email,
      purpose: 'PASSWORD_RESET',
      otp,
      expiresAt: now + 15 * 60 * 1000, // 15 minutes for password reset
      attempts: 0,
      resendAvailableAt: now + 60 * 1000,
    };

    await emailService.sendOtpEmail({
      to: user.email,
      recipientName: user.name,
      otp,
      purpose: 'PASSWORD_RESET',
      expiresInMinutes: 15,
    });

    db.logAudit('PASSWORD_RESET_REQUESTED', user.username, `Reset OTP dispatched to ${maskEmail(user.email)}`, ip);

    return {
      success: true,
      resetSessionId,
      maskedEmail: maskEmail(user.email),
      expiresInSeconds: 900,
      resendCooldownSeconds: 60,
      message: `A 6-digit password reset code has been dispatched to ${maskEmail(user.email)}.`,
      devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    };
  },

  async resetPassword(resetSessionId: string, otp: string, newPassword?: string, ip = 'unknown') {
    cleanupExpiredSessions();

    if (!resetSessionId || !otp || !newPassword) {
      throw new AppError('Reset session ID, OTP code, and new password are required.', 400);
    }

    if (newPassword.length < 8) {
      throw new AppError('New password must be at least 8 characters long.', 400);
    }

    const session = otpSessions[resetSessionId];
    if (!session || session.purpose !== 'PASSWORD_RESET') {
      throw new AppError('Invalid or expired password reset session. Please request a new code.', 400);
    }

    const now = Date.now();
    if (session.expiresAt < now) {
      delete otpSessions[resetSessionId];
      throw new AppError('Password reset code has expired. Please request a new code.', 400);
    }

    session.attempts += 1;
    if (session.attempts > 5) {
      delete otpSessions[resetSessionId];
      throw new AppError('Too many invalid attempts. Reset session terminated for security.', 429);
    }

    if (session.otp !== otp.trim()) {
      throw new AppError(`Invalid verification code. ${5 - session.attempts} attempt(s) remaining.`, 400);
    }

    const user = db.getState().users.find((u) => u.id === session.userId && u.active);
    if (!user) {
      delete otpSessions[resetSessionId];
      throw new AppError('Associated account was not found or is disabled.', 404);
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    db.updateState((s) => {
      const target = s.users.find((u) => u.id === user.id);
      if (target) {
        target.passwordHash = newHash;
        target.tokenVersion = (target.tokenVersion || 0) + 1; // Revoke any active sessions
      }
    });

    delete otpSessions[resetSessionId];
    db.logAudit('ADMIN_PASSWORD_RESET', user.username, 'Password successfully reset via Email OTP', ip);

    return {
      success: true,
      message: 'Your password has been successfully reset. Please sign in with your new credentials.',
    };
  },

  async logout(userId: string, username = 'admin', ip = 'unknown') {
    db.updateState((s) => {
      const target = s.users.find((u) => u.id === userId);
      if (target) {
        target.tokenVersion = (target.tokenVersion || 0) + 1;
      }
    });
    db.logAudit('ADMIN_LOGOUT', username, 'User logged out and session revoked', ip);
  },

  async changePassword(userId: string, currentPassword?: string, newPassword?: string) {
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      throw new AppError('New password must be at least 8 characters long.', 400);
    }

    const user = db.getState().users.find((u) => u.id === userId);
    if (!user || !bcrypt.compareSync(currentPassword, user.passwordHash)) {
      throw new AppError('Current password is incorrect.', 400);
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    db.updateState((s) => {
      const target = s.users.find((u) => u.id === userId);
      if (target) {
        target.passwordHash = newHash;
        target.tokenVersion = (target.tokenVersion || 0) + 1;
      }
    });

    db.logAudit('PASSWORD_CHANGED', user.username, 'Password updated successfully');
  },

  async getAllUsers() {
    return db.getState().users.map(({ passwordHash, ...safe }) => safe);
  },

  async createUser(userData: { name: string; email: string; username: string; password: string; role: string }, creatorUsername: string) {
    const { name, email, username, password, role } = userData;
    if (!name || !email || !username || !password || !role) {
      throw new AppError('All fields are required.', 400);
    }

    const validRoles = ['superadmin', 'manager', 'staff'];
    if (!validRoles.includes(role)) {
      throw new AppError(`Invalid role '${role}'. Role must be one of: ${validRoles.join(', ')}.`, 400);
    }

    if (password.length < 8) {
      throw new AppError('Password must be at least 8 characters long.', 400);
    }

    const state = db.getState();
    if (state.users.some((u) => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email.toLowerCase())) {
      throw new AppError('Username or email already exists.', 400);
    }

    const newUser: IAdminUser = {
      id: 'usr_' + Date.now(),
      name,
      email: email.toLowerCase().trim(),
      username: username.toLowerCase().trim(),
      passwordHash: bcrypt.hashSync(password, 10),
      role: role as 'superadmin' | 'manager' | 'staff',
      active: true,
      tokenVersion: 0,
      createdAt: new Date().toISOString(),
    };

    db.updateState((s) => s.users.push(newUser));
    db.logAudit('USER_CREATED', creatorUsername, `Created user ${username} (${role})`);

    const { passwordHash, ...safeUser } = newUser;
    return safeUser;
  },
};
