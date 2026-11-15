import pool from '../config/db.js';
import { TINH_TRANG, TINH_TRANG_NHAP, TRANG_THAI } from '../constants/device.js';

const SELECT_DEVICE = `
  SELECT tb.id, tb.ma_thiet_bi, tb.ten_thiet_bi, tb.hang, tb.model, tb.so_serial,
         tb.ngay_nhap, tb.tinh_trang, tb.trang_thai, tb.ghi_chu,
         tb.loai_id, l.ten_loai, tb.phong_ban_id, pb.ten_phong_ban
  FROM thiet_bi tb
  JOIN loai_thiet_bi l ON l.id = tb.loai_id
  JOIN phong_ban pb ON pb.id = tb.phong_ban_id`;

function toDeviceDto(r) {
  return {
    id: r.id,
    maThietBi: r.ma_thiet_bi,
    tenThietBi: r.ten_thiet_bi,
    loaiId: r.loai_id,
    tenLoai: r.ten_loai,
    hang: r.hang,
    model: r.model,
    soSerial: r.so_serial,
    ngayNhap: r.ngay_nhap,
    phongBanId: r.phong_ban_id,
    tenPhongBan: r.ten_phong_ban,
    tinhTrang: r.tinh_trang,
    trangThai: r.trang_thai,
    ghiChu: r.ghi_chu,
  };
}

// Chuyển giá trị query thành số nguyên dương; trả về null nếu không hợp lệ
function toId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Cắt khoảng trắng hai đầu; chuỗi rỗng thì thành null
function text(value) {
  const s = String(value ?? '').trim();
  return s === '' ? null : s;
}

// Kiểm tra chuỗi dạng YYYY-MM-DD và là ngày có thật (không có 2026-02-30)
function isRealDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function todayString() {
  const now = new Date();
  const pad = (v) => String(v).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Kiểm tra các thông tin dùng chung cho thêm và sửa; trả về { error } hoặc { data }
function parseCommon(body) {
  const data = {
    tenThietBi: text(body.tenThietBi),
    hang: text(body.hang),
    model: text(body.model),
    soSerial: text(body.soSerial),
    ghiChu: text(body.ghiChu),
  };

  if (!data.tenThietBi) return { error: 'Vui lòng nhập tên thiết bị' };

  const limits = [
    ['Tên thiết bị', data.tenThietBi, 150],
    ['Hãng', data.hang, 100],
    ['Model', data.model, 100],
    ['Số serial', data.soSerial, 100],
    ['Ghi chú', data.ghiChu, 1000],
  ];
  for (const [label, value, max] of limits) {
    if (value && value.length > max) return { error: `${label} tối đa ${max} ký tự` };
  }
  return { data };
}

// Kiểm tra danh sách thông số kỹ thuật: mỗi thông số phải thuộc loại của thiết bị.
// Trả về { rows } (rows = null nghĩa là không gửi thông số, giữ nguyên) hoặc { error }
async function parseSpecs(thongSo, loaiId) {
  if (thongSo === undefined) return { rows: null };
  if (!Array.isArray(thongSo)) return { error: 'Danh sách thông số kỹ thuật không hợp lệ' };

  const [defs] = await pool.query('SELECT id FROM thong_so_loai WHERE loai_id = ?', [loaiId]);
  const validIds = new Set(defs.map((d) => d.id));

  const rows = [];
  const seen = new Set();
  for (const item of thongSo) {
    const thongSoId = toId(item?.thongSoId);
    if (!thongSoId || !validIds.has(thongSoId)) {
      return { error: 'Có thông số kỹ thuật không thuộc loại thiết bị này' };
    }
    if (seen.has(thongSoId)) return { error: 'Thông số kỹ thuật bị trùng' };
    seen.add(thongSoId);

    const giaTri = text(item.giaTri);
    if (!giaTri) continue; // để trống thì bỏ qua
    if (giaTri.length > 255) return { error: 'Giá trị thông số tối đa 255 ký tự' };
    rows.push([thongSoId, giaTri]);
  }
  return { rows };
}

export async function listDevices(req, res, next) {
  try {
    const { search, loaiId, phongBanId, tinhTrang, trangThai } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 10, 1), 100);

    const where = [];
    const params = [];

    const keyword = String(search ?? '').trim();
    if (keyword) {
      // Escape ký tự đặc biệt của LIKE để người dùng gõ % hoặc _ vẫn tìm đúng
      const like = `%${keyword.replace(/[\\%_]/g, '\\$&')}%`;
      where.push(
        '(tb.ma_thiet_bi LIKE ? OR tb.ten_thiet_bi LIKE ? OR tb.hang LIKE ? OR tb.model LIKE ? OR tb.so_serial LIKE ?)'
      );
      params.push(like, like, like, like, like);
    }

    if (loaiId) {
      const id = toId(loaiId);
      if (!id) return res.status(400).json({ message: 'Loại thiết bị không hợp lệ' });
      where.push('tb.loai_id = ?');
      params.push(id);
    }
    if (phongBanId) {
      const id = toId(phongBanId);
      if (!id) return res.status(400).json({ message: 'Phòng ban không hợp lệ' });
      where.push('tb.phong_ban_id = ?');
      params.push(id);
    }
    if (tinhTrang) {
      if (!TINH_TRANG.includes(tinhTrang)) {
        return res.status(400).json({ message: 'Tình trạng không hợp lệ' });
      }
      where.push('tb.tinh_trang = ?');
      params.push(tinhTrang);
    }
    if (trangThai) {
      if (!TRANG_THAI.includes(trangThai)) {
        return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
      }
      where.push('tb.trang_thai = ?');
      params.push(trangThai);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM thiet_bi tb ${whereSql}`,
      params
    );
    const [rows] = await pool.query(
      `${SELECT_DEVICE} ${whereSql} ORDER BY tb.id ASC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    res.json({ items: rows.map(toDeviceDto), total, page, pageSize });
  } catch (error) {
    next(error);
  }
}

