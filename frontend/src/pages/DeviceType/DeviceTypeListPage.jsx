import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Table,
  Tag,
  message,
} from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { apiRequest } from '../../services/api.js';
import './DeviceTypeListPage.css';

// Biểu mẫu thêm hoặc sửa loại thiết bị, hiển thị trong hộp thoại
function DeviceTypeForm({ editing, onCancel, onSaved }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Loại đã có thiết bị thì không đổi được ký hiệu (mã thiết bị đã sinh ra từ ký hiệu)
  const hasDevices = Boolean(editing && editing.soThietBi > 0);

  const initialValues = editing
    ? {
        ten: editing.ten,
        kyHieu: editing.kyHieu,
        chuKyBaoDuongThang: editing.chuKyBaoDuongThang ?? undefined,
        thongSo: editing.thongSo.map((s) => ({ id: s.id, ten: s.ten, soGiaTri: s.soGiaTri })),
      }
    : { thongSo: [] };

  const handleFinish = async (values) => {
    setSubmitting(true);
    setError('');
    try {
      await apiRequest(editing ? `/api/device-types/${editing.id}` : '/api/device-types', {
        method: editing ? 'PUT' : 'POST',
        body: {
          ten: values.ten,
          kyHieu: values.kyHieu,
          chuKyBaoDuongThang: values.chuKyBaoDuongThang ?? null,
          thongSo: (values.thongSo ?? []).map((s) => ({ id: s.id, ten: s.ten })),
        },
      });
      message.success(editing ? 'Đã cập nhật loại thiết bị' : 'Đã thêm loại thiết bị');
      onSaved();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <Form form={form} layout="vertical" initialValues={initialValues} onFinish={handleFinish}>
      <Form.Item
        label="Tên loại thiết bị"
        name="ten"
        rules={[
          { required: true, whitespace: true, message: 'Vui lòng nhập tên loại thiết bị' },
          { max: 100, message: 'Tối đa 100 ký tự' },
        ]}
      >
        <Input autoFocus />
      </Form.Item>

      <div className="device-type-page__row">
        <Form.Item
          className="device-type-page__col"
          label="Ký hiệu (dùng để sinh mã thiết bị)"
          name="kyHieu"
          normalize={(value) => (value ? value.toUpperCase() : value)}
          rules={[
            { required: true, message: 'Vui lòng nhập ký hiệu' },
            { pattern: /^[A-Za-z0-9]{2,10}$/, message: '2 đến 10 chữ cái hoặc chữ số, không dấu' },
          ]}
          extra={
            hasDevices
              ? 'Loại này đã có thiết bị nên không đổi được ký hiệu.'
              : 'Ví dụ: LT thì mã thiết bị sẽ là LT-2026-001.'
          }
        >
          <Input disabled={hasDevices} maxLength={10} />
        </Form.Item>

        <Form.Item
          className="device-type-page__col"
          label="Chu kỳ bảo dưỡng mặc định (tháng)"
          name="chuKyBaoDuongThang"
          extra="Để trống nếu loại này không bảo dưỡng định kỳ."
        >
          <InputNumber className="device-type-page__number" min={1} max={120} precision={0} />
        </Form.Item>
      </div>

      <h3 className="device-type-page__subtitle">Thông số kỹ thuật của loại này</h3>
      <Form.List name="thongSo">
        {(fields, { add, remove, move }) => (
          <>
            {fields.map(({ key, name, ...restField }, index) => {
              const used = Number(form.getFieldValue(['thongSo', name, 'soGiaTri']) ?? 0) > 0;
              return (
                <div key={key} className="device-type-page__spec-row">
                  <Form.Item name={[name, 'id']} hidden>
                    <Input />
                  </Form.Item>
                  <Form.Item name={[name, 'soGiaTri']} hidden>
                    <Input />
                  </Form.Item>
                  <Form.Item
                    {...restField}
                    name={[name, 'ten']}
                    className="device-type-page__spec-input"
                    rules={[
                      { required: true, whitespace: true, message: 'Nhập tên thông số' },
                      { max: 100, message: 'Tối đa 100 ký tự' },
                    ]}
                  >
                    <Input placeholder="Tên thông số, ví dụ: RAM" />
                  </Form.Item>
                  <Button
                    icon={<ArrowUpOutlined />}
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  />
                  <Button
                    icon={<ArrowDownOutlined />}
                    disabled={index === fields.length - 1}
                    onClick={() => move(index, index + 1)}
                  />
                  <span
                    title={used ? 'Thông số đã có dữ liệu thiết bị nên không thể xóa' : 'Xóa thông số'}
                  >
                    <Button danger icon={<DeleteOutlined />} disabled={used} onClick={() => remove(name)} />
                  </span>
                </div>
              );
            })}
            <Button type="dashed" icon={<PlusOutlined />} block onClick={() => add({ ten: '' })}>
              Thêm thông số
            </Button>
          </>
        )}
      </Form.List>

      {error && <Alert className="device-type-page__alert" type="error" showIcon message={error} />}

      <div className="device-type-page__actions">
        <Button type="primary" htmlType="submit" loading={submitting}>
          Lưu
        </Button>
        <Button onClick={onCancel}>Hủy</Button>
      </div>
    </Form>
  );
}

export default function DeviceTypeListPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState({ key: null, items: [], error: '' });
  const [modal, setModal] = useState({ open: false, editing: null });

  useEffect(() => {
    let ignore = false;
    apiRequest('/api/device-types')
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
      await apiRequest(`/api/device-types/${row.id}`, { method: 'DELETE' });
      message.success('Đã xóa loại thiết bị');
      reload();
    } catch (err) {
      message.error(err.message);
    }
  };

  const columns = [
    { title: 'Tên loại thiết bị', dataIndex: 'ten' },
    { title: 'Ký hiệu', dataIndex: 'kyHieu', render: (value) => <Tag>{value}</Tag> },
    {
      title: 'Chu kỳ bảo dưỡng',
      dataIndex: 'chuKyBaoDuongThang',
      render: (value) => (value ? `${value} tháng` : '—'),
    },
    { title: 'Số thông số', align: 'right', render: (_, row) => row.thongSo.length },
    { title: 'Số thiết bị', dataIndex: 'soThietBi', align: 'right' },
    {
      title: 'Thao tác',
      width: 180,
      render: (_, row) => {
        const inUse = row.soThietBi > 0;
        return (
          <div className="device-type-page__row-actions">
            <Button size="small" icon={<EditOutlined />} onClick={() => openModal(row)}>
              Sửa
            </Button>
            <Popconfirm
              title="Xóa loại thiết bị này?"
              description="Các thông số kỹ thuật của loại cũng bị xóa."
              okText="Xóa"
              cancelText="Hủy"
              onConfirm={() => handleDelete(row)}
              disabled={inUse}
            >
              <span title={inUse ? 'Loại này đã có thiết bị nên không thể xóa' : undefined}>
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
    <section className="device-type-page">
      <div className="device-type-page__header">
        <h1 className="device-type-page__title">Danh mục loại thiết bị</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>
          Thêm loại thiết bị
        </Button>
      </div>

      {result.error && (
        <Alert className="device-type-page__alert" type="error" showIcon message={result.error} />
      )}

      <Table
        rowKey="id"
        columns={columns}
        dataSource={result.items}
        loading={loading}
        pagination={false}
        expandable={{
          expandedRowRender: (row) =>
            row.thongSo.length ? (
              <div className="device-type-page__tags">
                {row.thongSo.map((s) => (
                  <Tag key={s.id}>{s.ten}</Tag>
                ))}
              </div>
            ) : (
              <span className="device-type-page__empty">Chưa khai báo thông số kỹ thuật.</span>
            ),
        }}
      />

      <Modal
        title={modal.editing ? 'Sửa loại thiết bị' : 'Thêm loại thiết bị'}
        open={modal.open}
        onCancel={closeModal}
        footer={null}
        width={640}
      >
        {modal.open && (
          <DeviceTypeForm
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