import { useEffect, useState } from 'react';
import { Alert, Button, Form, Input, Modal, Popconfirm, Table, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { apiRequest } from '../../services/api.js';
import './DepartmentListPage.css';

// Biểu mẫu thêm hoặc sửa phòng ban, hiển thị trong hộp thoại
function DepartmentForm({ editing, onCancel, onSaved }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleFinish = async (values) => {
    setSubmitting(true);
    setError('');
    try {
      await apiRequest(editing ? `/api/departments/${editing.id}` : '/api/departments', {
        method: editing ? 'PUT' : 'POST',
        body: { ten: values.ten },
      });
      message.success(editing ? 'Đã cập nhật phòng ban' : 'Đã thêm phòng ban');
      onSaved();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <Form layout="vertical" initialValues={{ ten: editing?.ten ?? '' }} onFinish={handleFinish}>
      <Form.Item
        label="Tên phòng ban"
        name="ten"
        rules={[
          { required: true, whitespace: true, message: 'Vui lòng nhập tên phòng ban' },
          { max: 100, message: 'Tối đa 100 ký tự' },
        ]}
      >
        <Input autoFocus />
      </Form.Item>

      {error && <Alert className="department-page__alert" type="error" showIcon message={error} />}

      <div className="department-page__actions">
        <Button type="primary" htmlType="submit" loading={submitting}>
          Lưu
        </Button>
        <Button onClick={onCancel}>Hủy</Button>
      </div>
    </Form>
  );
}

export default function DepartmentListPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState({ key: null, items: [], error: '' });
  const [modal, setModal] = useState({ open: false, editing: null });

  useEffect(() => {
    let ignore = false;
    apiRequest('/api/departments')
      .then((res) => {
        if (!ignore) setResult({ key: reloadKey, items: res.items, error: '' });
      })
      .catch((err) => {
        if (!ignore) setResult({ key: reloadKey, items: [], error: err.message });
      });
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  const loading = result.key !== reloadKey;
  const reload = () => setReloadKey((k) => k + 1);
  const openModal = (editing) => setModal({ open: true, editing });
  const closeModal = () => setModal({ open: false, editing: null });

  const handleDelete = async (row) => {
    try {
      await apiRequest(`/api/departments/${row.id}`, { method: 'DELETE' });
      message.success('Đã xóa phòng ban');
      reload();
    } catch (err) {
      message.error(err.message);
    }
  };

  const columns = [
    { title: 'STT', width: 70, render: (_, __, index) => index + 1 },
    { title: 'Tên phòng ban', dataIndex: 'ten' },
    { title: 'Số người dùng', dataIndex: 'soNguoiDung', align: 'right' },
    { title: 'Số thiết bị', dataIndex: 'soThietBi', align: 'right' },
    {
      title: 'Thao tác',
      width: 180,
      render: (_, row) => {
        const inUse = row.soNguoiDung + row.soThietBi > 0;
        return (
          <div className="department-page__row-actions">
            <Button size="small" icon={<EditOutlined />} onClick={() => openModal(row)}>
              Sửa
            </Button>
            <Popconfirm
              title="Xóa phòng ban này?"
              okText="Xóa"
              cancelText="Hủy"
              onConfirm={() => handleDelete(row)}
              disabled={inUse}
            >
              <span title={inUse ? 'Phòng ban đang được sử dụng nên không thể xóa' : undefined}>
                <Button size="small" danger icon={<DeleteOutlined />} disabled={inUse}>
                  Xóa
                </Button>
              </span>
            </Popconfirm>
          </div>
        );
      },
    },
  ];

  return (
    <section className="department-page">
      <div className="department-page__header">
        <h1 className="department-page__title">Danh mục phòng ban</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>
          Thêm phòng ban
        </Button>
      </div>

      {result.error && (
        <Alert className="department-page__alert" type="error" showIcon message={result.error} />
      )}

      <Table
        rowKey="id"
        columns={columns}
        dataSource={result.items}
        loading={loading}
        pagination={false}
      />

      <Modal
        title={modal.editing ? 'Sửa phòng ban' : 'Thêm phòng ban'}
        open={modal.open}
        onCancel={closeModal}
        footer={null}
      >
        {modal.open && (
          <DepartmentForm
            editing={modal.editing}
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