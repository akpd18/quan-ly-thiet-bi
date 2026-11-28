import { Router } from 'express';
import {
  addExtra,
  completeInventory,
  createInventory,
  deleteExtra,
  getInventory,
  listInventories,
  listInventoryItems,
  markAllCorrect,
  recordItem,
} from '../controllers/inventory.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// Kiểm kê thiết bị chỉ dành cho quản trị viên (Bảng 8)
router.use(authenticate, authorize('quan_tri'));

router.get('/', listInventories);
router.post('/', createInventory);
router.get('/:id', getInventory);
router.get('/:id/items', listInventoryItems);
router.put('/:id/items/:itemId', recordItem);
router.delete('/:id/items/:itemId', deleteExtra);
router.post('/:id/mark-all-correct', markAllCorrect);
router.post('/:id/extras', addExtra);
router.post('/:id/complete', completeInventory);

export default router;