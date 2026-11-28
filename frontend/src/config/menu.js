import {
  ApartmentOutlined,
  AppstoreOutlined,
  AuditOutlined,
  DashboardOutlined,
  FileDoneOutlined,
  LaptopOutlined,
  SwapOutlined,
  TeamOutlined,
  ToolOutlined,
} from '@ant-design/icons';

// Mỗi mục menu: đường dẫn (key), nhãn, biểu tượng và các vai trò được thấy.
// Mục có "children" là một nhóm: key của nhóm chỉ là tên gọi, không phải đường dẫn.
// Mục con không cần khai báo roles, tự theo nhóm chứa nó.
export const MENU_ITEMS = [
  { key: '/dashboard', label: 'Dashboard', icon: DashboardOutlined, roles: ['quan_tri'] },
  { key: '/thiet-bi', label: 'Thiết bị', icon: LaptopOutlined, roles: ['quan_tri', 'nhan_vien'] },
  { key: '/phieu-muon', label: 'Phiếu mượn – trả', icon: SwapOutlined, roles: ['quan_tri', 'nhan_vien'] },
  { key: '/dieu-dong', label: 'Điều động', icon: ApartmentOutlined, roles: ['quan_tri'] },
  { key: '/kiem-ke', label: 'Kiểm kê', icon: AuditOutlined, roles: ['quan_tri'] },
  { key: '/bao-duong', label: 'Bảo dưỡng – sửa chữa', icon: ToolOutlined, roles: ['quan_tri'] },
  { key: '/thanh-ly', label: 'Thanh lý', icon: FileDoneOutlined, roles: ['quan_tri'] },
  {
    key: 'danh-muc',
    label: 'Danh mục',
    icon: AppstoreOutlined,
    roles: ['quan_tri'],
    children: [
      { key: '/danh-muc/phong-ban', label: 'Phòng ban' },
      { key: '/danh-muc/loai-thiet-bi', label: 'Loại thiết bị' },
    ],
  },
  { key: '/nguoi-dung', label: 'Người dùng', icon: TeamOutlined, roles: ['quan_tri'] },
];