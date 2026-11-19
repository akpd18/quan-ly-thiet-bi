import { Router } from 'express';
import {
  completeMaintenance,
  listDue,
  listEligibleDevices,
  listMaintenance,
  startMaintenance,
} from '../controllers/maintenance.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// Quản lý bảo dưỡng - sửa chữa chỉ dành cho quản trị viên (Bảng 8)
router.use(authenticate, authorize('quan_tri'));

router.get('/', listMaintenance);
router.get('/due', listDue);
router.get('/devices', listEligibleDevices);
router.post('/', startMaintenance);
router.post('/:id/complete', completeMaintenance);

export default router;