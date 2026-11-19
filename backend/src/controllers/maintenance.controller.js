import pool from '../config/db.js';
import { HttpError, sendError, withTransaction } from '../utils/http.js';
import { isRealDate, text, toId, todayString } from '../utils/validate.js';

const LOAI_HINH = ['bao_duong', 'sua_chua'];
const KET_QUA = ['dang_thuc_hien', 'thanh_cong', 'khong_thanh_cong'];
const DUE_SOON_DAYS = 7;
const MAX_MONEY = 99999999999;

const LOAI_HINH_LABEL = { bao_duong: 'bảo dưỡng', sua_chua: 'sửa chữa' };
const TRANG_THAI_LABEL = {
  san_sang: 'Sẵn sàng',
  dang_muon: 'Đang mượn',
  dang_bao_duong: 'Đang bảo dưỡng',
  dang_sua_chua: 'Đang sửa chữa',
  cho_xu_ly: 'Chờ xử lý',
  that_lac: 'Thất lạc',
  da_thanh_ly: 'Đã thanh lý',
};

// Thiết bị ở trạng thái nào thì được bắt đầu bảo dưỡng hoặc sửa chữa
const START_ALLOWED = {
  bao_duong: ['san_sang'],
  sua_chua: ['san_sang', 'cho_xu_ly'],
};
// Trạng thái thiết bị trong lúc đang bảo dưỡng hoặc sửa chữa
const ACTIVE_STATUS = { bao_duong: 'dang_bao_duong', sua_chua: 'dang_sua_chua' };
// Tình trạng được chọn khi hoàn tất thành công (Bảng 10)
const AFTER_SUCCESS = { bao_duong: ['moi', 'tot', 'cu'], sua_chua: ['tot', 'cu'] };

// Cộng thêm n ngày vào chuỗi ngày YYYY-MM-DD
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + n);
  const pad = (v) => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseMoney(value) {
  if (value === undefined || value === null || value === '') return { value: 0 };
  if (typeof value !== 'number' && typeof value !== 'string') {
    return { error: 'Chi phí không hợp lệ' };
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > MAX_MONEY) {
    return { error: 'Chi phí phải là số nguyên từ 0 đến 99.999.999.999 đồng' };
  }
  return { value: n };
}

const SELECT_MAINTENANCE = `
  SELECT m.id, m.thiet_bi_id, tb.ma_thiet_bi, tb.ten_thiet_bi, l.ten_loai, pb.ten_phong_ban,
         tb.tinh_trang AS tinh_trang_hien_tai, tb.trang_thai AS trang_thai_hien_tai,
         COALESCE(tb.chu_ky_bao_duong_thang, l.chu_ky_bao_duong_thang) AS chu_ky,
         m.loai_hinh, m.ngay_bat_dau, m.ngay_hoan_tat, m.van_de, m.noi_dung_xu_ly, m.chi_phi,
         m.ket_qua, m.tinh_trang_sau_xu_ly, m.ngay_bao_duong_ke_tiep,
         m.nguoi_tao_id, nt.ho_ten AS ten_nguoi_tao, m.created_at
  FROM bao_duong_sua_chua m
  JOIN thiet_bi tb ON tb.id = m.thiet_bi_id
  JOIN loai_thiet_bi l ON l.id = tb.loai_id
  JOIN phong_ban pb ON pb.id = tb.phong_ban_id
  JOIN nguoi_dung nt ON nt.id = m.nguoi_tao_id`;

function toMaintenanceDto(r) {
  return {
    id: r.id,
    thietBi: {
      id: r.thiet_bi_id,
      maThietBi: r.ma_thiet_bi,
      tenThietBi: r.ten_thiet_bi,
      tenLoai: r.ten_loai,
      tenPhongBan: r.ten_phong_ban,
      tinhTrang: r.tinh_trang_hien_tai,
      trangThai: r.trang_thai_hien_tai,
    },
    chuKyBaoDuongThang: r.chu_ky === null ? null : Number(r.chu_ky),
    loaiHinh: r.loai_hinh,
    ngayBatDau: r.ngay_bat_dau,
    ngayHoanTat: r.ngay_hoan_tat,
    vanDe: r.van_de,
    noiDungXuLy: r.noi_dung_xu_ly,
    chiPhi: Number(r.chi_phi),
    ketQua: r.ket_qua,
    tinhTrangSauXuLy: r.tinh_trang_sau_xu_ly,
    ngayBaoDuongKeTiep: r.ngay_bao_duong_ke_tiep,
    nguoiTao: { id: r.nguoi_tao_id, hoTen: r.ten_nguoi_tao },
    ngayTao: r.created_at,
  };
}

