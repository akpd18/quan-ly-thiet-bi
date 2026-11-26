import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Input, Modal, Popconfirm, Select, Table, message } from 'antd';
import { ArrowRightOutlined, CheckOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { apiRequest } from '../../services/api.js';
import { PHIEU_MUON_LABEL } from '../../constants/labels.js';
import { PhieuMuonTag, TrangThaiTag } from '../../components/StatusTag/StatusTag.jsx';
import { formatDate, formatDateTime } from '../../utils/format.js';
import TransferForm from './TransferForm.jsx';
import './TransferPage.css';

const EMPTY_FILTERS = { search: '', trangThai: undefined, phongBanId: undefined };

// Phiếu điều động chỉ có ba trạng thái: Chờ duyệt, Đã duyệt, Từ chối
const TRANG_THAI_OPTIONS = ['cho_duyet', 'da_duyet', 'tu_choi'].map((value) => ({
  value,
  label: PHIEU_MUON_LABEL[value],
}));

export default function TransferPage() {
  const [catalog, setCatalog] = useState({ phongBan: [], loaiThietBi: [] });
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState({ key: null, items: [], total: 0, error: '' });
  const [creating, setCreating] = useState(false);

  // Tải danh sách phòng ban cho ô lọc (chỉ một lần)
  useEffect(() => {
    apiRequest('/api/catalog')
      .then(setCatalog)
      .catch((err) => setResult((prev) => ({ ...prev, error: err.message })));
  }, []);

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
    apiRequest(`/api/transfers?${query}`)
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
      await apiRequest(`/api/transfers/${row.id}/${action}`, { method: 'POST' });
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
          <div className="transfer-page__muted">{row.thietBi.tenThietBi}</div>
        </div>
      ),
    },
    {
      title: 'Điều động',
      render: (_, row) => (
        <span className="transfer-page__route">
          {row.phongBanDi.ten} <ArrowRightOutlined /> <strong>{row.phongBanDen.ten}</strong>
        </span>
      ),
    },
    { title: 'Ngày điều động', dataIndex: 'ngayDieuDong', render: (value) => formatDate(value) },
    {
      title: 'Trạng thái thiết bị',
      render: (_, row) => <TrangThaiTag value={row.thietBi.trangThai} />,
    },
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
            <div className="transfer-page__muted">{formatDateTime(row.thoiDiemDuyet)}</div>
          </div>
        ) : (
          '—'
        ),
    },
    {
      title: 'Thao tác',
      render: (_, row) =>
        row.trangThai === 'cho_duyet' ? (
          <div className="transfer-page__row-actions">
            <Popconfirm
              title="Duyệt phiếu điều động này?"
              description={`Thiết bị sẽ chuyển sang phòng ban ${row.phongBanDen.ten}.`}
              okText="Duyệt"
              cancelText="Hủy"
              onConfirm={() => handleDecision(row, 'approve', 'Đã duyệt, thiết bị đã chuyển phòng ban')}
            >
              <Button size="small" type="primary" icon={<CheckOutlined />}>
                Duyệt
              </Button>
            </Popconfirm>
            <Popconfirm
              title="Từ chối phiếu này?"
              okText="Từ chối"
              cancelText="Hủy"
              onConfirm={() => handleDecision(row, 'reject', 'Đã từ chối phiếu điều động')}
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
    <section className="transfer-page">
      <div className="transfer-page__header">
        <h1 className="transfer-page__title">Điều động thiết bị</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
          Lập phiếu điều động
        </Button>
      </div>

      <div className="transfer-page__toolbar">
        <Input.Search
          className="transfer-page__search"
          placeholder="Tìm theo mã phiếu, mã hoặc tên thiết bị"
          allowClear
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onSearch={(value) => updateFilter('search', value.trim())}
        />
        <Select
          className="transfer-page__filter"
          placeholder="Trạng thái phiếu"
          allowClear
          value={filters.trangThai}
          onChange={(value) => updateFilter('trangThai', value)}
          options={TRANG_THAI_OPTIONS}
        />
        <Select
          className="transfer-page__filter"
          placeholder="Phòng ban (đi hoặc đến)"
          allowClear
          value={filters.phongBanId}
          onChange={(value) => updateFilter('phongBanId', value)}
          options={catalog.phongBan.map((p) => ({ value: p.id, label: p.ten }))}
        />
        <Button onClick={resetFilters}>Xóa bộ lọc</Button>
      </div>

      {result.error && (
        <Alert className="transfer-page__alert" type="error" showIcon message={result.error} />
      )}

      <Table
        rowKey="id"
        columns={columns}
        dataSource={result.items}
        loading={loading}
        scroll={{ x: 'max-content' }}
        expandable={{
          expandedRowRender: (row) => (
            <p className="transfer-page__detail">
              <strong>Lý do điều động:</strong> {row.lyDo}
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
        title="Lập phiếu điều động"
        open={creating}
        onCancel={() => setCreating(false)}
        footer={null}
      >
        {creating && (
          <TransferForm
            phongBan={catalog.phongBan}
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