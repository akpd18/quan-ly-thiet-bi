import express from 'express';
import pool from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import catalogRoutes from './routes/catalog.routes.js';
import deviceRoutes from './routes/device.routes.js';
import departmentRoutes from './routes/department.routes.js';
import deviceTypeRoutes from './routes/device-type.routes.js';
import userRoutes from './routes/user.routes.js';
import loanRoutes from './routes/loan.routes.js';
import maintenanceRoutes from './routes/maintenance.routes.js';
import disposalRoutes from './routes/disposal.routes.js';
import transferRoutes from './routes/transfer.routes.js';

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
app.use('/api/catalog', catalogRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/device-types', deviceTypeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/disposals', disposalRoutes);
app.use('/api/transfers', transferRoutes);

// Bắt lỗi chưa xử lý
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Lỗi máy chủ, vui lòng thử lại sau' });
});

export default app;