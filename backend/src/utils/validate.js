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