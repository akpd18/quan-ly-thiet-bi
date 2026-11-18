import { Router } from 'express';
import {
  approveLoan,
  createLoan,
  getLoan,
  listBorrowers,
  listLoans,
  rejectLoan,
  returnLoan,
} from '../controllers/loan.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.use(authenticate);

// Quản trị viên lấy danh sách người mượn để lập phiếu hộ (phải đặt trước '/:id')
router.get('/borrowers', authorize('quan_tri'), listBorrowers);

// Nhân viên và quản trị viên đều xem được phiếu (nhân viên chỉ thấy phiếu của mình) và lập phiếu
router.get('/', listLoans);
router.post('/', createLoan);
router.get('/:id', getLoan);

// Duyệt, từ chối, xác nhận trả: chỉ quản trị viên (Bảng 8)
router.post('/:id/approve', authorize('quan_tri'), approveLoan);
router.post('/:id/reject', authorize('quan_tri'), rejectLoan);
router.post('/:id/return', authorize('quan_tri'), returnLoan);

export default router;