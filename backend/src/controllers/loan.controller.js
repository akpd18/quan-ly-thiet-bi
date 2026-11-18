import pool from '../config/db.js';
import { TINH_TRANG } from '../constants/device.js';
import { isRealDate, text, toId, todayString } from '../utils/validate.js';

const TRANG_THAI_PHIEU = ['cho_duyet', 'da_duyet', 'da_tra', 'tu_choi'];
const MAX_DEVICES = 20;

// Lỗi có kèm mã trạng thái HTTP, dùng để dừng xử lý và trả lời người dùng
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendError(error, res, next) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message });
  }
  return next(error);
}

// Chạy các thao tác trong một giao dịch: cùng thành công hoặc cùng bị hủy
async function withTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

const SELECT_LOAN = `
  SELECT p.id, p.ma_phieu, p.nguoi_muon_id, nm.ho_ten AS ten_nguoi_muon,
         pb.ten_phong_ban AS phong_ban_nguoi_muon,
         p.nguoi_lap_id, nl.ho_ten AS ten_nguoi_lap,
         p.ngay_muon, p.han_tra, p.ngay_tra,
         p.nguoi_duyet_id, nd.ho_ten AS ten_nguoi_duyet, p.thoi_diem_duyet,
         p.trang_thai, p.created_at,
         (SELECT COUNT(*) FROM chi_tiet_phieu_muon c WHERE c.phieu_id = p.id) AS so_thiet_bi
  FROM phieu_muon p
  JOIN nguoi_dung nm ON nm.id = p.nguoi_muon_id
  JOIN phong_ban pb ON pb.id = nm.phong_ban_id
  JOIN nguoi_dung nl ON nl.id = p.nguoi_lap_id
  LEFT JOIN nguoi_dung nd ON nd.id = p.nguoi_duyet_id`;

function toLoanDto(r, today) {
  return {
    id: r.id,
    maPhieu: r.ma_phieu,
    nguoiMuon: { id: r.nguoi_muon_id, hoTen: r.ten_nguoi_muon, tenPhongBan: r.phong_ban_nguoi_muon },
    nguoiLap: { id: r.nguoi_lap_id, hoTen: r.ten_nguoi_lap },
    nguoiDuyet: r.nguoi_duyet_id ? { id: r.nguoi_duyet_id, hoTen: r.ten_nguoi_duyet } : null,
    ngayMuon: r.ngay_muon,
    hanTra: r.han_tra,
    ngayTra: r.ngay_tra,
    thoiDiemDuyet: r.thoi_diem_duyet,
    trangThai: r.trang_thai,
    // Quá hạn: phiếu đã duyệt, ngày hiện tại vượt hạn trả mà thiết bị chưa được trả
    quaHan: r.trang_thai === 'da_duyet' && r.han_tra < today,
    soThietBi: Number(r.so_thiet_bi),
    ngayTao: r.created_at,
  };
}

