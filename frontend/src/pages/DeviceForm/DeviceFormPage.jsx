import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, DatePicker, Form, Input, Select, Spin, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { apiRequest } from '../../services/api.js';
import { TINH_TRANG_LABEL, TRANG_THAI_LABEL } from '../../constants/labels.js';
import { formatDate } from '../../utils/format.js';
import './DeviceFormPage.css';

const toOption = (value) => ({ value, label: TINH_TRANG_LABEL[value] });
const TINH_TRANG_NHAP_OPTIONS = ['moi', 'tot', 'cu'].map(toOption);

// Biểu mẫu dùng chung cho thêm mới (/thiet-bi/them) và chỉnh sửa (/thiet-bi/:id/sua)
function DeviceFormBody({ id, catalog, device }) {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const isEdit = Boolean(id);

  // Thông số kỹ thuật hiển thị theo loại thiết bị đang chọn
  const selectedLoaiId = Form.useWatch('loaiId', form);
  const currentLoai = catalog.loaiThietBi.find(
    (l) => l.id === (isEdit ? device.loaiId : selectedLoaiId)
  );
  const thongSoDefs = currentLoai ? currentLoai.thongSo : [];

  // Thiết bị đang Hỏng vẫn phải hiển thị được nhãn "Hỏng" trong ô tình trạng
  const tinhTrangOptions =
    device?.tinhTrang === 'hong'
      ? [...TINH_TRANG_NHAP_OPTIONS, toOption('hong')]
      : TINH_TRANG_NHAP_OPTIONS;

  const initialValues = isEdit
    ? {
        tenThietBi: device.tenThietBi,
        hang: device.hang ?? '',
        model: device.model ?? '',
        soSerial: device.soSerial ?? '',
        tinhTrang: device.tinhTrang,
        ghiChu: device.ghiChu ?? '',
        thongSo: Object.fromEntries(device.thongSo.map((s) => [String(s.id), s.giaTri])),
      }
    : { tinhTrang: 'moi' };

  const handleFinish = async (values) => {
    setSubmitting(true);
    setError('');

    const body = {
      tenThietBi: values.tenThietBi,
      hang: values.hang,
      model: values.model,
      soSerial: values.soSerial,
      tinhTrang: values.tinhTrang,
      ghiChu: values.ghiChu,
      thongSo: thongSoDefs.map((s) => ({
        thongSoId: s.id,
        giaTri: values.thongSo?.[String(s.id)] ?? '',
      })),
    };
    if (!isEdit) {
      body.loaiId = values.loaiId;
      body.phongBanId = values.phongBanId;
      body.ngayNhap = values.ngayNhap.format('YYYY-MM-DD');
    }

    try {
      const res = await apiRequest(isEdit ? `/api/devices/${id}` : '/api/devices', {
        method: isEdit ? 'PUT' : 'POST',
        body,
      });
      message.success(isEdit ? 'Đã cập nhật thiết bị' : `Đã thêm thiết bị ${res.maThietBi}`);
      navigate(`/thiet-bi/${res.id}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onFinish={handleFinish}
      className="device-form-page__form"
    >
      {!isEdit && (
        <Alert
          className="device-form-page__alert"
          type="info"
          showIcon
          message="Mã thiết bị được tạo tự động theo quy tắc: ký hiệu loại – năm nhập – số thứ tự (ví dụ LT-2026-001)."
        />
      )}

      <div className="device-form-page__grid">
        {isEdit && (
          <>
            <Form.Item label="Mã thiết bị">
              <Input value={device.maThietBi} disabled />
            </Form.Item>
            <Form.Item label="Loại thiết bị">
              <Input value={device.tenLoai} disabled />
            </Form.Item>
            <Form.Item label="Ngày nhập">
              <Input value={formatDate(device.ngayNhap)} disabled />
            </Form.Item>
            <Form.Item
              label="Phòng ban đang đặt"
              extra="Muốn đổi phòng ban, dùng chức năng Điều động."
            >
              <Input value={device.tenPhongBan} disabled />
            </Form.Item>
            <Form.Item label="Trạng thái" extra="Hệ thống tự cập nhật theo các nghiệp vụ.">
              <Input value={TRANG_THAI_LABEL[device.trangThai]} disabled />
            </Form.Item>
          </>
        )}

        <Form.Item
          label="Tên thiết bị"
          name="tenThietBi"
          rules={[
            { required: true, whitespace: true, message: 'Vui lòng nhập tên thiết bị' },
            { max: 150, message: 'Tối đa 150 ký tự' },
          ]}
        >
          <Input />
        </Form.Item>

        {!isEdit && (
          <>
            <Form.Item
              label="Loại thiết bị"
              name="loaiId"
              rules={[{ required: true, message: 'Vui lòng chọn loại thiết bị' }]}
            >
              <Select
                placeholder="Chọn loại thiết bị"
                options={catalog.loaiThietBi.map((l) => ({ value: l.id, label: l.ten }))}
              />
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
            <Form.Item
              label="Ngày nhập"
              name="ngayNhap"
              rules={[{ required: true, message: 'Vui lòng chọn ngày nhập' }]}
            >
              <DatePicker
                className="device-form-page__date"
                format="DD/MM/YYYY"
                placeholder="Chọn ngày nhập"
                disabledDate={(current) => current && current.isAfter(new Date(), 'day')}
              />
            </Form.Item>
          </>
        )}

        <Form.Item label="Hãng" name="hang" rules={[{ max: 100, message: 'Tối đa 100 ký tự' }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Model" name="model" rules={[{ max: 100, message: 'Tối đa 100 ký tự' }]}>
          <Input />
        </Form.Item>
        <Form.Item
          label="Số serial"
          name="soSerial"
          rules={[{ max: 100, message: 'Tối đa 100 ký tự' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Tình trạng"
          name="tinhTrang"
          rules={[{ required: true, message: 'Vui lòng chọn tình trạng' }]}
          extra={
            isEdit && device.trangThai !== 'san_sang'
              ? 'Chỉ đổi được tình trạng khi thiết bị đang ở trạng thái Sẵn sàng.'
              : undefined
          }
        >
          <Select
            options={tinhTrangOptions}
            disabled={isEdit && device.trangThai !== 'san_sang'}
          />
        </Form.Item>

        <Form.Item
          className="device-form-page__full"
          label="Ghi chú"
          name="ghiChu"
          rules={[{ max: 1000, message: 'Tối đa 1000 ký tự' }]}
        >
          <Input.TextArea rows={3} />
        </Form.Item>
      </div>

      <h2 className="device-form-page__subtitle">Thông số kỹ thuật</h2>
      {thongSoDefs.length === 0 ? (
        <p className="device-form-page__hint">Chọn loại thiết bị để nhập thông số kỹ thuật.</p>
      ) : (
        <div className="device-form-page__grid">
          {thongSoDefs.map((s) => (
            <Form.Item
              key={s.id}
              label={s.ten}
              name={['thongSo', String(s.id)]}
              rules={[{ max: 255, message: 'Tối đa 255 ký tự' }]}
            >
              <Input />
            </Form.Item>
          ))}
        </div>
      )}

      {error && <Alert className="device-form-page__alert" type="error" showIcon message={error} />}

      <div className="device-form-page__actions">
        <Button type="primary" htmlType="submit" loading={submitting}>
          {isEdit ? 'Lưu thay đổi' : 'Thêm thiết bị'}
        </Button>
        <Button onClick={() => navigate(isEdit ? `/thiet-bi/${id}` : '/thiet-bi')}>Hủy</Button>
      </div>
    </Form>
  );
}

export default function DeviceFormPage() {
  const { id } = useParams();
  const formKey = id ?? 'new';
  const [result, setResult] = useState({ key: null, catalog: null, device: null, error: '' });

  useEffect(() => {
    let ignore = false;
    const requests = [apiRequest('/api/catalog')];
    if (id) requests.push(apiRequest(`/api/devices/${id}`));

    Promise.all(requests)
      .then(([catalog, detail]) => {
        if (!ignore) {
          setResult({ key: formKey, catalog, device: detail ? detail.thietBi : null, error: '' });
        }
      })
      .catch((err) => {
        if (!ignore) setResult({ key: formKey, catalog: null, device: null, error: err.message });
      });
    return () => {
      ignore = true;
    };
  }, [id, formKey]);

  const loading = result.key !== formKey;

  return (
    <section className="device-form-page">
      <Link to={id ? `/thiet-bi/${id}` : '/thiet-bi'} className="device-form-page__back">
        <ArrowLeftOutlined /> Quay lại
      </Link>

      <h1 className="device-form-page__title">{id ? 'Chỉnh sửa thiết bị' : 'Thêm thiết bị'}</h1>

      {loading && (
        <div className="device-form-page__loading">
          <Spin size="large" />
        </div>
      )}

      {!loading && result.error && (
        <Alert className="device-form-page__alert" type="error" showIcon message={result.error} />
      )}

      {!loading && result.catalog && (
        <DeviceFormBody
          key={formKey}
          id={id}
          catalog={result.catalog}
          device={result.device}
        />
      )}
    </section>
  );
}