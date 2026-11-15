import pool from '../config/db.js';

// Danh sách phòng ban và loại thiết bị (kèm các thông số kỹ thuật của từng loại),
// dùng cho các ô lọc và biểu mẫu thêm, sửa thiết bị
export async function getCatalog(req, res, next) {
  try {
    const [phongBan] = await pool.query(
      'SELECT id, ten_phong_ban AS ten FROM phong_ban ORDER BY id'
    );
    const [loai] = await pool.query(
      'SELECT id, ten_loai AS ten, ky_hieu AS kyHieu FROM loai_thiet_bi ORDER BY id'
    );
    const [thongSo] = await pool.query(
      'SELECT id, loai_id AS loaiId, ten_thong_so AS ten FROM thong_so_loai ORDER BY loai_id, thu_tu'
    );

    const loaiThietBi = loai.map((l) => ({
      ...l,
      thongSo: thongSo.filter((t) => t.loaiId === l.id).map(({ id, ten }) => ({ id, ten })),
    }));

    res.json({ phongBan, loaiThietBi });
  } catch (error) {
    next(error);
  }
}