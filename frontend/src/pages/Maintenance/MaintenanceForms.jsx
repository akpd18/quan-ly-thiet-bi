import { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { Alert, Button, DatePicker, Form, Input, InputNumber, Radio, Select, message } from 'antd';
import { apiRequest } from '../../services/api.js';
import { LOAI_HINH_LABEL, TINH_TRANG_LABEL, TRANG_THAI_LABEL } from '../../constants/labels.js';

const LOAI_HINH_OPTIONS = Object.entries(LOAI_HINH_LABEL).map(([value, label]) => ({
  value,
  label,
}));

// Tình trạng được chọn khi hoàn tất thành công (Bảng 10): sau sửa chữa không có "Mới"
const AFTER_SUCCESS_OPTIONS = {
  bao_duong: ['moi', 'tot', 'cu'].map((value) => ({ value, label: TINH_TRANG_LABEL[value] })),
  sua_chua: ['tot', 'cu'].map((value) => ({ value, label: TINH_TRANG_LABEL[value] })),
};

const toOption = (d) => ({
  value: d.id,
  label: `${d.maThietBi} – ${d.tenThietBi} (${d.tenPhongBan}) – ${TRANG_THAI_LABEL[d.trangThai]}`,
});

// Lấy tối đa 20 thiết bị đủ điều kiện bắt đầu bảo dưỡng hoặc sửa chữa
function fetchEligible(loaiHinh, keyword) {
  const params = new URLSearchParams({ loaiHinh });
  if (keyword) params.set('search', keyword);
  return apiRequest(`/api/maintenance/devices?${params}`)
    .then((res) => res.items.map(toOption))
    .catch(() => []);
}

// Ô chọn một thiết bị, gõ để tìm trên máy chủ
function EligibleDeviceSelect({ loaiHinh, value, onChange }) {
  const [options, setOptions] = useState([]);
  const [fetching, setFetching] = useState(true);
  const timer = useRef(null);

  useEffect(() => {
    let ignore = false;
    fetchEligible(loaiHinh, '').then((opts) => {
      if (!ignore) {
        setOptions(opts);
        setFetching(false);
      }
    });
    return () => {
      ignore = true;
      clearTimeout(timer.current);
    };
  }, [loaiHinh]);

  // Chờ người dùng gõ xong 0,3 giây mới tìm
  const handleSearch = (keyword) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setFetching(true);
      fetchEligible(loaiHinh, keyword.trim())
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

// Biểu mẫu bắt đầu bảo dưỡng hoặc sửa chữa
export function StartForm({ initial, onCancel, onSaved }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const loaiHinh = Form.useWatch('loaiHinh', form) ?? initial?.loaiHinh ?? 'bao_duong';

  const initialValues = {
    loaiHinh: initial?.loaiHinh ?? 'bao_duong',
    thietBi: initial?.device
      ? { value: initial.device.id, label: `${initial.device.maThietBi} – ${initial.device.tenThietBi}` }
      : undefined,
    ngayBatDau: dayjs(),
  };

  const handleFinish = async (values) => {
    setSubmitting(true);
    setError('');
    try {
      await apiRequest('/api/maintenance', {
        method: 'POST',
        body: {
          thietBiId: values.thietBi.value,
          loaiHinh: values.loaiHinh,
          ngayBatDau: values.ngayBatDau.format('YYYY-MM-DD'),
          vanDe: values.vanDe,
        },
      });
      message.success(
        values.loaiHinh === 'sua_chua'
          ? 'Đã bắt đầu sửa chữa, thiết bị chuyển sang Đang sửa chữa'
          : 'Đã bắt đầu bảo dưỡng, thiết bị chuyển sang Đang bảo dưỡng'
      );
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
      initialValues={initialValues}
      // Đổi loại hình thì danh sách thiết bị đủ điều kiện khác đi, nên bỏ thiết bị đã chọn
      onValuesChange={(changed) => {
        if ('loaiHinh' in changed) form.setFieldValue('thietBi', undefined);
      }}
      onFinish={handleFinish}
    >
      <Form.Item label="Loại hình" name="loaiHinh">
        <Radio.Group optionType="button" buttonStyle="solid" options={LOAI_HINH_OPTIONS} />
      </Form.Item>

      <Alert
        className="maintenance-page__alert"
        type="info"
        showIcon
        message={
          loaiHinh === 'sua_chua'
            ? 'Sửa chữa áp dụng cho thiết bị Sẵn sàng hoặc Chờ xử lý. Thiết bị sẽ chuyển sang Đang sửa chữa.'
            : 'Bảo dưỡng áp dụng cho thiết bị Sẵn sàng. Thiết bị sẽ chuyển sang Đang bảo dưỡng.'
        }
      />

      <Form.Item
        label="Thiết bị"
        name="thietBi"
        rules={[{ required: true, message: 'Vui lòng chọn thiết bị' }]}
      >
        <EligibleDeviceSelect key={loaiHinh} loaiHinh={loaiHinh} />
      </Form.Item>

      <Form.Item
        label="Ngày bắt đầu"
        name="ngayBatDau"
        rules={[{ required: true, message: 'Vui lòng chọn ngày bắt đầu' }]}
      >
        <DatePicker
          className="maintenance-page__date"
          format="DD/MM/YYYY"
          allowClear={false}
          disabledDate={(current) => current && current.isAfter(dayjs(), 'day')}
        />
      </Form.Item>

      <Form.Item
        label={loaiHinh === 'sua_chua' ? 'Sự cố cần sửa chữa' : 'Ghi chú (nếu có)'}
        name="vanDe"
        dependencies={['loaiHinh']}
        rules={[
          ({ getFieldValue }) => ({
            required: getFieldValue('loaiHinh') === 'sua_chua',
            whitespace: true,
            message: 'Vui lòng mô tả sự cố cần sửa chữa',
          }),
          { max: 2000, message: 'Tối đa 2000 ký tự' },
        ]}
      >
        <Input.TextArea rows={3} />
      </Form.Item>

      {error && <Alert className="maintenance-page__alert" type="error" showIcon message={error} />}

      <div className="maintenance-page__actions">
        <Button type="primary" htmlType="submit" loading={submitting}>
          Bắt đầu
        </Button>
        <Button onClick={onCancel}>Hủy</Button>
      </div>
    </Form>
  );
}

// Biểu mẫu hoàn tất một lần bảo dưỡng hoặc sửa chữa
export function CompleteForm({ record, onCancel, onSaved }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const ketQua = Form.useWatch('ketQua', form) ?? 'thanh_cong';
  const isRepair = record.loaiHinh === 'sua_chua';

  // Tình trạng mặc định: giữ tình trạng hiện tại nếu hợp lệ, không thì chọn Tốt
  const current = record.thietBi.tinhTrang;
  const defaultAfter = AFTER_SUCCESS_OPTIONS[record.loaiHinh].some((o) => o.value === current)
    ? current
    : 'tot';

  const handleFinish = async (values) => {
    setSubmitting(true);
    setError('');
    try {
      await apiRequest(`/api/maintenance/${record.id}/complete`, {
        method: 'POST',
        body: {
          ketQua: values.ketQua,
          ngayHoanTat: values.ngayHoanTat.format('YYYY-MM-DD'),
          noiDungXuLy: values.noiDungXuLy,
          chiPhi: values.chiPhi ?? 0,
          tinhTrangSauXuLy: values.ketQua === 'thanh_cong' ? values.tinhTrangSauXuLy : undefined,
        },
      });
      message.success(
        values.ketQua === 'thanh_cong'
          ? 'Đã hoàn tất, thiết bị trở về Sẵn sàng'
          : 'Đã ghi nhận không thành công, thiết bị chuyển sang Chờ xử lý'
      );
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
      initialValues={{
        ketQua: 'thanh_cong',
        ngayHoanTat: dayjs(),
        tinhTrangSauXuLy: defaultAfter,
        chiPhi: 0,
      }}
      onFinish={handleFinish}
    >
      <p className="maintenance-page__note">
        <strong>{record.thietBi.maThietBi} – {record.thietBi.tenThietBi}</strong>
        <br />
        {LOAI_HINH_LABEL[record.loaiHinh]}, bắt đầu ngày {dayjs(record.ngayBatDau).format('DD/MM/YYYY')}
        {record.vanDe ? `. Vấn đề: ${record.vanDe}` : ''}
      </p>

      <Form.Item label="Kết quả" name="ketQua">
        <Radio.Group
          optionType="button"
          buttonStyle="solid"
          options={[
            { value: 'thanh_cong', label: 'Thành công' },
            { value: 'khong_thanh_cong', label: 'Không thành công' },
          ]}
        />
      </Form.Item>

      {ketQua === 'thanh_cong' ? (
        <Form.Item
          label="Tình trạng sau xử lý"
          name="tinhTrangSauXuLy"
          rules={[{ required: true, message: 'Vui lòng chọn tình trạng' }]}
          extra={
            !isRepair && record.chuKyBaoDuongThang
              ? `Ngày bảo dưỡng kế tiếp sẽ được tính tự động: ngày hoàn tất cộng ${record.chuKyBaoDuongThang} tháng.`
              : undefined
          }
        >
          <Select options={AFTER_SUCCESS_OPTIONS[record.loaiHinh]} />
        </Form.Item>
      ) : (
        <Alert
          className="maintenance-page__alert"
          type="warning"
          showIcon
          message="Thiết bị sẽ được ghi nhận tình trạng Hỏng và chuyển sang Chờ xử lý (có thể đề xuất thanh lý)."
        />
      )}

      <Form.Item
        label="Ngày hoàn tất"
        name="ngayHoanTat"
        rules={[{ required: true, message: 'Vui lòng chọn ngày hoàn tất' }]}
      >
        <DatePicker
          className="maintenance-page__date"
          format="DD/MM/YYYY"
          allowClear={false}
          disabledDate={(current) =>
            current &&
            (current.isAfter(dayjs(), 'day') || current.isBefore(dayjs(record.ngayBatDau), 'day'))
          }
        />
      </Form.Item>

      <Form.Item label="Chi phí (đồng)" name="chiPhi">
        <InputNumber
          className="maintenance-page__money"
          min={0}
          max={99999999999}
          precision={0}
          step={50000}
          formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
          parser={(value) => (value ? value.replace(/\./g, '') : value)}
        />
      </Form.Item>

      <Form.Item
        label="Nội dung xử lý"
        name="noiDungXuLy"
        rules={[{ max: 2000, message: 'Tối đa 2000 ký tự' }]}
      >
        <Input.TextArea rows={3} />
      </Form.Item>

      {error && <Alert className="maintenance-page__alert" type="error" showIcon message={error} />}

      <div className="maintenance-page__actions">
        <Button type="primary" htmlType="submit" loading={submitting}>
          Xác nhận hoàn tất
        </Button>
        <Button onClick={onCancel}>Hủy</Button>
      </div>
    </Form>
  );
}