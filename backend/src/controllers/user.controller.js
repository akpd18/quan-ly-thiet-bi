import bcrypt from 'bcrypt';
import pool from '../config/db.js';
import { text, toId } from '../utils/validate.js';

const VAI_TRO = ['quan_tri', 'nhan_vien'];
const USERNAME_PATTERN = /^[A-Za-z0-9._]{3,50}$/;

const SELECT_ACCOUNT = `
  SELECT nd.id, nd.ho_ten, nd.ten_dang_nhap, nd.vai_tro, nd.phong_ban_id,
         pb.ten_phong_ban, nd.hoat_dong, nd.created_at
  FROM nguoi_dung nd
  JOIN phong_ban pb ON pb.id = nd.phong_ban_id`;

function toAccountDto(r) {
  return {
    id: r.id,
    hoTen: r.ho_ten,
    tenDangNhap: r.ten_dang_nhap,
    vaiTro: r.vai_tro,
    phongBanId: r.phong_ban_id,
    tenPhongBan: r.ten_phong_ban,
    hoatDong: Boolean(r.hoat_dong),
    ngayTao: r.created_at,
  };
}

// Kiểm tra họ tên, tên đăng nhập, vai trò, phòng ban; trả về { error } hoặc { data }
function parseProfile(body) {
  const hoTen = text(body.hoTen);
  if (!hoTen) return { error: 'Vui lòng nhập họ tên' };
  if (hoTen.length > 100) return { error: 'Họ tên tối đa 100 ký tự' };

  const tenDangNhap = text(body.tenDangNhap);
  if (!tenDangNhap || !USERNAME_PATTERN.test(tenDangNhap)) {
    return {
      error:
        'Tên đăng nhập gồm 3 đến 50 ký tự: chữ cái không dấu, chữ số, dấu chấm hoặc gạch dưới',
    };
  }

  if (!VAI_TRO.includes(body.vaiTro)) return { error: 'Vai trò không hợp lệ' };

  const phongBanId = toId(body.phongBanId);
  if (!phongBanId) return { error: 'Vui lòng chọn phòng ban' };

  return { data: { hoTen, tenDangNhap, vaiTro: body.vaiTro, phongBanId } };
}

// Kiểm tra mật khẩu mới; không cắt khoảng trắng vì khoảng trắng có thể là một phần mật khẩu
function checkPassword(value) {
  const matKhau = typeof value === 'string' ? value : '';
  if (matKhau.length < 6) return { error: 'Mật khẩu cần có ít nhất 6 ký tự' };
  if (matKhau.trim() === '') return { error: 'Mật khẩu không được chỉ gồm khoảng trắng' };
  // bcrypt chỉ xét 72 byte đầu, nên chặn mật khẩu dài hơn để không bị cắt ngầm
  if (Buffer.byteLength(matKhau, 'utf8') > 72) {
    return { error: 'Mật khẩu quá dài (tối đa 72 byte)' };
  }
  return { matKhau };
}

// Số quản trị viên đang hoạt động, không tính người có mã id
async function countOtherActiveAdmins(id) {
  const [[row]] = await pool.query(
    "SELECT COUNT(*) AS n FROM nguoi_dung WHERE vai_tro = 'quan_tri' AND hoat_dong = 1 AND id <> ?",
    [id]
  );
  return Number(row.n);
}

export async function listUsers(req, res, next) {
  try {
    const { search, vaiTro, phongBanId, hoatDong } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 10, 1), 100);

    const where = [];
    const params = [];

    const keyword = String(search ?? '').trim();
    if (keyword) {
      const like = `%${keyword.replace(/[\\%_]/g, '\\$&')}%`;
      where.push('(nd.ho_ten LIKE ? OR nd.ten_dang_nhap LIKE ?)');
      params.push(like, like);
    }
    if (vaiTro) {
      if (!VAI_TRO.includes(vaiTro)) return res.status(400).json({ message: 'Vai trò không hợp lệ' });
      where.push('nd.vai_tro = ?');
      params.push(vaiTro);
    }
    if (phongBanId) {
      const id = toId(phongBanId);
      if (!id) return res.status(400).json({ message: 'Phòng ban không hợp lệ' });
      where.push('nd.phong_ban_id = ?');
      params.push(id);
    }
    if (hoatDong !== undefined && hoatDong !== '') {
      if (hoatDong !== '0' && hoatDong !== '1') {
        return res.status(400).json({ message: 'Trạng thái tài khoản không hợp lệ' });
      }
      where.push('nd.hoat_dong = ?');
      params.push(Number(hoatDong));
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM nguoi_dung nd ${whereSql}`,
      params
    );
    const [rows] = await pool.query(
      `${SELECT_ACCOUNT} ${whereSql} ORDER BY nd.id ASC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    res.json({ items: rows.map(toAccountDto), total: Number(total), page, pageSize });
  } catch (error) {
    next(error);
  }
}

