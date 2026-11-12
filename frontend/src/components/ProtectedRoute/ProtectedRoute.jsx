import { Navigate, Outlet } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../../contexts/AuthContext.js';
import './ProtectedRoute.css';

// roles: danh sách vai trò được phép; bỏ trống nghĩa là chỉ cần đăng nhập
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="protected-route__loading">
        <Spin size="large" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.vaiTro)) return <Navigate to="/403" replace />;

  return <Outlet />;
}