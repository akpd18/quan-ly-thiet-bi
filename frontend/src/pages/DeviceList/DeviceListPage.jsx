import { Button } from 'antd';
import { useAuth } from '../../contexts/AuthContext.js';
import { VAI_TRO_LABEL } from '../../constants/labels.js';
import './DeviceListPage.css';

export default function DeviceListPage() {
  const { user, logout } = useAuth();

  return (
    <main className="device-list-page">
      <section className="device-list-page__card">
        <h1 className="device-list-page__title">Danh sách thiết bị</h1>
        <p className="device-list-page__text">
          Xin chào, <strong>{user.hoTen}</strong> ({VAI_TRO_LABEL[user.vaiTro]} – {user.tenPhongBan})
        </p>
        <p className="device-list-page__text device-list-page__text--muted">
          Trang đang được xây dựng ở các bước tiếp theo.
        </p>
        <Button onClick={logout} className="device-list-page__logout">
          Đăng xuất
        </Button>
      </section>
    </main>
  );
}