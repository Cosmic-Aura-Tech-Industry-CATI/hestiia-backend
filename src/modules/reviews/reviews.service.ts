import { db, ReviewItem } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/appError.js';

export const reviewsService = {
  async getPublicReviews() {
    return db.getState().reviews
      .filter((r) => r.isApproved)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async submitReview(data: any) {
    const { customerName, rating, comment, dishName } = data;

    if (!customerName || !rating || !comment) {
      throw new AppError('Name, star rating, and review comments are required.', 400);
    }

    const numericRating = Math.min(5, Math.max(1, parseInt(rating, 10) || 5));
    const newReview: ReviewItem = {
      id: 'rev_' + Date.now(),
      customerName: customerName.trim(),
      rating: numericRating,
      comment: comment.trim(),
      dishName: dishName ? dishName.trim() : undefined,
      source: 'website',
      isApproved: false,
      createdAt: new Date().toISOString(),
    };

    db.updateState((s) => s.reviews.unshift(newReview));
    db.logAudit('CUSTOMER_FEEDBACK_SUBMITTED', 'Public Customer', `Feedback received from ${customerName} (${numericRating}★)`);

    return newReview;
  },

  async getAdminReviews(query: any) {
    const { status, rating, search } = query;
    let reviews = [...db.getState().reviews];

    if (status === 'approved') {
      reviews = reviews.filter((r) => r.isApproved);
    } else if (status === 'pending') {
      reviews = reviews.filter((r) => !r.isApproved);
    }

    if (rating && rating !== 'all') {
      reviews = reviews.filter((r) => r.rating === Number(rating));
    }

    if (search) {
      const q = String(search).toLowerCase();
      reviews = reviews.filter(
        (r) =>
          r.customerName.toLowerCase().includes(q) ||
          r.comment.toLowerCase().includes(q) ||
          (r.dishName && r.dishName.toLowerCase().includes(q))
      );
    }

    reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return reviews;
  },

  async toggleApproval(reviewId: string, isApproved?: boolean, username = 'admin') {
    let updated: ReviewItem | null = null;
    db.updateState((s) => {
      const target = s.reviews.find((r) => r.id === reviewId);
      if (target) {
        target.isApproved = isApproved !== undefined ? Boolean(isApproved) : !target.isApproved;
        updated = { ...target };
      }
    });

    if (!updated) {
      throw new AppError('Review not found.', 404);
    }

    db.logAudit('REVIEW_APPROVAL_TOGGLE', username, `Review #${reviewId} set to approved=${(updated as ReviewItem).isApproved}`);
    return updated;
  },

  async replyReview(reviewId: string, staffReply?: string, username = 'admin') {
    let updated: ReviewItem | null = null;
    db.updateState((s) => {
      const target = s.reviews.find((r) => r.id === reviewId);
      if (target) {
        target.staffReply = staffReply ? String(staffReply).trim() : undefined;
        updated = { ...target };
      }
    });

    if (!updated) {
      throw new AppError('Review not found.', 404);
    }

    db.logAudit('REVIEW_REPLIED', username, `Staff replied to review #${reviewId}`);
    return updated;
  },

  async deleteReview(reviewId: string, username = 'admin') {
    db.updateState((s) => {
      s.reviews = s.reviews.filter((r) => r.id !== reviewId);
    });
    db.logAudit('DELETE_REVIEW', username, `Deleted review ${reviewId}`);
  },
};
