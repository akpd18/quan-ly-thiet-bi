import pool from '../config/db.js';
import { text, toId } from '../utils/validate.js';

function parseName(body) {
  const ten = text(body.ten);
  if (!ten) return { error: 'Vui lòng nhập tên phòng ban' };
  if (ten.length > 100) return { error: 'Tên phòng ban tối đa 100 ký tự' };
  return { ten };
}

export async function listDepartments(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT pb.id, pb.ten_phong_ban AS ten,
              (SELECT COUNT(*) FROM nguoi_dung nd WHERE nd.phong_ban_id = pb.id) AS soNguoiDung,
              (SELECT COUNT(*) FROM thiet_bi tb WHERE tb.phong_ban_id = pb.id) AS soThietBi
       FROM phong_ban pb
       ORDER BY pb.id`
    );
    res.json({
      items: rows.map((r) => ({
        id: r.id,
        ten: r.ten,
        soNguoiDung: Number(r.soNguoiDung),
        soThietBi: Number(r.soThietBi),
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function createDepartment(req, res, next) {
  try {
    const parsed = parseName(req.body ?? {});
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    const [result] = await pool.query('INSERT INTO phong_ban (ten_phong_ban) VALUES (?)', [
      parsed.ten,
    ]);
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Tên phòng ban đã tồn tại' });
    }
    next(error);
  }
}

export async function updateDepartment(req, res, next) {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã phòng ban không hợp lệ' });

    const parsed = parseName(req.body ?? {});
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    const [rows] = await pool.query('SELECT id FROM phong_ban WHERE id = ?', [id]);
    if (!rows[0]) return res.status(404).json({ message: 'Không tìm thấy phòng ban' });

    await pool.query('UPDATE phong_ban SET ten_phong_ban = ? WHERE id = ?', [parsed.ten, id]);
    res.json({ id });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Tên phòng ban đã tồn tại' });
    }
    next(error);
  }
}

// Chỉ xóa được phòng ban chưa được sử dụng ở bất kỳ đâu
export async function deleteDepartment(req, res, next) {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã phòng ban không hợp lệ' });

    const [rows] = await pool.query(
      `SELECT pb.id,
              (SELECT COUNT(*) FROM nguoi_dung nd WHERE nd.phong_ban_id = pb.id) AS soNguoiDung,
              (SELECT COUNT(*) FROM thiet_bi tb WHERE tb.phong_ban_id = pb.id) AS soThietBi
       FROM phong_ban pb
       WHERE pb.id = ?`,
      [id]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ message: 'Không tìm thấy phòng ban' });

    const soNguoiDung = Number(row.soNguoiDung);
    const soThietBi = Number(row.soThietBi);
    if (soNguoiDung > 0 || soThietBi > 0) {
      return res.status(409).json({
        message: `Phòng ban đang có ${soNguoiDung} người dùng và ${soThietBi} thiết bị, không thể xóa`,
      });
    }

    await pool.query('DELETE FROM phong_ban WHERE id = ?', [id]);
    res.json({ id });
  } catch (error) {
    // Phòng ban còn được tham chiếu ở phiếu điều động hoặc đợt kiểm kê
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        message: 'Phòng ban đã được dùng trong phiếu điều động hoặc kiểm kê, không thể xóa',
      });
    }
    next(error);
  }
}