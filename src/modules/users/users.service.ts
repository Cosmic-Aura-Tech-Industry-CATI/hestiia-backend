import authService from '../auth/auth.service.js';
import { userRepository } from './user.repository.js';
import type { IUser, UserRole, UserStatus } from './user.interface.js';

export const usersService = {
  async getUsers(query: { role?: string; status?: string; page?: number; limit?: number }) {
    return authService.getUsers(query);
  },

  async getUserById(id: string) {
    return authService.getUserById(id);
  },

  async createUser(userData: any, actorUser: any) {
    return authService.createUser(userData, actorUser);
  },

  async updateUser(id: string, updateData: { name?: string; email?: string }, actorUser: any) {
    return authService.updateUser(id, updateData, actorUser);
  },

  async updateUserRole(id: string, newRole: string, actorUser: any) {
    return authService.updateUserRole(id, newRole, actorUser);
  },

  async updateUserStatus(id: string, newStatus: string, actorUser: any) {
    return authService.updateUserStatus(id, newStatus, actorUser);
  },

  async deleteUser(id: string, actorUser: any) {
    return authService.deleteUser(id, actorUser);
  },

  async getStatus() {
    const activeSuperadmins = await userRepository.countActiveSuperadmins();
    return {
      module: 'users',
      status: 'operational',
      activeSuperadmins,
      timestamp: new Date().toISOString(),
    };
  },
};

export default usersService;
