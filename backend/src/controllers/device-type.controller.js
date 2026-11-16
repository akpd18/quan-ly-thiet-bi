import pool from '../config/db.js';
import { text, toId } from '../utils/validate.js';

const KY_HIEU_PATTERN = /^[A-Z0-9]{2,10}$/;
const MAX_SPECS = 30;

// Kiểm tra dữ liệu loại thiết bị; trả về { error } hoặc { data }
function parseType(body) {
  const ten = text(body.ten);
  if (!ten) return { error: 'Vui lòng nhập tên loại thiết bị' };
  if (ten.length > 100) return { error: 'Tên loại thiết bị tối đa 100 ký tự' };

  const kyHieu = (text(body.kyHieu) ?? '').toUpperCase();
  if (!KY_HIEU_PATTERN.test(kyHieu)) {
    return { error: 'Ký hiệu gồm 2 đến 10 chữ cái hoặc chữ số, không dấu, không khoảng trắng' };
  }

  let chuKy = null;
  const rawChuKy = body.chuKyBaoDuongThang;
  if (rawChuKy !== undefined && rawChuKy !== null && rawChuKy !== '') {
    chuKy = Number(rawChuKy);
    if (!Number.isInteger(chuKy) || chuKy < 1 || chuKy > 120) {
      return { error: 'Chu kỳ bảo dưỡng phải là số nguyên từ 1 đến 120 tháng' };
    }
  }

  if (body.thongSo !== undefined && !Array.isArray(body.thongSo)) {
    return { error: 'Danh sách thông số kỹ thuật không hợp lệ' };
  }
  const list = body.thongSo ?? [];
  if (list.length > MAX_SPECS) {
    return { error: `Mỗi loại tối đa ${MAX_SPECS} thông số kỹ thuật` };
  }

  const specs = [];
  const seenNames = new Set();
  const seenIds = new Set();
  for (const item of list) {
    const tenThongSo = text(item?.ten);
    if (!tenThongSo) return { error: 'Tên thông số kỹ thuật không được để trống' };
    if (tenThongSo.length > 100) return { error: 'Tên thông số tối đa 100 ký tự' };

    const nameKey = tenThongSo.toLowerCase();
    if (seenNames.has(nameKey)) return { error: `Thông số "${tenThongSo}" bị trùng` };
    seenNames.add(nameKey);

    const hasId = item.id !== undefined && item.id !== null && item.id !== '';
    const id = hasId ? toId(item.id) : null;
    if (hasId && !id) return { error: 'Mã thông số không hợp lệ' };
    if (id) {
      if (seenIds.has(id)) return { error: 'Mã thông số bị trùng' };
      seenIds.add(id);
    }
    specs.push({ id, ten: tenThongSo });
  }

  return { data: { ten, kyHieu, chuKy, specs } };
}

// Đổi lỗi trùng của MySQL thành câu thông báo dễ hiểu
function duplicateMessage(error) {
  const msg = error.sqlMessage ?? '';
  if (msg.includes('uq_loai_thiet_bi_ky_hieu')) return 'Ký hiệu đã được dùng cho loại khác';
  if (msg.includes('uq_loai_thiet_bi_ten')) return 'Tên loại thiết bị đã tồn tại';
  if (msg.includes('uq_thong_so_loai')) return 'Tên thông số bị trùng trong cùng một loại';
  return 'Dữ liệu bị trùng';
}

