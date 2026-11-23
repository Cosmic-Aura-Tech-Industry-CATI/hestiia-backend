import { Router } from 'express';
import { protect, restrictTo } from '../../../middleware/auth.middleware.js';
import { upload } from '../../../shared/middlewares/upload.middleware.js';
import { eventController } from '../controllers/event.controller.js';
import { eventMediaController } from '../controllers/eventMedia.controller.js';

// ==========================================
// 1. PUBLIC CUSTOMER EVENT ROUTES
// ==========================================
export const publicEventsRouter = Router();

publicEventsRouter.get('/', eventController.getPublishedEvents);
publicEventsRouter.get('/:id', eventController.getPublishedEventById);

// ==========================================
// 2. PROTECTED ADMIN EVENT ROUTES
// ==========================================
export const adminEventsRouter = Router();

// Require authenticated Admin or Manager
adminEventsRouter.use(protect);
adminEventsRouter.use(restrictTo('SUPERADMIN', 'MANAGER', 'superadmin', 'manager'));

// Event Management
adminEventsRouter.get('/', eventController.getAdminEvents);
adminEventsRouter.post('/', eventController.createEvent);
adminEventsRouter.get('/:id', eventController.getAdminEventById);
adminEventsRouter.put('/:id', eventController.updateEvent);
adminEventsRouter.patch('/:id/status', eventController.updateEventStatus);
adminEventsRouter.delete('/:id', eventController.deleteEvent);

// Media / Photographs Management (supports both /photos and /media endpoints)
adminEventsRouter.post('/:id/photos', upload.any(), eventMediaController.uploadPhotos);
adminEventsRouter.post('/:id/media', upload.any(), eventMediaController.uploadPhotos);

adminEventsRouter.get('/:id/photos', eventMediaController.getPhotos);
adminEventsRouter.get('/:id/media', eventMediaController.getPhotos);

adminEventsRouter.delete('/:id/photos/:mediaId', eventMediaController.deletePhoto);
adminEventsRouter.delete('/:id/media/:mediaId', eventMediaController.deletePhoto);

adminEventsRouter.patch('/:id/photos/:mediaId/cover', eventMediaController.setCover);
adminEventsRouter.patch('/:id/media/:mediaId/cover', eventMediaController.setCover);

adminEventsRouter.patch('/:id/photos/reorder', eventMediaController.reorderPhotos);
adminEventsRouter.patch('/:id/media/reorder', eventMediaController.reorderPhotos);

export default {
  publicEventsRouter,
  adminEventsRouter,
};
