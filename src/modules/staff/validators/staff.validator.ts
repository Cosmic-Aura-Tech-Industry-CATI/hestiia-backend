import mongoose from 'mongoose';
import { AppError } from '../../../shared/utils/appError.js';

// Strict Indian mobile phone regex: 10 digits starting with 6, 7, 8, or 9
const PHONE_REGEX = /^[6-9]\d{9}$/;

// Standard RFC 5322 compliant email regex
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Validates 24-character hexadecimal MongoDB ObjectId
 */
export function validateObjectId(id: string, paramName = 'id'): string {
  if (!id || typeof id !== 'string') {
    throw new AppError(`Invalid ${paramName} provided`, 400);
  }
  const cleanId = id.trim();
  const isValidHex = /^[0-9a-fA-F]{24}$/.test(cleanId);
  const isMongooseValid = mongoose.Types.ObjectId.isValid(cleanId);

  if (!isValidHex && !isMongooseValid) {
    throw new AppError(`Invalid ${paramName} format. Must be a valid 24-character ObjectId.`, 400);
  }
  return cleanId;
}

/**
 * Normalizes and validates employee name
 */
export function validateStaffName(name: any): string {
  if (name === undefined || name === null || typeof name !== 'string') {
    throw new AppError('Employee name is required and must be a string.', 400);
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new AppError('Employee name cannot be empty or whitespace only.', 400);
  }
  if (trimmed.length < 2) {
    throw new AppError('Employee name must be at least 2 characters long.', 400);
  }
  if (trimmed.length > 100) {
    throw new AppError('Employee name cannot exceed 100 characters.', 400);
  }
  if (/^\d+$/.test(trimmed)) {
    throw new AppError('Employee name cannot be numbers only.', 400);
  }
  if (!/^[\p{L}\p{N}\s.'-]+$/u.test(trimmed)) {
    throw new AppError('Employee name contains invalid characters.', 400);
  }
  return trimmed;
}

/**
 * Normalizes and validates Indian phone number
 */
export function validateStaffPhone(phone: any): string {
  if (phone === undefined || phone === null) {
    throw new AppError('Phone number is required.', 400);
  }
  let phoneStr = String(phone).trim();
  if (phoneStr.length === 0) {
    throw new AppError('Phone number cannot be empty.', 400);
  }

  // Handle common prefixes like "+91" or "0" or spaces/dashes
  phoneStr = phoneStr.replace(/[\s\-()]/g, '');
  if (phoneStr.startsWith('+91')) {
    phoneStr = phoneStr.substring(3);
  } else if (phoneStr.startsWith('91') && phoneStr.length === 12) {
    phoneStr = phoneStr.substring(2);
  } else if (phoneStr.startsWith('0') && phoneStr.length === 11) {
    phoneStr = phoneStr.substring(1);
  }

  if (/[^\d]/.test(phoneStr)) {
    throw new AppError('Phone number must contain only numeric digits.', 400);
  }
  if (phoneStr.length < 10) {
    throw new AppError('Phone number has too few digits. Must be a valid 10-digit mobile number.', 400);
  }
  if (phoneStr.length > 10) {
    throw new AppError('Phone number has too many digits. Must be a valid 10-digit mobile number.', 400);
  }
  if (!PHONE_REGEX.test(phoneStr)) {
    throw new AppError('Invalid Indian mobile phone number. Must start with 6, 7, 8, or 9.', 400);
  }
  return phoneStr;
}

/**
 * Normalizes and validates email address
 */
export function validateStaffEmail(email: any): string {
  if (email === undefined || email === null || typeof email !== 'string') {
    throw new AppError('Email address is required and must be a string.', 400);
  }
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length === 0) {
    throw new AppError('Email address cannot be empty or whitespace only.', 400);
  }
  if (trimmed.length > 150) {
    throw new AppError('Email address is excessively long.', 400);
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    throw new AppError('Invalid email format provided.', 400);
  }
  return trimmed;
}

/**
 * Validates that role is strictly 'staff' if provided
 */
export function validateStaffRole(role: any): 'staff' {
  if (role === undefined || role === null || role === '') {
    return 'staff';
  }
  const cleanRole = String(role).trim().toLowerCase();
  if (cleanRole !== 'staff') {
    throw new AppError(`Invalid role "${role}". Only 'staff' role is permitted for employee records.`, 400);
  }
  return 'staff';
}