export async function listDeviceTypes(req, res, next) {
  try {
    const [loai] = await pool.query(
      `SELECT l.id, l.ten_loai AS ten, l.ky_hieu AS kyHieu,
              l.chu_ky_bao_duong_thang AS chuKyBaoDuongThang,
              (SELECT COUNT(*) FROM thiet_bi tb WHERE tb.loai_id = l.id) AS soThietBi
       FROM loai_thiet_bi l
       ORDER BY l.id`
    );
    const [thongSo] = await pool.query(
      `SELECT ts.id, ts.loai_id AS loaiId, ts.ten_thong_so AS ten,
              (SELECT COUNT(*) FROM thiet_bi_thong_so v WHERE v.thong_so_id = ts.id) AS soGiaTri
       FROM thong_so_loai ts
       ORDER BY ts.loai_id, ts.thu_tu`
    );

    res.json({
      items: loai.map((l) => ({
        id: l.id,
        ten: l.ten,
        kyHieu: l.kyHieu,
        chuKyBaoDuongThang: l.chuKyBaoDuongThang,
        soThietBi: Number(l.soThietBi),
        thongSo: thongSo
          .filter((t) => t.loaiId === l.id)
          .map((t) => ({ id: t.id, ten: t.ten, soGiaTri: Number(t.soGiaTri) })),
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function createDeviceType(req, res, next) {
  let conn;
  try {
    const parsed = parseType(req.body ?? {});
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const { ten, kyHieu, chuKy, specs } = parsed.data;

    conn = await pool.getConnection();
    await conn.beginTransaction();
    try {
      const [result] = await conn.query(
        'INSERT INTO loai_thiet_bi (ten_loai, ky_hieu, chu_ky_bao_duong_thang) VALUES (?, ?, ?)',
        [ten, kyHieu, chuKy]
      );
      if (specs.length) {
        await conn.query(
          'INSERT INTO thong_so_loai (loai_id, ten_thong_so, thu_tu) VALUES ?',
          [specs.map((s, index) => [result.insertId, s.ten, index + 1])]
        );
      }
      await conn.commit();
      res.status(201).json({ id: result.insertId });
    } catch (error) {
      await conn.rollback();
      throw error;
    }
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: duplicateMessage(error) });
    }
    next(error);
  } finally {
    if (conn) conn.release();
  }
}

export async function updateDeviceType(req, res, next) {
  let conn;
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã loại thiết bị không hợp lệ' });

    const parsed = parseType(req.body ?? {});
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const { ten, kyHieu, chuKy, specs } = parsed.data;

    const [rows] = await pool.query(
      `SELECT l.id, l.ky_hieu,
              (SELECT COUNT(*) FROM thiet_bi tb WHERE tb.loai_id = l.id) AS soThietBi
       FROM loai_thiet_bi l
       WHERE l.id = ?`,
      [id]
    );
    const current = rows[0];
    if (!current) return res.status(404).json({ message: 'Không tìm thấy loại thiết bị' });

    // Mã thiết bị đã sinh ra từ ký hiệu nên không đổi ký hiệu khi đã có thiết bị
    if (kyHieu !== String(current.ky_hieu).toUpperCase() && Number(current.soThietBi) > 0) {
      return res
        .status(400)
        .json({ message: 'Loại này đã có thiết bị nên không thể đổi ký hiệu' });
    }

    const [existing] = await pool.query(
      `SELECT ts.id, ts.ten_thong_so AS ten,
              (SELECT COUNT(*) FROM thiet_bi_thong_so v WHERE v.thong_so_id = ts.id) AS soGiaTri
       FROM thong_so_loai ts
       WHERE ts.loai_id = ?`,
      [id]
    );
    const existingIds = new Set(existing.map((e) => e.id));

    if (specs.some((s) => s.id && !existingIds.has(s.id))) {
      return res.status(400).json({ message: 'Có thông số không thuộc loại thiết bị này' });
    }

    // Thông số bị bỏ khỏi danh sách sẽ bị xóa, nhưng không được xóa thông số đã có dữ liệu
    const keptIds = new Set(specs.filter((s) => s.id).map((s) => s.id));
    const removed = existing.filter((e) => !keptIds.has(e.id));
    const inUse = removed.find((e) => Number(e.soGiaTri) > 0);
    if (inUse) {
      return res.status(409).json({
        message: `Thông số "${inUse.ten}" đã có dữ liệu thiết bị nên không thể xóa`,
      });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();
    try {
      await conn.query(
        'UPDATE loai_thiet_bi SET ten_loai = ?, ky_hieu = ?, chu_ky_bao_duong_thang = ? WHERE id = ?',
        [ten, kyHieu, chuKy, id]
      );

      if (removed.length) {
        await conn.query('DELETE FROM thong_so_loai WHERE id IN (?)', [removed.map((e) => e.id)]);
      }

      // Đặt tên tạm trước để hoán đổi tên giữa hai thông số không bị báo trùng
      if (keptIds.size) {
        await conn.query("UPDATE thong_so_loai SET ten_thong_so = CONCAT('~', id) WHERE id IN (?)", [
          [...keptIds],
        ]);
      }

      for (let index = 0; index < specs.length; index += 1) {
        const s = specs[index];
        if (s.id) {
          await conn.query('UPDATE thong_so_loai SET ten_thong_so = ?, thu_tu = ? WHERE id = ?', [
            s.ten,
            index + 1,
            s.id,
          ]);
        } else {
          await conn.query(
            'INSERT INTO thong_so_loai (loai_id, ten_thong_so, thu_tu) VALUES (?, ?, ?)',
            [id, s.ten, index + 1]
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
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: duplicateMessage(error) });
    }
    next(error);
  } finally {
    if (conn) conn.release();
  }
}

// Chỉ xóa được loại chưa có thiết bị nào
export async function deleteDeviceType(req, res, next) {
  let conn;
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Mã loại thiết bị không hợp lệ' });

    const [rows] = await pool.query(
      `SELECT l.id,
              (SELECT COUNT(*) FROM thiet_bi tb WHERE tb.loai_id = l.id) AS soThietBi
       FROM loai_thiet_bi l
       WHERE l.id = ?`,
      [id]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ message: 'Không tìm thấy loại thiết bị' });

    const soThietBi = Number(row.soThietBi);
    if (soThietBi > 0) {
      return res
        .status(409)
        .json({ message: `Loại thiết bị đang có ${soThietBi} thiết bị, không thể xóa` });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();
    try {
      await conn.query('DELETE FROM thong_so_loai WHERE loai_id = ?', [id]);
      await conn.query('DELETE FROM loai_thiet_bi WHERE id = ?', [id]);
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    }

    res.json({ id });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ message: 'Loại thiết bị đang được sử dụng, không thể xóa' });
    }
    next(error);
  } finally {
    if (conn) conn.release();
  }
}