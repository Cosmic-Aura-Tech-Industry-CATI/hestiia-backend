import mongoose from 'mongoose';
import { MenuItem, slugify, type IFoodItemDocument } from './menu.model.js';
import { db } from '../../shared/config/store.js';
import { AppError } from '../../shared/utils/appError.js';

export const menuService = {
  /**
   * Helper to format a Mongoose dish document or lean object
   */
  formatDish(doc: any) {
    const id = doc?._id ? doc._id.toString() : (doc?.id || '');
    return {
      id,
      _id: doc?._id || id,
      name: doc?.name || '',
      slug: doc?.slug || '',
      category: doc?.category || '',
      description: doc?.description || '',
      fullDescription: doc?.fullDescription || '',
      price: doc?.price ?? 0,
      compareAtPrice: doc?.compareAtPrice,
      image: doc?.image || '/uploads/menu/default-dish.webp',
      isVeg: doc?.isVeg ?? true,
      isSignature: doc?.isSignature ?? false,
      spiceLevel: doc?.spiceLevel ?? 2,
      preparationTime: doc?.preparationTime || '20 mins',
      ingredients: doc?.ingredients || [],
      chefNote: doc?.chefNote || '',
      available: doc?.available ?? true,
      displayOrder: doc?.displayOrder ?? 0,
      createdAt: doc?.createdAt || new Date(),
      updatedAt: doc?.updatedAt || new Date(),
    };
  },

  /**
   * Fast lookup helper for dish by ObjectId, slug, or exact name
   */
  async findDishDoc(idOrSlug: string) {
    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      const byId = await MenuItem.findById(idOrSlug);
      if (byId) return byId;
    }
    return MenuItem.findOne({
      $or: [
        { slug: idOrSlug },
        { name: { $regex: new RegExp(`^${idOrSlug.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') } },
      ],
    });
  },

  /**
   * 1. Public Menu (Optimized lean query with index coverage)
   */
  async getPublicMenu(query: { category?: string; isVeg?: string; search?: string; availableOnly?: string }) {
    const { category, isVeg, search, availableOnly } = query;

    const filter: any = {};

    // Available only by default
    if (availableOnly !== 'false') {
      filter.available = true;
    }

    // Category filtering (utilizes compound index { available: 1, category: 1, displayOrder: 1 })
    if (category && category !== 'All' && category !== 'all') {
      const cleanCat = category.trim();
      const capitalized = cleanCat.charAt(0).toUpperCase() + cleanCat.slice(1).toLowerCase();
      filter.$or = [
        { category: cleanCat },
        { category: capitalized },
      ];
    }

    // Vegetarian filtering
    if (isVeg !== undefined) {
      filter.isVeg = isVeg === 'true';
    }

    // Keyword search (text index or regex fallback)
    if (search && search.trim()) {
      const term = search.trim();
      filter.$or = [
        { name: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
        { ingredients: { $regex: term, $options: 'i' } },
      ];
    }

    const dishes = await MenuItem.find(filter)
      .select('name slug category description price compareAtPrice image isVeg isSignature spiceLevel preparationTime ingredients available displayOrder createdAt')
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();

    return {
      total: dishes.length,
      dishes: dishes.map((d) => this.formatDish(d)),
    };
  },

  /**
   * 2. Single Dish Lookup (Detail view with fullDescription and chefNote)
   */
  async getDishById(id: string) {
    let dish: any = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      dish = await MenuItem.findById(id).lean();
    }

    if (!dish) {
      dish = await MenuItem.findOne({
        $or: [
          { slug: id },
          { name: { $regex: new RegExp(`^${id.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') } },
        ],
      }).lean();
    }

    if (!dish) {
      throw new AppError('Food item not found.', 404);
    }

    return this.formatDish(dish);
  },

  /**
   * 3. Admin Dishes (Optimized pagination and filtering)
   */
  async getAdminDishes(query: { category?: string; search?: string; available?: string; page?: string; limit?: string }) {
    const { category, search, available, page = '1', limit = '50' } = query;

    const filter: any = {};

    if (category && category !== 'All' && category !== 'all') {
      filter.category = { $regex: new RegExp(`^${category.trim()}$`, 'i') };
    }

    if (available !== undefined && available !== 'all') {
      filter.available = available === 'true';
    }

    if (search && search.trim()) {
      const term = search.trim();
      filter.$or = [
        { name: { $regex: term, $options: 'i' } },
        { category: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [total, dishes] = await Promise.all([
      MenuItem.countDocuments(filter),
      MenuItem.find(filter)
        .sort({ displayOrder: 1, createdAt: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    return {
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      dishes: dishes.map((d) => this.formatDish(d)),
    };
  },

  /**
   * 4. Create Dish (Direct MongoDB Atlas insertion with unique slug and order calculation)
   */
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
      displayOrder,
    } = data;

    if (!name || !name.trim()) {
      throw new AppError('Dish name is required.', 400);
    }
    if (!category || !category.trim()) {
      throw new AppError('Dish category is required.', 400);
    }
    if (price === undefined || price === null) {
      throw new AppError('Selling price is required.', 400);
    }

    const numericPrice = Number(price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      throw new AppError('Selling price must be a non-negative number.', 400);
    }

    const cleanName = name.trim();

    // Auto-generate unique slug
    let baseSlug = slugify(cleanName);
    let targetSlug = baseSlug;
    let counter = 1;
    while (await MenuItem.findOne({ slug: targetSlug }).select('_id').lean()) {
      targetSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Auto-calculate next displayOrder if not provided
    let order = displayOrder;
    if (order === undefined || order === null) {
      const highest = await MenuItem.findOne().sort({ displayOrder: -1 }).select('displayOrder').lean();
      order = highest ? (highest.displayOrder ?? 0) + 1 : 1;
    }

    // Parse ingredients array
    let parsedIngredients: string[] = [];
    if (Array.isArray(ingredients)) {
      parsedIngredients = ingredients.map((i) => String(i).trim()).filter(Boolean);
    } else if (typeof ingredients === 'string') {
      parsedIngredients = ingredients.split(',').map((s) => s.trim()).filter(Boolean);
    }

    try {
      const created = await MenuItem.create({
        name: cleanName,
        slug: targetSlug,
        category: category.trim(),
        description: (description || '').trim(),
        fullDescription: (fullDescription || description || '').trim(),
        price: numericPrice,
        compareAtPrice: compareAtPrice ? Number(compareAtPrice) : undefined,
        image: image || '/uploads/menu/default-dish.webp',
        isVeg: Boolean(isVeg),
        isSignature: Boolean(isSignature),
        spiceLevel: [1, 2, 3].includes(Number(spiceLevel)) ? (Number(spiceLevel) as 1 | 2 | 3) : 2,
        preparationTime: preparationTime ? String(preparationTime).trim() : '20 mins',
        ingredients: parsedIngredients,
        chefNote: chefNote ? String(chefNote).trim() : '',
        available: Boolean(available),
        displayOrder: Number(order),
      });

      db.logAudit('CREATE_FOOD_ITEM', username, `Created food item in database: ${created.name} (₹${created.price})`);
      return this.formatDish(created.toJSON());
    } catch (err: any) {
      if (err.code === 11000) {
        throw new AppError('A dish with this name or slug already exists.', 409);
      }
      throw err;
    }
  },

  /**
   * 5. Update Dish (Optimized findByIdAndUpdate in MongoDB Atlas)
   */
  async updateDish(dishId: string, data: any, username = 'admin') {
    const dish = await this.findDishDoc(dishId);
    if (!dish) {
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

    const updateFields: any = {};

    if (name !== undefined) {
      const cleanName = name.trim();
      if (!cleanName) {
        throw new AppError('Dish name cannot be empty.', 400);
      }
      updateFields.name = cleanName;
      updateFields.slug = slugify(cleanName);
    }

    if (category !== undefined) {
      updateFields.category = category.trim();
    }

    if (description !== undefined) {
      updateFields.description = description.trim();
    }

    if (fullDescription !== undefined) {
      updateFields.fullDescription = fullDescription.trim();
    }

    if (price !== undefined) {
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice < 0) {
        throw new AppError('Selling price must be a non-negative number.', 400);
      }
      updateFields.price = numPrice;
    }

    if (compareAtPrice !== undefined) {
      updateFields.compareAtPrice = compareAtPrice ? Number(compareAtPrice) : null;
    }

    if (image !== undefined) {
      updateFields.image = image;
    }

    if (isVeg !== undefined) {
      updateFields.isVeg = Boolean(isVeg);
    }

    if (isSignature !== undefined) {
      updateFields.isSignature = Boolean(isSignature);
    }

    if (spiceLevel !== undefined) {
      updateFields.spiceLevel = [1, 2, 3].includes(Number(spiceLevel)) ? Number(spiceLevel) : 2;
    }

    if (preparationTime !== undefined) {
      updateFields.preparationTime = String(preparationTime).trim();
    }

    if (ingredients !== undefined) {
      updateFields.ingredients = Array.isArray(ingredients)
        ? ingredients.map((i) => String(i).trim()).filter(Boolean)
        : String(ingredients).split(',').map((s) => s.trim()).filter(Boolean);
    }

    if (chefNote !== undefined) {
      updateFields.chefNote = String(chefNote).trim();
    }

    if (available !== undefined) {
      updateFields.available = Boolean(available);
    }

    if (displayOrder !== undefined) {
      const numOrder = Number(displayOrder);
      if (isNaN(numOrder) || numOrder < 0) {
        throw new AppError('Display order must be a non-negative number.', 400);
      }
      updateFields.displayOrder = numOrder;
    }

    try {
      const updated = await MenuItem.findByIdAndUpdate(
        dish._id,
        { $set: updateFields },
        { returnDocument: 'after', runValidators: true }
      ).lean();

      if (!updated) {
        throw new AppError('Food item not found or update failed.', 404);
      }

      db.logAudit('UPDATE_FOOD_ITEM', username, `Updated dish in database: ${updated.name}`);
      return this.formatDish(updated);
    } catch (err: any) {
      if (err.code === 11000) {
        throw new AppError('A dish with this name or slug already exists.', 409);
      }
      throw err;
    }
  },

  /**
   * 6. Toggle Stock Availability (Quick stock/86'd status toggle)
   */
  async toggleAvailability(dishId: string, available?: boolean, username = 'admin') {
    const dish = await this.findDishDoc(dishId);
    if (!dish) {
      throw new AppError('Food item not found.', 404);
    }

    const newStatus = available !== undefined ? Boolean(available) : !dish.available;

    const updated = await MenuItem.findByIdAndUpdate(
      dish._id,
      { $set: { available: newStatus } },
      { returnDocument: 'after' }
    ).lean();

    const statusText = newStatus ? 'Available' : 'Unavailable (86’d)';
    db.logAudit('TOGGLE_DISH_AVAILABILITY', username, `${dish.name} set to ${statusText}`);

    return { dish: this.formatDish(updated), statusText };
  },

  /**
   * 7. Delete / Safe Archive Dish
   */
  async deleteDish(dishId: string, username = 'admin') {
    const dish = await this.findDishDoc(dishId);
    if (!dish) {
      throw new AppError('Food item not found.', 404);
    }

    // Check if historical orders reference this dish
    const orders = db.getState().orders || [];
    const hasOrders = orders.some((o) => o.items.some((item) => item.dishId === dish._id.toString() || item.dishId === dish.slug));

    if (hasOrders) {
      await MenuItem.findByIdAndUpdate(dish._id, {
        $set: { available: false, name: `[Archived] ${dish.name}` },
      });

      db.logAudit('ARCHIVE_FOOD_ITEM', username, `Archived dish with historical orders: ${dish.name}`);
      return {
        archived: true,
        message: `${dish.name} has historical order records and has been safely archived and marked unavailable.`,
      };
    }

    await MenuItem.findByIdAndDelete(dish._id).lean();

    db.logAudit('DELETE_FOOD_ITEM', username, `Permanently deleted unused dish from database: ${dish.name}`);
    return {
      archived: false,
      message: `${dish.name} was permanently removed from the menu.`,
    };
  },
};
