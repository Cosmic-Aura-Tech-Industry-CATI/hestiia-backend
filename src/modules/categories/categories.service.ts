import { db, FoodCategory } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/appError.js';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const categoriesService = {
  async getPublicCategories() {
    const categories = [...db.getState().categories]
      .filter((c) => c.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    return categories;
  },

  async getAdminCategories() {
    const state = db.getState();
    const categoriesWithCount = state.categories.map((cat) => {
      const itemCount = state.dishes.filter((d) => d.category.toLowerCase() === cat.name.toLowerCase()).length;
      return { ...cat, itemCount };
    });

    categoriesWithCount.sort((a, b) => a.displayOrder - b.displayOrder);
    return categoriesWithCount;
  },

  async createCategory(data: { name?: string; description?: string; displayOrder?: number; isActive?: boolean }, username = 'admin') {
    const { name, description, displayOrder, isActive = true } = data;

    if (!name || !name.trim()) {
      throw new AppError('Category name is required.', 400);
    }

    const state = db.getState();
    if (state.categories.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) {
      throw new AppError('A category with this name already exists.', 400);
    }

    const newCat: FoodCategory = {
      id: 'cat-' + slugify(name),
      name: name.trim(),
      slug: slugify(name),
      description: (description || '').trim(),
      displayOrder: displayOrder !== undefined ? Number(displayOrder) : state.categories.length + 1,
      isActive: Boolean(isActive),
    };

    db.updateState((s) => s.categories.push(newCat));
    db.logAudit('CREATE_CATEGORY', username, `Created food category: ${newCat.name}`);

    return newCat;
  },

  async updateCategory(catId: string, data: any, username = 'admin') {
    const { name, description, displayOrder, isActive } = data;

    let updated: FoodCategory | null = null;
    let oldName = '';

    db.updateState((s) => {
      const target = s.categories.find((c) => c.id === catId);
      if (target) {
        oldName = target.name;
        if (name) {
          target.name = name.trim();
          target.slug = slugify(name);
        }
        if (description !== undefined) target.description = description.trim();
        if (displayOrder !== undefined) target.displayOrder = Number(displayOrder);
        if (isActive !== undefined) target.isActive = Boolean(isActive);
        updated = { ...target };

        if (name && oldName && oldName.toLowerCase() !== name.trim().toLowerCase()) {
          s.dishes.forEach((d) => {
            if (d.category.toLowerCase() === oldName.toLowerCase()) {
              d.category = name.trim();
            }
          });
        }
      }
    });

    if (!updated) {
      throw new AppError('Category not found.', 404);
    }

    db.logAudit('UPDATE_CATEGORY', username, `Updated category: ${(updated as FoodCategory).name}`);
    return updated;
  },

  async deleteCategory(catId: string, username = 'admin') {
    const state = db.getState();
    const target = state.categories.find((c) => c.id === catId);

    if (!target) {
      throw new AppError('Category not found.', 404);
    }

    const activeDishes = state.dishes.filter((d) => d.category.toLowerCase() === target.name.toLowerCase());
    if (activeDishes.length > 0) {
      throw new AppError(
        `Cannot delete '${target.name}' because it contains ${activeDishes.length} menu item(s). Reassign or remove these items first.`,
        400
      );
    }

    db.updateState((s) => {
      s.categories = s.categories.filter((c) => c.id !== catId);
    });

    db.logAudit('DELETE_CATEGORY', username, `Deleted empty category: ${target.name}`);
    return { name: target.name };
  },
};
