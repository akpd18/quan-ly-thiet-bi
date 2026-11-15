import { DashboardOutlined, LaptopOutlined } from '@ant-design/icons';

// Mỗi mục menu: đường dẫn (key), nhãn, biểu tượng và các vai trò được thấy.
// Khi thêm trang mới ở các bước sau, chỉ cần thêm một dòng vào đây.
export const MENU_ITEMS = [
  { key: '/dashboard', label: 'Dashboard', icon: DashboardOutlined, roles: ['quan_tri'] },
  { key: '/thiet-bi', label: 'Thiết bị', icon: LaptopOutlined, roles: ['quan_tri', 'nhan_vien'] },
];