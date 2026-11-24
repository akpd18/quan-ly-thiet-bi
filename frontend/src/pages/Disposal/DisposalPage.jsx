import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Input, Modal, Popconfirm, Select, Table, Tag, message } from 'antd';
import { CheckOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { apiRequest } from '../../services/api.js';
import { HINH_THUC_COLOR, HINH_THUC_LABEL, PHIEU_MUON_LABEL } from '../../constants/labels.js';
import { PhieuMuonTag, TinhTrangTag, TrangThaiTag } from '../../components/StatusTag/StatusTag.jsx';
import { formatDate, formatDateTime, formatMoney } from '../../utils/format.js';
import DisposalForm from './DisposalForm.jsx';
import './DisposalPage.css';

const EMPTY_FILTERS = { search: '', trangThai: undefined, hinhThuc: undefined };

// Phiếu thanh lý chỉ có ba trạng thái: Chờ duyệt, Đã duyệt, Từ chối
const TRANG_THAI_OPTIONS = ['cho_duyet', 'da_duyet', 'tu_choi'].map((value) => ({
  value,
  label: PHIEU_MUON_LABEL[value],
}));
const HINH_THUC_OPTIONS = Object.entries(HINH_THUC_LABEL).map(([value, label]) => ({
  value,
  label,
}));

export default function DisposalPage() {
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState({ key: null, items: [], total: 0, error: '' });
  const [creating, setCreating] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page, pageSize });
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters, page, pageSize]);

  const requestKey = `${query}|${reloadKey}`;

  useEffect(() => {
    let ignore = false;
    apiRequest(`/api/disposals?${query}`)
      .then((res) => {
        if (!ignore) setResult({ key: requestKey, items: res.items, total: res.total, error: '' });
      })
      .catch((err) => {
        if (!ignore) setResult({ key: requestKey, items: [], total: 0, error: err.message });
      });
    return () => {
      ignore = true;
    };
  }, [query, requestKey]);

  const loading = result.key !== requestKey;
  const reload = () => setReloadKey((k) => k + 1);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const resetFilters = () => {
    setSearchText('');
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  // Duyệt hoặc từ chối một phiếu
  const handleDecision = async (row, action, successText) => {
    try {
      await apiRequest(`/api/disposals/${row.id}/${action}`, { method: 'POST' });
      message.success(successText);
      reload();
    } catch (err) {
      message.error(err.message);
    }
  };

  const columns = [
    { title: 'Mã phiếu', dataIndex: 'maPhieu' },
    {
      title: 'Thiết bị',
      render: (_, row) => (
        <div>
          <Link to={`/thiet-bi/${row.thietBi.id}`}>{row.thietBi.maThietBi}</Link>
          <div className="disposal-page__muted">{row.thietBi.tenThietBi}</div>
        </div>
      ),
    },
    {
      title: 'Tình trạng',
      render: (_, row) => <TinhTrangTag value={row.thietBi.tinhTrang} />,
    },
    {
      title: 'Trạng thái thiết bị',
      render: (_, row) => <TrangThaiTag value={row.thietBi.trangThai} />,
    },
    {
      title: 'Hình thức',
      dataIndex: 'hinhThuc',
      render: (value) => <Tag color={HINH_THUC_COLOR[value]}>{HINH_THUC_LABEL[value]}</Tag>,
    },
    {
      title: 'Giá trị thu hồi',
      dataIndex: 'giaTriThuHoi',
      align: 'right',
      render: (value) => formatMoney(value),
    },
    { title: 'Ngày thanh lý', dataIndex: 'ngayThanhLy', render: (value) => formatDate(value) },
    { title: 'Người lập', render: (_, row) => row.nguoiLap.hoTen },
    {
      title: 'Trạng thái phiếu',
      dataIndex: 'trangThai',
      render: (value) => <PhieuMuonTag value={value} />,
    },
    {
      title: 'Người duyệt',
      render: (_, row) =>
        row.nguoiDuyet ? (
          <div>
            <div>{row.nguoiDuyet.hoTen}</div>
            <div className="disposal-page__muted">{formatDateTime(row.thoiDiemDuyet)}</div>
          </div>
        ) : (
          '—'
        ),
    },
    {
      title: 'Thao tác',
      render: (_, row) =>
        row.trangThai === 'cho_duyet' ? (
          <div className="disposal-page__row-actions">
            <Popconfirm
              title="Duyệt phiếu thanh lý này?"
              description="Thiết bị sẽ chuyển sang Đã thanh lý và không còn được mượn, điều động hay sửa chữa."
              okText="Duyệt"
              cancelText="Hủy"
              onConfirm={() => handleDecision(row, 'approve', 'Đã duyệt, thiết bị chuyển sang Đã thanh lý')}
            >
              <Button size="small" type="primary" icon={<CheckOutlined />}>
                Duyệt
              </Button>
            </Popconfirm>
            <Popconfirm
              title="Từ chối phiếu này?"
              okText="Từ chối"
              cancelText="Hủy"
              onConfirm={() => handleDecision(row, 'reject', 'Đã từ chối phiếu thanh lý')}
            >
              <Button size="small" danger icon={<CloseOutlined />}>
                Từ chối
              </Button>
            </Popconfirm>
          </div>
        ) : null,
    },
  ];

  return (
    <section className="disposal-page">
      <div className="disposal-page__header">
        <h1 className="disposal-page__title">Thanh lý thiết bị</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
          Lập phiếu thanh lý
        </Button>
      </div>

      <div className="disposal-page__toolbar">
        <Input.Search
          className="disposal-page__search"
          placeholder="Tìm theo mã phiếu, mã hoặc tên thiết bị"
          allowClear
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onSearch={(value) => updateFilter('search', value.trim())}
        />
        <Select
          className="disposal-page__filter"
          placeholder="Trạng thái phiếu"
          allowClear
          value={filters.trangThai}
          onChange={(value) => updateFilter('trangThai', value)}
          options={TRANG_THAI_OPTIONS}
        />
        <Select
          className="disposal-page__filter"
          placeholder="Hình thức"
          allowClear
          value={filters.hinhThuc}
          onChange={(value) => updateFilter('hinhThuc', value)}
          options={HINH_THUC_OPTIONS}
        />
        <Button onClick={resetFilters}>Xóa bộ lọc</Button>
      </div>

      {result.error && (
        <Alert className="disposal-page__alert" type="error" showIcon message={result.error} />
      )}

      <Table
        rowKey="id"
        columns={columns}
        dataSource={result.items}
        loading={loading}
        scroll={{ x: 'max-content' }}
        expandable={{
          expandedRowRender: (row) => (
            <p className="disposal-page__detail">
              <strong>Lý do thanh lý:</strong> {row.lyDo}
            </p>
          ),
        }}
        pagination={{
          current: page,
          pageSize,
          total: result.total,
          showSizeChanger: true,
          showTotal: (total) => `Tổng ${total} phiếu`,
        }}
        onChange={(pagination) => {
          setPage(pagination.current);
          setPageSize(pagination.pageSize);
        }}
      />

      <Modal
        title="Lập phiếu thanh lý"
        open={creating}
        onCancel={() => setCreating(false)}
        footer={null}
      >
        {creating && (
          <DisposalForm
            onCancel={() => setCreating(false)}
            onSaved={() => {
              setCreating(false);
              reload();
            }}
          />
        )}
      </Modal>
    </section>
  );
}