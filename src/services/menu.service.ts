import { AppError } from '@/lib/errors';
import { connectDB } from '@/lib/mongodb';
import { logAudit } from '@/lib/audit';
import { escapeRegex, slugify } from '@/lib/regex';
import { DishModel, IFoodItem } from '@/models/Dish.model';
import { OrderModel } from '@/models/Order.model';
import { cleanDoc, cleanDocs } from '@/models/_schema';

function matchesCategoryFilter(dishes: IFoodItem[], category?: string): IFoodItem[] {
  if (!category || category === 'All') return dishes;
  const catLow = String(category).toLowerCase();
  return dishes.filter(
    (d) =>
      d.category.toLowerCase() === catLow ||
      d.category.toLowerCase().replace(/[^a-z0-9]+/g, '-') === catLow ||
      d.categoryId?.toLowerCase() === catLow
  );
}

export const menuService = {
  async getPublicMenu(query: {
    category?: string;
    isVeg?: string;
    search?: string;
    availableOnly?: string;
  }) {
    await connectDB();
    const { category, isVeg, search, availableOnly } = query;

    const filter: Record<string, any> = {};
    if (availableOnly !== 'false') {
      filter.available = true;
    }
    if (isVeg !== undefined) {
      filter.isVeg = isVeg === 'true';
    }
    if (search) {
      const rx = new RegExp(escapeRegex(String(search)), 'i');
      filter.$or = [{ name: rx }, { description: rx }, { ingredients: rx }];
    }

    const rawDishes = await DishModel.find(filter)
      .sort({ displayOrder: 1 })
      .lean();
    const items = matchesCategoryFilter(cleanDocs<IFoodItem>(rawDishes), category);
    items.sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99));

    return { total: items.length, dishes: items };
  },

  async getDishById(id: string) {
    await connectDB();
    const dish = await DishModel.findOne({ $or: [{ id }, { slug: id }] }).lean();
    if (!dish) {
      throw new AppError('Food item not found.', 404);
    }
    return cleanDoc<IFoodItem>(dish);
  },

  async getAdminDishes(query: {
    category?: string;
    search?: string;
    available?: string;
    page?: string;
    limit?: string;
  }) {
    await connectDB();
    const { category, search, available, page = '1', limit = '50' } = query;

    const filter: Record<string, any> = {};
    if (available !== undefined && available !== 'all') {
      filter.available = available === 'true';
    }
    if (search) {
      const rx = new RegExp(escapeRegex(String(search)), 'i');
      filter.$or = [{ name: rx }, { category: rx }, { description: rx }];
    }

    const rawDishes = await DishModel.find(filter)
      .sort({ displayOrder: 1 })
      .lean();
    const dishes = matchesCategoryFilter(cleanDocs<IFoodItem>(rawDishes), category);
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
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      throw new AppError('Price must be a non-negative number.', 400);
    }

    await connectDB();
    const count = await DishModel.countDocuments();
    const id = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    const newDish: IFoodItem = {
      id,
      name: String(name).trim(),
      slug: slugify(name),
      category: String(category).trim(),
      description: String(description || '').trim(),
      fullDescription: String(fullDescription || description || '').trim(),
      price: numericPrice,
      compareAtPrice: compareAtPrice ? Number(compareAtPrice) : undefined,
      image: image || '/images/dishes/handi-paneer.jpg',
      isVeg: Boolean(isVeg),
      isSignature: Boolean(isSignature),
      spiceLevel: [1, 2, 3].includes(Number(spiceLevel))
        ? (Number(spiceLevel) as 1 | 2 | 3)
        : 2,
      preparationTime: preparationTime ? String(preparationTime) : '20 mins',
      ingredients: Array.isArray(ingredients)
        ? ingredients
        : String(ingredients || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
      chefNote: chefNote ? String(chefNote).trim() : undefined,
      available: Boolean(available),
      displayOrder: count + 1,
      createdAt: now,
      updatedAt: now,
    };

    await DishModel.create(newDish);
    await logAudit(
      'CREATE_FOOD_ITEM',
      username,
      `Created food item: ${newDish.name} (₹${newDish.price})`
    );

    return newDish;
  },

  async updateDish(dishId: string, data: any, username = 'admin') {
    await connectDB();
    const existing = await DishModel.findOne({ id: dishId }).lean();
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

    if (price !== undefined && (Number.isNaN(Number(price)) || Number(price) < 0)) {
      throw new AppError('Price must be a non-negative number.', 400);
    }

    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (name) updates.name = String(name).trim();
    if (category) updates.category = String(category).trim();
    if (description !== undefined) updates.description = String(description).trim();
    if (fullDescription !== undefined) {
      updates.fullDescription = String(fullDescription).trim();
    }
    if (price !== undefined) updates.price = Number(price);
    if (compareAtPrice !== undefined) {
      updates.compareAtPrice = compareAtPrice ? Number(compareAtPrice) : undefined;
    }
    if (image) updates.image = image;
    if (isVeg !== undefined) updates.isVeg = Boolean(isVeg);
    if (isSignature !== undefined) updates.isSignature = Boolean(isSignature);
    if (spiceLevel !== undefined) updates.spiceLevel = Number(spiceLevel) as 1 | 2 | 3;
    if (preparationTime !== undefined) updates.preparationTime = String(preparationTime);
    if (ingredients !== undefined) {
      updates.ingredients = Array.isArray(ingredients)
        ? ingredients
        : String(ingredients)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }
    if (chefNote !== undefined) {
      updates.chefNote = chefNote ? String(chefNote).trim() : undefined;
    }
    if (available !== undefined) updates.available = Boolean(available);
    if (displayOrder !== undefined) updates.displayOrder = Number(displayOrder);

    const updated = await DishModel.findOneAndUpdate(
      { id: dishId },
      { $set: updates },
      { new: true }
    ).lean();

    const clean = cleanDoc<IFoodItem>(updated);
    await logAudit('UPDATE_FOOD_ITEM', username, `Updated dish: ${clean.name}`);
    return clean;
  },

  async toggleAvailability(dishId: string, available?: boolean, username = 'admin') {
    await connectDB();
    const existing = await DishModel.findOne({ id: dishId }).lean();
    if (!existing) {
      throw new AppError('Food item not found.', 404);
    }

    const nextAvailable = available !== undefined ? Boolean(available) : !existing.available;
    const updated = await DishModel.findOneAndUpdate(
      { id: dishId },
      { $set: { available: nextAvailable, updatedAt: new Date().toISOString() } },
      { new: true }
    ).lean();

    const clean = cleanDoc<IFoodItem>(updated);
    const statusText = clean.available ? 'Available' : 'Unavailable (86’d)';
    await logAudit(
      'TOGGLE_DISH_AVAILABILITY',
      username,
      `${clean.name} set to ${statusText}`
    );

    return { dish: clean, statusText };
  },

  async deleteDish(dishId: string, username = 'admin') {
    await connectDB();
    const existing = await DishModel.findOne({ id: dishId }).lean();
    if (!existing) {
      throw new AppError('Food item not found.', 404);
    }

    const hasOrders = await OrderModel.exists({ 'items.dishId': dishId });
    if (hasOrders) {
      await DishModel.updateOne(
        { id: dishId },
        {
          $set: {
            available: false,
            displayOrder: 9999,
            name: `[Archived] ${existing.name}`,
            updatedAt: new Date().toISOString(),
          },
        }
      );

      await logAudit(
        'ARCHIVE_FOOD_ITEM',
        username,
        `Archived food item with historical orders: ${existing.name}`
      );
      return {
        archived: true,
        message: `${existing.name} has active historical order records and has been safely archived and marked unavailable.`,
      };
    }

    await DishModel.deleteOne({ id: dishId });
    await logAudit(
      'DELETE_FOOD_ITEM',
      username,
      `Permanently deleted unused food item: ${existing.name}`
    );
    return {
      archived: false,
      message: `${existing.name} was removed from the menu.`,
    };
  },
};
