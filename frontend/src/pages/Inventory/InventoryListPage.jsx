import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Input, Modal, Progress, Select, Table, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { apiRequest } from '../../services/api.js';
import { TRANG_THAI_DOT_COLOR, TRANG_THAI_DOT_LABEL } from '../../constants/labels.js';
import { formatDate } from '../../utils/format.js';
import { CreateInventoryForm } from './InventoryForms.jsx';
import './InventoryPage.css';

const EMPTY_FILTERS = { search: '', trangThai: undefined, phongBanId: undefined };

const TRANG_THAI_OPTIONS = Object.entries(TRANG_THAI_DOT_LABEL).map(([value, label]) => ({
  value,
  label,
}));

export default function InventoryListPage() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState({ phongBan: [], loaiThietBi: [] });
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [result, setResult] = useState({ query: null, items: [], total: 0, error: '' });
  const [creating, setCreating] = useState(false);

  // Tải danh sách phòng ban cho ô lọc và biểu mẫu (chỉ một lần)
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

  useEffect(() => {
    let ignore = false;
    apiRequest(`/api/inventories?${query}`)
      .then((res) => {
        if (!ignore) setResult({ query, items: res.items, total: res.total, error: '' });
      })
      .catch((err) => {
        if (!ignore) setResult({ query, items: [], total: 0, error: err.message });
      });
    return () => {
      ignore = true;
    };
  }, [query]);

  const loading = result.query !== query;

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const resetFilters = () => {
    setSearchText('');
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const columns = [
    {
      title: 'Mã đợt',
      dataIndex: 'maDot',
      render: (value, row) => <Link to={`/kiem-ke/${row.id}`}>{value}</Link>,
    },
    { title: 'Tên đợt', dataIndex: 'tenDot' },
    {
      title: 'Phạm vi',
      render: (_, row) => row.phongBan?.ten ?? 'Toàn công ty',
    },
    { title: 'Ngày kiểm kê', dataIndex: 'ngayKiemKe', render: (value) => formatDate(value) },
    { title: 'Người thực hiện', render: (_, row) => row.nguoiThucHien.hoTen },
    {
      title: 'Tiến độ',
      render: (_, row) => (
        <Progress
          className="inventory-page__progress"
          size="small"
          percent={row.soThietBi ? Math.round((row.soDaKiem / row.soThietBi) * 100) : 0}
          format={() => `${row.soDaKiem}/${row.soThietBi}`}
        />
      ),
    },
    {
      title: 'Chênh lệch',
      dataIndex: 'soChenhLech',
      align: 'right',
      render: (value) => (value > 0 ? <Tag color="warning">{value}</Tag> : value),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trangThai',
      render: (value) => (
        <Tag color={TRANG_THAI_DOT_COLOR[value]}>{TRANG_THAI_DOT_LABEL[value]}</Tag>
      ),
    },
  ];

  return (
    <section className="inventory-page">
      <div className="inventory-page__header">
        <h1 className="inventory-page__title">Kiểm kê thiết bị</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
          Tạo đợt kiểm kê
        </Button>
      </div>

      <div className="inventory-page__toolbar">
        <Input.Search
          className="inventory-page__search"
          placeholder="Tìm theo mã hoặc tên đợt"
          allowClear
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onSearch={(value) => updateFilter('search', value.trim())}
        />
        <Select
          className="inventory-page__filter"
          placeholder="Trạng thái"
          allowClear
          value={filters.trangThai}
          onChange={(value) => updateFilter('trangThai', value)}
          options={TRANG_THAI_OPTIONS}
        />
        <Select
          className="inventory-page__filter"
          placeholder="Phòng ban"
          allowClear
          value={filters.phongBanId}
          onChange={(value) => updateFilter('phongBanId', value)}
          options={catalog.phongBan.map((p) => ({ value: p.id, label: p.ten }))}
        />
        <Button onClick={resetFilters}>Xóa bộ lọc</Button>
      </div>

      {result.error && (
        <Alert className="inventory-page__alert" type="error" showIcon message={result.error} />
      )}

      <Table
        rowKey="id"
        columns={columns}
        dataSource={result.items}
        loading={loading}
        scroll={{ x: 'max-content' }}
        pagination={{
          current: page,
          pageSize,
          total: result.total,
          showSizeChanger: true,
          showTotal: (total) => `Tổng ${total} đợt`,
        }}
        onChange={(pagination) => {
          setPage(pagination.current);
          setPageSize(pagination.pageSize);
        }}
      />

      <Modal
        title="Tạo đợt kiểm kê"
        open={creating}
        onCancel={() => setCreating(false)}
        footer={null}
      >
        {creating && (
          <CreateInventoryForm
            phongBan={catalog.phongBan}
            onCancel={() => setCreating(false)}
            onCreated={(id) => navigate(`/kiem-ke/${id}`)}
          />
        )}
      </Modal>
    </section>
  );
}