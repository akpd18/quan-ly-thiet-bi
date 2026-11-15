import { Router } from 'express';
import {
  createDevice,
  getDevice,
  listDevices,
  updateDevice,
} from '../controllers/device.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.use(authenticate);

// Cả quản trị viên và nhân viên đều được xem danh sách và thông tin thiết bị (Bảng 8)
router.get('/', listDevices);
router.get('/:id', getDevice);

// Chỉ quản trị viên được thêm và sửa thiết bị
router.post('/', authorize('quan_tri'), createDevice);
router.put('/:id', authorize('quan_tri'), updateDevice);

export default router;