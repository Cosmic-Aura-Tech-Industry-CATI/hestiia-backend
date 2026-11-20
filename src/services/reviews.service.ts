import { AppError } from '@/lib/errors';
import { connectDB } from '@/lib/mongodb';
import { logAudit } from '@/lib/audit';
import { escapeRegex } from '@/lib/regex';
import { IReviewItem, ReviewModel } from '@/models/Review.model';
import { cleanDoc, cleanDocs } from '@/models/_schema';

export const reviewsService = {
  async getPublicReviews() {
    await connectDB();
    const docs = await ReviewModel.find({ isApproved: true })
      .sort({ createdAt: -1 })
      .lean();
    return cleanDocs<IReviewItem>(docs);
  },

  async submitReview(data: any) {
    const { customerName, rating, comment, dishName } = data;
    if (!customerName || !rating || !comment) {
      throw new AppError(
        'Name, star rating, and review comments are required.',
        400
      );
    }

    await connectDB();
    const numericRating = Math.min(5, Math.max(1, parseInt(rating, 10) || 5));
    const newReview: IReviewItem = {
      id: `rev_${Date.now()}`,
      customerName: String(customerName).trim(),
      rating: numericRating,
      comment: String(comment).trim(),
      dishName: dishName ? String(dishName).trim() : undefined,
      source: 'website',
      isApproved: false,
      createdAt: new Date().toISOString(),
    };

    await ReviewModel.create(newReview);
    await logAudit(
      'CUSTOMER_FEEDBACK_SUBMITTED',
      'Public Customer',
      `Feedback received from ${customerName} (${numericRating}★)`
    );

    return newReview;
  },

  async getAdminReviews(query: any) {
    await connectDB();
    const { status, rating, search } = query;

    const filter: Record<string, any> = {};
    if (status === 'approved') filter.isApproved = true;
    else if (status === 'pending') filter.isApproved = false;

    if (rating && rating !== 'all') filter.rating = Number(rating);

    if (search) {
      const rx = new RegExp(escapeRegex(String(search)), 'i');
      filter.$or = [{ customerName: rx }, { comment: rx }, { dishName: rx }];
    }

    const docs = await ReviewModel.find(filter).sort({ createdAt: -1 }).lean();
    return cleanDocs<IReviewItem>(docs);
  },

  async toggleApproval(reviewId: string, isApproved?: boolean, username = 'admin') {
    await connectDB();
    const existing = await ReviewModel.findOne({ id: reviewId }).lean();
    if (!existing) {
      throw new AppError('Review not found.', 404);
    }

    const nextApproved =
      isApproved !== undefined ? Boolean(isApproved) : !existing.isApproved;

    const updated = await ReviewModel.findOneAndUpdate(
      { id: reviewId },
      { $set: { isApproved: nextApproved } },
      { new: true }
    ).lean();

    const clean = cleanDoc<IReviewItem>(updated);
    await logAudit(
      'REVIEW_APPROVAL_TOGGLE',
      username,
      `Review #${reviewId} set to approved=${clean.isApproved}`
    );
    return clean;
  },

  async replyReview(reviewId: string, staffReply?: string, username = 'admin') {
    await connectDB();
    const updated = await ReviewModel.findOneAndUpdate(
      { id: reviewId },
      { $set: { staffReply: staffReply ? String(staffReply).trim() : undefined } },
      { new: true }
    ).lean();

    if (!updated) {
      throw new AppError('Review not found.', 404);
    }

    await logAudit('REVIEW_REPLIED', username, `Staff replied to review #${reviewId}`);
    return cleanDoc<IReviewItem>(updated);
  },

  async deleteReview(reviewId: string, username = 'admin') {
    await connectDB();
    await ReviewModel.deleteOne({ id: reviewId });
    await logAudit('DELETE_REVIEW', username, `Deleted review ${reviewId}`);
  },
};
