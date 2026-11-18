import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Descriptions,
  Form,
  Modal,
  Popconfirm,
  Select,
  Spin,
  Table,
  Tag,
  message,
} from 'antd';
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, RollbackOutlined } from '@ant-design/icons';
import { apiRequest } from '../../services/api.js';
import { useAuth } from '../../contexts/AuthContext.js';
import { TINH_TRANG_LABEL } from '../../constants/labels.js';
import {
  PhieuMuonTag,
  TinhTrangTag,
  TrangThaiTag,
} from '../../components/StatusTag/StatusTag.jsx';
import { formatDate, formatDateTime } from '../../utils/format.js';
import './LoanDetailPage.css';

const TINH_TRANG_OPTIONS = Object.entries(TINH_TRANG_LABEL).map(([value, label]) => ({
  value,
  label,
}));

// Biểu mẫu xác nhận trả: ghi tình trạng của từng thiết bị khi trả
function ReturnForm({ loan, onCancel, onSaved }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const initialValues = {
    tinhTrang: Object.fromEntries(loan.thietBi.map((d) => [String(d.thietBiId), d.tinhTrang])),
  };

  const handleFinish = async (values) => {
    setSubmitting(true);
    setError('');
    try {
      const res = await apiRequest(`/api/loans/${loan.id}/return`, {
        method: 'POST',
        body: {
          thietBi: loan.thietBi.map((d) => ({
            thietBiId: d.thietBiId,
            tinhTrang: values.tinhTrang[String(d.thietBiId)],
          })),
        },
      });
      message.success(
        res.soThietBiHong > 0
          ? `Đã nhận trả. ${res.soThietBiHong} thiết bị hỏng được chuyển sang Chờ xử lý`
          : 'Đã nhận trả thiết bị'
      );
      onSaved();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <Form layout="vertical" initialValues={initialValues} onFinish={handleFinish}>
      <p className="loan-detail-page__note">
        Chọn tình trạng của từng thiết bị khi nhận lại. Thiết bị ở tình trạng Hỏng sẽ chuyển sang
        trạng thái Chờ xử lý, các thiết bị còn lại trở về Sẵn sàng.
      </p>

      {loan.thietBi.map((d) => (
        <Form.Item
          key={d.thietBiId}
          label={`${d.maThietBi} – ${d.tenThietBi}`}
          name={['tinhTrang', String(d.thietBiId)]}
          rules={[{ required: true, message: 'Vui lòng chọn tình trạng' }]}
        >
          <Select options={TINH_TRANG_OPTIONS} />
        </Form.Item>
      ))}

      {error && <Alert className="loan-detail-page__alert" type="error" showIcon message={error} />}

      <div className="loan-detail-page__actions">
        <Button type="primary" htmlType="submit" loading={submitting}>
          Xác nhận đã trả
        </Button>
        <Button onClick={onCancel}>Hủy</Button>
      </div>
    </Form>
  );
}

export default function LoanDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const isAdmin = user.vaiTro === 'quan_tri';

  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState({ key: null, loan: null, error: '' });
  const [returning, setReturning] = useState(false);

  const requestKey = `${id}|${reloadKey}`;

  useEffect(() => {
    let ignore = false;
    apiRequest(`/api/loans/${id}`)
      .then((res) => {
        if (!ignore) setResult({ key: requestKey, loan: res.phieu, error: '' });
      })
      .catch((err) => {
        if (!ignore) setResult({ key: requestKey, loan: null, error: err.message });
      });
    return () => {
      ignore = true;
    };
  }, [id, requestKey]);

  const loading = result.key !== requestKey;
  const { loan, error } = result;
  const reload = () => setReloadKey((k) => k + 1);

  // Duyệt hoặc từ chối phiếu
  const handleDecision = async (action, successText) => {
    try {
      await apiRequest(`/api/loans/${id}/${action}`, { method: 'POST' });
      message.success(successText);
      reload();
    } catch (err) {
      message.error(err.message);
    }
  };

  const generalItems = loan
    ? [
        { key: 'ma', label: 'Mã phiếu', children: loan.maPhieu },
        {
          key: 'tt',
          label: 'Trạng thái',
          children: (
            <span>
              <PhieuMuonTag value={loan.trangThai} />
              {loan.quaHan && <Tag color="error">Quá hạn</Tag>}
            </span>
          ),
        },
        {
          key: 'nm',
          label: 'Người mượn',
          children: `${loan.nguoiMuon.hoTen} – ${loan.nguoiMuon.tenPhongBan}`,
        },
        { key: 'nl', label: 'Người lập phiếu', children: loan.nguoiLap.hoTen },
        { key: 'nmuon', label: 'Ngày mượn', children: formatDate(loan.ngayMuon) },
        { key: 'han', label: 'Hạn trả', children: formatDate(loan.hanTra) },
        { key: 'ntra', label: 'Ngày trả', children: formatDate(loan.ngayTra) || '—' },
        { key: 'nd', label: 'Người duyệt', children: loan.nguoiDuyet?.hoTen ?? '—' },
        { key: 'td', label: 'Thời điểm duyệt', children: formatDateTime(loan.thoiDiemDuyet) || '—' },
        { key: 'tao', label: 'Ngày lập phiếu', children: formatDateTime(loan.ngayTao) },
      ]
    : [];

  const columns = [
    {
      title: 'Mã thiết bị',
      dataIndex: 'maThietBi',
      render: (value, row) => <Link to={`/thiet-bi/${row.thietBiId}`}>{value}</Link>,
    },
    { title: 'Tên thiết bị', dataIndex: 'tenThietBi' },
    { title: 'Loại', dataIndex: 'tenLoai' },
    {
      title: 'Hãng / Model',
      render: (_, row) => [row.hang, row.model].filter(Boolean).join(' ') || '—',
    },
    {
      title: 'Tình trạng hiện tại',
      dataIndex: 'tinhTrang',
      render: (value) => <TinhTrangTag value={value} />,
    },
    {
      title: 'Trạng thái hiện tại',
      dataIndex: 'trangThai',
      render: (value) => <TrangThaiTag value={value} />,
    },
    {
      title: 'Tình trạng khi trả',
      dataIndex: 'tinhTrangKhiTra',
      render: (value) => (value ? <TinhTrangTag value={value} /> : '—'),
    },
  ];

  return (
    <section className="loan-detail-page">
      <div className="loan-detail-page__topbar">
        <Link to="/phieu-muon">
          <ArrowLeftOutlined /> Quay lại danh sách
        </Link>

        {isAdmin && loan && loan.trangThai === 'cho_duyet' && (
          <div className="loan-detail-page__actions">
            <Popconfirm
              title="Duyệt phiếu này?"
              description="Các thiết bị trong phiếu sẽ chuyển sang trạng thái Đang mượn."
              okText="Duyệt"
              cancelText="Hủy"
              onConfirm={() => handleDecision('approve', 'Đã duyệt phiếu')}
            >
              <Button type="primary" icon={<CheckOutlined />}>
                Duyệt phiếu
              </Button>
            </Popconfirm>
            <Popconfirm
              title="Từ chối phiếu này?"
              okText="Từ chối"
              cancelText="Hủy"
              onConfirm={() => handleDecision('reject', 'Đã từ chối phiếu')}
            >
              <Button danger icon={<CloseOutlined />}>
                Từ chối
              </Button>
            </Popconfirm>
          </div>
        )}

        {isAdmin && loan && loan.trangThai === 'da_duyet' && (
          <Button type="primary" icon={<RollbackOutlined />} onClick={() => setReturning(true)}>
            Xác nhận trả
          </Button>
        )}
      </div>

      {loading && (
        <div className="loan-detail-page__loading">
          <Spin size="large" />
        </div>
      )}

      {!loading && error && (
        <Alert className="loan-detail-page__alert" type="error" showIcon message={error} />
      )}

      {!loading && loan && (
        <>
          {loan.quaHan && (
            <Alert
              className="loan-detail-page__alert"
              type="warning"
              showIcon
              message={`Phiếu đã quá hạn trả (hạn trả ${formatDate(loan.hanTra)}). Thiết bị vẫn chưa được trả.`}
            />
          )}

          <div className="loan-detail-page__card">
            <h1 className="loan-detail-page__title">Phiếu mượn {loan.maPhieu}</h1>
            <Descriptions bordered size="small" column={{ xs: 1, md: 2 }} items={generalItems} />
          </div>

          <div className="loan-detail-page__card">
            <h2 className="loan-detail-page__subtitle">Thiết bị trong phiếu ({loan.thietBi.length})</h2>
            <Table
              rowKey="thietBiId"
              columns={columns}
              dataSource={loan.thietBi}
              pagination={false}
              scroll={{ x: 'max-content' }}
              expandable={{
                expandedRowRender: (row) =>
                  row.thongSo.length ? (
                    <Descriptions
                      bordered
                      size="small"
                      column={{ xs: 1, md: 2 }}
                      items={row.thongSo.map((s) => ({ key: s.ten, label: s.ten, children: s.giaTri }))}
                    />
                  ) : (
                    <span className="loan-detail-page__note">Chưa có thông số kỹ thuật.</span>
                  ),
              }}
            />
          </div>

          <Modal
            title={`Xác nhận trả phiếu ${loan.maPhieu}`}
            open={returning}
            onCancel={() => setReturning(false)}
            footer={null}
          >
            {returning && (
              <ReturnForm
                loan={loan}
                onCancel={() => setReturning(false)}
                onSaved={() => {
                  setReturning(false);
                  reload();
                }}
              />
            )}
          </Modal>
        </>
      )}
    </section>
  );
}