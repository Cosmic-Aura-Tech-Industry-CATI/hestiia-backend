import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../../shared/config/db.js';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../../shared/config/utils.js';
import { AppError } from '../../shared/utils/appError.js';
import { IAdminUser } from './auth.interface.js';

const loginAttempts: Record<string, { count: number; lockUntil: number }> = {};

export const authService = {
  async login(username?: string, password?: string, ip = 'unknown') {
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

    db.updateState((s) => {
      const target = s.users.find((u) => u.id === user.id);
      if (target) target.lastLogin = new Date().toISOString();
    });

    db.logAudit('ADMIN_LOGIN', user.username, `Successful login by ${user.name} (${user.role})`, ip);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name, tokenVersion: user.tokenVersion || 0 },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    const { passwordHash, ...safeUser } = user;
    return { token, user: safeUser };
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
