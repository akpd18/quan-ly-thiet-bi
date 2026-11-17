import { Router } from 'express';
import {
  createUser,
  listUsers,
  resetPassword,
  setUserActive,
  updateUser,
} from '../controllers/user.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// Quản lý người dùng chỉ dành cho quản trị viên (Bảng 8)
router.use(authenticate, authorize('quan_tri'));

router.get('/', listUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.patch('/:id/active', setUserActive);
router.post('/:id/reset-password', resetPassword);

export default router;