import pool from '../config/db.js';
import { HttpError, sendError, withTransaction } from '../utils/http.js';
import { isRealDate, text, toId, todayString } from '../utils/validate.js';

const KET_QUA = ['dung', 'thieu', 'thua', 'sai_vi_tri', 'sai_tinh_trang'];
// Các kết quả ghi cho thiết bị có trong danh sách ("thừa" ghi riêng cho thiết bị chưa có hồ sơ)
const RECORDABLE = ['dung', 'thieu', 'sai_vi_tri', 'sai_tinh_trang'];
const TINH_TRANG = ['moi', 'tot', 'cu', 'hong'];
const TRANG_THAI_DOT = ['dang_kiem_ke', 'hoan_tat'];
// Chỉ thiết bị ở các trạng thái này mới có thể "thiếu" (đang mượn, đang bảo dưỡng, đang sửa chữa là vắng mặt hợp lệ)
const CAN_BE_MISSING = ['san_sang', 'cho_xu_ly', 'that_lac'];

const TRANG_THAI_LABEL = {
  san_sang: 'Sẵn sàng',
  dang_muon: 'Đang mượn',
  dang_bao_duong: 'Đang bảo dưỡng',
  dang_sua_chua: 'Đang sửa chữa',
  cho_xu_ly: 'Chờ xử lý',
  that_lac: 'Thất lạc',
  da_thanh_ly: 'Đã thanh lý',
};

const SELECT_INVENTORY = `
  SELECT d.id, d.ma_dot, d.ten_dot, d.phong_ban_id, pb.ten_phong_ban, d.ngay_kiem_ke,
         d.nguoi_thuc_hien_id, nt.ho_ten AS ten_nguoi_thuc_hien, d.trang_thai, d.bien_ban, d.created_at,
         (SELECT COUNT(*) FROM chi_tiet_kiem_ke c
          WHERE c.dot_id = d.id AND c.thiet_bi_id IS NOT NULL) AS so_thiet_bi,
         (SELECT COUNT(*) FROM chi_tiet_kiem_ke c
          WHERE c.dot_id = d.id AND c.thiet_bi_id IS NOT NULL AND c.ket_qua IS NOT NULL) AS so_da_kiem,
         (SELECT COUNT(*) FROM chi_tiet_kiem_ke c
          WHERE c.dot_id = d.id
            AND c.ket_qua IN ('thieu', 'thua', 'sai_vi_tri', 'sai_tinh_trang')) AS so_chenh_lech
  FROM dot_kiem_ke d
  LEFT JOIN phong_ban pb ON pb.id = d.phong_ban_id
  JOIN nguoi_dung nt ON nt.id = d.nguoi_thuc_hien_id`;

function toInventoryDto(r) {
  return {
    id: r.id,
    maDot: r.ma_dot,
    tenDot: r.ten_dot,
    // phongBan = null nghĩa là kiểm kê toàn công ty
    phongBan: r.phong_ban_id ? { id: r.phong_ban_id, ten: r.ten_phong_ban } : null,
    ngayKiemKe: r.ngay_kiem_ke,
    nguoiThucHien: { id: r.nguoi_thuc_hien_id, hoTen: r.ten_nguoi_thuc_hien },
    trangThai: r.trang_thai,
    bienBan: r.bien_ban,
    soThietBi: Number(r.so_thiet_bi),
    soDaKiem: Number(r.so_da_kiem),
    soChenhLech: Number(r.so_chenh_lech),
    ngayTao: r.created_at,
  };
}

