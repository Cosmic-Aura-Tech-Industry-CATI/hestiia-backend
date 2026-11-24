import mongoose from 'mongoose';
import { db } from '../../shared/config/db.js';
import { Review, type IReviewDocument } from './review.model.js';
import { AppError } from '../../shared/utils/appError.js';

export const reviewsService = {
  async getPublicReviews() {
    if (mongoose.connection.readyState === 1) {
      try {
        const reviews = await Review.find({ isApproved: true })
          .sort({ createdAt: -1 })
          .lean();
        if (reviews.length > 0) return reviews;
      } catch {}
    }

    return db.getState().reviews
      .filter((r) => r.isApproved)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async submitReview(data: any) {
    const { customerName, rating, comment, dishName, source = 'website' } = data;

    if (!customerName || !rating || !comment) {
      throw new AppError('Name, star rating, and review comments are required.', 400);
    }

    const numericRating = Math.min(5, Math.max(1, parseInt(rating, 10) || 5));

    let createdDoc: any = null;
    if (mongoose.connection.readyState === 1) {
      try {
        createdDoc = await Review.create({
          customerName: customerName.trim(),
          rating: numericRating,
          comment: comment.trim(),
          dishName: dishName ? dishName.trim() : undefined,
          source: ['website', 'google', 'direct'].includes(source) ? source : 'website',
          isApproved: false,
        });
      } catch (err: any) {
        console.warn(`[Review] Mongo create failed: ${err?.message}`);
      }
    }

    const id = createdDoc?._id ? String(createdDoc._id) : 'rev_' + Date.now();
    const newReview = {
      id,
      customerName: customerName.trim(),
      rating: numericRating,
      comment: comment.trim(),
      dishName: dishName ? dishName.trim() : undefined,
      source: 'website' as const,
      isApproved: false,
      createdAt: new Date().toISOString(),
    };

    db.updateState((s) => s.reviews.unshift(newReview));
    db.logAudit('CUSTOMER_FEEDBACK_SUBMITTED', 'Public Customer', `Feedback received from ${customerName} (${numericRating}★)`);

    return createdDoc || newReview;
  },

  async getAdminReviews(query: any) {
    const { status, rating, search, page = '1', limit = '50' } = query;
    const pageNum = parseInt(String(page), 10) || 1;
    const limitNum = parseInt(String(limit), 10) || 50;

    if (mongoose.connection.readyState === 1) {
      try {
        const filter: any = {};
        if (status === 'approved') filter.isApproved = true;
        else if (status === 'pending') filter.isApproved = false;

        if (rating && rating !== 'all') filter.rating = Number(rating);
        if (search && String(search).trim()) {
          const q = String(search).trim();
          filter.$or = [
            { customerName: { $regex: q, $options: 'i' } },
            { comment: { $regex: q, $options: 'i' } },
            { dishName: { $regex: q, $options: 'i' } },
          ];
        }

        const [total, reviews] = await Promise.all([
          Review.countDocuments(filter),
          Review.find(filter)
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .lean(),
        ]);

        if (total > 0 || !search) {
          return {
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum) || 1,
            reviews,
          };
        }
      } catch {}
    }

    // Fallback to local store
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

    return {
      total: reviews.length,
      page: pageNum,
      totalPages: Math.ceil(reviews.length / limitNum) || 1,
      reviews,
    };
  },

  async toggleApproval(id: string, isApproved?: boolean, username = 'admin') {
    const approvedVal = isApproved !== undefined ? Boolean(isApproved) : true;
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
      await Review.findByIdAndUpdate(id, { isApproved: approvedVal });
    }

    let review: any = null;
    db.updateState((s) => {
      const r = s.reviews.find((item) => item.id === id);
      if (r) {
        r.isApproved = approvedVal;
        review = { ...r };
      }
    });

    db.logAudit('REVIEW_APPROVED', username, `Toggled approval on review ${id}`);
    return review || { id, isApproved: approvedVal };
  },

  async replyReview(id: string, replyText: string, username = 'admin') {
    return this.replyToReview(id, replyText, username);
  },

  async approveReview(id: string, username = 'admin') {
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
      await Review.findByIdAndUpdate(id, { isApproved: true });
    }

    let review: any = null;
    db.updateState((s) => {
      const r = s.reviews.find((item) => item.id === id);
      if (r) {
        r.isApproved = true;
        review = { ...r };
      }
    });

    db.logAudit('REVIEW_APPROVED', username, `Approved review ${id}`);
    return review || { id, isApproved: true };
  },

  async replyToReview(id: string, replyText: string, username = 'admin') {
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
      await Review.findByIdAndUpdate(id, { staffReply: replyText.trim() });
    }

    let review: any = null;
    db.updateState((s) => {
      const r = s.reviews.find((item) => item.id === id);
      if (r) {
        r.staffReply = replyText.trim();
        review = { ...r };
      }
    });

    db.logAudit('REVIEW_REPLIED', username, `Responded to review ${id}`);
    return review || { id, staffReply: replyText.trim() };
  },

  async deleteReview(id: string, username = 'admin') {
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
      await Review.findByIdAndDelete(id).catch(() => {});
    }

    db.updateState((s) => {
      s.reviews = s.reviews.filter((r) => r.id !== id);
    });

    db.logAudit('REVIEW_DELETED', username, `Deleted review ${id}`);
    return { success: true };
  },
};

export default reviewsService;
