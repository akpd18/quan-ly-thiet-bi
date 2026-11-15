import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Descriptions, Spin } from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { apiRequest } from '../../services/api.js';
import { useAuth } from '../../contexts/AuthContext.js';
import { TinhTrangTag, TrangThaiTag } from '../../components/StatusTag/StatusTag.jsx';
import { formatDate } from '../../utils/format.js';
import './DeviceDetailPage.css';

export default function DeviceDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [result, setResult] = useState({ id: null, device: null, error: '' });

  useEffect(() => {
    let ignore = false;
    apiRequest(`/api/devices/${id}`)
      .then((res) => {
        if (!ignore) setResult({ id, device: res.thietBi, error: '' });
      })
      .catch((err) => {
        if (!ignore) setResult({ id, device: null, error: err.message });
      });
    return () => {
      ignore = true;
    };
  }, [id]);

  const loading = result.id !== id;
  const { device, error } = result;

  const generalItems = device
    ? [
        { key: 'ma', label: 'Mã thiết bị', children: device.maThietBi },
        { key: 'ten', label: 'Tên thiết bị', children: device.tenThietBi },
        { key: 'loai', label: 'Loại thiết bị', children: device.tenLoai },
        { key: 'hang', label: 'Hãng', children: device.hang || '—' },
        { key: 'model', label: 'Model', children: device.model || '—' },
        { key: 'serial', label: 'Số serial', children: device.soSerial || '—' },
        { key: 'ngay', label: 'Ngày nhập', children: formatDate(device.ngayNhap) },
        { key: 'pb', label: 'Phòng ban đang đặt', children: device.tenPhongBan },
        { key: 'tt', label: 'Tình trạng', children: <TinhTrangTag value={device.tinhTrang} /> },
        { key: 'st', label: 'Trạng thái', children: <TrangThaiTag value={device.trangThai} /> },
        { key: 'gc', label: 'Ghi chú', children: device.ghiChu || '—', span: 2 },
      ]
    : [];

  const specItems = device
    ? device.thongSo.map((s) => ({ key: s.ten, label: s.ten, children: s.giaTri }))
    : [];

  return (
    <section className="device-detail-page">
      <div className="device-detail-page__topbar">
        <Link to="/thiet-bi">
          <ArrowLeftOutlined /> Quay lại danh sách
        </Link>
        {user.vaiTro === 'quan_tri' && device && device.trangThai !== 'da_thanh_ly' && (
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => navigate(`/thiet-bi/${device.id}/sua`)}
          >
            Chỉnh sửa
          </Button>
        )}
      </div>

      {loading && (
        <div className="device-detail-page__loading">
          <Spin size="large" />
        </div>
      )}

      {!loading && error && (
        <Alert className="device-detail-page__alert" type="error" showIcon message={error} />
      )}

      {!loading && device && (
        <>
          <div className="device-detail-page__card">
            <h1 className="device-detail-page__title">Thông tin thiết bị</h1>
            <Descriptions bordered size="small" column={{ xs: 1, md: 2 }} items={generalItems} />
          </div>

          <div className="device-detail-page__card">
            <h2 className="device-detail-page__subtitle">Thông số kỹ thuật</h2>
            <Descriptions bordered size="small" column={{ xs: 1, md: 2 }} items={specItems} />
          </div>
        </>
      )}
    </section>
  );
}