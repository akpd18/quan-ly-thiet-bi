import { Tag } from 'antd';
import {
  PHIEU_MUON_COLOR,
  PHIEU_MUON_LABEL,
  TINH_TRANG_COLOR,
  TINH_TRANG_LABEL,
  TRANG_THAI_COLOR,
  TRANG_THAI_LABEL,
} from '../../constants/labels.js';

export function TrangThaiTag({ value }) {
  return <Tag color={TRANG_THAI_COLOR[value]}>{TRANG_THAI_LABEL[value] ?? value}</Tag>;
}

export function TinhTrangTag({ value }) {
  return <Tag color={TINH_TRANG_COLOR[value]}>{TINH_TRANG_LABEL[value] ?? value}</Tag>;
}

export function PhieuMuonTag({ value }) {
  return <Tag color={PHIEU_MUON_COLOR[value]}>{PHIEU_MUON_LABEL[value] ?? value}</Tag>;
}