import mongoose from 'mongoose';
import { Category, type ICategoryDocument } from './category.model.js';
import { MenuItem } from '../menu/menu.model.js';
import { db } from '../../shared/config/store.js';
import { AppError } from '../../shared/utils/appError.js';

export const categoriesService = {
  /**
   * Format document with clean string ID and timestamps
   */
  formatCategory(doc: any) {
    const id = doc?._id ? doc._id.toString() : (doc?.id || '');
    return {
      id,
      _id: doc?._id || id,
      name: doc?.name || '',
      description: doc?.description || '',
      displayOrder: doc?.displayOrder ?? 0,
      isActive: doc?.isActive ?? true,
      createdAt: doc?.createdAt,
      updatedAt: doc?.updatedAt,
    };
  },

  /**
   * Fast lookup helper for category by ID or name
   */
  async findCategoryDoc(idOrName: string) {
    if (mongoose.Types.ObjectId.isValid(idOrName)) {
      const doc = await Category.findById(idOrName);
      if (doc) return doc;
    }
    return Category.findOne({
      name: { $regex: new RegExp(`^${idOrName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') },
    });
  },

  /**
   * Get single category by ID
   */
  async getCategoryById(id: string) {
    const category = await this.findCategoryDoc(id);
    if (!category) {
      throw new AppError('Category not found.', 404);
    }
    return this.formatCategory(category);
  },

  /**
   * 1. Public Categories (Optimized query: active only, sorted by displayOrder asc, lean execution)
   */
  async getPublicCategories() {
    const categories = await Category.find({ isActive: true })
      .select('name description displayOrder isActive createdAt updatedAt')
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();

    return categories.map((c) => this.formatCategory(c));
  },

  /**
   * 2. Admin Categories (Optimized query: all categories with associated dish count, lean execution)
   */
  async getAdminCategories() {
    const categories = await Category.find()
      .select('name description displayOrder isActive createdAt updatedAt')
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();

    // High-performance aggregation: count dishes per category directly from MongoDB Atlas
    const dishCounts = await MenuItem.aggregate([
      {
        $group: {
          _id: { $toLower: '$category' },
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = new Map<string, number>();
    for (const item of dishCounts) {
      if (item._id) countMap.set(item._id, item.count);
    }

    return categories.map((cat: any) => {
      const catNameLow = (cat.name || '').toLowerCase();
      const itemCount = countMap.get(catNameLow) || 0;

      return {
        ...this.formatCategory(cat),
        itemCount,
      };
    });
  },

  /**
   * 3. Create Category (Direct MongoDB Atlas insertion with optimized duplicate checking)
   */
  async createCategory(
    data: { name?: string; description?: string; displayOrder?: number; isActive?: boolean },
    username = 'admin'
  ) {
    const { name, description, displayOrder, isActive = true } = data;

    if (!name || !name.trim()) {
      throw new AppError('Category name is required.', 400);
    }

    const cleanName = name.trim();

    // Optimized check: verify duplicate name using case-insensitive collation or regex index
    const exists = await Category.findOne({
      name: { $regex: new RegExp(`^${cleanName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') },
    })
      .select('_id')
      .lean();

    if (exists) {
      throw new AppError(`A category named '${cleanName}' already exists in the database.`, 409);
    }

    // Auto-calculate next displayOrder if not provided
    let order = displayOrder;
    if (order === undefined || order === null) {
      const highest = await Category.findOne()
        .sort({ displayOrder: -1 })
        .select('displayOrder')
        .lean();
      order = highest ? (highest.displayOrder ?? 0) + 1 : 1;
    } else {
      const num = Number(order);
      if (isNaN(num) || num < 0) {
        throw new AppError('displayOrder must be a non-negative number.', 400);
      }
      order = num;
    }

    try {
      const category = await Category.create({
        name: cleanName,
        description: (description || '').trim(),
        displayOrder: Number(order),
        isActive: Boolean(isActive),
      });

      db.logAudit('CREATE_CATEGORY', username, `Created category in database: ${category.name}`);
      return this.formatCategory(category.toJSON());
    } catch (err: any) {
      if (err.code === 11000) {
        throw new AppError(`A category with this name already exists.`, 409);
      }
      throw err;
    }
  },

  /**
   * 4. Update Category (Optimized findByIdAndUpdate in MongoDB Atlas)
   */
  async updateCategory(catId: string, data: any, username = 'admin') {
    const { name, description, displayOrder, isActive } = data;

    const category = await this.findCategoryDoc(catId);
    if (!category) {
      throw new AppError('Category not found.', 404);
    }

    const updateFields: any = {};

    if (name !== undefined) {
      const cleanName = name.trim();
      if (!cleanName) {
        throw new AppError('Category name cannot be empty.', 400);
      }

      const duplicate = await Category.findOne({
        _id: { $ne: category._id },
        name: { $regex: new RegExp(`^${cleanName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') },
      })
        .select('_id')
        .lean();

      if (duplicate) {
        throw new AppError(`A category named '${cleanName}' already exists.`, 409);
      }

      updateFields.name = cleanName;
    }

    if (description !== undefined) {
      updateFields.description = description.trim();
    }

    if (displayOrder !== undefined) {
      const num = Number(displayOrder);
      if (isNaN(num) || num < 0) {
        throw new AppError('displayOrder must be a non-negative number.', 400);
      }
      updateFields.displayOrder = num;
    }

    if (isActive !== undefined) {
      updateFields.isActive = Boolean(isActive);
    }

    try {
      const updated = await Category.findByIdAndUpdate(
        category._id,
        { $set: updateFields },
        { returnDocument: 'after', runValidators: true }
      ).lean();

      if (!updated) {
        throw new AppError('Failed to update category.', 500);
      }

      db.logAudit('UPDATE_CATEGORY', username, `Updated category in database: ${updated.name}`);
      return this.formatCategory(updated);
    } catch (err: any) {
      if (err.code === 11000) {
        throw new AppError(`A category with this name already exists.`, 409);
      }
      throw err;
    }
  },

  /**
   * 5. Delete Category (Guards against deleting if dishes exist, then executes direct MongoDB delete)
   */
  async deleteCategory(catId: string, username = 'admin') {
    const category = await this.findCategoryDoc(catId);
    if (!category) {
      throw new AppError('Category not found.', 404);
    }

    const targetName = category.name;
    const catIdStr = category._id.toString();

    // Check if dishes in MongoDB Atlas are currently associated with this category
    const activeDishesCount = await MenuItem.countDocuments({
      category: { $regex: new RegExp(`^${targetName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') },
    });

    if (activeDishesCount > 0) {
      throw new AppError(
        `Cannot delete '${targetName}' because it contains ${activeDishesCount} menu item(s). Reassign or remove these items first.`,
        400
      );
    }

    await Category.findByIdAndDelete(category._id).lean();

    db.logAudit('DELETE_CATEGORY', username, `Deleted category from database: ${targetName}`);
    return { id: catIdStr, name: targetName };
  },
};