// Danh sách người có thể được chọn làm người mượn (quản trị viên lập phiếu hộ)
export async function listBorrowers(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT nd.id, nd.ho_ten, nd.ten_dang_nhap, pb.ten_phong_ban
       FROM nguoi_dung nd
       JOIN phong_ban pb ON pb.id = nd.phong_ban_id
       WHERE nd.hoat_dong = 1
       ORDER BY nd.ho_ten`
    );
    res.json({
      items: rows.map((r) => ({
        id: r.id,
        hoTen: r.ho_ten,
        tenDangNhap: r.ten_dang_nhap,
        tenPhongBan: r.ten_phong_ban,
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function listLoans(req, res, next) {
  try {
    const { search, trangThai, quaHan } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 10, 1), 100);
    const today = todayString();

    const where = [];
    const params = [];

    // Nhân viên chỉ xem phiếu của chính mình (Bảng 8)
    if (req.user.vaiTro !== 'quan_tri') {
      where.push('p.nguoi_muon_id = ?');
      params.push(req.user.id);
    }

    const keyword = String(search ?? '').trim();
    if (keyword) {
      const like = `%${keyword.replace(/[\\%_]/g, '\\$&')}%`;
      where.push('(p.ma_phieu LIKE ? OR nm.ho_ten LIKE ?)');
      params.push(like, like);
    }
    if (trangThai) {
      if (!TRANG_THAI_PHIEU.includes(trangThai)) {
        return res.status(400).json({ message: 'Trạng thái phiếu không hợp lệ' });
      }
      where.push('p.trang_thai = ?');
      params.push(trangThai);
    }
    if (quaHan === '1') {
      where.push("(p.trang_thai = 'da_duyet' AND p.han_tra < ?)");
      params.push(today);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM phieu_muon p
       JOIN nguoi_dung nm ON nm.id = p.nguoi_muon_id
       ${whereSql}`,
      params
    );
    const [rows] = await pool.query(
      `${SELECT_LOAN} ${whereSql} ORDER BY p.id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    res.json({
      items: rows.map((r) => toLoanDto(r, today)),
      total: Number(total),
      page,
      pageSize,
    });
  } catch (error) {
    next(error);
  }
}

export async function getLoan(req, res, next) {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã phiếu không hợp lệ' });

    const [rows] = await pool.query(`${SELECT_LOAN} WHERE p.id = ?`, [id]);
    const row = rows[0];
    // Nhân viên không xem được phiếu của người khác: trả về như không tồn tại
    if (!row || (req.user.vaiTro !== 'quan_tri' && row.nguoi_muon_id !== req.user.id)) {
      return res.status(404).json({ message: 'Không tìm thấy phiếu mượn' });
    }

    const [devices] = await pool.query(
      `SELECT c.thiet_bi_id, c.tinh_trang_khi_tra,
              tb.ma_thiet_bi, tb.ten_thiet_bi, tb.hang, tb.model, tb.tinh_trang, tb.trang_thai,
              l.ten_loai
       FROM chi_tiet_phieu_muon c
       JOIN thiet_bi tb ON tb.id = c.thiet_bi_id
       JOIN loai_thiet_bi l ON l.id = tb.loai_id
       WHERE c.phieu_id = ?
       ORDER BY c.id`,
      [id]
    );

    // Thông số kỹ thuật của từng thiết bị, để người mượn và người duyệt biết rõ thiết bị được giao
    let specs = [];
    if (devices.length) {
      [specs] = await pool.query(
        `SELECT v.thiet_bi_id, ts.ten_thong_so AS ten, v.gia_tri
         FROM thiet_bi_thong_so v
         JOIN thong_so_loai ts ON ts.id = v.thong_so_id
         WHERE v.thiet_bi_id IN (?)
         ORDER BY v.thiet_bi_id, ts.thu_tu`,
        [devices.map((d) => d.thiet_bi_id)]
      );
    }

    res.json({
      phieu: {
        ...toLoanDto(row, todayString()),
        thietBi: devices.map((d) => ({
          thietBiId: d.thiet_bi_id,
          maThietBi: d.ma_thiet_bi,
          tenThietBi: d.ten_thiet_bi,
          tenLoai: d.ten_loai,
          hang: d.hang,
          model: d.model,
          tinhTrang: d.tinh_trang,
          trangThai: d.trang_thai,
          tinhTrangKhiTra: d.tinh_trang_khi_tra,
          thongSo: specs
            .filter((s) => s.thiet_bi_id === d.thiet_bi_id)
            .map((s) => ({ ten: s.ten, giaTri: s.gia_tri })),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

function parseDeviceIds(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: 'Vui lòng chọn ít nhất một thiết bị' };
  }
  if (value.length > MAX_DEVICES) {
    return { error: `Mỗi phiếu mượn tối đa ${MAX_DEVICES} thiết bị` };
  }
  const ids = value.map((v) => toId(v));
  if (ids.some((v) => !v)) return { error: 'Mã thiết bị không hợp lệ' };
  if (new Set(ids).size !== ids.length) return { error: 'Thiết bị bị chọn trùng' };
  return { ids };
}

// Lập phiếu mượn: phiếu mới luôn ở trạng thái Chờ duyệt, thiết bị chưa đổi trạng thái
export async function createLoan(req, res, next) {
  try {
    const body = req.body ?? {};
    const today = todayString();

    const ngayMuon = String(body.ngayMuon ?? '');
    const hanTra = String(body.hanTra ?? '');
    if (!isRealDate(ngayMuon)) return res.status(400).json({ message: 'Ngày mượn không hợp lệ' });
    if (!isRealDate(hanTra)) return res.status(400).json({ message: 'Hạn trả không hợp lệ' });
    if (ngayMuon < today) {
      return res.status(400).json({ message: 'Ngày mượn không được trước ngày hôm nay' });
    }
    if (hanTra < ngayMuon) {
      return res.status(400).json({ message: 'Hạn trả không được trước ngày mượn' });
    }

    const parsed = parseDeviceIds(body.thietBiIds);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const { ids } = parsed;

    // Nhân viên chỉ lập phiếu cho chính mình; quản trị viên được lập hộ người khác
    let nguoiMuonId = req.user.id;
    const rawBorrower = body.nguoiMuonId;
    if (
      req.user.vaiTro === 'quan_tri' &&
      rawBorrower !== undefined &&
      rawBorrower !== null &&
      rawBorrower !== ''
    ) {
      nguoiMuonId = toId(rawBorrower);
      if (!nguoiMuonId) return res.status(400).json({ message: 'Người mượn không hợp lệ' });
      const [users] = await pool.query(
        'SELECT id FROM nguoi_dung WHERE id = ? AND hoat_dong = 1',
        [nguoiMuonId]
      );
      if (!users[0]) {
        return res.status(400).json({ message: 'Người mượn không tồn tại hoặc đã bị khóa' });
      }
    }

    // Chỉ thiết bị Sẵn sàng mới được mượn
    const [devices] = await pool.query(
      'SELECT id, ma_thiet_bi, trang_thai FROM thiet_bi WHERE id IN (?)',
      [ids]
    );
    if (devices.length !== ids.length) {
      return res.status(400).json({ message: 'Có thiết bị không tồn tại' });
    }
    const notReady = devices.filter((d) => d.trang_thai !== 'san_sang');
    if (notReady.length) {
      return res.status(400).json({
        message: `Thiết bị ${notReady
          .map((d) => d.ma_thiet_bi)
          .join(', ')} không ở trạng thái Sẵn sàng nên không thể mượn`,
      });
    }

    const prefix = `PM-${today.slice(0, 4)}`;
    let created = null;

    // Nếu hai người lập phiếu cùng lúc và trùng mã thì thử lại với số thứ tự kế tiếp
    for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
      try {
        created = await withTransaction(async (conn) => {
          const [[{ maxSeq }]] = await conn.query(
            `SELECT MAX(CAST(SUBSTRING_INDEX(ma_phieu, '-', -1) AS UNSIGNED)) AS maxSeq
             FROM phieu_muon WHERE ma_phieu LIKE ?`,
            [`${prefix}-%`]
          );
          const maPhieu = `${prefix}-${String(Number(maxSeq ?? 0) + 1).padStart(3, '0')}`;

          const [result] = await conn.query(
            `INSERT INTO phieu_muon
               (ma_phieu, nguoi_muon_id, nguoi_lap_id, ngay_muon, han_tra, trang_thai)
             VALUES (?, ?, ?, ?, ?, 'cho_duyet')`,
            [maPhieu, nguoiMuonId, req.user.id, ngayMuon, hanTra]
          );
          await conn.query('INSERT INTO chi_tiet_phieu_muon (phieu_id, thiet_bi_id) VALUES ?', [
            ids.map((thietBiId) => [result.insertId, thietBiId]),
          ]);
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

// Khóa dòng phiếu và kiểm tra phiếu đang ở đúng trạng thái cần thiết
async function lockLoan(conn, id, expected) {
  const [rows] = await conn.query(
    'SELECT id, trang_thai, han_tra FROM phieu_muon WHERE id = ? FOR UPDATE',
    [id]
  );
  const loan = rows[0];
  if (!loan) throw new HttpError(404, 'Không tìm thấy phiếu mượn');
  if (loan.trang_thai !== expected) {
    const label = { cho_duyet: 'Chờ duyệt', da_duyet: 'Đã duyệt' }[expected];
    throw new HttpError(409, `Phiếu không ở trạng thái ${label}`);
  }
  return loan;
}

// Khóa các thiết bị trong phiếu để không ai sửa trạng thái cùng lúc
async function lockLoanDevices(conn, id) {
  const [devices] = await conn.query(
    `SELECT tb.id, tb.ma_thiet_bi, tb.trang_thai
     FROM chi_tiet_phieu_muon c
     JOIN thiet_bi tb ON tb.id = c.thiet_bi_id
     WHERE c.phieu_id = ?
     FOR UPDATE`,
    [id]
  );
  return devices;
}

// Duyệt phiếu: phiếu chuyển Đã duyệt, các thiết bị chuyển Đang mượn (cùng một giao dịch)
export async function approveLoan(req, res, next) {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã phiếu không hợp lệ' });
    const today = todayString();

    await withTransaction(async (conn) => {
      const loan = await lockLoan(conn, id, 'cho_duyet');
      if (loan.han_tra < today) {
        throw new HttpError(400, 'Hạn trả đã qua, không thể duyệt phiếu này. Hãy từ chối và lập phiếu mới');
      }

      const devices = await lockLoanDevices(conn, id);
      const busy = devices.filter((d) => d.trang_thai !== 'san_sang');
      if (busy.length) {
        throw new HttpError(
          409,
          `Thiết bị ${busy.map((d) => d.ma_thiet_bi).join(', ')} không còn ở trạng thái Sẵn sàng. Hãy từ chối phiếu này`
        );
      }

      await conn.query("UPDATE thiet_bi SET trang_thai = 'dang_muon' WHERE id IN (?)", [
        devices.map((d) => d.id),
      ]);
      await conn.query(
        `UPDATE phieu_muon
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

// Từ chối phiếu: thiết bị giữ nguyên trạng thái
export async function rejectLoan(req, res, next) {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã phiếu không hợp lệ' });

    await withTransaction(async (conn) => {
      await lockLoan(conn, id, 'cho_duyet');
      await conn.query(
        `UPDATE phieu_muon
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

function parseReturn(body) {
  const list = body?.thietBi;
  if (!Array.isArray(list) || list.length === 0) {
    return { error: 'Vui lòng ghi nhận tình trạng của từng thiết bị khi trả' };
  }
  const map = new Map();
  for (const item of list) {
    const thietBiId = toId(item?.thietBiId);
    if (!thietBiId) return { error: 'Mã thiết bị không hợp lệ' };
    if (map.has(thietBiId)) return { error: 'Thiết bị bị khai báo trùng' };
    if (!TINH_TRANG.includes(item.tinhTrang)) return { error: 'Tình trạng khi trả không hợp lệ' };
    map.set(thietBiId, item.tinhTrang);
  }
  return { map };
}

// Xác nhận trả: ghi tình trạng khi trả của từng thiết bị (Bảng 10 trong tài liệu)
// - Không hỏng: thiết bị về Sẵn sàng, tình trạng cập nhật theo lúc trả
// - Hỏng: thiết bị chuyển sang Chờ xử lý
export async function returnLoan(req, res, next) {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã phiếu không hợp lệ' });

    const parsed = parseReturn(req.body);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const { map } = parsed;
    const today = todayString();

    const soThietBiHong = await withTransaction(async (conn) => {
      await lockLoan(conn, id, 'da_duyet');
      const devices = await lockLoanDevices(conn, id);

      if (devices.length !== map.size || devices.some((d) => !map.has(d.id))) {
        throw new HttpError(400, 'Phải ghi nhận tình trạng cho đúng tất cả thiết bị trong phiếu');
      }
      const notBorrowed = devices.filter((d) => d.trang_thai !== 'dang_muon');
      if (notBorrowed.length) {
        throw new HttpError(
          409,
          `Thiết bị ${notBorrowed.map((d) => d.ma_thiet_bi).join(', ')} không ở trạng thái Đang mượn`
        );
      }

      let hong = 0;
      for (const d of devices) {
        const tinhTrang = map.get(d.id);
        if (tinhTrang === 'hong') hong += 1;
        await conn.query(
          'UPDATE chi_tiet_phieu_muon SET tinh_trang_khi_tra = ? WHERE phieu_id = ? AND thiet_bi_id = ?',
          [tinhTrang, id, d.id]
        );
        await conn.query('UPDATE thiet_bi SET tinh_trang = ?, trang_thai = ? WHERE id = ?', [
          tinhTrang,
          tinhTrang === 'hong' ? 'cho_xu_ly' : 'san_sang',
          d.id,
        ]);
      }

      await conn.query("UPDATE phieu_muon SET trang_thai = 'da_tra', ngay_tra = ? WHERE id = ?", [
        today,
        id,
      ]);
      return hong;
    });

    res.json({ id, soThietBiHong });
  } catch (error) {
    sendError(error, res, next);
  }
}