export async function createUser(req, res, next) {
  try {
    const body = req.body ?? {};

    const profile = parseProfile(body);
    if (profile.error) return res.status(400).json({ message: profile.error });
    const password = checkPassword(body.matKhau);
    if (password.error) return res.status(400).json({ message: password.error });
    const { hoTen, tenDangNhap, vaiTro, phongBanId } = profile.data;

    const [phongBan] = await pool.query('SELECT id FROM phong_ban WHERE id = ?', [phongBanId]);
    if (!phongBan[0]) return res.status(400).json({ message: 'Phòng ban không tồn tại' });

    const hash = await bcrypt.hash(password.matKhau, 10);
    const [result] = await pool.query(
      `INSERT INTO nguoi_dung (ho_ten, ten_dang_nhap, mat_khau_hash, vai_tro, phong_ban_id)
       VALUES (?, ?, ?, ?, ?)`,
      [hoTen, tenDangNhap, hash, vaiTro, phongBanId]
    );
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Tên đăng nhập đã tồn tại' });
    }
    next(error);
  }
}

export async function updateUser(req, res, next) {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã người dùng không hợp lệ' });

    const profile = parseProfile(req.body ?? {});
    if (profile.error) return res.status(400).json({ message: profile.error });
    const { hoTen, tenDangNhap, vaiTro, phongBanId } = profile.data;

    const [rows] = await pool.query('SELECT id, vai_tro, hoat_dong FROM nguoi_dung WHERE id = ?', [id]);
    const current = rows[0];
    if (!current) return res.status(404).json({ message: 'Không tìm thấy người dùng' });

    if (id === req.user.id && vaiTro !== current.vai_tro) {
      return res.status(400).json({ message: 'Không thể tự đổi vai trò của chính mình' });
    }
    if (
      current.vai_tro === 'quan_tri' &&
      vaiTro !== 'quan_tri' &&
      (await countOtherActiveAdmins(id)) === 0
    ) {
      return res
        .status(400)
        .json({ message: 'Hệ thống phải còn ít nhất một quản trị viên đang hoạt động' });
    }

    const [phongBan] = await pool.query('SELECT id FROM phong_ban WHERE id = ?', [phongBanId]);
    if (!phongBan[0]) return res.status(400).json({ message: 'Phòng ban không tồn tại' });

    await pool.query(
      'UPDATE nguoi_dung SET ho_ten = ?, ten_dang_nhap = ?, vai_tro = ?, phong_ban_id = ? WHERE id = ?',
      [hoTen, tenDangNhap, vaiTro, phongBanId, id]
    );
    res.json({ id });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Tên đăng nhập đã tồn tại' });
    }
    next(error);
  }
}

// Khóa hoặc mở khóa tài khoản. Tài khoản bị khóa không đăng nhập được và mất quyền ngay lập tức.
export async function setUserActive(req, res, next) {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã người dùng không hợp lệ' });

    const hoatDong = req.body?.hoatDong;
    if (typeof hoatDong !== 'boolean') {
      return res.status(400).json({ message: 'Giá trị hoạt động không hợp lệ' });
    }

    const [rows] = await pool.query('SELECT id, vai_tro, hoat_dong FROM nguoi_dung WHERE id = ?', [id]);
    const current = rows[0];
    if (!current) return res.status(404).json({ message: 'Không tìm thấy người dùng' });

    if (!hoatDong) {
      if (id === req.user.id) {
        return res.status(400).json({ message: 'Không thể tự khóa tài khoản của chính mình' });
      }
      if (current.vai_tro === 'quan_tri' && (await countOtherActiveAdmins(id)) === 0) {
        return res
          .status(400)
          .json({ message: 'Hệ thống phải còn ít nhất một quản trị viên đang hoạt động' });
      }
    }

    await pool.query('UPDATE nguoi_dung SET hoat_dong = ? WHERE id = ?', [hoatDong ? 1 : 0, id]);
    res.json({ id, hoatDong });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã người dùng không hợp lệ' });

    const password = checkPassword(req.body?.matKhau);
    if (password.error) return res.status(400).json({ message: password.error });

    const [rows] = await pool.query('SELECT id FROM nguoi_dung WHERE id = ?', [id]);
    if (!rows[0]) return res.status(404).json({ message: 'Không tìm thấy người dùng' });

    const hash = await bcrypt.hash(password.matKhau, 10);
    await pool.query('UPDATE nguoi_dung SET mat_khau_hash = ? WHERE id = ?', [hash, id]);
    res.json({ id });
  } catch (error) {
    next(error);
  }
}