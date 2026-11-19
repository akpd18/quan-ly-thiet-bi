import { Navigate, Route, Routes } from 'react-router-dom';
import HomeRedirect from './components/HomeRedirect/HomeRedirect.jsx';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute.jsx';
import AppLayout from './components/AppLayout/AppLayout.jsx';
import LoginPage from './pages/Login/LoginPage.jsx';
import DashboardPage from './pages/Dashboard/DashboardPage.jsx';
import DeviceListPage from './pages/DeviceList/DeviceListPage.jsx';
import DeviceDetailPage from './pages/DeviceDetail/DeviceDetailPage.jsx';
import DeviceFormPage from './pages/DeviceForm/DeviceFormPage.jsx';
import LoanListPage from './pages/Loan/LoanListPage.jsx';
import LoanFormPage from './pages/LoanForm/LoanFormPage.jsx';
import LoanDetailPage from './pages/LoanDetail/LoanDetailPage.jsx';
import MaintenancePage from './pages/Maintenance/MaintenancePage.jsx';
import DepartmentListPage from './pages/Department/DepartmentListPage.jsx';
import DeviceTypeListPage from './pages/DeviceType/DeviceTypeListPage.jsx';
import UserListPage from './pages/User/UserListPage.jsx';
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
        <Route element={<AppLayout />}>
          <Route path="/thiet-bi" element={<DeviceListPage />} />
          <Route path="/thiet-bi/:id" element={<DeviceDetailPage />} />
          <Route path="/phieu-muon" element={<LoanListPage />} />
          <Route path="/phieu-muon/them" element={<LoanFormPage />} />
          <Route path="/phieu-muon/:id" element={<LoanDetailPage />} />
        </Route>
        <Route path="/403" element={<ForbiddenPage />} />
      </Route>

      {/* Chỉ quản trị viên */}
      <Route element={<ProtectedRoute roles={['quan_tri']} />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/thiet-bi/them" element={<DeviceFormPage />} />
          <Route path="/thiet-bi/:id/sua" element={<DeviceFormPage />} />
          <Route path="/bao-duong" element={<MaintenancePage />} />
          <Route path="/danh-muc/phong-ban" element={<DepartmentListPage />} />
          <Route path="/danh-muc/loai-thiet-bi" element={<DeviceTypeListPage />} />
          <Route path="/nguoi-dung" element={<UserListPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}