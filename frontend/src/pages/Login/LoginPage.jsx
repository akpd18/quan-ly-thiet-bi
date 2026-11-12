import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Button, Form, Input } from 'antd';
import { useAuth } from '../../contexts/AuthContext.js';
import { getHomePath } from '../../utils/routes.js';
import './LoginPage.css';

export default function LoginPage() {
  const { user, login } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Đã đăng nhập thì chuyển thẳng về trang chủ theo vai trò
  if (user) return <Navigate to={getHomePath(user)} replace />;

  const handleSubmit = async (values) => {
    setSubmitting(true);
    setError('');
    try {
      await login(values.tenDangNhap.trim(), values.matKhau);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-page__card">
        <h1 className="login-page__title">Quản lý thiết bị</h1>
        <p className="login-page__subtitle">Đăng nhập để tiếp tục</p>

        <Form layout="vertical" onFinish={handleSubmit} className="login-page__form">
          <Form.Item
            label="Tên đăng nhập"
            name="tenDangNhap"
            rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập' }]}
          >
            <Input size="large" autoFocus />
          </Form.Item>

          <Form.Item
            label="Mật khẩu"
            name="matKhau"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
          >
            <Input.Password size="large" />
          </Form.Item>

          {error && <p className="login-page__error">{error}</p>}

          <Button
            type="primary"
            htmlType="submit"
            size="large"
            block
            loading={submitting}
            className="login-page__submit"
          >
            Đăng nhập
          </Button>
        </Form>

        <p className="login-page__hint">
          Tài khoản thử nghiệm: admin (quản trị viên) hoặc nv01 (nhân viên). Mật khẩu: 123456.
        </p>
      </section>
    </main>
  );
}