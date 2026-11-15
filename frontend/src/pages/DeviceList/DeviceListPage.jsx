import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Input, Select, Table } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { apiRequest } from '../../services/api.js';
import { useAuth } from '../../contexts/AuthContext.js';
import { TINH_TRANG_LABEL, TRANG_THAI_LABEL } from '../../constants/labels.js';
import { TinhTrangTag, TrangThaiTag } from '../../components/StatusTag/StatusTag.jsx';
import { formatDate } from '../../utils/format.js';
import './DeviceListPage.css';

const EMPTY_FILTERS = {
  search: '',
  loaiId: undefined,
  phongBanId: undefined,
  tinhTrang: undefined,
  trangThai: undefined,
};

const labelsToOptions = (labels) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

const COLUMNS = [
  {
    title: 'Mã thiết bị',
    dataIndex: 'maThietBi',
    render: (value, row) => <Link to={`/thiet-bi/${row.id}`}>{value}</Link>,
  },
  { title: 'Tên thiết bị', dataIndex: 'tenThietBi' },
  { title: 'Loại', dataIndex: 'tenLoai' },
  {
    title: 'Hãng / Model',
    render: (_, row) => [row.hang, row.model].filter(Boolean).join(' '),
  },
  { title: 'Phòng ban', dataIndex: 'tenPhongBan' },
  {
    title: 'Tình trạng',
    dataIndex: 'tinhTrang',
    render: (value) => <TinhTrangTag value={value} />,
  },
  {
    title: 'Trạng thái',
    dataIndex: 'trangThai',
    render: (value) => <TrangThaiTag value={value} />,
  },
  { title: 'Ngày nhập', dataIndex: 'ngayNhap', render: (value) => formatDate(value) },
];

export default function DeviceListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState({ phongBan: [], loaiThietBi: [] });
  const [catalogError, setCatalogError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [result, setResult] = useState({ query: null, items: [], total: 0, error: '' });

  // Tải danh sách phòng ban và loại thiết bị cho các ô lọc (chỉ một lần)
  useEffect(() => {
    apiRequest('/api/catalog')
      .then(setCatalog)
      .catch((err) => setCatalogError(err.message));
  }, []);

  // Chuỗi truy vấn thay đổi mỗi khi người dùng đổi bộ lọc hoặc trang
  const query = useMemo(() => {
    const params = new URLSearchParams({ page, pageSize });
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters, page, pageSize]);

  useEffect(() => {
    let ignore = false;
    apiRequest(`/api/devices?${query}`)
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

  // Chưa có kết quả cho truy vấn hiện tại thì đang tải
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

  const errorMessage = result.error || catalogError;

  return (
    <section className="device-list-page">
      <div className="device-list-page__header">
        <h1 className="device-list-page__title">Danh sách thiết bị</h1>
        {user.vaiTro === 'quan_tri' && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/thiet-bi/them')}>
            Thêm thiết bị
          </Button>
        )}
      </div>

      <div className="device-list-page__toolbar">
        <Input.Search
          className="device-list-page__search"
          placeholder="Tìm theo mã, tên, hãng, model, số serial"
          allowClear
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onSearch={(value) => updateFilter('search', value.trim())}
        />
        <Select
          className="device-list-page__filter"
          placeholder="Loại thiết bị"
          allowClear
          value={filters.loaiId}
          onChange={(value) => updateFilter('loaiId', value)}
          options={catalog.loaiThietBi.map((l) => ({ value: l.id, label: l.ten }))}
        />
        <Select
          className="device-list-page__filter"
          placeholder="Phòng ban"
          allowClear
          value={filters.phongBanId}
          onChange={(value) => updateFilter('phongBanId', value)}
          options={catalog.phongBan.map((p) => ({ value: p.id, label: p.ten }))}
        />
        <Select
          className="device-list-page__filter"
          placeholder="Tình trạng"
          allowClear
          value={filters.tinhTrang}
          onChange={(value) => updateFilter('tinhTrang', value)}
          options={labelsToOptions(TINH_TRANG_LABEL)}
        />
        <Select
          className="device-list-page__filter"
          placeholder="Trạng thái"
          allowClear
          value={filters.trangThai}
          onChange={(value) => updateFilter('trangThai', value)}
          options={labelsToOptions(TRANG_THAI_LABEL)}
        />
        <Button onClick={resetFilters}>Xóa bộ lọc</Button>
      </div>

      {errorMessage && (
        <Alert className="device-list-page__alert" type="error" showIcon message={errorMessage} />
      )}

      <Table
        rowKey="id"
        columns={COLUMNS}
        dataSource={result.items}
        loading={loading}
        scroll={{ x: 'max-content' }}
        pagination={{
          current: page,
          pageSize,
          total: result.total,
          showSizeChanger: true,
          showTotal: (total) => `Tổng ${total} thiết bị`,
        }}
        onChange={(pagination) => {
          setPage(pagination.current);
          setPageSize(pagination.pageSize);
        }}
      />
    </section>
  );
}