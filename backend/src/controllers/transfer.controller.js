import pool from '../config/db.js';
import { HttpError, sendError, withTransaction } from '../utils/http.js';
import { isRealDate, text, toId, todayString } from '../utils/validate.js';

const TRANG_THAI_PHIEU = ['cho_duyet', 'da_duyet', 'tu_choi'];

const TRANG_THAI_LABEL = {
  san_sang: 'Sẵn sàng',
  dang_muon: 'Đang mượn',
  dang_bao_duong: 'Đang bảo dưỡng',
  dang_sua_chua: 'Đang sửa chữa',
  cho_xu_ly: 'Chờ xử lý',
  that_lac: 'Thất lạc',
  da_thanh_ly: 'Đã thanh lý',
};

const SELECT_TRANSFER = `
  SELECT p.id, p.ma_phieu, p.thiet_bi_id, tb.ma_thiet_bi, tb.ten_thiet_bi,
         tb.trang_thai AS trang_thai_thiet_bi, pbc.ten_phong_ban AS phong_ban_hien_tai,
         p.phong_ban_di_id, pdi.ten_phong_ban AS ten_phong_ban_di,
         p.phong_ban_den_id, pden.ten_phong_ban AS ten_phong_ban_den,
         p.ly_do, p.ngay_dieu_dong,
         p.nguoi_lap_id, nl.ho_ten AS ten_nguoi_lap,
         p.nguoi_duyet_id, nd.ho_ten AS ten_nguoi_duyet, p.thoi_diem_duyet,
         p.trang_thai, p.created_at
  FROM phieu_dieu_dong p
  JOIN thiet_bi tb ON tb.id = p.thiet_bi_id
  JOIN phong_ban pbc ON pbc.id = tb.phong_ban_id
  JOIN phong_ban pdi ON pdi.id = p.phong_ban_di_id
  JOIN phong_ban pden ON pden.id = p.phong_ban_den_id
  JOIN nguoi_dung nl ON nl.id = p.nguoi_lap_id
  LEFT JOIN nguoi_dung nd ON nd.id = p.nguoi_duyet_id`;

function toTransferDto(r) {
  return {
    id: r.id,
    maPhieu: r.ma_phieu,
    thietBi: {
      id: r.thiet_bi_id,
      maThietBi: r.ma_thiet_bi,
      tenThietBi: r.ten_thiet_bi,
      trangThai: r.trang_thai_thiet_bi,
      tenPhongBanHienTai: r.phong_ban_hien_tai,
    },
    phongBanDi: { id: r.phong_ban_di_id, ten: r.ten_phong_ban_di },
    phongBanDen: { id: r.phong_ban_den_id, ten: r.ten_phong_ban_den },
    lyDo: r.ly_do,
    ngayDieuDong: r.ngay_dieu_dong,
    nguoiLap: { id: r.nguoi_lap_id, hoTen: r.ten_nguoi_lap },
    nguoiDuyet: r.nguoi_duyet_id ? { id: r.nguoi_duyet_id, hoTen: r.ten_nguoi_duyet } : null,
    thoiDiemDuyet: r.thoi_diem_duyet,
    trangThai: r.trang_thai,
    ngayTao: r.created_at,
  };
}

// Danh sách phiếu điều động (cũng là lịch sử điều động); phiếu Chờ duyệt xếp trước
export async function listTransfers(req, res, next) {
  try {
    const { search, trangThai, phongBanId, thietBiId } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 10, 1), 100);

    const where = [];
    const params = [];

    const keyword = String(search ?? '').trim();
    if (keyword) {
      const like = `%${keyword.replace(/[\\%_]/g, '\\$&')}%`;
      where.push('(p.ma_phieu LIKE ? OR tb.ma_thiet_bi LIKE ? OR tb.ten_thiet_bi LIKE ?)');
      params.push(like, like, like);
    }
    if (trangThai) {
      if (!TRANG_THAI_PHIEU.includes(trangThai)) {
        return res.status(400).json({ message: 'Trạng thái phiếu không hợp lệ' });
      }
      where.push('p.trang_thai = ?');
      params.push(trangThai);
    }
    if (phongBanId) {
      const id = toId(phongBanId);
      if (!id) return res.status(400).json({ message: 'Phòng ban không hợp lệ' });
      // Phiếu có phòng ban này là nơi đi hoặc nơi đến
      where.push('(p.phong_ban_di_id = ? OR p.phong_ban_den_id = ?)');
      params.push(id, id);
    }
    if (thietBiId) {
      const id = toId(thietBiId);
      if (!id) return res.status(400).json({ message: 'Mã thiết bị không hợp lệ' });
      where.push('p.thiet_bi_id = ?');
      params.push(id);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM phieu_dieu_dong p
       JOIN thiet_bi tb ON tb.id = p.thiet_bi_id
       ${whereSql}`,
      params
    );
    const [rows] = await pool.query(
      `${SELECT_TRANSFER} ${whereSql}
       ORDER BY (p.trang_thai = 'cho_duyet') DESC, p.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    res.json({ items: rows.map(toTransferDto), total: Number(total), page, pageSize });
  } catch (error) {
    next(error);
  }
}

