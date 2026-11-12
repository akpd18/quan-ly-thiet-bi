import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { toUserDto } from '../utils/user.js';

export async function login(req, res, next) {
  try {
    const { tenDangNhap, matKhau } = req.body ?? {};
    if (!tenDangNhap || !matKhau) {
      return res.status(400).json({ message: 'Vui lòng nhập tên đăng nhập và mật khẩu' });
    }

    const [rows] = await pool.query(
      `SELECT nd.*, pb.ten_phong_ban
       FROM nguoi_dung nd
       JOIN phong_ban pb ON pb.id = nd.phong_ban_id
       WHERE nd.ten_dang_nhap = ? LIMIT 1`,
      [tenDangNhap]
    );
    const row = rows[0];

    const hopLe = row && Boolean(row.hoat_dong) && (await bcrypt.compare(matKhau, row.mat_khau_hash));
    if (!hopLe) {
      // Không nói rõ sai tên hay sai mật khẩu để tránh lộ thông tin
      return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng' });
    }

    const token = jwt.sign({ id: row.id, vaiTro: row.vai_tro }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    res.json({ token, user: toUserDto(row) });
  } catch (error) {
    next(error);
  }
}

export function me(req, res) {
  res.json({ user: req.user });
}