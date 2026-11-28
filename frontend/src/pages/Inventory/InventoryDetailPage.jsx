import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Descriptions,
  Input,
  Modal,
  Popconfirm,
  Select,
  Spin,
  Table,
  Tag,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  EditOutlined,
  FlagOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { apiRequest } from '../../services/api.js';
import {
  KET_QUA_KIEM_KE_COLOR,
  KET_QUA_KIEM_KE_LABEL,
  TINH_TRANG_LABEL,
  TRANG_THAI_DOT_COLOR,
  TRANG_THAI_DOT_LABEL,
} from '../../constants/labels.js';
import { TinhTrangTag, TrangThaiTag } from '../../components/StatusTag/StatusTag.jsx';
import { formatDate } from '../../utils/format.js';
import { CompleteInventoryForm, ExtraForm, RecordForm } from './InventoryForms.jsx';
import './InventoryPage.css';

const EMPTY_FILTERS = { search: '', ketQua: undefined };

const KET_QUA_OPTIONS = [
  { value: 'chua_kiem', label: 'Chưa kiểm' },
  ...Object.entries(KET_QUA_KIEM_KE_LABEL).map(([value, label]) => ({ value, label })),
];

export default function InventoryDetailPage() {
  const { id } = useParams();
  const [reloadKey, setReloadKey] = useState(0);
  const [catalog, setCatalog] = useState({ phongBan: [], loaiThietBi: [] });
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dotResult, setDotResult] = useState({ key: null, dot: null, error: '' });
  const [itemsResult, setItemsResult] = useState({ key: null, items: [], total: 0, error: '' });
  const [modal, setModal] = useState({ type: null, data: null });

  const closeModal = () => setModal({ type: null, data: null });
  const reload = () => setReloadKey((k) => k + 1);

  // Danh sách phòng ban cho các biểu mẫu (chỉ một lần)
  useEffect(() => {
    apiRequest('/api/catalog')
      .then(setCatalog)
      .catch(() => {});
  }, []);

  // Thông tin đợt kiểm kê và số liệu tổng kết
  const dotKey = `${id}|${reloadKey}`;
  useEffect(() => {
    let ignore = false;
    apiRequest(`/api/inventories/${id}`)
      .then((res) => {
        if (!ignore) setDotResult({ key: dotKey, dot: res.dot, error: '' });
      })
      .catch((err) => {
        if (!ignore) setDotResult({ key: dotKey, dot: null, error: err.message });
      });
    return () => {
      ignore = true;
    };
  }, [id, dotKey]);

  // Danh sách thiết bị trong đợt
  const query = useMemo(() => {
    const params = new URLSearchParams({ page, pageSize });
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters, page, pageSize]);

  const itemsKey = `${id}|${query}|${reloadKey}`;
  useEffect(() => {
    let ignore = false;
    apiRequest(`/api/inventories/${id}/items?${query}`)
      .then((res) => {
        if (!ignore) setItemsResult({ key: itemsKey, items: res.items, total: res.total, error: '' });
      })
      .catch((err) => {
        if (!ignore) setItemsResult({ key: itemsKey, items: [], total: 0, error: err.message });
      });
    return () => {
      ignore = true;
    };
  }, [id, query, itemsKey]);

  const dotLoading = dotResult.key !== dotKey;
  const itemsLoading = itemsResult.key !== itemsKey;
  const { dot, error } = dotResult;
  const isOpen = dot?.trangThai === 'dang_kiem_ke';

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const resetFilters = () => {
    setSearchText('');
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  // Ghi nhanh một thiết bị là Đúng
  const handleQuickCorrect = async (item) => {
    try {
      await apiRequest(`/api/inventories/${id}/items/${item.id}`, {
        method: 'PUT',
        body: { ketQua: 'dung' },
      });
      reload();
    } catch (err) {
      message.error(err.message);
    }
  };

  const handleMarkAll = async () => {
    try {
      const res = await apiRequest(`/api/inventories/${id}/mark-all-correct`, { method: 'POST' });
      message.success(`Đã đánh dấu Đúng cho ${res.soThietBi} thiết bị`);
      reload();
    } catch (err) {
      message.error(err.message);
    }
  };

  const handleDeleteExtra = async (item) => {
    try {
      await apiRequest(`/api/inventories/${id}/items/${item.id}`, { method: 'DELETE' });
      message.success('Đã xóa dòng thiết bị thừa');
      reload();
    } catch (err) {
      message.error(err.message);
    }
  };

  const columns = [
    {
      title: 'Thiết bị',
      render: (_, row) =>
        row.thietBi ? (
          <div>
            <Link to={`/thiet-bi/${row.thietBi.id}`}>{row.thietBi.maThietBi}</Link>
            <div className="inventory-page__muted">{row.thietBi.tenThietBi}</div>
          </div>
        ) : (
          <div>
            <Tag color="purple">Thiết bị thừa</Tag>
            <div className="inventory-page__muted">{row.moTaThietBiThua}</div>
          </div>
        ),
    },
    {
      title: 'Phòng ban (hệ thống)',
      render: (_, row) => row.phongBanHeThong?.ten ?? '—',
    },
    {
      title: 'Tình trạng (hệ thống)',
      render: (_, row) => (row.tinhTrangHeThong ? <TinhTrangTag value={row.tinhTrangHeThong} /> : '—'),
    },
    {
      title: 'Trạng thái hiện tại',
      render: (_, row) => (row.thietBi ? <TrangThaiTag value={row.thietBi.trangThai} /> : '—'),
    },
    {
      title: 'Kết quả',
      render: (_, row) =>
        row.ketQua ? (
          <Tag color={KET_QUA_KIEM_KE_COLOR[row.ketQua]}>{KET_QUA_KIEM_KE_LABEL[row.ketQua]}</Tag>
        ) : (
          <Tag>Chưa kiểm</Tag>
        ),
    },
    {
      title: 'Thực tế',
      render: (_, row) => {
        if (row.ketQua === 'sai_vi_tri') return `Đặt tại ${row.phongBanThucTe?.ten}`;
        if (row.ketQua === 'sai_tinh_trang') return `Tình trạng ${TINH_TRANG_LABEL[row.tinhTrangThucTe]}`;
        if (row.ketQua === 'thua') return `Đặt tại ${row.phongBanThucTe?.ten}`;
        return '—';
      },
    },
    { title: 'Ghi chú', dataIndex: 'ghiChu', render: (value) => value || '—' },
  ];

  if (isOpen) {
    columns.push({
      title: 'Thao tác',
      render: (_, row) =>
        row.thietBi ? (
          <div className="inventory-page__row-actions">
            <Button size="small" icon={<CheckOutlined />} onClick={() => handleQuickCorrect(row)}>
              Đúng
            </Button>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => setModal({ type: 'record', data: row })}
            >
              Ghi kết quả
            </Button>
          </div>
        ) : (
          <Popconfirm
            title="Xóa dòng thiết bị thừa này?"
            okText="Xóa"
            cancelText="Hủy"
            onConfirm={() => handleDeleteExtra(row)}
          >
            <Button size="small" danger>
              Xóa
            </Button>
          </Popconfirm>
        ),
    });
  }

  const stats = dot
    ? [
        { key: 'tong', label: 'Thiết bị cần kiểm', value: dot.soThietBi },
        { key: 'da', label: 'Đã kiểm', value: dot.soDaKiem },
        { key: 'chua', label: 'Chưa kiểm', value: dot.tongKet.chuaKiem },
        { key: 'dung', label: 'Đúng', value: dot.tongKet.dung },
        { key: 'thieu', label: 'Thiếu', value: dot.tongKet.thieu },
        { key: 'thua', label: 'Thừa', value: dot.tongKet.thua },
        { key: 'vitri', label: 'Sai vị trí', value: dot.tongKet.saiViTri },
        { key: 'tinhtrang', label: 'Sai tình trạng', value: dot.tongKet.saiTinhTrang },
      ]
    : [];

  return (
    <section className="inventory-page">
      <div className="inventory-page__topbar">
        <Link to="/kiem-ke">
          <ArrowLeftOutlined /> Quay lại danh sách
        </Link>

        {isOpen && (
          <div className="inventory-page__row-actions">
            <Popconfirm
              title="Đánh dấu Đúng cho các thiết bị còn lại?"
              description="Chỉ áp dụng cho thiết bị trong danh sách mà chưa được kiểm."
              okText="Đánh dấu"
              cancelText="Hủy"
              onConfirm={handleMarkAll}
            >
              <Button icon={<CheckCircleOutlined />}>Đánh dấu các thiết bị còn lại là Đúng</Button>
            </Popconfirm>
            <Button icon={<PlusOutlined />} onClick={() => setModal({ type: 'extra', data: null })}>
              Thêm thiết bị thừa
            </Button>
            <Button
              type="primary"
              icon={<FlagOutlined />}
              onClick={() => setModal({ type: 'complete', data: null })}
            >
              Hoàn tất đợt kiểm kê
            </Button>
          </div>
        )}
      </div>

      {dotLoading && (
        <div className="inventory-page__loading">
          <Spin size="large" />
        </div>
      )}

      {!dotLoading && error && (
        <Alert className="inventory-page__alert" type="error" showIcon message={error} />
      )}

      {!dotLoading && dot && (
        <>
          <div className="inventory-page__card">
            <h1 className="inventory-page__title">
              {dot.maDot} – {dot.tenDot}
            </h1>
            <Descriptions
              bordered
              size="small"
              column={{ xs: 1, md: 2 }}
              items={[
                { key: 'pv', label: 'Phạm vi', children: dot.phongBan?.ten ?? 'Toàn công ty' },
                { key: 'ngay', label: 'Ngày kiểm kê', children: formatDate(dot.ngayKiemKe) },
                { key: 'nguoi', label: 'Người thực hiện', children: dot.nguoiThucHien.hoTen },
                {
                  key: 'tt',
                  label: 'Trạng thái',
                  children: (
                    <Tag color={TRANG_THAI_DOT_COLOR[dot.trangThai]}>
                      {TRANG_THAI_DOT_LABEL[dot.trangThai]}
                    </Tag>
                  ),
                },
              ]}
            />

            <div className="inventory-page__stats">
              {stats.map((s) => (
                <div key={s.key} className="inventory-page__stat">
                  <div className="inventory-page__stat-value">{s.value}</div>
                  <div className="inventory-page__stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {dot.trangThai === 'hoan_tat' && (
            <div className="inventory-page__card">
              <h2 className="inventory-page__subtitle">Biên bản kiểm kê</h2>
              <p className="inventory-page__detail">
                <strong>Kết luận:</strong> {dot.bienBan || 'Không có kết luận.'}
              </p>
              <ul className="inventory-page__summary">
                <li>Thiếu {dot.tongKet.thieu} thiết bị: các thiết bị này đã được đánh dấu Thất lạc.</li>
                <li>Sai vị trí {dot.tongKet.saiViTri} thiết bị: đã cập nhật phòng ban đang đặt.</li>
                <li>Sai tình trạng {dot.tongKet.saiTinhTrang} thiết bị: đã cập nhật tình trạng.</li>
                <li>
                  Thừa {dot.tongKet.thua} thiết bị: cần tạo hồ sơ thiết bị mới ở trang Thiết bị.
                </li>
              </ul>
            </div>
          )}

          <div className="inventory-page__card">
            <h2 className="inventory-page__subtitle">Danh sách thiết bị trong đợt</h2>

            <div className="inventory-page__toolbar">
              <Input.Search
                className="inventory-page__search"
                placeholder="Tìm theo mã, tên hoặc mô tả thiết bị"
                allowClear
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onSearch={(value) => updateFilter('search', value.trim())}
              />
              <Select
                className="inventory-page__filter"
                placeholder="Kết quả"
                allowClear
                value={filters.ketQua}
                onChange={(value) => updateFilter('ketQua', value)}
                options={KET_QUA_OPTIONS}
              />
              <Button onClick={resetFilters}>Xóa bộ lọc</Button>
            </div>

            {itemsResult.error && (
              <Alert className="inventory-page__alert" type="error" showIcon message={itemsResult.error} />
            )}

            <Table
              rowKey="id"
              columns={columns}
              dataSource={itemsResult.items}
              loading={itemsLoading}
              scroll={{ x: 'max-content' }}
              pagination={{
                current: page,
                pageSize,
                total: itemsResult.total,
                showSizeChanger: true,
                showTotal: (total) => `Tổng ${total} dòng`,
              }}
              onChange={(pagination) => {
                setPage(pagination.current);
                setPageSize(pagination.pageSize);
              }}
            />
          </div>

          <Modal
            title={modal.type === 'record' ? `Ghi kết quả ${modal.data.thietBi.maThietBi}` : ''}
            open={modal.type === 'record'}
            onCancel={closeModal}
            footer={null}
          >
            {modal.type === 'record' && (
              <RecordForm
                dotId={id}
                item={modal.data}
                phongBan={catalog.phongBan}
                onCancel={closeModal}
                onSaved={() => {
                  closeModal();
                  reload();
                }}
              />
            )}
          </Modal>

          <Modal
            title="Ghi nhận thiết bị thừa"
            open={modal.type === 'extra'}
            onCancel={closeModal}
            footer={null}
          >
            {modal.type === 'extra' && (
              <ExtraForm
                dotId={id}
                phongBan={catalog.phongBan}
                onCancel={closeModal}
                onSaved={() => {
                  closeModal();
                  reload();
                }}
              />
            )}
          </Modal>

          <Modal
            title="Hoàn tất đợt kiểm kê"
            open={modal.type === 'complete'}
            onCancel={closeModal}
            footer={null}
          >
            {modal.type === 'complete' && (
              <CompleteInventoryForm
                dot={dot}
                onCancel={closeModal}
                onSaved={() => {
                  closeModal();
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