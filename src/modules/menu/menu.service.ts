import { db, FoodItem } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/appError.js';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const menuService = {
  async getPublicMenu(query: { category?: string; isVeg?: string; search?: string; availableOnly?: string }) {
    const { category, isVeg, search, availableOnly } = query;
    let items = [...db.getState().dishes];

    if (availableOnly !== 'false') {
      items = items.filter((d) => d.available);
    }

    if (category && category !== 'All') {
      const catLow = String(category).toLowerCase();
      items = items.filter(
        (d) =>
          d.category.toLowerCase() === catLow ||
          d.category.toLowerCase().replace(/[^a-z0-9]+/g, '-') === catLow ||
          (d as any).categoryId?.toLowerCase() === catLow
      );
    }

    if (isVeg !== undefined) {
      items = items.filter((d) => d.isVeg === (isVeg === 'true'));
    }

    if (search) {
      const q = String(search).toLowerCase();
      items = items.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          d.ingredients.some((ing) => ing.toLowerCase().includes(q))
      );
    }

    items.sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99));
    return { total: items.length, dishes: items };
  },

  async getDishById(id: string) {
    const dish = db.getState().dishes.find((d) => d.id === id || d.slug === id);
    if (!dish) {
      throw new AppError('Food item not found.', 404);
    }
    return dish;
  },

  async getAdminDishes(query: { category?: string; search?: string; available?: string; page?: string; limit?: string }) {
    const { category, search, available, page = '1', limit = '50' } = query;
    let dishes = [...db.getState().dishes];

    if (category && category !== 'All') {
      const catLow = String(category).toLowerCase();
      dishes = dishes.filter(
        (d) =>
          d.category.toLowerCase() === catLow ||
          d.category.toLowerCase().replace(/[^a-z0-9]+/g, '-') === catLow ||
          (d as any).categoryId?.toLowerCase() === catLow
      );
    }

    if (available !== undefined && available !== 'all') {
      dishes = dishes.filter((d) => d.available === (available === 'true'));
    }

    if (search) {
      const q = String(search).toLowerCase();
      dishes = dishes.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q)
      );
    }

    dishes.sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99));

    const pageNum = parseInt(String(page), 10) || 1;
    const limitNum = parseInt(String(limit), 10) || 50;
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = dishes.slice(startIndex, startIndex + limitNum);

    return {
      total: dishes.length,
      page: pageNum,
      totalPages: Math.ceil(dishes.length / limitNum),
      dishes: paginated,
    };
  },

  async createDish(data: any, username = 'admin') {
    const {
      name,
      category,
      description,
      fullDescription,
      price,
      compareAtPrice,
      image,
      isVeg,
      isSignature,
      spiceLevel,
      preparationTime,
      ingredients,
      chefNote,
      available = true,
    } = data;

    if (!name || !category || price === undefined) {
      throw new AppError('Dish name, category, and price are required.', 400);
    }

    const numericPrice = Number(price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      throw new AppError('Price must be a non-negative number.', 400);
    }

    const id = slugify(name) + '-' + Math.random().toString(36).substr(2, 4);
    const now = new Date().toISOString();

    const newDish: FoodItem = {
      id,
      name: name.trim(),
      slug: slugify(name),
      category: category.trim(),
      description: (description || '').trim(),
      fullDescription: (fullDescription || description || '').trim(),
      price: numericPrice,
      compareAtPrice: compareAtPrice ? Number(compareAtPrice) : undefined,
      image: image || '/images/dishes/handi-paneer.jpg',
      isVeg: Boolean(isVeg),
      isSignature: Boolean(isSignature),
      spiceLevel: [1, 2, 3].includes(Number(spiceLevel)) ? (Number(spiceLevel) as 1 | 2 | 3) : 2,
      preparationTime: preparationTime ? String(preparationTime) : '20 mins',
      ingredients: Array.isArray(ingredients) ? ingredients : String(ingredients || '').split(',').map((s) => s.trim()).filter(Boolean),
      chefNote: chefNote ? String(chefNote).trim() : undefined,
      available: Boolean(available),
      displayOrder: db.getState().dishes.length + 1,
      createdAt: now,
      updatedAt: now,
    };

    db.updateState((s) => s.dishes.push(newDish));
    db.logAudit('CREATE_FOOD_ITEM', username, `Created food item: ${newDish.name} (₹${newDish.price})`);

    return newDish;
  },

  async updateDish(dishId: string, data: any, username = 'admin') {
    const state = db.getState();
    const existing = state.dishes.find((d) => d.id === dishId);
    if (!existing) {
      throw new AppError('Food item not found.', 404);
    }

    const {
      name,
      category,
      description,
      fullDescription,
      price,
      compareAtPrice,
      image,
      isVeg,
      isSignature,
      spiceLevel,
      preparationTime,
      ingredients,
      chefNote,
      available,
      displayOrder,
    } = data;

    if (price !== undefined && (isNaN(Number(price)) || Number(price) < 0)) {
      throw new AppError('Price must be a non-negative number.', 400);
    }

    let updatedDish: FoodItem | null = null;
    db.updateState((s) => {
      const target = s.dishes.find((d) => d.id === dishId);
      if (target) {
        if (name) target.name = name.trim();
        if (category) target.category = category.trim();
        if (description !== undefined) target.description = description.trim();
        if (fullDescription !== undefined) target.fullDescription = fullDescription.trim();
        if (price !== undefined) target.price = Number(price);
        if (compareAtPrice !== undefined) target.compareAtPrice = compareAtPrice ? Number(compareAtPrice) : undefined;
        if (image) target.image = image;
        if (isVeg !== undefined) target.isVeg = Boolean(isVeg);
        if (isSignature !== undefined) target.isSignature = Boolean(isSignature);
        if (spiceLevel !== undefined) target.spiceLevel = Number(spiceLevel) as 1 | 2 | 3;
        if (preparationTime !== undefined) target.preparationTime = String(preparationTime);
        if (ingredients !== undefined) {
          target.ingredients = Array.isArray(ingredients) ? ingredients : String(ingredients).split(',').map((s) => s.trim()).filter(Boolean);
        }
        if (chefNote !== undefined) target.chefNote = chefNote ? String(chefNote).trim() : undefined;
        if (available !== undefined) target.available = Boolean(available);
        if (displayOrder !== undefined) target.displayOrder = Number(displayOrder);
        target.updatedAt = new Date().toISOString();
        updatedDish = { ...target };
      }
    });

    db.logAudit('UPDATE_FOOD_ITEM', username, `Updated dish: ${updatedDish?.name}`);
    return updatedDish!;
  },

  async toggleAvailability(dishId: string, available?: boolean, username = 'admin') {
    let updatedDish: FoodItem | null = null;
    db.updateState((s) => {
      const target = s.dishes.find((d) => d.id === dishId);
      if (target) {
        target.available = available !== undefined ? Boolean(available) : !target.available;
        target.updatedAt = new Date().toISOString();
        updatedDish = { ...target };
      }
    });

    if (!updatedDish) {
      throw new AppError('Food item not found.', 404);
    }

    const statusText = (updatedDish as FoodItem).available ? 'Available' : 'Unavailable (86’d)';
    db.logAudit('TOGGLE_DISH_AVAILABILITY', username, `${(updatedDish as FoodItem).name} set to ${statusText}`);

    return { dish: updatedDish, statusText };
  },

  async deleteDish(dishId: string, username = 'admin') {
    const state = db.getState();
    const existing = state.dishes.find((d) => d.id === dishId);
    if (!existing) {
      throw new AppError('Food item not found.', 404);
    }

    const hasOrders = state.orders.some((o) => o.items.some((item) => item.dishId === dishId));
    if (hasOrders) {
      db.updateState((s) => {
        const target = s.dishes.find((d) => d.id === dishId);
        if (target) {
          target.available = false;
          target.displayOrder = 9999;
          target.name = `[Archived] ${target.name}`;
        }
      });

      db.logAudit('ARCHIVE_FOOD_ITEM', username, `Archived food item with historical orders: ${existing.name}`);
      return {
        archived: true,
        message: `${existing.name} has active historical order records and has been safely archived and marked unavailable.`,
      };
    }

    db.updateState((s) => {
      s.dishes = s.dishes.filter((d) => d.id !== dishId);
    });

    db.logAudit('DELETE_FOOD_ITEM', username, `Permanently deleted unused food item: ${existing.name}`);
    return {
      archived: false,
      message: `${existing.name} was removed from the menu.`,
    };
  },
};