// Danh sách các đợt kiểm kê (cũng là lịch sử kiểm kê); đợt đang kiểm kê xếp trước
export async function listInventories(req, res, next) {
  try {
    const { search, trangThai, phongBanId } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 10, 1), 100);

    const where = [];
    const params = [];

    const keyword = String(search ?? '').trim();
    if (keyword) {
      const like = `%${keyword.replace(/[\\%_]/g, '\\$&')}%`;
      where.push('(d.ma_dot LIKE ? OR d.ten_dot LIKE ?)');
      params.push(like, like);
    }
    if (trangThai) {
      if (!TRANG_THAI_DOT.includes(trangThai)) {
        return res.status(400).json({ message: 'Trạng thái đợt kiểm kê không hợp lệ' });
      }
      where.push('d.trang_thai = ?');
      params.push(trangThai);
    }
    if (phongBanId) {
      const id = toId(phongBanId);
      if (!id) return res.status(400).json({ message: 'Phòng ban không hợp lệ' });
      where.push('d.phong_ban_id = ?');
      params.push(id);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM dot_kiem_ke d ${whereSql}`,
      params
    );
    const [rows] = await pool.query(
      `${SELECT_INVENTORY} ${whereSql}
       ORDER BY (d.trang_thai = 'dang_kiem_ke') DESC, d.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    res.json({ items: rows.map(toInventoryDto), total: Number(total), page, pageSize });
  } catch (error) {
    next(error);
  }
}

