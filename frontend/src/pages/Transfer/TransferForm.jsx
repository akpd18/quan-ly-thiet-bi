import { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { Alert, Button, DatePicker, Form, Input, Select, message } from 'antd';
import { apiRequest } from '../../services/api.js';

const toOption = (d) => ({
  value: d.id,
  label: `${d.maThietBi} – ${d.tenThietBi} (${d.tenPhongBan})`,
  phongBanId: d.phongBanId,
  tenPhongBan: d.tenPhongBan,
});

// Lấy tối đa 20 thiết bị có thể điều động (Sẵn sàng, chưa có phiếu điều động chờ duyệt)
function fetchTransferable(keyword) {
  const params = new URLSearchParams();
  if (keyword) params.set('search', keyword);
  return apiRequest(`/api/transfers/devices?${params}`)
    .then((res) => res.items.map(toOption))
    .catch(() => []);
}

// Ô chọn một thiết bị, gõ để tìm trên máy chủ. onPick báo cho biểu mẫu biết thiết bị đang đặt ở phòng ban nào.
function TransferableDeviceSelect({ value, onChange, onPick }) {
  const [options, setOptions] = useState([]);
  const [fetching, setFetching] = useState(true);
  const timer = useRef(null);

  useEffect(() => {
    let ignore = false;
    fetchTransferable('').then((opts) => {
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
      fetchTransferable(keyword.trim())
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
      onChange={(selected, option) => {
        onChange(selected);
        onPick(option);
      }}
      notFoundContent="Không có thiết bị Sẵn sàng phù hợp"
    />
  );
}

// Biểu mẫu lập phiếu điều động, hiển thị trong hộp thoại
export default function TransferForm({ phongBan, onCancel, onSaved }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [currentDept, setCurrentDept] = useState(null);

  // Khi chọn thiết bị: ghi nhớ phòng ban hiện tại, và bỏ phòng ban đến nếu trùng với nơi đang đặt
  const handlePick = (option) => {
    setCurrentDept(option ?? null);
    if (option && form.getFieldValue('phongBanDenId') === option.phongBanId) {
      form.setFieldValue('phongBanDenId', undefined);
    }
  };

  const handleFinish = async (values) => {
    setSubmitting(true);
    setError('');
    try {
      const res = await apiRequest('/api/transfers', {
        method: 'POST',
        body: {
          thietBiId: values.thietBi.value,
          phongBanDenId: values.phongBanDenId,
          lyDo: values.lyDo,
          ngayDieuDong: values.ngayDieuDong.format('YYYY-MM-DD'),
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
      form={form}
      layout="vertical"
      initialValues={{ ngayDieuDong: dayjs() }}
      onFinish={handleFinish}
    >
      <Alert
        className="transfer-page__alert"
        type="info"
        showIcon
        message="Phiếu mới ở trạng thái Chờ duyệt. Khi được duyệt, phòng ban đang đặt của thiết bị được cập nhật sang phòng ban đến và lịch sử điều động được lưu lại."
      />

      <Form.Item
        label="Thiết bị"
        name="thietBi"
        rules={[{ required: true, message: 'Vui lòng chọn thiết bị' }]}
        extra="Chỉ thiết bị Sẵn sàng và chưa có phiếu điều động đang chờ duyệt."
      >
        <TransferableDeviceSelect onPick={handlePick} />
      </Form.Item>

      <Form.Item label="Phòng ban hiện tại">
        <Input value={currentDept?.tenPhongBan ?? ''} placeholder="Chọn thiết bị để xem" disabled />
      </Form.Item>

      <Form.Item
        label="Phòng ban đến"
        name="phongBanDenId"
        rules={[{ required: true, message: 'Vui lòng chọn phòng ban đến' }]}
      >
        <Select
          placeholder="Chọn phòng ban đến"
          options={phongBan.map((p) => ({
            value: p.id,
            label: p.ten,
            disabled: p.id === currentDept?.phongBanId,
          }))}
        />
      </Form.Item>

      <Form.Item
        label="Lý do điều động"
        name="lyDo"
        rules={[
          { required: true, whitespace: true, message: 'Vui lòng nhập lý do điều động' },
          { max: 255, message: 'Tối đa 255 ký tự' },
        ]}
      >
        <Input.TextArea rows={3} showCount maxLength={255} />
      </Form.Item>

      <Form.Item
        label="Ngày điều động"
        name="ngayDieuDong"
        rules={[{ required: true, message: 'Vui lòng chọn ngày điều động' }]}
      >
        <DatePicker className="transfer-page__date" format="DD/MM/YYYY" allowClear={false} />
      </Form.Item>

      {error && <Alert className="transfer-page__alert" type="error" showIcon message={error} />}

      <div className="transfer-page__actions">
        <Button type="primary" htmlType="submit" loading={submitting}>
          Lập phiếu
        </Button>
        <Button onClick={onCancel}>Hủy</Button>
      </div>
    </Form>
  );
}