export async function getDevice(req, res, next) {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã thiết bị không hợp lệ' });

    const [rows] = await pool.query(`${SELECT_DEVICE} WHERE tb.id = ?`, [id]);
    if (!rows[0]) return res.status(404).json({ message: 'Không tìm thấy thiết bị' });

    const [thongSo] = await pool.query(
      `SELECT ts.id AS id, ts.ten_thong_so AS ten, v.gia_tri AS giaTri
       FROM thiet_bi_thong_so v
       JOIN thong_so_loai ts ON ts.id = v.thong_so_id
       WHERE v.thiet_bi_id = ?
       ORDER BY ts.thu_tu`,
      [id]
    );

    res.json({ thietBi: { ...toDeviceDto(rows[0]), thongSo } });
  } catch (error) {
    next(error);
  }
}

// Thêm thiết bị mới: mã tự sinh theo quy tắc <ký hiệu loại>-<năm nhập>-<số thứ tự 3 chữ số>
export async function createDevice(req, res, next) {
  let conn;
  try {
    const body = req.body ?? {};

    const common = parseCommon(body);
    if (common.error) return res.status(400).json({ message: common.error });
    const { tenThietBi, hang, model, soSerial, ghiChu } = common.data;

    const loaiId = toId(body.loaiId);
    const phongBanId = toId(body.phongBanId);
    const ngayNhap = String(body.ngayNhap ?? '');
    const { tinhTrang } = body;

    if (!loaiId) return res.status(400).json({ message: 'Vui lòng chọn loại thiết bị' });
    if (!phongBanId) return res.status(400).json({ message: 'Vui lòng chọn phòng ban' });
    if (!isRealDate(ngayNhap)) return res.status(400).json({ message: 'Ngày nhập không hợp lệ' });
    if (ngayNhap > todayString()) {
      return res.status(400).json({ message: 'Ngày nhập không được sau ngày hiện tại' });
    }
    if (!TINH_TRANG_NHAP.includes(tinhTrang)) {
      return res.status(400).json({ message: 'Tình trạng phải là Mới, Tốt hoặc Cũ/trầy xước' });
    }

    const [[loai]] = await pool.query('SELECT id, ky_hieu FROM loai_thiet_bi WHERE id = ?', [loaiId]);
    if (!loai) return res.status(400).json({ message: 'Loại thiết bị không tồn tại' });

    const [[phongBan]] = await pool.query('SELECT id FROM phong_ban WHERE id = ?', [phongBanId]);
    if (!phongBan) return res.status(400).json({ message: 'Phòng ban không tồn tại' });

    const specs = await parseSpecs(body.thongSo, loaiId);
    if (specs.error) return res.status(400).json({ message: specs.error });
    const specRows = specs.rows ?? [];

    conn = await pool.getConnection();
    const prefix = `${loai.ky_hieu}-${ngayNhap.slice(0, 4)}`;
    let newId = null;
    let maThietBi = null;

    // Nếu hai người cùng thêm một lúc và trùng mã thì thử lại với số thứ tự kế tiếp
    for (let attempt = 0; attempt < 5 && !newId; attempt += 1) {
      await conn.beginTransaction();
      try {
        const [[{ maxSeq }]] = await conn.query(
          `SELECT MAX(CAST(SUBSTRING_INDEX(ma_thiet_bi, '-', -1) AS UNSIGNED)) AS maxSeq
           FROM thiet_bi WHERE ma_thiet_bi LIKE ?`,
          [`${prefix}-%`]
        );
        maThietBi = `${prefix}-${String(Number(maxSeq ?? 0) + 1).padStart(3, '0')}`;

        const [result] = await conn.query(
          `INSERT INTO thiet_bi
             (ma_thiet_bi, ten_thiet_bi, loai_id, hang, model, so_serial, ngay_nhap,
              phong_ban_id, tinh_trang, trang_thai, ghi_chu)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'san_sang', ?)`,
          [maThietBi, tenThietBi, loaiId, hang, model, soSerial, ngayNhap, phongBanId, tinhTrang, ghiChu]
        );

        if (specRows.length) {
          await conn.query(
            'INSERT INTO thiet_bi_thong_so (thiet_bi_id, thong_so_id, gia_tri) VALUES ?',
            [specRows.map(([thongSoId, giaTri]) => [result.insertId, thongSoId, giaTri])]
          );
        }

        await conn.commit();
        newId = result.insertId;
      } catch (error) {
        await conn.rollback();
        if (error.code !== 'ER_DUP_ENTRY') throw error;
      }
    }

    if (!newId) {
      return res.status(409).json({ message: 'Không tạo được mã thiết bị, vui lòng thử lại' });
    }
    res.status(201).json({ id: newId, maThietBi });
  } catch (error) {
    next(error);
  } finally {
    if (conn) conn.release();
  }
}

