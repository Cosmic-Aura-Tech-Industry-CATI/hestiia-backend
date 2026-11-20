import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { connectDB } from '../lib/mongodb';
import {
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_CLOUD_NAME,
} from '../lib/env';
import { uploadLocalFileToCloudinary } from '../lib/cloudinary';
import { UserModel } from '../models/User.model';
import { SettingModel } from '../models/Setting.model';
import { CategoryModel } from '../models/Category.model';
import { DishModel } from '../models/Dish.model';
import { OrderModel } from '../models/Order.model';
import { CustomerModel } from '../models/Customer.model';
import { PaymentModel } from '../models/Payment.model';
import { InvoiceModel } from '../models/Invoice.model';
import { BookingModel } from '../models/Booking.model';
import { PartyInquiryModel } from '../models/PartyInquiry.model';
import { PromotionModel } from '../models/Promotion.model';
import { GalleryPhotoModel } from '../models/GalleryPhoto.model';
import { ReviewModel } from '../models/Review.model';
import { AuditLogModel } from '../models/AuditLog.model';

function resolveLocalImagePath(imageUrl?: string): string | null {
  if (!imageUrl || imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return null;
  }
  const clean = imageUrl.replace(/^\/+/, '');
  const candidates = [
    path.resolve(process.cwd(), 'public', clean),
    path.resolve(process.cwd(), 'public', 'uploads', clean),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

async function maybeUploadLocalImage(
  imageUrl: string | undefined,
  subFolder: string,
  cache: Map<string, string>
): Promise<string | undefined> {
  if (!imageUrl) return imageUrl;
  if (cache.has(imageUrl)) return cache.get(imageUrl);

  const hasCloudinary = Boolean(
    CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET
  );
  if (!hasCloudinary) return imageUrl;

  const localPath = resolveLocalImagePath(imageUrl);
  if (!localPath) return imageUrl;

  const baseName = path.parse(localPath).name;
  const secureUrl = await uploadLocalFileToCloudinary(localPath, subFolder, baseName);
  cache.set(imageUrl, secureUrl);
  return secureUrl;
}

async function upsertById<T extends { id: string }>(
  model: mongoose.Model<any>,
  docs: T[]
) {
  for (const doc of docs) {
    await model.updateOne({ id: doc.id }, { $set: doc }, { upsert: true });
  }
}

async function runMigration() {
  const dbPath = path.resolve(process.cwd(), 'data', 'db.json');
  if (!fs.existsSync(dbPath)) {
    console.error(`Migration aborted: ${dbPath} does not exist.`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  await connectDB();
  console.log('[Migration] Connected to MongoDB:', mongoose.connection.name);

  const imageCache = new Map<string, string>();
  const hasCloudinary = Boolean(
    CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET
  );
  console.log(
    hasCloudinary
      ? '[Migration] Cloudinary credentials detected — local images will be uploaded to Cloudinary.'
      : '[Migration] Cloudinary credentials not set — keeping existing image paths as-is.'
  );

  // 1. Settings
  if (raw.settings) {
    await SettingModel.updateOne(
      { key: 'default' },
      { $set: { ...raw.settings, key: 'default' } },
      { upsert: true }
    );
  }

  // 2. Users (ensure tokenVersion exists)
  const users = (raw.users || []).map((u: any) => ({
    ...u,
    tokenVersion: u.tokenVersion ?? 0,
  }));
  await upsertById(UserModel, users);

  // 3. Categories
  await upsertById(CategoryModel, raw.categories || []);

  // 4. Dishes (optional Cloudinary image migration)
  const dishes = [];
  for (const dish of raw.dishes || []) {
    const migratedImage = await maybeUploadLocalImage(dish.image, 'menu', imageCache);
    dishes.push({ ...dish, image: migratedImage || dish.image });
  }
  await upsertById(DishModel, dishes);

  // 5. Customers (add normalizedPhone for unique lookup)
  const customers = (raw.customers || []).map((c: any) => ({
    ...c,
    normalizedPhone: String(c.phone || '').replace(/\D/g, '') || c.id,
  }));
  for (const cust of customers) {
    await CustomerModel.updateOne(
      { normalizedPhone: cust.normalizedPhone },
      { $set: cust },
      { upsert: true }
    );
  }

  // 6. Orders, Invoices, Payments, Bookings, Party Inquiries
  await upsertById(OrderModel, raw.orders || []);
  await upsertById(InvoiceModel, raw.invoices || []);
  await upsertById(PaymentModel, raw.payments || []);
  await upsertById(BookingModel, raw.bookings || []);
  await upsertById(PartyInquiryModel, raw.partyInquiries || []);

  // 7. Promotions & Gallery (optional Cloudinary image migration)
  const promotions = [];
  for (const promo of raw.promotions || []) {
    const migratedImage = await maybeUploadLocalImage(promo.image, 'promotions', imageCache);
    promotions.push({ ...promo, image: migratedImage || promo.image });
  }
  await upsertById(PromotionModel, promotions);

  const gallery = [];
  for (const photo of raw.gallery || []) {
    const migratedImage = await maybeUploadLocalImage(photo.image, 'gallery', imageCache);
    gallery.push({ ...photo, image: migratedImage || photo.image });
  }
  await upsertById(GalleryPhotoModel, gallery);

  // 8. Reviews & AuditLogs
  await upsertById(ReviewModel, raw.reviews || []);
  await upsertById(AuditLogModel, raw.auditLogs || []);

  console.log('[Migration] Summary:', {
    users: users.length,
    categories: (raw.categories || []).length,
    dishes: dishes.length,
    orders: (raw.orders || []).length,
    customers: customers.length,
    bookings: (raw.bookings || []).length,
    gallery: gallery.length,
    reviews: (raw.reviews || []).length,
    cloudinaryUploaded: imageCache.size,
  });

  await mongoose.disconnect();
  console.log('[Migration] Completed cleanly.');
}

runMigration().catch((err) => {
  console.error('[Migration] Failed:', err);
  process.exit(1);
});
