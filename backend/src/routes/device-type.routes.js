import { Router } from 'express';
import {
  createDeviceType,
  deleteDeviceType,
  listDeviceTypes,
  updateDeviceType,
} from '../controllers/device-type.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// Quản lý danh mục chỉ dành cho quản trị viên (Bảng 8)
router.use(authenticate, authorize('quan_tri'));

router.get('/', listDeviceTypes);
router.post('/', createDeviceType);
router.put('/:id', updateDeviceType);
router.delete('/:id', deleteDeviceType);

export default router;