// Thiết bị có thể điều động: chỉ thiết bị Sẵn sàng và chưa có phiếu điều động đang chờ duyệt
export async function listTransferableDevices(req, res, next) {
  try {
    const where = [
      "tb.trang_thai = 'san_sang'",
      `NOT EXISTS (SELECT 1 FROM phieu_dieu_dong p
                   WHERE p.thiet_bi_id = tb.id AND p.trang_thai = 'cho_duyet')`,
    ];
    const params = [];

    const keyword = String(req.query.search ?? '').trim();
    if (keyword) {
      const like = `%${keyword.replace(/[\\%_]/g, '\\$&')}%`;
      where.push('(tb.ma_thiet_bi LIKE ? OR tb.ten_thiet_bi LIKE ?)');
      params.push(like, like);
    }

    const [rows] = await pool.query(
      `SELECT tb.id, tb.ma_thiet_bi, tb.ten_thiet_bi, tb.phong_ban_id, pb.ten_phong_ban
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
        phongBanId: r.phong_ban_id,
        tenPhongBan: r.ten_phong_ban,
      })),
    });
  } catch (error) {
    next(error);
  }
}

// Lập phiếu điều động: phòng ban đi là phòng ban đang đặt thiết bị lúc lập phiếu.
// Phiếu mới ở trạng thái Chờ duyệt, thiết bị chưa đổi phòng ban.
export async function createTransfer(req, res, next) {
  try {
    const body = req.body ?? {};
    const today = todayString();

    const thietBiId = toId(body.thietBiId);
    if (!thietBiId) return res.status(400).json({ message: 'Vui lòng chọn thiết bị' });

    const phongBanDenId = toId(body.phongBanDenId);
    if (!phongBanDenId) return res.status(400).json({ message: 'Vui lòng chọn phòng ban đến' });

    const lyDo = text(body.lyDo);
    if (!lyDo) return res.status(400).json({ message: 'Vui lòng nhập lý do điều động' });
    if (lyDo.length > 255) return res.status(400).json({ message: 'Lý do tối đa 255 ký tự' });

    const ngayDieuDong = String(body.ngayDieuDong ?? '');
    if (!isRealDate(ngayDieuDong)) {
      return res.status(400).json({ message: 'Ngày điều động không hợp lệ' });
    }

    const prefix = `DD-${today.slice(0, 4)}`;
    let created = null;

    // Nếu hai người lập phiếu cùng lúc và trùng mã thì thử lại với số thứ tự kế tiếp
    for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
      try {
        created = await withTransaction(pool, async (conn) => {
          const [rows] = await conn.query(
            `SELECT id, ma_thiet_bi, ngay_nhap, trang_thai, phong_ban_id
             FROM thiet_bi WHERE id = ? FOR UPDATE`,
            [thietBiId]
          );
          const device = rows[0];
          if (!device) throw new HttpError(404, 'Không tìm thấy thiết bị');
          if (device.trang_thai !== 'san_sang') {
            throw new HttpError(
              409,
              `Thiết bị ${device.ma_thiet_bi} đang ở trạng thái ${TRANG_THAI_LABEL[device.trang_thai]}, chỉ thiết bị Sẵn sàng mới được điều động`
            );
          }

          const [phongBan] = await conn.query('SELECT id FROM phong_ban WHERE id = ?', [phongBanDenId]);
          if (!phongBan[0]) throw new HttpError(400, 'Phòng ban đến không tồn tại');
          if (phongBanDenId === device.phong_ban_id) {
            throw new HttpError(400, 'Phòng ban đến phải khác phòng ban hiện tại của thiết bị');
          }
          if (ngayDieuDong < device.ngay_nhap) {
            throw new HttpError(400, 'Ngày điều động không được trước ngày nhập của thiết bị');
          }

          const [pending] = await conn.query(
            "SELECT id FROM phieu_dieu_dong WHERE thiet_bi_id = ? AND trang_thai = 'cho_duyet'",
            [thietBiId]
          );
          if (pending[0]) {
            throw new HttpError(409, 'Thiết bị này đã có phiếu điều động đang chờ duyệt');
          }

          const [[{ maxSeq }]] = await conn.query(
            `SELECT MAX(CAST(SUBSTRING_INDEX(ma_phieu, '-', -1) AS UNSIGNED)) AS maxSeq
             FROM phieu_dieu_dong WHERE ma_phieu LIKE ?`,
            [`${prefix}-%`]
          );
          const maPhieu = `${prefix}-${String(Number(maxSeq ?? 0) + 1).padStart(3, '0')}`;

          const [result] = await conn.query(
            `INSERT INTO phieu_dieu_dong
               (ma_phieu, thiet_bi_id, phong_ban_di_id, phong_ban_den_id, ly_do, ngay_dieu_dong,
                nguoi_lap_id, trang_thai)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'cho_duyet')`,
            [maPhieu, thietBiId, device.phong_ban_id, phongBanDenId, lyDo, ngayDieuDong, req.user.id]
          );
          return { id: result.insertId, maPhieu };
        });
      } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY') throw error;
      }
    }

    if (!created) {
      return res.status(409).json({ message: 'Không tạo được mã phiếu, vui lòng thử lại' });
    }
    res.status(201).json(created);
  } catch (error) {
    sendError(error, res, next);
  }
}

// Khóa dòng phiếu và kiểm tra phiếu đang Chờ duyệt
async function lockPendingTransfer(conn, id) {
  const [rows] = await conn.query(
    `SELECT id, thiet_bi_id, phong_ban_di_id, phong_ban_den_id, trang_thai
     FROM phieu_dieu_dong WHERE id = ? FOR UPDATE`,
    [id]
  );
  const transfer = rows[0];
  if (!transfer) throw new HttpError(404, 'Không tìm thấy phiếu điều động');
  if (transfer.trang_thai !== 'cho_duyet') {
    throw new HttpError(409, 'Phiếu không ở trạng thái Chờ duyệt');
  }
  return transfer;
}

// Duyệt phiếu: phòng ban đang đặt của thiết bị chuyển sang phòng ban đến, trạng thái và tình trạng giữ nguyên
// (Bảng 10). Phiếu và thiết bị được cập nhật trong cùng một giao dịch.
export async function approveTransfer(req, res, next) {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã phiếu không hợp lệ' });

    await withTransaction(pool, async (conn) => {
      const transfer = await lockPendingTransfer(conn, id);

      const [devices] = await conn.query(
        'SELECT id, ma_thiet_bi, trang_thai, phong_ban_id FROM thiet_bi WHERE id = ? FOR UPDATE',
        [transfer.thiet_bi_id]
      );
      const device = devices[0];
      if (!device) throw new HttpError(409, 'Không tìm thấy thiết bị của phiếu này');

      if (device.trang_thai !== 'san_sang') {
        throw new HttpError(
          409,
          `Thiết bị ${device.ma_thiet_bi} đang ở trạng thái ${TRANG_THAI_LABEL[device.trang_thai]}, chỉ thiết bị Sẵn sàng mới được điều động. Hãy từ chối phiếu này`
        );
      }
      if (device.phong_ban_id !== transfer.phong_ban_di_id) {
        throw new HttpError(
          409,
          'Thiết bị đã được chuyển sang phòng ban khác kể từ lúc lập phiếu. Hãy từ chối phiếu này'
        );
      }

      await conn.query('UPDATE thiet_bi SET phong_ban_id = ? WHERE id = ?', [
        transfer.phong_ban_den_id,
        device.id,
      ]);
      await conn.query(
        `UPDATE phieu_dieu_dong
         SET trang_thai = 'da_duyet', nguoi_duyet_id = ?, thoi_diem_duyet = NOW()
         WHERE id = ?`,
        [req.user.id, id]
      );
    });

    res.json({ id });
  } catch (error) {
    sendError(error, res, next);
  }
}

// Từ chối phiếu: thiết bị giữ nguyên phòng ban
export async function rejectTransfer(req, res, next) {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã phiếu không hợp lệ' });

    await withTransaction(pool, async (conn) => {
      await lockPendingTransfer(conn, id);
      await conn.query(
        `UPDATE phieu_dieu_dong
         SET trang_thai = 'tu_choi', nguoi_duyet_id = ?, thoi_diem_duyet = NOW()
         WHERE id = ?`,
        [req.user.id, id]
      );
    });

    res.json({ id });
  } catch (error) {
    sendError(error, res, next);
  }
}