// Sửa thông tin thiết bị. Không cho đổi: mã, loại, ngày nhập, phòng ban (đổi bằng Điều động),
// trạng thái (hệ thống tự cập nhật theo nghiệp vụ).
export async function updateDevice(req, res, next) {
  let conn;
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã thiết bị không hợp lệ' });

    const body = req.body ?? {};
    const common = parseCommon(body);
    if (common.error) return res.status(400).json({ message: common.error });
    const { tenThietBi, hang, model, soSerial, ghiChu } = common.data;

    const [rows] = await pool.query(
      'SELECT id, loai_id, tinh_trang, trang_thai FROM thiet_bi WHERE id = ?',
      [id]
    );
    const current = rows[0];
    if (!current) return res.status(404).json({ message: 'Không tìm thấy thiết bị' });

    if (current.trang_thai === 'da_thanh_ly') {
      return res.status(400).json({ message: 'Thiết bị đã thanh lý, không thể chỉnh sửa' });
    }

    let tinhTrang = current.tinh_trang;
    if (body.tinhTrang !== undefined && body.tinhTrang !== current.tinh_trang) {
      if (current.trang_thai !== 'san_sang') {
        return res
          .status(400)
          .json({ message: 'Chỉ đổi tình trạng khi thiết bị đang ở trạng thái Sẵn sàng' });
      }
      if (!TINH_TRANG_NHAP.includes(body.tinhTrang)) {
        return res.status(400).json({ message: 'Tình trạng phải là Mới, Tốt hoặc Cũ/trầy xước' });
      }
      tinhTrang = body.tinhTrang;
    }

    const specs = await parseSpecs(body.thongSo, current.loai_id);
    if (specs.error) return res.status(400).json({ message: specs.error });

    conn = await pool.getConnection();
    await conn.beginTransaction();
    try {
      await conn.query(
        `UPDATE thiet_bi
         SET ten_thiet_bi = ?, hang = ?, model = ?, so_serial = ?, tinh_trang = ?, ghi_chu = ?
         WHERE id = ?`,
        [tenThietBi, hang, model, soSerial, tinhTrang, ghiChu, id]
      );

      // Có gửi thông số thì thay toàn bộ thông số cũ bằng danh sách mới
      if (specs.rows !== null) {
        await conn.query('DELETE FROM thiet_bi_thong_so WHERE thiet_bi_id = ?', [id]);
        if (specs.rows.length) {
          await conn.query(
            'INSERT INTO thiet_bi_thong_so (thiet_bi_id, thong_so_id, gia_tri) VALUES ?',
            [specs.rows.map(([thongSoId, giaTri]) => [id, thongSoId, giaTri])]
          );
        }
      }
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    }

    res.json({ id });
  } catch (error) {
    next(error);
  } finally {
    if (conn) conn.release();
  }
}