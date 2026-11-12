import { useCallback, useEffect, useState } from 'react';
import { AuthContext } from './AuthContext.js';
import { apiRequest, clearToken, getToken, setToken } from '../services/api.js';

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Khi mở lại trang: nếu còn token thì hỏi backend xem còn hợp lệ không
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    apiRequest('/api/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (tenDangNhap, matKhau) => {
    const data = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { tenDangNhap, matKhau },
    });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}