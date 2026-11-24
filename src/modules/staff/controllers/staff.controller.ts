import { Request, Response } from 'express';
import { catchAsync } from '../../../shared/utils/index.js';
import { staffService } from '../services/staff.service.js';

export const staffController = {
  /**
   * Service 1: Create Staff Member
   * POST /api/admin/staff
   */
  createStaff: catchAsync(async (req: Request, res: Response) => {
    const actor = (req as any).user?.username || (req as any).user?.name || 'admin';
    const staff = await staffService.createStaff(req.body, actor);

    return res.status(201).json({
      success: true,
      message: 'Staff member created successfully',
      data: staff,
    });
  }),

  /**
   * Service 2: Get All Staff Members
   * GET /api/admin/staff
   */
  getAllStaff: catchAsync(async (req: Request, res: Response) => {
    const result = await staffService.getAllStaff(req.query);

    return res.status(200).json({
      success: true,
      message: 'Staff members retrieved successfully',
      data: result,
    });
  }),

  /**
   * Service 3: Get Staff Member by ID
   * GET /api/admin/staff/:id
   */
  getStaffById: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const staff = await staffService.getStaffById(id);

    return res.status(200).json({
      success: true,
      message: 'Staff member retrieved successfully',
      data: staff,
    });
  }),

  /**
   * Service 4: Update Staff Member
   * PUT /api/admin/staff/:id
   */
  updateStaff: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const actor = (req as any).user?.username || (req as any).user?.name || 'admin';
    const staff = await staffService.updateStaff(id, req.body, actor);

    return res.status(200).json({
      success: true,
      message: 'Staff member updated successfully',
      data: staff,
    });
  }),

  /**
   * Service 5: Soft Delete Staff Member
   * DELETE /api/admin/staff/:id
   */
  deleteStaff: catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const actor = (req as any).user?.username || (req as any).user?.name || 'admin';
    const result = await staffService.deleteStaff(id, actor);

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  }),
};

export default staffController;
