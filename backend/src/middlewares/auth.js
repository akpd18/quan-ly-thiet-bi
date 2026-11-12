import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { SELECT_USER, toUserDto } from '../utils/user.js';

// Kiểm tra token, nạp thông tin người dùng hiện tại vào req.user
export async function authenticate(req, res, next) {
  try {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Bạn chưa đăng nhập' });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ' });
    }

    // Đọc lại từ CSDL để tài khoản bị khóa hoặc đổi vai trò có hiệu lực ngay
    const [rows] = await pool.query(`${SELECT_USER} WHERE nd.id = ? AND nd.hoat_dong = 1`, [payload.id]);
    if (!rows[0]) {
      return res.status(401).json({ message: 'Tài khoản không còn hiệu lực' });
    }

    req.user = toUserDto(rows[0]);
    next();
  } catch (error) {
    next(error);
  }
}

// Chỉ cho phép các vai trò được liệt kê. Dùng sau authenticate.
export function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.vaiTro)) {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện chức năng này' });
    }
    next();
  };
}