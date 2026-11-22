import mongoose from 'mongoose';
import { Category, type ICategoryDocument } from './category.model.js';
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
    if (mongoose.connection.readyState === 1) {
      try {
        if (mongoose.Types.ObjectId.isValid(idOrName)) {
          const doc = await Category.findById(idOrName);
          if (doc) return doc;
        }
        const docByName = await Category.findOne({
          name: { $regex: new RegExp(`^${idOrName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') },
        });
        if (docByName) return docByName;
      } catch {
        // Fall back to local store
      }
    }
    const local = (db.getState().categories || []).find(
      (c) => c.id === idOrName || (c as any)._id === idOrName || c.name.toLowerCase() === idOrName.toLowerCase()
    );
    return local || null;
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
    if (mongoose.connection.readyState === 1) {
      try {
        const categories = await Category.find({ isActive: true })
          .select('name description displayOrder isActive createdAt updatedAt')
          .sort({ displayOrder: 1, createdAt: 1 })
          .lean();

        if (categories && categories.length > 0) {
          return categories.map((c) => this.formatCategory(c));
        }
      } catch (err) {
        console.warn('[CategoriesService] Mongoose error, falling back to local store:', err);
      }
    }

    const localCategories = (db.getState().categories || []).filter((c) => c.isActive !== false);
    return localCategories.map((c) => this.formatCategory(c));
  },

  /**
   * 2. Admin Categories (Optimized query: all categories with associated dish count, lean execution)
   */
  async getAdminCategories() {
    const dishes = db.getState().dishes || [];

    if (mongoose.connection.readyState === 1) {
      try {
        const categories = await Category.find()
          .select('name description displayOrder isActive createdAt updatedAt')
          .sort({ displayOrder: 1, createdAt: 1 })
          .lean();

        if (categories && categories.length > 0) {
          return categories.map((cat: any) => {
            const catIdStr = cat._id ? cat._id.toString() : cat.id;
            const catNameLow = (cat.name || '').toLowerCase();

            const itemCount = dishes.filter(
              (d) =>
                (d.category && d.category.toLowerCase() === catNameLow) ||
                (d as any).categoryId === catIdStr
            ).length;

            return {
              ...this.formatCategory(cat),
              itemCount,
            };
          });
        }
      } catch (err) {
        console.warn('[CategoriesService] Mongoose error, falling back to local store:', err);
      }
    }

    const localCategories = db.getState().categories || [];
    return localCategories.map((cat: any) => {
      const catIdStr = cat._id ? cat._id.toString() : cat.id;
      const catNameLow = (cat.name || '').toLowerCase();

      const itemCount = dishes.filter(
        (d) =>
          (d.category && d.category.toLowerCase() === catNameLow) ||
          (d as any).categoryId === catIdStr
      ).length;

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

    if (mongoose.connection.readyState === 1) {
      try {
        const category = await Category.create({
          name: cleanName,
          description: (description || '').trim(),
          displayOrder: Number(order),
          isActive: Boolean(isActive),
        });

        db.updateState((state) => {
          state.categories.push({
            id: String(category._id),
            name: category.name,
            slug: category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            description: category.description || '',
            displayOrder: category.displayOrder,
            isActive: category.isActive,
          });
        });

        db.logAudit('CREATE_CATEGORY', username, `Created category in database: ${category.name}`);
        return this.formatCategory(category.toJSON());
      } catch (err: any) {
        if (err.code === 11000) {
          throw new AppError(`A category with this name already exists.`, 409);
        }
        throw err;
      }
    }

    // Local store mode
    const newCat = {
      id: 'cat_' + Date.now(),
      name: cleanName,
      slug: cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: (description || '').trim(),
      displayOrder: Number(order),
      isActive: Boolean(isActive),
    };
    db.updateState((state) => {
      state.categories.push(newCat);
    });
    db.logAudit('CREATE_CATEGORY', username, `Created category in local store: ${newCat.name}`);
    return this.formatCategory(newCat);
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

    const targetId = (category as any)._id ? String((category as any)._id) : String((category as any).id);
    const updateFields: any = {};

    if (name !== undefined) {
      const cleanName = name.trim();
      if (!cleanName) {
        throw new AppError('Category name cannot be empty.', 400);
      }

      if (mongoose.connection.readyState === 1 && (category as any)._id) {
        const duplicate = await Category.findOne({
          _id: { $ne: (category as any)._id },
          name: { $regex: new RegExp(`^${cleanName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') },
        })
          .select('_id')
          .lean();

        if (duplicate) {
          throw new AppError(`A category named '${cleanName}' already exists.`, 409);
        }
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

    if (mongoose.connection.readyState === 1 && (category as any)._id) {
      try {
        const updated = await Category.findByIdAndUpdate(
          (category as any)._id,
          { $set: updateFields },
          { returnDocument: 'after', runValidators: true }
        ).lean();

        if (updated) {
          db.updateState((state) => {
            const idx = state.categories.findIndex((c) => c.id === targetId || (c as any)._id === targetId);
            if (idx !== -1) {
              state.categories[idx] = {
                ...state.categories[idx],
                ...updateFields,
              };
            }
          });
          db.logAudit('UPDATE_CATEGORY', username, `Updated category: ${updated.name}`);
          return this.formatCategory(updated);
        }
      } catch (err: any) {
        if (err.code === 11000) {
          throw new AppError(`A category with this name already exists.`, 409);
        }
        throw err;
      }
    }

    // Local store mode update
    let updatedLocal: any;
    db.updateState((state) => {
      const idx = state.categories.findIndex((c) => c.id === targetId || (c as any)._id === targetId);
      if (idx !== -1) {
        state.categories[idx] = {
          ...state.categories[idx],
          ...updateFields,
        };
        updatedLocal = state.categories[idx];
      }
    });
    if (!updatedLocal) throw new AppError('Failed to update category.', 500);
    db.logAudit('UPDATE_CATEGORY', username, `Updated category: ${updatedLocal.name}`);
    return this.formatCategory(updatedLocal);
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
    const catIdStr = String((category as any)._id || (category as any).id);

    // Check if dishes are currently associated with this category
    const dishes = db.getState().dishes || [];
    const activeDishes = dishes.filter(
      (d) =>
        (d.category && d.category.toLowerCase() === targetName.toLowerCase()) ||
        (d as any).categoryId === catIdStr
    );

    if (activeDishes.length > 0) {
      throw new AppError(
        `Cannot delete '${targetName}' because it contains ${activeDishes.length} menu item(s). Reassign or remove these items first.`,
        400
      );
    }

    if (mongoose.connection.readyState === 1 && (category as any)._id) {
      await Category.findByIdAndDelete((category as any)._id).lean();
    }

    db.updateState((state) => {
      state.categories = state.categories.filter((c) => c.id !== catIdStr && (c as any)._id !== catIdStr);
    });

    db.logAudit('DELETE_CATEGORY', username, `Deleted category: ${targetName}`);
    return { id: catIdStr, name: targetName };
  },
};