// Chi tiết một đợt kiểm kê kèm số liệu tổng kết theo từng kết quả
export async function getInventory(req, res, next) {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã đợt kiểm kê không hợp lệ' });

    const [rows] = await pool.query(`${SELECT_INVENTORY} WHERE d.id = ?`, [id]);
    if (!rows[0]) return res.status(404).json({ message: 'Không tìm thấy đợt kiểm kê' });

    const [counts] = await pool.query(
      'SELECT ket_qua, COUNT(*) AS n FROM chi_tiet_kiem_ke WHERE dot_id = ? GROUP BY ket_qua',
      [id]
    );
    const byResult = Object.fromEntries(counts.map((c) => [c.ket_qua ?? 'chua_kiem', Number(c.n)]));

    res.json({
      dot: {
        ...toInventoryDto(rows[0]),
        tongKet: {
          dung: byResult.dung ?? 0,
          thieu: byResult.thieu ?? 0,
          thua: byResult.thua ?? 0,
          saiViTri: byResult.sai_vi_tri ?? 0,
          saiTinhTrang: byResult.sai_tinh_trang ?? 0,
          chuaKiem: byResult.chua_kiem ?? 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

// Danh sách thiết bị (và thiết bị thừa) của một đợt kiểm kê
export async function listInventoryItems(req, res, next) {
  try {
    const dotId = toId(req.params.id);
    if (!dotId) return res.status(400).json({ message: 'Mã đợt kiểm kê không hợp lệ' });

    const { search, ketQua } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 10, 1), 100);

    const [dots] = await pool.query('SELECT id FROM dot_kiem_ke WHERE id = ?', [dotId]);
    if (!dots[0]) return res.status(404).json({ message: 'Không tìm thấy đợt kiểm kê' });

    const where = ['c.dot_id = ?'];
    const params = [dotId];

    const keyword = String(search ?? '').trim();
    if (keyword) {
      const like = `%${keyword.replace(/[\\%_]/g, '\\$&')}%`;
      where.push('(tb.ma_thiet_bi LIKE ? OR tb.ten_thiet_bi LIKE ? OR c.mo_ta_thiet_bi_thua LIKE ?)');
      params.push(like, like, like);
    }
    if (ketQua) {
      if (ketQua === 'chua_kiem') {
        where.push('c.ket_qua IS NULL');
      } else if (KET_QUA.includes(ketQua)) {
        where.push('c.ket_qua = ?');
        params.push(ketQua);
      } else {
        return res.status(400).json({ message: 'Kết quả kiểm kê không hợp lệ' });
      }
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const fromSql = `
      FROM chi_tiet_kiem_ke c
      LEFT JOIN thiet_bi tb ON tb.id = c.thiet_bi_id
      LEFT JOIN phong_ban pht ON pht.id = c.phong_ban_he_thong_id
      LEFT JOIN phong_ban ptt ON ptt.id = c.phong_ban_thuc_te_id`;

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${fromSql} ${whereSql}`, params);
    const [rows] = await pool.query(
      `SELECT c.id, c.thiet_bi_id, tb.ma_thiet_bi, tb.ten_thiet_bi, tb.trang_thai AS trang_thai_hien_tai,
              c.ket_qua, c.phong_ban_he_thong_id, pht.ten_phong_ban AS ten_pb_he_thong,
              c.phong_ban_thuc_te_id, ptt.ten_phong_ban AS ten_pb_thuc_te,
              c.tinh_trang_he_thong, c.tinh_trang_thuc_te, c.mo_ta_thiet_bi_thua, c.ghi_chu, c.da_xu_ly
       ${fromSql} ${whereSql}
       ORDER BY c.id ASC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    res.json({
      items: rows.map((r) => ({
        id: r.id,
        thietBi: r.thiet_bi_id
          ? {
              id: r.thiet_bi_id,
              maThietBi: r.ma_thiet_bi,
              tenThietBi: r.ten_thiet_bi,
              trangThai: r.trang_thai_hien_tai,
            }
          : null,
        ketQua: r.ket_qua,
        phongBanHeThong: r.phong_ban_he_thong_id
          ? { id: r.phong_ban_he_thong_id, ten: r.ten_pb_he_thong }
          : null,
        phongBanThucTe: r.phong_ban_thuc_te_id
          ? { id: r.phong_ban_thuc_te_id, ten: r.ten_pb_thuc_te }
          : null,
        tinhTrangHeThong: r.tinh_trang_he_thong,
        tinhTrangThucTe: r.tinh_trang_thuc_te,
        moTaThietBiThua: r.mo_ta_thiet_bi_thua,
        ghiChu: r.ghi_chu,
        daXuLy: Boolean(r.da_xu_ly),
      })),
      total: Number(total),
      page,
      pageSize,
    });
  } catch (error) {
    next(error);
  }
}

// Khóa dòng đợt kiểm kê và kiểm tra đợt còn đang kiểm kê
async function lockOpenInventory(conn, id) {
  const [rows] = await conn.query(
    'SELECT id, trang_thai, phong_ban_id FROM dot_kiem_ke WHERE id = ? FOR UPDATE',
    [id]
  );
  if (!rows[0]) throw new HttpError(404, 'Không tìm thấy đợt kiểm kê');
  if (rows[0].trang_thai !== 'dang_kiem_ke') {
    throw new HttpError(409, 'Đợt kiểm kê đã hoàn tất, không thể thay đổi');
  }
  return rows[0];
}

// Tạo đợt kiểm kê: hệ thống lập sẵn danh sách thiết bị cần kiểm (toàn công ty hoặc một phòng ban).
// Thiết bị đã thanh lý không nằm trong danh sách.
export async function createInventory(req, res, next) {
  try {
    const body = req.body ?? {};
    const today = todayString();

    const tenDot = text(body.tenDot);
    if (!tenDot) return res.status(400).json({ message: 'Vui lòng nhập tên đợt kiểm kê' });
    if (tenDot.length > 150) return res.status(400).json({ message: 'Tên đợt tối đa 150 ký tự' });

    // Không chọn phòng ban nghĩa là kiểm kê toàn công ty
    let phongBanId = null;
    const rawScope = body.phongBanId;
    if (rawScope !== undefined && rawScope !== null && rawScope !== '') {
      phongBanId = toId(rawScope);
      if (!phongBanId) return res.status(400).json({ message: 'Phòng ban không hợp lệ' });
    }

    const ngayKiemKe = String(body.ngayKiemKe ?? '');
    if (!isRealDate(ngayKiemKe)) {
      return res.status(400).json({ message: 'Ngày kiểm kê không hợp lệ' });
    }

    const prefix = `KK-${today.slice(0, 4)}`;
    let created = null;

    // Nếu hai người tạo đợt cùng lúc và trùng mã thì thử lại với số thứ tự kế tiếp
    for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
      try {
        created = await withTransaction(pool, async (conn) => {
          if (phongBanId) {
            const [pb] = await conn.query('SELECT id FROM phong_ban WHERE id = ?', [phongBanId]);
            if (!pb[0]) throw new HttpError(400, 'Phòng ban không tồn tại');
          }

          // Không mở hai đợt kiểm kê trùng phạm vi cùng lúc: toàn công ty trùng với mọi đợt, phòng ban trùng với chính nó
          const [open] = await conn.query(
            "SELECT id, ma_dot, phong_ban_id FROM dot_kiem_ke WHERE trang_thai = 'dang_kiem_ke' FOR UPDATE"
          );
          const overlap = open.find(
            (d) => phongBanId === null || d.phong_ban_id === null || d.phong_ban_id === phongBanId
          );
          if (overlap) {
            throw new HttpError(
              409,
              `Đang có đợt kiểm kê ${overlap.ma_dot} trùng phạm vi, hãy hoàn tất đợt đó trước`
            );
          }

          const [[{ maxSeq }]] = await conn.query(
            `SELECT MAX(CAST(SUBSTRING_INDEX(ma_dot, '-', -1) AS UNSIGNED)) AS maxSeq
             FROM dot_kiem_ke WHERE ma_dot LIKE ?`,
            [`${prefix}-%`]
          );
          const maDot = `${prefix}-${String(Number(maxSeq ?? 0) + 1).padStart(3, '0')}`;

          const [result] = await conn.query(
            `INSERT INTO dot_kiem_ke
               (ma_dot, ten_dot, phong_ban_id, ngay_kiem_ke, nguoi_thuc_hien_id, trang_thai)
             VALUES (?, ?, ?, ?, ?, 'dang_kiem_ke')`,
            [maDot, tenDot, phongBanId, ngayKiemKe, req.user.id]
          );

          // Lập sẵn danh sách thiết bị cần kiểm, chụp lại phòng ban và tình trạng theo hệ thống tại thời điểm này
          const scopeSql = phongBanId ? 'AND tb.phong_ban_id = ?' : '';
          const [items] = await conn.query(
            `INSERT INTO chi_tiet_kiem_ke (dot_id, thiet_bi_id, phong_ban_he_thong_id, tinh_trang_he_thong)
             SELECT ?, tb.id, tb.phong_ban_id, tb.tinh_trang
             FROM thiet_bi tb
             WHERE tb.trang_thai <> 'da_thanh_ly' ${scopeSql}`,
            phongBanId ? [result.insertId, phongBanId] : [result.insertId]
          );
          if (items.affectedRows === 0) {
            throw new HttpError(400, 'Không có thiết bị nào cần kiểm kê trong phạm vi này');
          }
          return { id: result.insertId, maDot, soThietBi: items.affectedRows };
        });
      } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY') throw error;
      }
    }

    if (!created) {
      return res.status(409).json({ message: 'Không tạo được mã đợt, vui lòng thử lại' });
    }
    res.status(201).json(created);
  } catch (error) {
    sendError(error, res, next);
  }
}

// Ghi kết quả kiểm kê của một thiết bị: đúng, thiếu, sai vị trí hoặc sai tình trạng
export async function recordItem(req, res, next) {
  try {
    const dotId = toId(req.params.id);
    const itemId = toId(req.params.itemId);
    if (!dotId || !itemId) return res.status(400).json({ message: 'Mã không hợp lệ' });

    const body = req.body ?? {};
    if (!RECORDABLE.includes(body.ketQua)) {
      return res.status(400).json({ message: 'Kết quả kiểm kê không hợp lệ' });
    }
    const { ketQua } = body;

    const ghiChu = text(body.ghiChu);
    if (ghiChu && ghiChu.length > 255) {
      return res.status(400).json({ message: 'Ghi chú tối đa 255 ký tự' });
    }

    await withTransaction(pool, async (conn) => {
      await lockOpenInventory(conn, dotId);

      const [rows] = await conn.query(
        `SELECT c.id, c.thiet_bi_id, c.da_xu_ly, c.phong_ban_he_thong_id, c.tinh_trang_he_thong,
                tb.ma_thiet_bi, tb.trang_thai AS trang_thai_thiet_bi
         FROM chi_tiet_kiem_ke c
         LEFT JOIN thiet_bi tb ON tb.id = c.thiet_bi_id
         WHERE c.id = ? AND c.dot_id = ?`,
        [itemId, dotId]
      );
      const item = rows[0];
      if (!item) throw new HttpError(404, 'Không tìm thấy thiết bị trong đợt kiểm kê này');
      if (!item.thiet_bi_id) {
        throw new HttpError(400, 'Không sửa kết quả của thiết bị thừa, hãy xóa rồi thêm lại');
      }

      // Mặc định: vị trí và tình trạng thực tế giống hệ thống
      let phongBanThucTe = item.phong_ban_he_thong_id;
      let tinhTrangThucTe = item.tinh_trang_he_thong;

      if (ketQua === 'thieu') {
        if (!CAN_BE_MISSING.includes(item.trang_thai_thiet_bi)) {
          throw new HttpError(
            400,
            `Thiết bị ${item.ma_thiet_bi} đang ở trạng thái ${TRANG_THAI_LABEL[item.trang_thai_thiet_bi]} nên vắng mặt là hợp lệ, hãy ghi nhận Đúng`
          );
        }
        phongBanThucTe = null;
        tinhTrangThucTe = null;
      }

      if (ketQua === 'sai_vi_tri') {
        const id = toId(body.phongBanThucTeId);
        if (!id) throw new HttpError(400, 'Vui lòng chọn phòng ban thực tế');
        if (id === item.phong_ban_he_thong_id) {
          throw new HttpError(400, 'Phòng ban thực tế phải khác phòng ban ghi nhận trong hệ thống');
        }
        const [pb] = await conn.query('SELECT id FROM phong_ban WHERE id = ?', [id]);
        if (!pb[0]) throw new HttpError(400, 'Phòng ban thực tế không tồn tại');
        phongBanThucTe = id;
      }

      if (ketQua === 'sai_tinh_trang') {
        if (!TINH_TRANG.includes(body.tinhTrangThucTe)) {
          throw new HttpError(400, 'Vui lòng chọn tình trạng thực tế');
        }
        if (body.tinhTrangThucTe === item.tinh_trang_he_thong) {
          throw new HttpError(400, 'Tình trạng thực tế phải khác tình trạng ghi nhận trong hệ thống');
        }
        tinhTrangThucTe = body.tinhTrangThucTe;
      }

      await conn.query(
        `UPDATE chi_tiet_kiem_ke
         SET ket_qua = ?, phong_ban_thuc_te_id = ?, tinh_trang_thuc_te = ?, ghi_chu = ?
         WHERE id = ?`,
        [ketQua, phongBanThucTe, tinhTrangThucTe, ghiChu, itemId]
      );
    });

    res.json({ id: itemId, ketQua });
  } catch (error) {
    sendError(error, res, next);
  }
}

// Đánh dấu "Đúng" cho mọi thiết bị trong danh sách mà chưa được kiểm
export async function markAllCorrect(req, res, next) {
  try {
    const dotId = toId(req.params.id);
    if (!dotId) return res.status(400).json({ message: 'Mã đợt kiểm kê không hợp lệ' });

    const soThietBi = await withTransaction(pool, async (conn) => {
      await lockOpenInventory(conn, dotId);
      const [result] = await conn.query(
        `UPDATE chi_tiet_kiem_ke
         SET ket_qua = 'dung', phong_ban_thuc_te_id = phong_ban_he_thong_id,
             tinh_trang_thuc_te = tinh_trang_he_thong
         WHERE dot_id = ? AND thiet_bi_id IS NOT NULL AND ket_qua IS NULL`,
        [dotId]
      );
      return result.affectedRows;
    });

    res.json({ id: dotId, soThietBi });
  } catch (error) {
    sendError(error, res, next);
  }
}

// Ghi nhận thiết bị thừa: có thực tế nhưng chưa có hồ sơ trong hệ thống
export async function addExtra(req, res, next) {
  try {
    const dotId = toId(req.params.id);
    if (!dotId) return res.status(400).json({ message: 'Mã đợt kiểm kê không hợp lệ' });

    const body = req.body ?? {};
    const moTa = text(body.moTa);
    if (!moTa) return res.status(400).json({ message: 'Vui lòng mô tả thiết bị thừa' });
    if (moTa.length > 255) return res.status(400).json({ message: 'Mô tả tối đa 255 ký tự' });

    const phongBanId = toId(body.phongBanThucTeId);
    if (!phongBanId) return res.status(400).json({ message: 'Vui lòng chọn phòng ban đang đặt thiết bị' });

    const ghiChu = text(body.ghiChu);
    if (ghiChu && ghiChu.length > 255) {
      return res.status(400).json({ message: 'Ghi chú tối đa 255 ký tự' });
    }

    const created = await withTransaction(pool, async (conn) => {
      await lockOpenInventory(conn, dotId);
      const [pb] = await conn.query('SELECT id FROM phong_ban WHERE id = ?', [phongBanId]);
      if (!pb[0]) throw new HttpError(400, 'Phòng ban không tồn tại');

      const [result] = await conn.query(
        `INSERT INTO chi_tiet_kiem_ke
           (dot_id, thiet_bi_id, ket_qua, phong_ban_thuc_te_id, mo_ta_thiet_bi_thua, ghi_chu)
         VALUES (?, NULL, 'thua', ?, ?, ?)`,
        [dotId, phongBanId, moTa, ghiChu]
      );
      return { id: result.insertId };
    });

    res.status(201).json(created);
  } catch (error) {
    sendError(error, res, next);
  }
}

// Xóa một dòng thiết bị thừa đã ghi nhận nhầm (chỉ xóa được dòng thừa, khi đợt còn đang kiểm kê)
export async function deleteExtra(req, res, next) {
  try {
    const dotId = toId(req.params.id);
    const itemId = toId(req.params.itemId);
    if (!dotId || !itemId) return res.status(400).json({ message: 'Mã không hợp lệ' });

    await withTransaction(pool, async (conn) => {
      await lockOpenInventory(conn, dotId);
      const [rows] = await conn.query(
        'SELECT id, thiet_bi_id FROM chi_tiet_kiem_ke WHERE id = ? AND dot_id = ?',
        [itemId, dotId]
      );
      if (!rows[0]) throw new HttpError(404, 'Không tìm thấy dòng cần xóa');
      if (rows[0].thiet_bi_id) {
        throw new HttpError(400, 'Chỉ xóa được dòng thiết bị thừa, không xóa thiết bị trong danh sách');
      }
      await conn.query('DELETE FROM chi_tiet_kiem_ke WHERE id = ?', [itemId]);
    });

    res.json({ id: itemId });
  } catch (error) {
    sendError(error, res, next);
  }
}

// Hoàn tất đợt kiểm kê và xử lý chênh lệch (Bảng 10, mục 3.2.5):
// - Thiếu: thiết bị chuyển Thất lạc (tình trạng giữ nguyên)
// - Sai vị trí: cập nhật phòng ban đang đặt
// - Sai tình trạng: cập nhật tình trạng; nếu thành Hỏng thì thiết bị Sẵn sàng chuyển Chờ xử lý
// - Đúng: thiết bị đang Thất lạc được tìm thấy thì trở về Sẵn sàng (hoặc Chờ xử lý nếu tình trạng Hỏng)
// - Thừa: chỉ ghi vào biên bản, cần tạo hồ sơ thiết bị mới ở trang Thiết bị
export async function completeInventory(req, res, next) {
  try {
    const dotId = toId(req.params.id);
    if (!dotId) return res.status(400).json({ message: 'Mã đợt kiểm kê không hợp lệ' });

    const bienBan = text(req.body?.bienBan);
    if (bienBan && bienBan.length > 2000) {
      return res.status(400).json({ message: 'Biên bản tối đa 2000 ký tự' });
    }

    const summary = await withTransaction(pool, async (conn) => {
      await lockOpenInventory(conn, dotId);

      const [[{ chuaKiem }]] = await conn.query(
        `SELECT COUNT(*) AS chuaKiem FROM chi_tiet_kiem_ke
         WHERE dot_id = ? AND thiet_bi_id IS NOT NULL AND ket_qua IS NULL`,
        [dotId]
      );
      if (Number(chuaKiem) > 0) {
        throw new HttpError(400, `Còn ${Number(chuaKiem)} thiết bị chưa kiểm, hãy ghi nhận kết quả trước khi hoàn tất`);
      }

      // Khóa các thiết bị có trong danh sách trong lúc xử lý
      const [items] = await conn.query(
        `SELECT c.id, c.ket_qua, c.phong_ban_thuc_te_id, c.tinh_trang_thuc_te,
                tb.id AS thiet_bi_id, tb.ma_thiet_bi, tb.trang_thai, tb.tinh_trang
         FROM chi_tiet_kiem_ke c
         JOIN thiet_bi tb ON tb.id = c.thiet_bi_id
         WHERE c.dot_id = ?
         FOR UPDATE`,
        [dotId]
      );

      const result = { soThatLac: 0, soTimThay: 0, soDoiPhongBan: 0, soDoiTinhTrang: 0 };

      for (const item of items) {
        if (item.ket_qua === 'thieu') {
          if (item.trang_thai === 'that_lac') continue; // vẫn chưa tìm thấy
          if (!['san_sang', 'cho_xu_ly'].includes(item.trang_thai)) {
            throw new HttpError(
              409,
              `Thiết bị ${item.ma_thiet_bi} đã đổi sang trạng thái ${TRANG_THAI_LABEL[item.trang_thai]} từ lúc ghi nhận, hãy ghi nhận lại kết quả`
            );
          }
          await conn.query("UPDATE thiet_bi SET trang_thai = 'that_lac' WHERE id = ?", [item.thiet_bi_id]);
          result.soThatLac += 1;
        } else if (item.ket_qua === 'dung') {
          if (item.trang_thai === 'that_lac') {
            const back = item.tinh_trang === 'hong' ? 'cho_xu_ly' : 'san_sang';
            await conn.query('UPDATE thiet_bi SET trang_thai = ? WHERE id = ?', [back, item.thiet_bi_id]);
            result.soTimThay += 1;
          }
        } else if (item.ket_qua === 'sai_vi_tri') {
          await conn.query('UPDATE thiet_bi SET phong_ban_id = ? WHERE id = ?', [
            item.phong_ban_thuc_te_id,
            item.thiet_bi_id,
          ]);
          result.soDoiPhongBan += 1;
        } else if (item.ket_qua === 'sai_tinh_trang') {
          const trangThai =
            item.tinh_trang_thuc_te === 'hong' && item.trang_thai === 'san_sang'
              ? 'cho_xu_ly'
              : item.trang_thai;
          await conn.query('UPDATE thiet_bi SET tinh_trang = ?, trang_thai = ? WHERE id = ?', [
            item.tinh_trang_thuc_te,
            trangThai,
            item.thiet_bi_id,
          ]);
          result.soDoiTinhTrang += 1;
        }
      }

      await conn.query('UPDATE chi_tiet_kiem_ke SET da_xu_ly = 1 WHERE dot_id = ?', [dotId]);
      await conn.query("UPDATE dot_kiem_ke SET trang_thai = 'hoan_tat', bien_ban = ? WHERE id = ?", [
        bienBan,
        dotId,
      ]);
      return result;
    });

    res.json({ id: dotId, ...summary });
  } catch (error) {
    sendError(error, res, next);
  }
}