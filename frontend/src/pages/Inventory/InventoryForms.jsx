import { useState } from 'react';
import dayjs from 'dayjs';
import { Alert, Button, DatePicker, Form, Input, Radio, Select, message } from 'antd';
import { apiRequest } from '../../services/api.js';
import { TINH_TRANG_LABEL, TRANG_THAI_LABEL } from '../../constants/labels.js';

const TINH_TRANG_OPTIONS = Object.entries(TINH_TRANG_LABEL).map(([value, label]) => ({
  value,
  label,
}));

// Biểu mẫu tạo đợt kiểm kê: toàn công ty hoặc một phòng ban
export function CreateInventoryForm({ phongBan, onCancel, onCreated }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleFinish = async (values) => {
    setSubmitting(true);
    setError('');
    try {
      const res = await apiRequest('/api/inventories', {
        method: 'POST',
        body: {
          tenDot: values.tenDot,
          phongBanId: values.phamVi === 'all' ? null : values.phamVi,
          ngayKiemKe: values.ngayKiemKe.format('YYYY-MM-DD'),
        },
      });
      message.success(`Đã tạo đợt ${res.maDot} với ${res.soThietBi} thiết bị cần kiểm`);
      onCreated(res.id);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <Form
      layout="vertical"
      initialValues={{ phamVi: 'all', ngayKiemKe: dayjs() }}
      onFinish={handleFinish}
    >
      <Alert
        className="inventory-page__alert"
        type="info"
        showIcon
        message="Hệ thống tự lập danh sách thiết bị cần kiểm trong phạm vi đã chọn (không gồm thiết bị đã thanh lý). Không mở được hai đợt kiểm kê trùng phạm vi cùng lúc."
      />

      <Form.Item
        label="Tên đợt kiểm kê"
        name="tenDot"
        rules={[
          { required: true, whitespace: true, message: 'Vui lòng nhập tên đợt kiểm kê' },
          { max: 150, message: 'Tối đa 150 ký tự' },
        ]}
      >
        <Input placeholder="Ví dụ: Kiểm kê định kỳ quý 4/2026" />
      </Form.Item>

      <Form.Item label="Phạm vi" name="phamVi" rules={[{ required: true, message: 'Vui lòng chọn phạm vi' }]}>
        <Select
          options={[
            { value: 'all', label: 'Toàn công ty' },
            ...phongBan.map((p) => ({ value: p.id, label: `Phòng ban: ${p.ten}` })),
          ]}
        />
      </Form.Item>

      <Form.Item
        label="Ngày kiểm kê"
        name="ngayKiemKe"
        rules={[{ required: true, message: 'Vui lòng chọn ngày kiểm kê' }]}
      >
        <DatePicker className="inventory-page__date" format="DD/MM/YYYY" allowClear={false} />
      </Form.Item>

      {error && <Alert className="inventory-page__alert" type="error" showIcon message={error} />}

      <div className="inventory-page__actions">
        <Button type="primary" htmlType="submit" loading={submitting}>
          Tạo đợt kiểm kê
        </Button>
        <Button onClick={onCancel}>Hủy</Button>
      </div>
    </Form>
  );
}

// Biểu mẫu ghi kết quả kiểm kê của một thiết bị
export function RecordForm({ dotId, item, phongBan, onCancel, onSaved }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const ketQua = Form.useWatch('ketQua', form) ?? item.ketQua ?? 'dung';

  const handleFinish = async (values) => {
    setSubmitting(true);
    setError('');
    const body = { ketQua: values.ketQua, ghiChu: values.ghiChu };
    if (values.ketQua === 'sai_vi_tri') body.phongBanThucTeId = values.phongBanThucTeId;
    if (values.ketQua === 'sai_tinh_trang') body.tinhTrangThucTe = values.tinhTrangThucTe;

    try {
      await apiRequest(`/api/inventories/${dotId}/items/${item.id}`, { method: 'PUT', body });
      message.success('Đã ghi nhận kết quả');
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
        ketQua: item.ketQua && item.ketQua !== 'thua' ? item.ketQua : 'dung',
        phongBanThucTeId: item.ketQua === 'sai_vi_tri' ? item.phongBanThucTe?.id : undefined,
        tinhTrangThucTe: item.ketQua === 'sai_tinh_trang' ? item.tinhTrangThucTe : undefined,
        ghiChu: item.ghiChu ?? '',
      }}
      onFinish={handleFinish}
    >
      <p className="inventory-page__note">
        <strong>
          {item.thietBi.maThietBi} – {item.thietBi.tenThietBi}
        </strong>
        <br />
        Hệ thống ghi nhận: phòng ban <strong>{item.phongBanHeThong?.ten}</strong>, tình trạng{' '}
        <strong>{TINH_TRANG_LABEL[item.tinhTrangHeThong]}</strong>, trạng thái hiện tại{' '}
        <strong>{TRANG_THAI_LABEL[item.thietBi.trangThai]}</strong>.
      </p>

      <Form.Item label="Kết quả kiểm kê" name="ketQua">
        <Radio.Group
          optionType="button"
          buttonStyle="solid"
          options={[
            { value: 'dung', label: 'Đúng' },
            { value: 'thieu', label: 'Thiếu' },
            { value: 'sai_vi_tri', label: 'Sai vị trí' },
            { value: 'sai_tinh_trang', label: 'Sai tình trạng' },
          ]}
        />
      </Form.Item>

      {ketQua === 'thieu' && (
        <Alert
          className="inventory-page__alert"
          type="warning"
          showIcon
          message="Chỉ ghi Thiếu khi không tìm thấy thiết bị. Thiết bị đang được mượn hoặc đang bảo dưỡng, sửa chữa thì vắng mặt là hợp lệ, hãy ghi Đúng. Khi hoàn tất đợt, thiết bị Thiếu chuyển sang Thất lạc."
        />
      )}

      {ketQua === 'sai_vi_tri' && (
        <Form.Item
          label="Phòng ban thực tế"
          name="phongBanThucTeId"
          rules={[{ required: true, message: 'Vui lòng chọn phòng ban thực tế' }]}
        >
          <Select
            placeholder="Chọn phòng ban đang đặt thiết bị"
            options={phongBan.map((p) => ({
              value: p.id,
              label: p.ten,
              disabled: p.id === item.phongBanHeThong?.id,
            }))}
          />
        </Form.Item>
      )}

      {ketQua === 'sai_tinh_trang' && (
        <Form.Item
          label="Tình trạng thực tế"
          name="tinhTrangThucTe"
          rules={[{ required: true, message: 'Vui lòng chọn tình trạng thực tế' }]}
        >
          <Select
            placeholder="Chọn tình trạng thực tế"
            options={TINH_TRANG_OPTIONS.map((o) => ({
              ...o,
              disabled: o.value === item.tinhTrangHeThong,
            }))}
          />
        </Form.Item>
      )}

      <Form.Item label="Ghi chú" name="ghiChu" rules={[{ max: 255, message: 'Tối đa 255 ký tự' }]}>
        <Input />
      </Form.Item>

      {error && <Alert className="inventory-page__alert" type="error" showIcon message={error} />}

      <div className="inventory-page__actions">
        <Button type="primary" htmlType="submit" loading={submitting}>
          Lưu kết quả
        </Button>
        <Button onClick={onCancel}>Hủy</Button>
      </div>
    </Form>
  );
}

