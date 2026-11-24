import User from './user.model.js';
import { IUser, IUserDocument, IUserRepository, UserRole, UserStatus } from './user.interface.js';

export class UserRepository implements IUserRepository {
  async findByEmail(email: string, selectPassword = false): Promise<IUserDocument | null> {
    const query = User.findOne({ email: email.toLowerCase().trim() });
    if (selectPassword) query.select('+password +passwordHash');
    return await query.exec();
  }

  async findById(id: string, selectPassword = false): Promise<IUserDocument | null> {
    const query = User.findById(id);
    if (selectPassword) query.select('+password +passwordHash');
    return await query.exec();
  }

  async findByUsernameOrEmail(identifier: string, selectPassword = false): Promise<IUserDocument | null> {
    const clean = identifier.toLowerCase().trim();
    const query = User.findOne({
      $or: [{ email: clean }, { username: clean }],
    });
    if (selectPassword) query.select('+password +passwordHash');
    return await query.exec();
  }

  async findUsers(
    filter: any = {},
    skip = 0,
    limit = 50
  ): Promise<{ users: IUserDocument[]; total: number }> {
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      User.countDocuments(filter).exec(),
    ]);
    return { users, total };
  }

  async createUser(userData: Partial<IUser>): Promise<IUserDocument> {
    const newUser = new User(userData);
    return await newUser.save();
  }

  async updateUser(id: string, updateData: Partial<IUser>): Promise<IUserDocument | null> {
    const user = await User.findById(id);
    if (!user) return null;

    Object.assign(user, updateData);
    return await user.save();
  }

  async countActiveSuperadmins(): Promise<number> {
    return await User.countDocuments({
      role: { $in: ['ADMIN', 'SUPERADMIN', 'MANAGER'] },
      status: 'ACTIVE',
    }).exec();
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await User.findByIdAndDelete(id).exec();
    return !!result;
  }
}

export const userRepository = new UserRepository();
export default userRepository;
