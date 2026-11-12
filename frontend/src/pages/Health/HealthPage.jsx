import { useEffect, useState } from 'react';
import { TRANG_THAI_LABEL } from '../../constants/labels.js';
import './HealthPage.css';

export default function HealthPage() {
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [rows, setRows] = useState([]);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'ok') {
          setStatus('success');
          setMessage(`Đã đọc được ${data.tongThietBi} thiết bị từ MySQL`);
          setRows(data.theoTrangThai);
        } else {
          setStatus('error');
          setMessage(data.message || 'Backend báo lỗi, xem terminal backend để biết chi tiết');
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

        {rows.length > 0 && (
          <ul className="health-page__list">
            {rows.map((row) => (
              <li key={row.trang_thai} className="health-page__item">
                <span className="health-page__item-label">
                  {TRANG_THAI_LABEL[row.trang_thai]}
                </span>
                <span className="health-page__item-value">{row.so_luong}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}