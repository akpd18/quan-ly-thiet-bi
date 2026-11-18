// Đổi '2026-01-15' (hoặc '2026-01-15 08:30:00') thành '15/01/2026'
export function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

// Đổi '2026-01-15 08:30:00' thành '15/01/2026 08:30'
export function formatDateTime(value) {
  if (!value) return '';
  const time = String(value).slice(11, 16);
  return time ? `${formatDate(value)} ${time}` : formatDate(value);
}