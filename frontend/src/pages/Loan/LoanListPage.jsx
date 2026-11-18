import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Checkbox, Input, Select, Table, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { apiRequest } from '../../services/api.js';
import { useAuth } from '../../contexts/AuthContext.js';
import { PHIEU_MUON_LABEL } from '../../constants/labels.js';
import { PhieuMuonTag } from '../../components/StatusTag/StatusTag.jsx';
import { formatDate } from '../../utils/format.js';
import './LoanListPage.css';

const EMPTY_FILTERS = { search: '', trangThai: undefined, quaHan: undefined };

const TRANG_THAI_OPTIONS = Object.entries(PHIEU_MUON_LABEL).map(([value, label]) => ({
  value,
  label,
}));

export default function LoanListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user.vaiTro === 'quan_tri';

  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [result, setResult] = useState({ query: null, items: [], total: 0, error: '' });

  const query = useMemo(() => {
    const params = new URLSearchParams({ page, pageSize });
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters, page, pageSize]);

  useEffect(() => {
    let ignore = false;
    apiRequest(`/api/loans?${query}`)
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
      title: 'Mã phiếu',
      dataIndex: 'maPhieu',
      render: (value, row) => <Link to={`/phieu-muon/${row.id}`}>{value}</Link>,
    },
    // Nhân viên chỉ thấy phiếu của mình nên không cần cột người mượn
    ...(isAdmin
      ? [
          {
            title: 'Người mượn',
            render: (_, row) => (
              <div>
                <div>{row.nguoiMuon.hoTen}</div>
                <div className="loan-list-page__muted">{row.nguoiMuon.tenPhongBan}</div>
              </div>
            ),
          },
        ]
      : []),
    { title: 'Ngày mượn', dataIndex: 'ngayMuon', render: (value) => formatDate(value) },
    {
      title: 'Hạn trả',
      dataIndex: 'hanTra',
      render: (value, row) => (
        <span>
          {formatDate(value)} {row.quaHan && <Tag color="error">Quá hạn</Tag>}
        </span>
      ),
    },
    { title: 'Ngày trả', dataIndex: 'ngayTra', render: (value) => formatDate(value) || '—' },
    { title: 'Số thiết bị', dataIndex: 'soThietBi', align: 'right' },
    {
      title: 'Trạng thái',
      dataIndex: 'trangThai',
      render: (value) => <PhieuMuonTag value={value} />,
    },
    { title: 'Người duyệt', render: (_, row) => row.nguoiDuyet?.hoTen ?? '—' },
  ];

  return (
    <section className="loan-list-page">
      <div className="loan-list-page__header">
        <h1 className="loan-list-page__title">
          {isAdmin ? 'Phiếu mượn – trả' : 'Phiếu mượn của tôi'}
        </h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/phieu-muon/them')}>
          Lập phiếu mượn
        </Button>
      </div>

      <div className="loan-list-page__toolbar">
        <Input.Search
          className="loan-list-page__search"
          placeholder={isAdmin ? 'Tìm theo mã phiếu hoặc người mượn' : 'Tìm theo mã phiếu'}
          allowClear
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onSearch={(value) => updateFilter('search', value.trim())}
        />
        <Select
          className="loan-list-page__filter"
          placeholder="Trạng thái"
          allowClear
          value={filters.trangThai}
          onChange={(value) => updateFilter('trangThai', value)}
          options={TRANG_THAI_OPTIONS}
        />
        <Checkbox
          checked={Boolean(filters.quaHan)}
          onChange={(e) => updateFilter('quaHan', e.target.checked ? '1' : undefined)}
        >
          Chỉ phiếu quá hạn
        </Checkbox>
        <Button onClick={resetFilters}>Xóa bộ lọc</Button>
      </div>

      {result.error && (
        <Alert className="loan-list-page__alert" type="error" showIcon message={result.error} />
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
          showTotal: (total) => `Tổng ${total} phiếu`,
        }}
        onChange={(pagination) => {
          setPage(pagination.current);
          setPageSize(pagination.pageSize);
        }}
      />
    </section>
  );
}