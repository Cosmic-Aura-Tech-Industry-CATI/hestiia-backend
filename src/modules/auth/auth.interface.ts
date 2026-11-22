import { UserRole, UserStatus } from '../users/user.interface.js';

export { UserRole, UserStatus };

export interface IAdminUser {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: UserRole;
  status: UserStatus;
  tokenVersion?: number;
  lastLogin?: string | Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  success: boolean;
  requireOtp: boolean;
  email: string;
  maskedEmail: string;
  expiresInSeconds: number;
  message: string;
  devOtp?: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  token: string;
  refreshToken?: string;
  user: IAdminUser;
}
