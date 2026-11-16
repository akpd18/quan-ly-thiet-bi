import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button, Layout, Menu, Tag } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext.js';
import { VAI_TRO_LABEL } from '../../constants/labels.js';
import { MENU_ITEMS } from '../../config/menu.js';
import './AppLayout.css';

const { Header, Sider, Content } = Layout;

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  // Mục không khai báo roles (mục con) thì ai thấy nhóm cha cũng thấy
  const canSee = (item) => !item.roles || item.roles.includes(user.vaiTro);

  // Chuyển cấu hình menu sang dạng Ant Design cần, chỉ giữ mục vai trò hiện tại được thấy
  const toMenuItems = (items) =>
    items.filter(canSee).map(({ key, label, icon: Icon, children }) => ({
      key,
      label,
      icon: Icon ? <Icon /> : undefined,
      children: children ? toMenuItems(children) : undefined,
    }));
  const menuItems = toMenuItems(MENU_ITEMS);

  // Các mục có đường dẫn thật (mục đơn hoặc mục con của nhóm)
  const pages = MENU_ITEMS.filter(canSee).flatMap((item) => item.children ?? [item]);

  // Trang con (ví dụ /thiet-bi/5) vẫn làm sáng mục menu cha (/thiet-bi)
  const selected = pages.find(
    (item) => pathname === item.key || pathname.startsWith(`${item.key}/`)
  );

  return (
    <Layout className="app-layout">
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        className="app-layout__sider"
      >
        <div className="app-layout__logo">{collapsed ? 'QLTB' : 'Quản lý thiết bị'}</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selected ? [selected.key] : []}
          defaultOpenKeys={['danh-muc']}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      <Layout className="app-layout__main">
        <Header className="app-layout__header">
          <div className="app-layout__user">
            <span className="app-layout__user-name">{user.hoTen}</span>
            <Tag color={user.vaiTro === 'quan_tri' ? 'blue' : 'default'}>
              {VAI_TRO_LABEL[user.vaiTro]}
            </Tag>
            <span className="app-layout__user-dept">{user.tenPhongBan}</span>
          </div>
          <Button icon={<LogoutOutlined />} onClick={logout}>
            Đăng xuất
          </Button>
        </Header>

        <Content className="app-layout__content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}