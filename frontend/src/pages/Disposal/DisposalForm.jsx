import { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { Alert, Button, DatePicker, Form, Input, InputNumber, Radio, Select, message } from 'antd';
import { apiRequest } from '../../services/api.js';
import { HINH_THUC_LABEL, TRANG_THAI_LABEL } from '../../constants/labels.js';

const HINH_THUC_OPTIONS = Object.entries(HINH_THUC_LABEL).map(([value, label]) => ({
  value,
  label,
}));

const toOption = (d) => ({
  value: d.id,
  label: `${d.maThietBi} – ${d.tenThietBi} (${d.tenPhongBan}) – ${TRANG_THAI_LABEL[d.trangThai]}`,
});

// Lấy tối đa 20 thiết bị có thể thanh lý (Sẵn sàng hoặc Chờ xử lý, chưa có phiếu chờ duyệt)
function fetchDisposable(keyword) {
  const params = new URLSearchParams();
  if (keyword) params.set('search', keyword);
  return apiRequest(`/api/disposals/devices?${params}`)
    .then((res) => res.items.map(toOption))
    .catch(() => []);
}

// Ô chọn một thiết bị, gõ để tìm trên máy chủ
function DisposableDeviceSelect({ value, onChange }) {
  const [options, setOptions] = useState([]);
  const [fetching, setFetching] = useState(true);
  const timer = useRef(null);

  useEffect(() => {
    let ignore = false;
    fetchDisposable('').then((opts) => {
      if (!ignore) {
        setOptions(opts);
        setFetching(false);
      }
    });
    return () => {
      ignore = true;
      clearTimeout(timer.current);
    };
  }, []);

  // Chờ người dùng gõ xong 0,3 giây mới tìm
  const handleSearch = (keyword) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setFetching(true);
      fetchDisposable(keyword.trim())
        .then(setOptions)
        .finally(() => setFetching(false));
    }, 300);
  };

  return (
    <Select
      labelInValue
      showSearch
      filterOption={false}
      placeholder="Gõ mã hoặc tên thiết bị để tìm"
      options={options}
      loading={fetching}
      onSearch={handleSearch}
      value={value}
      onChange={onChange}
      notFoundContent="Không có thiết bị phù hợp"
    />
  );
}

// Biểu mẫu lập phiếu thanh lý, hiển thị trong hộp thoại
export default function DisposalForm({ onCancel, onSaved }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleFinish = async (values) => {
    setSubmitting(true);
    setError('');
    try {
      const res = await apiRequest('/api/disposals', {
        method: 'POST',
        body: {
          thietBiId: values.thietBi.value,
          lyDo: values.lyDo,
          hinhThuc: values.hinhThuc,
          giaTriThuHoi: values.giaTriThuHoi ?? 0,
          ngayThanhLy: values.ngayThanhLy.format('YYYY-MM-DD'),
        },
      });
      message.success(`Đã lập phiếu ${res.maPhieu}, đang chờ duyệt`);
      onSaved();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <Form
      layout="vertical"
      initialValues={{ hinhThuc: 'ban', giaTriThuHoi: 0, ngayThanhLy: dayjs() }}
      onFinish={handleFinish}
    >
      <Alert
        className="disposal-page__alert"
        type="info"
        showIcon
        message="Phiếu mới ở trạng thái Chờ duyệt. Khi được duyệt, thiết bị chuyển sang Đã thanh lý và không còn được mượn, điều động hay sửa chữa; hồ sơ vẫn được giữ để tra cứu."
      />

      <Form.Item
        label="Thiết bị"
        name="thietBi"
        rules={[{ required: true, message: 'Vui lòng chọn thiết bị' }]}
        extra="Chỉ thiết bị Sẵn sàng hoặc Chờ xử lý, và chưa có phiếu thanh lý đang chờ duyệt."
      >
        <DisposableDeviceSelect />
      </Form.Item>

      <Form.Item
        label="Lý do thanh lý"
        name="lyDo"
        rules={[
          { required: true, whitespace: true, message: 'Vui lòng nhập lý do thanh lý' },
          { max: 255, message: 'Tối đa 255 ký tự' },
        ]}
      >
        <Input.TextArea rows={3} showCount maxLength={255} />
      </Form.Item>

      <Form.Item
        label="Hình thức thanh lý"
        name="hinhThuc"
        rules={[{ required: true, message: 'Vui lòng chọn hình thức' }]}
      >
        <Radio.Group optionType="button" buttonStyle="solid" options={HINH_THUC_OPTIONS} />
      </Form.Item>

      <Form.Item label="Giá trị thu hồi (đồng)" name="giaTriThuHoi">
        <InputNumber
          className="disposal-page__money"
          min={0}
          max={99999999999}
          precision={0}
          step={50000}
          formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
          parser={(value) => (value ? value.replace(/\./g, '') : value)}
        />
      </Form.Item>

      <Form.Item
        label="Ngày thanh lý"
        name="ngayThanhLy"
        rules={[{ required: true, message: 'Vui lòng chọn ngày thanh lý' }]}
      >
        <DatePicker className="disposal-page__date" format="DD/MM/YYYY" allowClear={false} />
      </Form.Item>

      {error && <Alert className="disposal-page__alert" type="error" showIcon message={error} />}

      <div className="disposal-page__actions">
        <Button type="primary" htmlType="submit" loading={submitting}>
          Lập phiếu
        </Button>
        <Button onClick={onCancel}>Hủy</Button>
      </div>
    </Form>
  );
}