// Lịch sử bảo dưỡng - sửa chữa; các lần đang thực hiện xếp trước
export async function listMaintenance(req, res, next) {
  try {
    const { search, loaiHinh, ketQua, thietBiId } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 10, 1), 100);

    const where = [];
    const params = [];

    const keyword = String(search ?? '').trim();
    if (keyword) {
      const like = `%${keyword.replace(/[\\%_]/g, '\\$&')}%`;
      where.push('(tb.ma_thiet_bi LIKE ? OR tb.ten_thiet_bi LIKE ?)');
      params.push(like, like);
    }
    if (loaiHinh) {
      if (!LOAI_HINH.includes(loaiHinh)) return res.status(400).json({ message: 'Loại hình không hợp lệ' });
      where.push('m.loai_hinh = ?');
      params.push(loaiHinh);
    }
    if (ketQua) {
      if (!KET_QUA.includes(ketQua)) return res.status(400).json({ message: 'Kết quả không hợp lệ' });
      where.push('m.ket_qua = ?');
      params.push(ketQua);
    }
    if (thietBiId) {
      const id = toId(thietBiId);
      if (!id) return res.status(400).json({ message: 'Mã thiết bị không hợp lệ' });
      where.push('m.thiet_bi_id = ?');
      params.push(id);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM bao_duong_sua_chua m
       JOIN thiet_bi tb ON tb.id = m.thiet_bi_id
       ${whereSql}`,
      params
    );
    const [rows] = await pool.query(
      `${SELECT_MAINTENANCE} ${whereSql}
       ORDER BY (m.ket_qua = 'dang_thuc_hien') DESC, m.ngay_bat_dau DESC, m.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    res.json({ items: rows.map(toMaintenanceDto), total: Number(total), page, pageSize });
  } catch (error) {
    next(error);
  }
}

