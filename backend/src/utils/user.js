export const SELECT_USER = `
  SELECT nd.id, nd.ho_ten, nd.ten_dang_nhap, nd.vai_tro, nd.phong_ban_id, pb.ten_phong_ban
  FROM nguoi_dung nd
  JOIN phong_ban pb ON pb.id = nd.phong_ban_id`;

export function toUserDto(row) {
  return {
    id: row.id,
    hoTen: row.ho_ten,
    tenDangNhap: row.ten_dang_nhap,
    vaiTro: row.vai_tro,
    phongBanId: row.phong_ban_id,
    tenPhongBan: row.ten_phong_ban,
  };
}