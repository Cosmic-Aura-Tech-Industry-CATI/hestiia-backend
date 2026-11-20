import { AppError } from '@/lib/errors';
import { connectDB } from '@/lib/mongodb';
import { logAudit } from '@/lib/audit';
import { escapeRegex, slugify } from '@/lib/regex';
import { CategoryModel, IFoodCategory } from '@/models/Category.model';
import { DishModel } from '@/models/Dish.model';
import { cleanDoc, cleanDocs } from '@/models/_schema';

export const categoriesService = {
  async getPublicCategories() {
    await connectDB();
    const categories = await CategoryModel.find({ isActive: true })
      .sort({ displayOrder: 1 })
      .lean();
    return cleanDocs<IFoodCategory>(categories);
  },

  async getAdminCategories() {
    await connectDB();
    const [categories, dishes] = await Promise.all([
      CategoryModel.find({}).sort({ displayOrder: 1 }).lean(),
      DishModel.find({}, { category: 1 }).lean(),
    ]);

    return cleanDocs<IFoodCategory>(categories).map((cat) => {
      const itemCount = dishes.filter(
        (d) => d.category.toLowerCase() === cat.name.toLowerCase()
      ).length;
      return { ...cat, itemCount };
    });
  },

  async createCategory(
    data: { name?: string; description?: string; displayOrder?: number; isActive?: boolean },
    username = 'admin'
  ) {
    const { name, description, displayOrder, isActive = true } = data;
    if (!name || !name.trim()) {
      throw new AppError('Category name is required.', 400);
    }

    await connectDB();
    const trimmedName = name.trim();
    const duplicate = await CategoryModel.findOne({
      name: new RegExp(`^${escapeRegex(trimmedName)}$`, 'i'),
    }).lean();

    if (duplicate) {
      throw new AppError('A category with this name already exists.', 400);
    }

    const total = await CategoryModel.countDocuments();
    const newCat: IFoodCategory = {
      id: `cat-${slugify(trimmedName)}`,
      name: trimmedName,
      slug: slugify(trimmedName),
      description: (description || '').trim(),
      displayOrder: displayOrder !== undefined ? Number(displayOrder) : total + 1,
      isActive: Boolean(isActive),
    };

    await CategoryModel.create(newCat);
    await logAudit('CREATE_CATEGORY', username, `Created food category: ${newCat.name}`);
    return newCat;
  },

  async updateCategory(catId: string, data: any, username = 'admin') {
    await connectDB();
    const existing = await CategoryModel.findOne({ id: catId }).lean();
    if (!existing) {
      throw new AppError('Category not found.', 404);
    }

    const { name, description, displayOrder, isActive } = data;
    const updates: Record<string, any> = {};
    if (name) {
      updates.name = String(name).trim();
      updates.slug = slugify(name);
    }
    if (description !== undefined) updates.description = String(description).trim();
    if (displayOrder !== undefined) updates.displayOrder = Number(displayOrder);
    if (isActive !== undefined) updates.isActive = Boolean(isActive);

    const updated = await CategoryModel.findOneAndUpdate(
      { id: catId },
      { $set: updates },
      { new: true }
    ).lean();

    if (name && existing.name.toLowerCase() !== String(name).trim().toLowerCase()) {
      await DishModel.updateMany(
        { category: new RegExp(`^${escapeRegex(existing.name)}$`, 'i') },
        { $set: { category: String(name).trim() } }
      );
    }

    const clean = cleanDoc<IFoodCategory>(updated);
    await logAudit('UPDATE_CATEGORY', username, `Updated category: ${clean.name}`);
    return clean;
  },

  async deleteCategory(catId: string, username = 'admin') {
    await connectDB();
    const target = await CategoryModel.findOne({ id: catId }).lean();
    if (!target) {
      throw new AppError('Category not found.', 404);
    }

    const activeCount = await DishModel.countDocuments({
      category: new RegExp(`^${escapeRegex(target.name)}$`, 'i'),
    });

    if (activeCount > 0) {
      throw new AppError(
        `Cannot delete '${target.name}' because it contains ${activeCount} menu item(s). Reassign or remove these items first.`,
        400
      );
    }

    await CategoryModel.deleteOne({ id: catId });
    await logAudit('DELETE_CATEGORY', username, `Deleted empty category: ${target.name}`);
    return { name: target.name };
  },
};