// Thiết bị đến hạn hoặc quá hạn bảo dưỡng.
// Hạn bảo dưỡng = ngày bảo dưỡng kế tiếp của lần bảo dưỡng thành công gần nhất;
// chưa từng bảo dưỡng thì tính từ ngày nhập cộng chu kỳ (chu kỳ riêng của thiết bị, nếu không có thì chu kỳ của loại).
export async function listDue(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 10, 1), 100);
    const today = todayString();
    const soon = addDays(today, DUE_SOON_DAYS);

    const dueQuery = `
      SELECT t.* FROM (
        SELECT tb.id, tb.ma_thiet_bi, tb.ten_thiet_bi, l.ten_loai, pb.ten_phong_ban,
               tb.tinh_trang, tb.trang_thai,
               COALESCE(tb.chu_ky_bao_duong_thang, l.chu_ky_bao_duong_thang) AS chu_ky,
               COALESCE(
                 (SELECT MAX(m.ngay_bao_duong_ke_tiep)
                  FROM bao_duong_sua_chua m
                  WHERE m.thiet_bi_id = tb.id AND m.loai_hinh = 'bao_duong'
                    AND m.ket_qua = 'thanh_cong' AND m.ngay_bao_duong_ke_tiep IS NOT NULL),
                 DATE_ADD(tb.ngay_nhap,
                          INTERVAL COALESCE(tb.chu_ky_bao_duong_thang, l.chu_ky_bao_duong_thang) MONTH)
               ) AS han_bao_duong
        FROM thiet_bi tb
        JOIN loai_thiet_bi l ON l.id = tb.loai_id
        JOIN phong_ban pb ON pb.id = tb.phong_ban_id
        WHERE tb.trang_thai IN ('san_sang', 'dang_muon')
          AND COALESCE(tb.chu_ky_bao_duong_thang, l.chu_ky_bao_duong_thang) IS NOT NULL
      ) t
      WHERE t.han_bao_duong <= ?`;

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM (${dueQuery}) due`, [soon]);
    const [rows] = await pool.query(
      `${dueQuery} ORDER BY t.han_bao_duong ASC, t.id ASC LIMIT ? OFFSET ?`,
      [soon, pageSize, (page - 1) * pageSize]
    );

    res.json({
      items: rows.map((r) => ({
        id: r.id,
        maThietBi: r.ma_thiet_bi,
        tenThietBi: r.ten_thiet_bi,
        tenLoai: r.ten_loai,
        tenPhongBan: r.ten_phong_ban,
        tinhTrang: r.tinh_trang,
        trangThai: r.trang_thai,
        chuKyBaoDuongThang: Number(r.chu_ky),
        hanBaoDuong: r.han_bao_duong,
        quaHan: r.han_bao_duong < today,
      })),
      total: Number(total),
      page,
      pageSize,
      soNgayCanhBao: DUE_SOON_DAYS,
    });
  } catch (error) {
    next(error);
  }
}

// Thiết bị có thể bắt đầu bảo dưỡng hoặc sửa chữa, dùng cho ô chọn thiết bị
export async function listEligibleDevices(req, res, next) {
  try {
    const { loaiHinh, search } = req.query;
    if (!LOAI_HINH.includes(loaiHinh)) {
      return res.status(400).json({ message: 'Loại hình không hợp lệ' });
    }

    const where = ['tb.trang_thai IN (?)'];
    const params = [START_ALLOWED[loaiHinh]];

    const keyword = String(search ?? '').trim();
    if (keyword) {
      const like = `%${keyword.replace(/[\\%_]/g, '\\$&')}%`;
      where.push('(tb.ma_thiet_bi LIKE ? OR tb.ten_thiet_bi LIKE ?)');
      params.push(like, like);
    }

    const [rows] = await pool.query(
      `SELECT tb.id, tb.ma_thiet_bi, tb.ten_thiet_bi, tb.trang_thai, pb.ten_phong_ban
       FROM thiet_bi tb
       JOIN phong_ban pb ON pb.id = tb.phong_ban_id
       WHERE ${where.join(' AND ')}
       ORDER BY tb.ma_thiet_bi
       LIMIT 20`,
      params
    );

    res.json({
      items: rows.map((r) => ({
        id: r.id,
        maThietBi: r.ma_thiet_bi,
        tenThietBi: r.ten_thiet_bi,
        trangThai: r.trang_thai,
        tenPhongBan: r.ten_phong_ban,
      })),
    });
  } catch (error) {
    next(error);
  }
}

// Bắt đầu bảo dưỡng hoặc sửa chữa: thiết bị chuyển sang Đang bảo dưỡng hoặc Đang sửa chữa (Bảng 10)
export async function startMaintenance(req, res, next) {
  try {
    const body = req.body ?? {};
    const today = todayString();

    const thietBiId = toId(body.thietBiId);
    if (!thietBiId) return res.status(400).json({ message: 'Vui lòng chọn thiết bị' });
    if (!LOAI_HINH.includes(body.loaiHinh)) {
      return res.status(400).json({ message: 'Loại hình không hợp lệ' });
    }
    const { loaiHinh } = body;

    const ngayBatDau = String(body.ngayBatDau ?? '');
    if (!isRealDate(ngayBatDau)) return res.status(400).json({ message: 'Ngày bắt đầu không hợp lệ' });
    if (ngayBatDau > today) {
      return res.status(400).json({ message: 'Ngày bắt đầu không được sau ngày hôm nay' });
    }

    const vanDe = text(body.vanDe);
    if (vanDe && vanDe.length > 2000) {
      return res.status(400).json({ message: 'Vấn đề tối đa 2000 ký tự' });
    }
    if (loaiHinh === 'sua_chua' && !vanDe) {
      return res.status(400).json({ message: 'Vui lòng mô tả sự cố cần sửa chữa' });
    }

    const created = await withTransaction(pool, async (conn) => {
      const [rows] = await conn.query(
        'SELECT id, ma_thiet_bi, ngay_nhap, trang_thai FROM thiet_bi WHERE id = ? FOR UPDATE',
        [thietBiId]
      );
      const device = rows[0];
      if (!device) throw new HttpError(404, 'Không tìm thấy thiết bị');

      if (!START_ALLOWED[loaiHinh].includes(device.trang_thai)) {
        throw new HttpError(
          409,
          `Thiết bị ${device.ma_thiet_bi} đang ở trạng thái ${TRANG_THAI_LABEL[device.trang_thai]}, không thể bắt đầu ${LOAI_HINH_LABEL[loaiHinh]}`
        );
      }
      if (ngayBatDau < device.ngay_nhap) {
        throw new HttpError(400, 'Ngày bắt đầu không được trước ngày nhập của thiết bị');
      }

      const [result] = await conn.query(
        `INSERT INTO bao_duong_sua_chua
           (thiet_bi_id, loai_hinh, ngay_bat_dau, van_de, ket_qua, nguoi_tao_id)
         VALUES (?, ?, ?, ?, 'dang_thuc_hien', ?)`,
        [thietBiId, loaiHinh, ngayBatDau, vanDe, req.user.id]
      );
      await conn.query('UPDATE thiet_bi SET trang_thai = ? WHERE id = ?', [
        ACTIVE_STATUS[loaiHinh],
        thietBiId,
      ]);
      return { id: result.insertId };
    });

    res.status(201).json(created);
  } catch (error) {
    sendError(error, res, next);
  }
}

// Hoàn tất một lần bảo dưỡng hoặc sửa chữa (Bảng 10):
// - Thành công: thiết bị về Sẵn sàng, tình trạng theo kết quả (sau bảo dưỡng: Mới, Tốt hoặc Cũ/trầy xước;
//   sau sửa chữa: Tốt hoặc Cũ/trầy xước). Bảo dưỡng thành công còn tính ngày bảo dưỡng kế tiếp theo chu kỳ.
// - Không thành công: thiết bị ghi nhận Hỏng và chuyển sang Chờ xử lý.
export async function completeMaintenance(req, res, next) {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã bản ghi không hợp lệ' });

    const body = req.body ?? {};
    const today = todayString();

    if (body.ketQua !== 'thanh_cong' && body.ketQua !== 'khong_thanh_cong') {
      return res.status(400).json({ message: 'Vui lòng chọn kết quả: thành công hoặc không thành công' });
    }
    const { ketQua } = body;

    const ngayHoanTat = String(body.ngayHoanTat ?? '');
    if (!isRealDate(ngayHoanTat)) return res.status(400).json({ message: 'Ngày hoàn tất không hợp lệ' });
    if (ngayHoanTat > today) {
      return res.status(400).json({ message: 'Ngày hoàn tất không được sau ngày hôm nay' });
    }

    const money = parseMoney(body.chiPhi);
    if (money.error) return res.status(400).json({ message: money.error });

    const noiDungXuLy = text(body.noiDungXuLy);
    if (noiDungXuLy && noiDungXuLy.length > 2000) {
      return res.status(400).json({ message: 'Nội dung xử lý tối đa 2000 ký tự' });
    }

    const result = await withTransaction(pool, async (conn) => {
      const [rows] = await conn.query(
        `SELECT id, thiet_bi_id, loai_hinh, ngay_bat_dau, ket_qua
         FROM bao_duong_sua_chua WHERE id = ? FOR UPDATE`,
        [id]
      );
      const record = rows[0];
      if (!record) throw new HttpError(404, 'Không tìm thấy bản ghi bảo dưỡng - sửa chữa');
      if (record.ket_qua !== 'dang_thuc_hien') {
        throw new HttpError(409, 'Lần xử lý này đã được hoàn tất');
      }
      if (ngayHoanTat < record.ngay_bat_dau) {
        throw new HttpError(400, 'Ngày hoàn tất không được trước ngày bắt đầu');
      }

      let tinhTrang = 'hong';
      if (ketQua === 'thanh_cong') {
        tinhTrang = body.tinhTrangSauXuLy;
        if (!AFTER_SUCCESS[record.loai_hinh].includes(tinhTrang)) {
          throw new HttpError(
            400,
            record.loai_hinh === 'sua_chua'
              ? 'Sau sửa chữa thành công, tình trạng phải là Tốt hoặc Cũ/trầy xước'
              : 'Sau bảo dưỡng thành công, tình trạng phải là Mới, Tốt hoặc Cũ/trầy xước'
          );
        }
      }

      const [devices] = await conn.query(
        `SELECT tb.id, tb.trang_thai,
                COALESCE(tb.chu_ky_bao_duong_thang, l.chu_ky_bao_duong_thang) AS chu_ky
         FROM thiet_bi tb
         JOIN loai_thiet_bi l ON l.id = tb.loai_id
         WHERE tb.id = ? FOR UPDATE`,
        [record.thiet_bi_id]
      );
      const device = devices[0];
      if (!device || device.trang_thai !== ACTIVE_STATUS[record.loai_hinh]) {
        throw new HttpError(409, 'Trạng thái thiết bị không khớp với lần xử lý này, hãy kiểm tra lại dữ liệu');
      }

      // Bảo dưỡng thành công: ngày bảo dưỡng kế tiếp = ngày hoàn tất + chu kỳ (tính theo tháng)
      const chuKy = device.chu_ky === null ? null : Number(device.chu_ky);
      const hasNext = record.loai_hinh === 'bao_duong' && ketQua === 'thanh_cong' && chuKy;
      const nextExpr = hasNext ? 'DATE_ADD(?, INTERVAL ? MONTH)' : 'NULL';
      const updateParams = [ngayHoanTat, noiDungXuLy, money.value, ketQua, tinhTrang];
      if (hasNext) updateParams.push(ngayHoanTat, chuKy);
      updateParams.push(id);

      await conn.query(
        `UPDATE bao_duong_sua_chua
         SET ngay_hoan_tat = ?, noi_dung_xu_ly = ?, chi_phi = ?, ket_qua = ?,
             tinh_trang_sau_xu_ly = ?, ngay_bao_duong_ke_tiep = ${nextExpr}
         WHERE id = ?`,
        updateParams
      );

      const trangThaiMoi = ketQua === 'thanh_cong' ? 'san_sang' : 'cho_xu_ly';
      await conn.query('UPDATE thiet_bi SET tinh_trang = ?, trang_thai = ? WHERE id = ?', [
        tinhTrang,
        trangThaiMoi,
        record.thiet_bi_id,
      ]);
      return { id, trangThaiThietBi: trangThaiMoi };
    });

    res.json(result);
  } catch (error) {
    sendError(error, res, next);
  }
}