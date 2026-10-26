import { Request, Response } from 'express';
import { catchAsync } from '../../shared/utils/catchAsync.js';
import { AuthenticatedRequest } from '../../shared/middlewares/auth.middleware.js';
import { categoriesService } from './categories.service.js';

export const getPublicCategories = catchAsync(async (_req: Request, res: Response) => {
  const categories = await categoriesService.getPublicCategories();
  res.status(200).json({ success: true, categories });
});

export const getAdminCategories = catchAsync(async (_req: AuthenticatedRequest, res: Response) => {
  const categories = await categoriesService.getAdminCategories();
  res.status(200).json({ success: true, categories });
});

export const createCategory = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const category = await categoriesService.createCategory(req.body, req.user?.username);
  res.status(201).json({
    success: true,
    category,
    message: `Category '${category.name}' created successfully.`,
  });
});

export const updateCategory = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const category = await categoriesService.updateCategory(req.params.id, req.body, req.user?.username);
  res.status(200).json({
    success: true,
    category,
    message: 'Category updated successfully.',
  });
});

export const deleteCategory = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { name } = await categoriesService.deleteCategory(req.params.id, req.user?.username);
  res.status(200).json({
    success: true,
    message: `Category '${name}' deleted successfully.`,
  });
});
