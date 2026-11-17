import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Input, Modal, Popconfirm, Select, Table, Tag, message } from 'antd';
import {
  EditOutlined,
  KeyOutlined,
  LockOutlined,
  PlusOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { apiRequest } from '../../services/api.js';
import { useAuth } from '../../contexts/AuthContext.js';
import { VAI_TRO_LABEL } from '../../constants/labels.js';
import { formatDate } from '../../utils/format.js';
import './UserListPage.css';

const EMPTY_FILTERS = {
  search: '',
  vaiTro: undefined,
  phongBanId: undefined,
  hoatDong: undefined,
};

const VAI_TRO_OPTIONS = Object.entries(VAI_TRO_LABEL).map(([value, label]) => ({ value, label }));
const HOAT_DONG_OPTIONS = [
  { value: '1', label: 'Đang hoạt động' },
  { value: '0', label: 'Đã khóa' },
];

// Kiểm tra ô "Xác nhận mật khẩu" khớp với ô "Mật khẩu"
const confirmRule = ({ getFieldValue }) => ({
  validator(_, value) {
    if (!value || getFieldValue('matKhau') === value) return Promise.resolve();
    return Promise.reject(new Error('Mật khẩu xác nhận không khớp'));
  },
});

// Biểu mẫu thêm hoặc sửa người dùng, hiển thị trong hộp thoại
function UserForm({ editing, isSelf, catalog, onCancel, onSaved }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleFinish = async (values) => {
    setSubmitting(true);
    setError('');
    const body = {
      hoTen: values.hoTen,
      tenDangNhap: values.tenDangNhap,
      vaiTro: values.vaiTro,
      phongBanId: values.phongBanId,
    };
    if (!editing) body.matKhau = values.matKhau;

    try {
      await apiRequest(editing ? `/api/users/${editing.id}` : '/api/users', {
        method: editing ? 'PUT' : 'POST',
        body,
      });
      message.success(editing ? 'Đã cập nhật người dùng' : 'Đã thêm người dùng');
      onSaved();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <Form
      layout="vertical"
      initialValues={
        editing
          ? {
              hoTen: editing.hoTen,
              tenDangNhap: editing.tenDangNhap,
              vaiTro: editing.vaiTro,
              phongBanId: editing.phongBanId,
            }
          : { vaiTro: 'nhan_vien' }
      }
      onFinish={handleFinish}
    >
      <Form.Item
        label="Họ tên"
        name="hoTen"
        rules={[
          { required: true, whitespace: true, message: 'Vui lòng nhập họ tên' },
          { max: 100, message: 'Tối đa 100 ký tự' },
        ]}
      >
        <Input autoFocus />
      </Form.Item>

      <Form.Item
        label="Tên đăng nhập"
        name="tenDangNhap"
        rules={[
          { required: true, message: 'Vui lòng nhập tên đăng nhập' },
          {
            pattern: /^[A-Za-z0-9._]{3,50}$/,
            message: '3 đến 50 ký tự: chữ cái không dấu, chữ số, dấu chấm hoặc gạch dưới',
          },
        ]}
      >
        <Input autoComplete="off" />
      </Form.Item>

      {!editing && (
        <>
          <Form.Item
            label="Mật khẩu"
            name="matKhau"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu' },
              { min: 6, message: 'Mật khẩu cần có ít nhất 6 ký tự' },
              { max: 72, message: 'Mật khẩu tối đa 72 ký tự' },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            label="Xác nhận mật khẩu"
            name="xacNhan"
            dependencies={['matKhau']}
            rules={[{ required: true, message: 'Vui lòng nhập lại mật khẩu' }, confirmRule]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </>
      )}

      <Form.Item
        label="Vai trò"
        name="vaiTro"
        rules={[{ required: true, message: 'Vui lòng chọn vai trò' }]}
        extra={isSelf ? 'Không thể tự đổi vai trò của chính mình.' : undefined}
      >
        <Select options={VAI_TRO_OPTIONS} disabled={isSelf} />
      </Form.Item>

      <Form.Item
        label="Phòng ban"
        name="phongBanId"
        rules={[{ required: true, message: 'Vui lòng chọn phòng ban' }]}
      >
        <Select
          placeholder="Chọn phòng ban"
          options={catalog.phongBan.map((p) => ({ value: p.id, label: p.ten }))}
        />
      </Form.Item>

      {error && <Alert className="user-page__alert" type="error" showIcon message={error} />}

      <div className="user-page__actions">
        <Button type="primary" htmlType="submit" loading={submitting}>
          Lưu
        </Button>
        <Button onClick={onCancel}>Hủy</Button>
      </div>
    </Form>
  );
}

// Biểu mẫu đặt lại mật khẩu cho một người dùng
function ResetPasswordForm({ user, onCancel, onSaved }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleFinish = async (values) => {
    setSubmitting(true);
    setError('');
    try {
      await apiRequest(`/api/users/${user.id}/reset-password`, {
        method: 'POST',
        body: { matKhau: values.matKhau },
      });
      message.success(`Đã đặt lại mật khẩu cho ${user.tenDangNhap}`);
      onSaved();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <Form layout="vertical" onFinish={handleFinish}>
      <p className="user-page__note">
        Đặt mật khẩu mới cho <strong>{user.hoTen}</strong> ({user.tenDangNhap}). Hãy báo mật khẩu mới
        cho người đó.
      </p>
      <Form.Item
        label="Mật khẩu mới"
        name="matKhau"
        rules={[
          { required: true, message: 'Vui lòng nhập mật khẩu mới' },
          { min: 6, message: 'Mật khẩu cần có ít nhất 6 ký tự' },
          { max: 72, message: 'Mật khẩu tối đa 72 ký tự' },
        ]}
      >
        <Input.Password autoFocus autoComplete="new-password" />
      </Form.Item>
      <Form.Item
        label="Xác nhận mật khẩu mới"
        name="xacNhan"
        dependencies={['matKhau']}
        rules={[{ required: true, message: 'Vui lòng nhập lại mật khẩu' }, confirmRule]}
      >
        <Input.Password autoComplete="new-password" />
      </Form.Item>

      {error && <Alert className="user-page__alert" type="error" showIcon message={error} />}

      <div className="user-page__actions">
        <Button type="primary" htmlType="submit" loading={submitting}>
          Đặt lại mật khẩu
        </Button>
        <Button onClick={onCancel}>Hủy</Button>
      </div>
    </Form>
  );
}

export default function UserListPage() {
  const { user: me } = useAuth();
  const [catalog, setCatalog] = useState({ phongBan: [], loaiThietBi: [] });
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState({ key: null, items: [], total: 0, error: '' });
  const [modal, setModal] = useState({ type: null, user: null });

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

  const requestKey = `${query}|${reloadKey}`;

  useEffect(() => {
    let ignore = false;
    apiRequest(`/api/users?${query}`)
      .then((res) => {
        if (!ignore) {
          setResult({ key: requestKey, items: res.items, total: res.total, error: '' });
        }
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
  const closeModal = () => setModal({ type: null, user: null });

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const resetFilters = () => {
    setSearchText('');
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const handleToggleActive = async (row) => {
    try {
      await apiRequest(`/api/users/${row.id}/active`, {
        method: 'PATCH',
        body: { hoatDong: !row.hoatDong },
      });
      message.success(row.hoatDong ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản');
      reload();
    } catch (err) {
      message.error(err.message);
    }
  };

  const columns = [
    { title: 'Họ tên', dataIndex: 'hoTen' },
    { title: 'Tên đăng nhập', dataIndex: 'tenDangNhap' },
    {
      title: 'Vai trò',
      dataIndex: 'vaiTro',
      render: (value) => (
        <Tag color={value === 'quan_tri' ? 'blue' : 'default'}>{VAI_TRO_LABEL[value]}</Tag>
      ),
    },
    { title: 'Phòng ban', dataIndex: 'tenPhongBan' },
    {
      title: 'Trạng thái',
      dataIndex: 'hoatDong',
      render: (value) =>
        value ? <Tag color="success">Đang hoạt động</Tag> : <Tag color="error">Đã khóa</Tag>,
    },
    { title: 'Ngày tạo', dataIndex: 'ngayTao', render: (value) => formatDate(value) },
    {
      title: 'Thao tác',
      width: 330,
      render: (_, row) => {
        const isSelf = row.id === me.id;
        return (
          <div className="user-page__row-actions">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => setModal({ type: 'form', user: row })}
            >
              Sửa
            </Button>
            <Button
              size="small"
              icon={<KeyOutlined />}
              onClick={() => setModal({ type: 'password', user: row })}
            >
              Đặt lại mật khẩu
            </Button>
            <Popconfirm
              title={row.hoatDong ? 'Khóa tài khoản này?' : 'Mở khóa tài khoản này?'}
              description={
                row.hoatDong ? 'Người này sẽ không đăng nhập được nữa cho đến khi được mở khóa.' : undefined
              }
              okText={row.hoatDong ? 'Khóa' : 'Mở khóa'}
              cancelText="Hủy"
              onConfirm={() => handleToggleActive(row)}
              disabled={isSelf && row.hoatDong}
            >
              <span title={isSelf && row.hoatDong ? 'Không thể tự khóa tài khoản của chính mình' : undefined}>
                <Button
                  size="small"
                  danger={row.hoatDong}
                  icon={row.hoatDong ? <LockOutlined /> : <UnlockOutlined />}
                  disabled={isSelf && row.hoatDong}
                >
                  {row.hoatDong ? 'Khóa' : 'Mở khóa'}
                </Button>
              </span>
            </Popconfirm>
          </div>
        );
      },
    },
  ];

  return (
    <section className="user-page">
      <div className="user-page__header">
        <h1 className="user-page__title">Quản lý người dùng</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModal({ type: 'form', user: null })}
        >
          Thêm người dùng
        </Button>
      </div>

      <div className="user-page__toolbar">
        <Input.Search
          className="user-page__search"
          placeholder="Tìm theo họ tên hoặc tên đăng nhập"
          allowClear
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onSearch={(value) => updateFilter('search', value.trim())}
        />
        <Select
          className="user-page__filter"
          placeholder="Vai trò"
          allowClear
          value={filters.vaiTro}
          onChange={(value) => updateFilter('vaiTro', value)}
          options={VAI_TRO_OPTIONS}
        />
        <Select
          className="user-page__filter"
          placeholder="Phòng ban"
          allowClear
          value={filters.phongBanId}
          onChange={(value) => updateFilter('phongBanId', value)}
          options={catalog.phongBan.map((p) => ({ value: p.id, label: p.ten }))}
        />
        <Select
          className="user-page__filter"
          placeholder="Trạng thái"
          allowClear
          value={filters.hoatDong}
          onChange={(value) => updateFilter('hoatDong', value)}
          options={HOAT_DONG_OPTIONS}
        />
        <Button onClick={resetFilters}>Xóa bộ lọc</Button>
      </div>

      {result.error && (
        <Alert className="user-page__alert" type="error" showIcon message={result.error} />
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
          showTotal: (total) => `Tổng ${total} người dùng`,
        }}
        onChange={(pagination) => {
          setPage(pagination.current);
          setPageSize(pagination.pageSize);
        }}
      />

      <Modal
        title={modal.user ? 'Sửa người dùng' : 'Thêm người dùng'}
        open={modal.type === 'form'}
        onCancel={closeModal}
        footer={null}
      >
        {modal.type === 'form' && (
          <UserForm
            editing={modal.user}
            isSelf={Boolean(modal.user) && modal.user.id === me.id}
            catalog={catalog}
            onCancel={closeModal}
            onSaved={() => {
              closeModal();
              reload();
            }}
          />
        )}
      </Modal>

      <Modal
        title="Đặt lại mật khẩu"
        open={modal.type === 'password'}
        onCancel={closeModal}
        footer={null}
      >
        {modal.type === 'password' && (
          <ResetPasswordForm
            user={modal.user}
            onCancel={closeModal}
            onSaved={() => {
              closeModal();
              reload();
            }}
          />
        )}
      </Modal>
    </section>
  );
}