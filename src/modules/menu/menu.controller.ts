import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import { menuService } from './menu.service.js';

export const getPublicMenu = catchAsync(async (req: Request, res: Response) => {
  const result = await menuService.getPublicMenu(req.query as any);
  res.status(200).json({ success: true, ...result });
});

export const getDishById = catchAsync(async (req: Request, res: Response) => {
  const dish = await menuService.getDishById(req.params.id);
  res.status(200).json({ success: true, dish });
});

export const getAdminDishes = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const result = await menuService.getAdminDishes(req.query as any);
  res.status(200).json({ success: true, ...result });
});

export const createDish = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const dish = await menuService.createDish(req.body, req.user?.username);
  res.status(201).json({
    success: true,
    dish,
    message: `${dish.name} has been added to the restaurant menu.`,
  });
});

export const updateDish = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const dish = await menuService.updateDish(req.params.id, req.body, req.user?.username);
  res.status(200).json({
    success: true,
    dish,
    message: `${dish.name} updated successfully.`,
  });
});

export const toggleAvailability = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { dish, statusText } = await menuService.toggleAvailability(req.params.id, req.body.available, req.user?.username);
  res.status(200).json({
    success: true,
    dish,
    message: `${dish.name} is now marked as ${statusText}.`,
  });
});

export const deleteDish = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const result = await menuService.deleteDish(req.params.id, req.user?.username);
  res.status(200).json({
    success: true,
    ...result,
  });
});