// Biểu mẫu ghi nhận thiết bị thừa
export function ExtraForm({ dotId, phongBan, onCancel, onSaved }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleFinish = async (values) => {
    setSubmitting(true);
    setError('');
    try {
      await apiRequest(`/api/inventories/${dotId}/extras`, {
        method: 'POST',
        body: {
          moTa: values.moTa,
          phongBanThucTeId: values.phongBanThucTeId,
          ghiChu: values.ghiChu,
        },
      });
      message.success('Đã ghi nhận thiết bị thừa');
      onSaved();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <Form layout="vertical" onFinish={handleFinish}>
      <Alert
        className="inventory-page__alert"
        type="info"
        showIcon
        message="Thiết bị thừa là thiết bị có thật nhưng chưa có hồ sơ trong hệ thống. Sau khi hoàn tất đợt kiểm kê, hãy tạo hồ sơ thiết bị mới ở trang Thiết bị."
      />

      <Form.Item
        label="Mô tả thiết bị"
        name="moTa"
        rules={[
          { required: true, whitespace: true, message: 'Vui lòng mô tả thiết bị thừa' },
          { max: 255, message: 'Tối đa 255 ký tự' },
        ]}
      >
        <Input.TextArea rows={2} showCount maxLength={255} placeholder="Loại, hãng, model, số serial hoặc đặc điểm nhận dạng" />
      </Form.Item>

      <Form.Item
        label="Phòng ban đang đặt"
        name="phongBanThucTeId"
        rules={[{ required: true, message: 'Vui lòng chọn phòng ban' }]}
      >
        <Select
          placeholder="Chọn phòng ban"
          options={phongBan.map((p) => ({ value: p.id, label: p.ten }))}
        />
      </Form.Item>

      <Form.Item label="Ghi chú" name="ghiChu" rules={[{ max: 255, message: 'Tối đa 255 ký tự' }]}>
        <Input />
      </Form.Item>

      {error && <Alert className="inventory-page__alert" type="error" showIcon message={error} />}

      <div className="inventory-page__actions">
        <Button type="primary" htmlType="submit" loading={submitting}>
          Ghi nhận
        </Button>
        <Button onClick={onCancel}>Hủy</Button>
      </div>
    </Form>
  );
}

// Biểu mẫu hoàn tất đợt kiểm kê và xử lý chênh lệch
export function CompleteInventoryForm({ dot, onCancel, onSaved }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { tongKet } = dot;

  const handleFinish = async (values) => {
    setSubmitting(true);
    setError('');
    try {
      const res = await apiRequest(`/api/inventories/${dot.id}/complete`, {
        method: 'POST',
        body: { bienBan: values.bienBan },
      });
      message.success(
        `Đã hoàn tất: ${res.soThatLac} thất lạc, ${res.soTimThay} tìm thấy lại, ${res.soDoiPhongBan} đổi phòng ban, ${res.soDoiTinhTrang} đổi tình trạng`
      );
      onSaved();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <Form layout="vertical" onFinish={handleFinish}>
      {tongKet.chuaKiem > 0 ? (
        <Alert
          className="inventory-page__alert"
          type="error"
          showIcon
          message={`Còn ${tongKet.chuaKiem} thiết bị chưa kiểm. Hãy ghi nhận kết quả (hoặc đánh dấu Đúng) trước khi hoàn tất.`}
        />
      ) : (
        <Alert
          className="inventory-page__alert"
          type="warning"
          showIcon
          message="Khi hoàn tất, hệ thống xử lý chênh lệch và đợt kiểm kê không sửa được nữa."
          description={`Thiếu ${tongKet.thieu} thiết bị sẽ chuyển Thất lạc; sai vị trí ${tongKet.saiViTri} thiết bị sẽ cập nhật phòng ban; sai tình trạng ${tongKet.saiTinhTrang} thiết bị sẽ cập nhật tình trạng (thiết bị Sẵn sàng thành Hỏng sẽ chuyển Chờ xử lý); thiết bị Thất lạc được ghi Đúng sẽ trở về Sẵn sàng.`}
        />
      )}

      <Form.Item
        label="Kết luận trong biên bản"
        name="bienBan"
        rules={[{ max: 2000, message: 'Tối đa 2000 ký tự' }]}
      >
        <Input.TextArea rows={4} showCount maxLength={2000} placeholder="Nhận xét chung, nguyên nhân chênh lệch, kiến nghị xử lý..." />
      </Form.Item>

      {error && <Alert className="inventory-page__alert" type="error" showIcon message={error} />}

      <div className="inventory-page__actions">
        <Button type="primary" htmlType="submit" loading={submitting} disabled={tongKet.chuaKiem > 0}>
          Hoàn tất đợt kiểm kê
        </Button>
        <Button onClick={onCancel}>Hủy</Button>
      </div>
    </Form>
  );
}