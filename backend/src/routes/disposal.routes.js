import { Router } from 'express';
import {
  approveDisposal,
  createDisposal,
  listDisposableDevices,
  listDisposals,
  rejectDisposal,
} from '../controllers/disposal.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// Thanh lý thiết bị chỉ dành cho quản trị viên (Bảng 8)
router.use(authenticate, authorize('quan_tri'));

router.get('/', listDisposals);
router.get('/devices', listDisposableDevices);
router.post('/', createDisposal);
router.post('/:id/approve', approveDisposal);
router.post('/:id/reject', rejectDisposal);

export default router;