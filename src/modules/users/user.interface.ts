import { Document } from 'mongoose';

export type UserRole = 'ADMIN' | 'SUPERADMIN' | 'MANAGER' | 'STAFF' | 'CUSTOMER';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface IUser {
  id?: string;
  name: string;
  email: string;
  username?: string;
  password?: string;
  passwordHash?: string;
  role: UserRole;
  status: UserStatus;
  tokenVersion: number;
  lastLogin?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserDocument extends Document {
  name: string;
  email: string;
  username?: string;
  password?: string;
  passwordHash?: string;
  role: UserRole;
  status: UserStatus;
  tokenVersion: number;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface IUserRepository {
  findByEmail(email: string, selectPassword?: boolean): Promise<IUserDocument | null>;
  findById(id: string, selectPassword?: boolean): Promise<IUserDocument | null>;
  findByUsernameOrEmail(identifier: string, selectPassword?: boolean): Promise<IUserDocument | null>;
  findUsers(query: any, skip?: number, limit?: number): Promise<{ users: IUserDocument[]; total: number }>;
  createUser(userData: Partial<IUser>): Promise<IUserDocument>;
  updateUser(id: string, updateData: Partial<IUser>): Promise<IUserDocument | null>;
  countActiveSuperadmins(): Promise<number>;
  deleteUser(id: string): Promise<boolean>;
}
