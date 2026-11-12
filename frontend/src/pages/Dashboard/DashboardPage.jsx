import { Button } from 'antd';
import { useAuth } from '../../contexts/AuthContext.js';
import { VAI_TRO_LABEL } from '../../constants/labels.js';
import './DashboardPage.css';

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <main className="dashboard-page">
      <section className="dashboard-page__card">
        <h1 className="dashboard-page__title">Dashboard quản trị</h1>
        <p className="dashboard-page__text">
          Xin chào, <strong>{user.hoTen}</strong> ({VAI_TRO_LABEL[user.vaiTro]} – {user.tenPhongBan})
        </p>
        <p className="dashboard-page__text dashboard-page__text--muted">
          Trang đang được xây dựng ở các bước tiếp theo.
        </p>
        <Button onClick={logout} className="dashboard-page__logout">
          Đăng xuất
        </Button>
      </section>
    </main>
  );
}