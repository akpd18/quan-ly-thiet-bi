// Chuyển giá trị thành số nguyên dương; trả về null nếu không hợp lệ
export function toId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Cắt khoảng trắng hai đầu; chuỗi rỗng thì thành null
export function text(value) {
  const s = String(value ?? '').trim();
  return s === '' ? null : s;
}

// Kiểm tra chuỗi dạng YYYY-MM-DD và là ngày có thật (không có 2026-02-30)
export function isRealDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

// Ngày hiện tại của máy chủ, dạng YYYY-MM-DD
export function todayString() {
  const now = new Date();
  const pad = (v) => String(v).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}