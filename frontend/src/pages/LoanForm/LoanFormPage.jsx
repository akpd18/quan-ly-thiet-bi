import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { Alert, Button, DatePicker, Form, Select, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { apiRequest } from '../../services/api.js';
import { useAuth } from '../../contexts/AuthContext.js';
import './LoanFormPage.css';

const toOption = (d) => ({
  value: d.id,
  label: `${d.maThietBi} – ${d.tenThietBi} (${d.tenPhongBan})`,
});

// Lấy tối đa 20 thiết bị Sẵn sàng khớp từ khóa tìm kiếm
function fetchDeviceOptions(keyword) {
  const params = new URLSearchParams({ trangThai: 'san_sang', pageSize: 20 });
  if (keyword) params.set('search', keyword);
  return apiRequest(`/api/devices?${params}`)
    .then((res) => res.items.map(toOption))
    .catch(() => []);
}

// Ô chọn nhiều thiết bị Sẵn sàng, gõ để tìm trên máy chủ
function DeviceSelect({ value, onChange }) {
  const [options, setOptions] = useState([]);
  const [fetching, setFetching] = useState(true);
  const timer = useRef(null);

  useEffect(() => {
    let ignore = false;
    fetchDeviceOptions('').then((opts) => {
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

  // Chờ người dùng gõ xong 0,3 giây mới tìm, tránh gọi máy chủ sau mỗi phím
  const handleSearch = (keyword) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setFetching(true);
      fetchDeviceOptions(keyword.trim())
        .then(setOptions)
        .finally(() => setFetching(false));
    }, 300);
  };

  return (
    <Select
      mode="multiple"
      labelInValue
      showSearch
      filterOption={false}
      placeholder="Gõ mã, tên, hãng hoặc model để tìm thiết bị Sẵn sàng"
      options={options}
      loading={fetching}
      onSearch={handleSearch}
      value={value}
      onChange={onChange}
      notFoundContent="Không có thiết bị Sẵn sàng phù hợp"
    />
  );
}

export default function LoanFormPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const isAdmin = user.vaiTro === 'quan_tri';
  const [borrowers, setBorrowers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Quản trị viên được lập phiếu hộ người khác nên cần danh sách người mượn
  useEffect(() => {
    if (!isAdmin) return;
    apiRequest('/api/loans/borrowers')
      .then((res) => setBorrowers(res.items))
      .catch((err) => setError(err.message));
  }, [isAdmin]);

  const handleFinish = async (values) => {
    setSubmitting(true);
    setError('');

    const body = {
      ngayMuon: values.ngayMuon.format('YYYY-MM-DD'),
      hanTra: values.hanTra.format('YYYY-MM-DD'),
      thietBiIds: values.thietBi.map((item) => item.value),
    };
    if (isAdmin) body.nguoiMuonId = values.nguoiMuonId;

    try {
      const res = await apiRequest('/api/loans', { method: 'POST', body });
      message.success(`Đã lập phiếu ${res.maPhieu}, đang chờ duyệt`);
      navigate(`/phieu-muon/${res.id}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <section className="loan-form-page">
      <Link to="/phieu-muon" className="loan-form-page__back">
        <ArrowLeftOutlined /> Quay lại danh sách
      </Link>

      <h1 className="loan-form-page__title">Lập phiếu mượn</h1>

      <Alert
        className="loan-form-page__alert"
        type="info"
        showIcon
        message="Phiếu mới ở trạng thái Chờ duyệt. Thiết bị chỉ chuyển sang Đang mượn sau khi quản trị viên duyệt."
      />

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          nguoiMuonId: user.id,
          ngayMuon: dayjs(),
          hanTra: dayjs().add(7, 'day'),
        }}
        onFinish={handleFinish}
      >
        <div className="loan-form-page__grid">
          {isAdmin && (
            <Form.Item
              className="loan-form-page__full"
              label="Người mượn"
              name="nguoiMuonId"
              rules={[{ required: true, message: 'Vui lòng chọn người mượn' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={borrowers.map((b) => ({
                  value: b.id,
                  label: `${b.hoTen} (${b.tenDangNhap}) – ${b.tenPhongBan}`,
                }))}
              />
            </Form.Item>
          )}

          <Form.Item
            label="Ngày mượn"
            name="ngayMuon"
            rules={[{ required: true, message: 'Vui lòng chọn ngày mượn' }]}
          >
            <DatePicker
              className="loan-form-page__date"
              format="DD/MM/YYYY"
              allowClear={false}
              disabledDate={(current) => current && current.isBefore(dayjs(), 'day')}
            />
          </Form.Item>

          <Form.Item
            label="Hạn trả"
            name="hanTra"
            dependencies={['ngayMuon']}
            rules={[
              { required: true, message: 'Vui lòng chọn hạn trả' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const start = getFieldValue('ngayMuon');
                  if (!value || !start || !value.isBefore(start, 'day')) return Promise.resolve();
                  return Promise.reject(new Error('Hạn trả không được trước ngày mượn'));
                },
              }),
            ]}
          >
            <DatePicker
              className="loan-form-page__date"
              format="DD/MM/YYYY"
              allowClear={false}
              disabledDate={(current) => current && current.isBefore(dayjs(), 'day')}
            />
          </Form.Item>

          <Form.Item
            className="loan-form-page__full"
            label="Thiết bị cần mượn"
            name="thietBi"
            rules={[
              { required: true, type: 'array', min: 1, message: 'Vui lòng chọn ít nhất một thiết bị' },
              { type: 'array', max: 20, message: 'Mỗi phiếu tối đa 20 thiết bị' },
            ]}
          >
            <DeviceSelect />
          </Form.Item>
        </div>

        {error && <Alert className="loan-form-page__alert" type="error" showIcon message={error} />}

        <div className="loan-form-page__actions">
          <Button type="primary" htmlType="submit" loading={submitting}>
            Lập phiếu
          </Button>
          <Button onClick={() => navigate('/phieu-muon')}>Hủy</Button>
        </div>
      </Form>
    </section>
  );
}