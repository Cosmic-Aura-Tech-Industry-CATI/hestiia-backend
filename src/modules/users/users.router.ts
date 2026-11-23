import { Router } from 'express';
import { requireAuth, requireRole } from '../../shared/middlewares/auth.middleware.js';
import * as controller from './users.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole('SUPERADMIN'));

router.get('/', controller.getUsers);
router.post('/', controller.createUser);
router.get('/status', controller.getStatus);
router.get('/:id', controller.getUserById);
router.patch('/:id', controller.updateUser);
router.patch('/:id/role', controller.updateUserRole);
router.patch('/:id/status', controller.updateUserStatus);
router.delete('/:id', controller.deleteUser);

export default router;
export const usersRouter = router;
