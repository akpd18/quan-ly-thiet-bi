import { useNavigate } from 'react-router-dom';
import { Button, Result } from 'antd';
import { useAuth } from '../../contexts/AuthContext.js';
import { getHomePath } from '../../utils/routes.js';
import './ForbiddenPage.css';

export default function ForbiddenPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <main className="forbidden-page">
      <Result
        status="403"
        title="403"
        subTitle="Bạn không có quyền truy cập trang này."
        extra={
          <Button type="primary" onClick={() => navigate(getHomePath(user), { replace: true })}>
            Về trang chủ
          </Button>
        }
      />
    </main>
  );
}