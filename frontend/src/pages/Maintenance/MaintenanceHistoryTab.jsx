import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Input, Select, Table } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { apiRequest } from '../../services/api.js';
import { KET_QUA_LABEL, LOAI_HINH_LABEL } from '../../constants/labels.js';
import { KetQuaTag, LoaiHinhTag, TinhTrangTag } from '../../components/StatusTag/StatusTag.jsx';
import { formatDate, formatMoney } from '../../utils/format.js';

const EMPTY_FILTERS = { search: '', loaiHinh: undefined, ketQua: undefined };

const toOptions = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }));

export default function MaintenanceHistoryTab({ reloadKey, onComplete }) {
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [result, setResult] = useState({ key: null, items: [], total: 0, error: '' });

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
    apiRequest(`/api/maintenance?${query}`)
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
      title: 'Thiết bị',
      render: (_, row) => (
        <div>
          <Link to={`/thiet-bi/${row.thietBi.id}`}>{row.thietBi.maThietBi}</Link>
          <div className="maintenance-page__muted">{row.thietBi.tenThietBi}</div>
        </div>
      ),
    },
    { title: 'Loại hình', dataIndex: 'loaiHinh', render: (value) => <LoaiHinhTag value={value} /> },
    { title: 'Ngày bắt đầu', dataIndex: 'ngayBatDau', render: (value) => formatDate(value) },
    {
      title: 'Ngày hoàn tất',
      dataIndex: 'ngayHoanTat',
      render: (value) => formatDate(value) || '—',
    },
    { title: 'Chi phí', dataIndex: 'chiPhi', align: 'right', render: (value) => formatMoney(value) },
    { title: 'Kết quả', dataIndex: 'ketQua', render: (value) => <KetQuaTag value={value} /> },
    {
      title: 'Tình trạng sau xử lý',
      dataIndex: 'tinhTrangSauXuLy',
      render: (value) => (value ? <TinhTrangTag value={value} /> : '—'),
    },
    {
      title: 'Bảo dưỡng kế tiếp',
      dataIndex: 'ngayBaoDuongKeTiep',
      render: (value) => formatDate(value) || '—',
    },
    { title: 'Người ghi nhận', render: (_, row) => row.nguoiTao.hoTen },
    {
      title: 'Thao tác',
      render: (_, row) =>
        row.ketQua === 'dang_thuc_hien' ? (
          <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => onComplete(row)}>
            Hoàn tất
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <div className="maintenance-page__toolbar">
        <Input.Search
          className="maintenance-page__search"
          placeholder="Tìm theo mã hoặc tên thiết bị"
          allowClear
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onSearch={(value) => updateFilter('search', value.trim())}
        />
        <Select
          className="maintenance-page__filter"
          placeholder="Loại hình"
          allowClear
          value={filters.loaiHinh}
          onChange={(value) => updateFilter('loaiHinh', value)}
          options={toOptions(LOAI_HINH_LABEL)}
        />
        <Select
          className="maintenance-page__filter"
          placeholder="Kết quả"
          allowClear
          value={filters.ketQua}
          onChange={(value) => updateFilter('ketQua', value)}
          options={toOptions(KET_QUA_LABEL)}
        />
        <Button onClick={resetFilters}>Xóa bộ lọc</Button>
      </div>

      {result.error && (
        <Alert className="maintenance-page__alert" type="error" showIcon message={result.error} />
      )}

      <Table
        rowKey="id"
        columns={columns}
        dataSource={result.items}
        loading={loading}
        scroll={{ x: 'max-content' }}
        expandable={{
          expandedRowRender: (row) => (
            <div>
              <p className="maintenance-page__detail">
                <strong>Vấn đề phát hiện:</strong> {row.vanDe || '—'}
              </p>
              <p className="maintenance-page__detail">
                <strong>Nội dung xử lý:</strong> {row.noiDungXuLy || '—'}
              </p>
            </div>
          ),
        }}
        pagination={{
          current: page,
          pageSize,
          total: result.total,
          showSizeChanger: true,
          showTotal: (total) => `Tổng ${total} lần`,
        }}
        onChange={(pagination) => {
          setPage(pagination.current);
          setPageSize(pagination.pageSize);
        }}
      />
    </div>
  );
}