import { Request, Response } from 'express';
import { catchAsync } from '../../../shared/utils/index.js';
import { sendSuccess } from '../../../shared/responses/index.js';
import { eventService } from '../services/event.service.js';

export const eventController = {
  /**
   * Public: List all published events
   */
  getPublishedEvents: catchAsync(async (req: Request, res: Response) => {
    const result = await eventService.getPublishedEvents(req.query);
    sendSuccess(res, result);
  }),

  /**
   * Public: Get published event by ID with media
   */
  getPublishedEventById: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const event = await eventService.getPublishedEventById(id);
    sendSuccess(res, { event });
  }),

  /**
   * Admin: List all events with filters & pagination
   */
  getAdminEvents: catchAsync(async (req: Request, res: Response) => {
    const result = await eventService.getAdminEvents(req.query);
    sendSuccess(res, result);
  }),

  /**
   * Admin: Get event by ID with media
   */
  getAdminEventById: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const event = await eventService.getAdminEventById(id);
    sendSuccess(res, { event });
  }),

  /**
   * Admin: Create new event
   */
  createEvent: catchAsync(async (req: Request, res: Response) => {
    const username = (req as any).user?.username || (req as any).user?.name || 'admin';
    const event = await eventService.createEvent(req.body, username);
    sendSuccess(res, { event }, 201, 'Event created successfully');
  }),

  /**
   * Admin: Update event details
   */
  updateEvent: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const username = (req as any).user?.username || (req as any).user?.name || 'admin';
    const event = await eventService.updateEvent(id, req.body, username);
    sendSuccess(res, { event }, 200, 'Event updated successfully');
  }),

  /**
   * Admin: Update event status (publish, unpublish, archive)
   */
  updateEventStatus: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const status = req.body?.status;
    const username = (req as any).user?.username || (req as any).user?.name || 'admin';
    const event = await eventService.updateEventStatus(id, status, username);
    sendSuccess(res, { event }, 200, 'Event status updated successfully');
  }),

  /**
   * Admin: Delete event & cleanup media
   */
  deleteEvent: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const username = (req as any).user?.username || (req as any).user?.name || 'admin';
    const result = await eventService.deleteEvent(id, username);
    sendSuccess(res, result, 200, result.message);
  }),
};

export default eventController;
