// Trang chủ theo vai trò: quản trị viên vào Dashboard, nhân viên vào Danh sách thiết bị
export function getHomePath(user) {
  return user.vaiTro === 'quan_tri' ? '/dashboard' : '/thiet-bi';
}