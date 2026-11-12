import express from 'express';
import pool from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import { authenticate, authorize } from './middlewares/auth.js';

const app = express();
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    const [[tong]] = await pool.query('SELECT COUNT(*) AS tong FROM thiet_bi');
    const [theoTrangThai] = await pool.query(
      'SELECT trang_thai, COUNT(*) AS so_luong FROM thiet_bi GROUP BY trang_thai'
    );
    res.json({ status: 'ok', tongThietBi: tong.tong, theoTrangThai });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: 'error',
      message: error.message || error.code || 'Không kết nối được MySQL',
    });
  }
});

app.use('/api/auth', authRoutes);

// Route thử phân quyền, sẽ xóa ở bước sau
app.get('/api/admin/ping', authenticate, authorize('quan_tri'), (req, res) => {
  res.json({ message: 'Bạn là quản trị viên, truy cập hợp lệ' });
});

// Bắt lỗi chưa xử lý
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Lỗi máy chủ, vui lòng thử lại sau' });
});

export default app;