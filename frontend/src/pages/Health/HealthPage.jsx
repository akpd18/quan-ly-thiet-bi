import { useEffect, useState } from 'react';
import './HealthPage.css';

export default function HealthPage() {
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'ok') {
          setStatus('success');
          setMessage('Giao diện, backend và MySQL đều hoạt động');
        } else {
          setStatus('error');
          setMessage(data.message);
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Không gọi được backend. Kiểm tra backend đã chạy chưa.');
      });
  }, []);

  return (
    <main className="health-page">
      <section className="health-page__card">
        <h1 className="health-page__title">Kiểm tra kết nối hệ thống</h1>
        <p className={`health-page__status health-page__status--${status}`}>
          {status === 'loading' ? 'Đang kiểm tra...' : message}
        </p>
      </section>
    </main>
  );
}