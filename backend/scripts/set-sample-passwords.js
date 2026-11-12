import bcrypt from 'bcrypt';
import pool from '../src/config/db.js';

const MAT_KHAU_MAU = '123456';

const hash = await bcrypt.hash(MAT_KHAU_MAU, 10);
const [result] = await pool.query('UPDATE nguoi_dung SET mat_khau_hash = ?', [hash]);

console.log(`Đã đặt mật khẩu mẫu "${MAT_KHAU_MAU}" cho ${result.affectedRows} tài khoản.`);
await pool.end();