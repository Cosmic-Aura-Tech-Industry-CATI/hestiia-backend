export * from '../shared/middlewares/auth.middleware.js';
export {
  requireAuth as protect,
  requireRole as restrictTo,
  requireAuth as authenticateAdmin,
  requireRole as requireRoleAlias,
} from '../shared/middlewares/auth.middleware.js';
