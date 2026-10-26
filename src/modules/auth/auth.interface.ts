export interface IAdminUser {
  id: string;
  name: string;
  email: string;
  username: string;
  passwordHash: string;
  role: 'superadmin' | 'manager' | 'staff';
  active: boolean;
  lastLogin?: string;
  createdAt: string;
}
