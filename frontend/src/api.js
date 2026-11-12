const TOKEN_KEY = 'qltb_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export async function apiRequest(url, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // phản hồi không có nội dung JSON
  }

  if (!res.ok) {
    const error = new Error(data?.message || 'Có lỗi xảy ra, vui lòng thử lại');
    error.status = res.status;
    throw error;
  }
  return data;
}