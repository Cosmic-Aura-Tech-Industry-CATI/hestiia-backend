import { AppError } from '../../shared/utils/appError.js';
import { IUpdateContactDTO } from './contact.interface.js';

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const PHONE_CHARS_REGEX = /^[+]?[\d\s\-().]{7,30}$/;

export function validatePhoneUpdate(data: any): { number?: string; enabled?: boolean } {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new AppError('Field "phone" must be an object with "number" and "enabled" properties.', 400);
  }

  const allowedKeys = new Set(['number', 'enabled']);
  for (const k of Object.keys(data)) {
    if (!allowedKeys.has(k)) {
      throw new AppError(`Unexpected property "${k}" in phone settings.`, 400);
    }
  }

  const result: { number?: string; enabled?: boolean } = {};

  if (data.enabled !== undefined) {
    if (typeof data.enabled !== 'boolean') {
      throw new AppError('Property "phone.enabled" must be a boolean.', 400);
    }
    result.enabled = data.enabled;
  }

  if (data.number !== undefined) {
    if (typeof data.number !== 'string') {
      throw new AppError('Property "phone.number" must be a string.', 400);
    }
    const clean = data.number.trim();
    if (clean.length > 50) {
      throw new AppError('Phone number cannot exceed 50 characters.', 400);
    }

    if (result.enabled === true || (result.enabled === undefined && clean.length > 0)) {
      if (clean.length === 0) {
        throw new AppError('Phone number cannot be empty when phone contact option is enabled.', 400);
      }
      if (!PHONE_CHARS_REGEX.test(clean)) {
        throw new AppError('Invalid phone number format. Must contain valid international or local phone digits.', 400);
      }
      const digitsOnly = clean.replace(/\D/g, '');
      if (digitsOnly.length < 7 || digitsOnly.length > 15) {
        throw new AppError('Phone number must contain between 7 and 15 digits.', 400);
      }
    }
    result.number = clean;
  } else if (result.enabled === true) {
    // If enabled is set to true without number, number must already exist in DB; verified in service
  }

  return result;
}

export function validateEmailUpdate(data: any): { address?: string; enabled?: boolean } {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new AppError('Field "email" must be an object with "address" and "enabled" properties.', 400);
  }

  const allowedKeys = new Set(['address', 'enabled']);
  for (const k of Object.keys(data)) {
    if (!allowedKeys.has(k)) {
      throw new AppError(`Unexpected property "${k}" in email settings.`, 400);
    }
  }

  const result: { address?: string; enabled?: boolean } = {};

  if (data.enabled !== undefined) {
    if (typeof data.enabled !== 'boolean') {
      throw new AppError('Property "email.enabled" must be a boolean.', 400);
    }
    result.enabled = data.enabled;
  }

  if (data.address !== undefined) {
    if (typeof data.address !== 'string') {
      throw new AppError('Property "email.address" must be a string.', 400);
    }
    const clean = data.address.trim().toLowerCase();
    if (clean.length > 150) {
      throw new AppError('Email address cannot exceed 150 characters.', 400);
    }

    if (result.enabled === true || (result.enabled === undefined && clean.length > 0)) {
      if (clean.length === 0) {
        throw new AppError('Email address cannot be empty when email contact option is enabled.', 400);
      }
      if (!EMAIL_REGEX.test(clean)) {
        throw new AppError(`Invalid email address format: "${clean}".`, 400);
      }
    }
    result.address = clean;
  }

  return result;
}

export function validateWhatsAppUpdate(data: any): { number?: string; enabled?: boolean } {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new AppError('Field "whatsapp" must be an object with "number" and "enabled" properties.', 400);
  }

  const allowedKeys = new Set(['number', 'enabled']);
  for (const k of Object.keys(data)) {
    if (!allowedKeys.has(k)) {
      throw new AppError(`Unexpected property "${k}" in whatsapp settings.`, 400);
    }
  }

  const result: { number?: string; enabled?: boolean } = {};

  if (data.enabled !== undefined) {
    if (typeof data.enabled !== 'boolean') {
      throw new AppError('Property "whatsapp.enabled" must be a boolean.', 400);
    }
    result.enabled = data.enabled;
  }

  if (data.number !== undefined) {
    if (typeof data.number !== 'string') {
      throw new AppError('Property "whatsapp.number" must be a string.', 400);
    }
    const clean = data.number.trim();
    if (clean.length > 50) {
      throw new AppError('WhatsApp number cannot exceed 50 characters.', 400);
    }

    const digitsOnly = clean.replace(/\D/g, '');

    if (result.enabled === true || (result.enabled === undefined && clean.length > 0)) {
      if (clean.length === 0) {
        throw new AppError('WhatsApp number cannot be empty when WhatsApp option is enabled.', 400);
      }
      if (digitsOnly.length < 8 || digitsOnly.length > 15) {
        throw new AppError('WhatsApp number must contain between 8 and 15 digits in international format for wa.me links.', 400);
      }
    }
    // Store clean digits so frontend can cleanly format wa.me links
    result.number = digitsOnly || clean;
  }

  return result;
}

export function validateUpdateContactPayload(body: any): IUpdateContactDTO {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError('Request payload must be a JSON object.', 400);
  }

  const rootKeys = Object.keys(body);
  if (rootKeys.length === 0) {
    throw new AppError('Request body cannot be empty. At least one contact option (phone, email, whatsapp) is required.', 400);
  }

  const allowedRootKeys = new Set(['phone', 'email', 'whatsapp']);
  for (const k of rootKeys) {
    if (!allowedRootKeys.has(k)) {
      throw new AppError(`Unexpected property "${k}" in request payload. Only "phone", "email", and "whatsapp" are allowed.`, 400);
    }
  }

  const dto: IUpdateContactDTO = {};

  if (body.phone !== undefined) {
    dto.phone = validatePhoneUpdate(body.phone);
  }
  if (body.email !== undefined) {
    dto.email = validateEmailUpdate(body.email);
  }
  if (body.whatsapp !== undefined) {
    dto.whatsapp = validateWhatsAppUpdate(body.whatsapp);
  }

  return dto;
}
