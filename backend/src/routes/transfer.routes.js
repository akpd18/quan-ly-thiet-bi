import { Router } from 'express';
import {
  approveTransfer,
  createTransfer,
  listTransferableDevices,
  listTransfers,
  rejectTransfer,
} from '../controllers/transfer.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// Điều động thiết bị chỉ dành cho quản trị viên (Bảng 8)
router.use(authenticate, authorize('quan_tri'));

router.get('/', listTransfers);
router.get('/devices', listTransferableDevices);
router.post('/', createTransfer);
router.post('/:id/approve', approveTransfer);
router.post('/:id/reject', rejectTransfer);

export default router;