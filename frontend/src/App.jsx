import { Navigate, Route, Routes } from 'react-router-dom';
import HomeRedirect from './components/HomeRedirect/HomeRedirect.jsx';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute.jsx';
import LoginPage from './pages/Login/LoginPage.jsx';
import DashboardPage from './pages/Dashboard/DashboardPage.jsx';
import DeviceListPage from './pages/DeviceList/DeviceListPage.jsx';
import ForbiddenPage from './pages/Forbidden/ForbiddenPage.jsx';
import HealthPage from './pages/Health/HealthPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/health" element={<HealthPage />} />

      {/* Cần đăng nhập, vai trò nào cũng vào được */}
      <Route element={<ProtectedRoute />}>
        <Route path="/thiet-bi" element={<DeviceListPage />} />
        <Route path="/403" element={<ForbiddenPage />} />
      </Route>

      {/* Chỉ quản trị viên */}
      <Route element={<ProtectedRoute roles={['quan_tri']} />}>
        <Route path="/dashboard" element={<DashboardPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}