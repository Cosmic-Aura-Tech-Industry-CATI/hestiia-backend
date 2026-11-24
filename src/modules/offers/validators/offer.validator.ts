import mongoose from 'mongoose';
import { AppError } from '../../../shared/utils/appError.js';
import { DiscountType, OfferPlacement } from '../interfaces/offer.interface.js';

export function validateObjectId(id: string, paramName = 'ID'): string {
  if (!id || typeof id !== 'string') {
    throw new AppError(`Invalid ${paramName} provided.`, 400);
  }
  const clean = id.trim();
  const isValidHex = /^[0-9a-fA-F]{24}$/.test(clean);
  const isMongoose = mongoose.Types.ObjectId.isValid(clean);
  if (!isValidHex && !isMongoose) {
    throw new AppError(`Invalid ${paramName} format. Must be a valid 24-character ObjectId.`, 400);
  }
  return clean;
}

export function validateOfferTitle(title: any): string {
  if (title === undefined || title === null || typeof title !== 'string') {
    throw new AppError('Offer title is required and must be a string.', 400);
  }
  const clean = title.trim();
  if (clean.length === 0) {
    throw new AppError('Offer title cannot be empty or whitespace only.', 400);
  }
  if (clean.length < 2) {
    throw new AppError('Offer title must be at least 2 characters long.', 400);
  }
  if (clean.length > 150) {
    throw new AppError('Offer title cannot exceed 150 characters.', 400);
  }
  return clean;
}

export function validateOfferDescription(description: any): string {
  if (description === undefined || description === null || typeof description !== 'string') {
    throw new AppError('Offer description is required and must be a string.', 400);
  }
  const clean = description.trim();
  if (clean.length === 0) {
    throw new AppError('Offer description cannot be empty.', 400);
  }
  if (clean.length > 1000) {
    throw new AppError('Offer description cannot exceed 1000 characters.', 400);
  }
  return clean;
}

export function validateDiscountConfig(
  type: any,
  value: any,
  maxDiscount?: any
): { discountType: DiscountType; discountValue: number; maxDiscount: number | null } {
  if (!type || typeof type !== 'string') {
    throw new AppError('Discount type is required. Allowed types: "fixed", "percentage".', 400);
  }
  const cleanType = type.trim().toLowerCase();
  if (cleanType !== 'fixed' && cleanType !== 'percentage') {
    throw new AppError(`Invalid discount type "${type}". Only "fixed" or "percentage" are supported.`, 400);
  }

  if (value === undefined || value === null) {
    throw new AppError('Discount value is required.', 400);
  }
  const numValue = Number(value);
  if (isNaN(numValue) || numValue <= 0) {
    throw new AppError('Discount value must be a positive number greater than 0.', 400);
  }

  if (cleanType === 'percentage' && numValue > 100) {
    throw new AppError('Percentage discount value cannot exceed 100%.', 400);
  }

  let cleanMaxDiscount: number | null = null;
  if (maxDiscount !== undefined && maxDiscount !== null && maxDiscount !== '') {
    const numMax = Number(maxDiscount);
    if (isNaN(numMax) || numMax < 0) {
      throw new AppError('Maximum discount cap must be a non-negative number.', 400);
    }
    cleanMaxDiscount = numMax;
  }

  return {
    discountType: cleanType as DiscountType,
    discountValue: numValue,
    maxDiscount: cleanMaxDiscount,
  };
}

export function validateMinOrderValue(val: any): number {
  if (val === undefined || val === null || val === '') {
    return 0;
  }
  const num = Number(val);
  if (isNaN(num) || num < 0) {
    throw new AppError('Minimum order value must be a non-negative number.', 400);
  }
  return num;
}

export function validateOfferDates(
  start: any,
  end: any
): { startDate: Date; endDate: Date } {
  if (!start) {
    throw new AppError('Start date is required.', 400);
  }
  if (!end) {
    throw new AppError('End date is required.', 400);
  }

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (isNaN(startDate.getTime())) {
    throw new AppError('Invalid start date format.', 400);
  }
  if (isNaN(endDate.getTime())) {
    throw new AppError('Invalid end date format.', 400);
  }

  if (endDate.getTime() <= startDate.getTime()) {
    throw new AppError('End date must be strictly after the start date.', 400);
  }

  return { startDate, endDate };
}

export function validatePlacements(placements: any): OfferPlacement[] {
  if (placements === undefined || placements === null) {
    return ['home', 'menu'];
  }
  if (!Array.isArray(placements)) {
    throw new AppError('Placements must be an array of strings ("home" and/or "menu").', 400);
  }
  if (placements.length === 0) {
    return ['home', 'menu'];
  }

  const validSet = new Set(['home', 'menu']);
  const result: OfferPlacement[] = [];

  for (const p of placements) {
    if (typeof p !== 'string' || !validSet.has(p.trim().toLowerCase())) {
      throw new AppError(`Invalid placement "${p}". Allowed placements: "home", "menu".`, 400);
    }
    const clean = p.trim().toLowerCase() as OfferPlacement;
    if (!result.includes(clean)) {
      result.push(clean);
    }
  }

  return result;
}

export function validateDisplayPriority(val: any): number {
  if (val === undefined || val === null || val === '') {
    return 1;
  }
  const num = parseInt(String(val), 10);
  if (isNaN(num) || num < 1) {
    throw new AppError('Display priority must be an integer of at least 1.', 400);
  }
  return num;
}
