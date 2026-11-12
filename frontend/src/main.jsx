import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import './styles/variables.css';
import './styles/base.css';
import App from './App.jsx';
import AuthProvider from './contexts/AuthProvider.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider locale={viVN} theme={{ token: { colorPrimary: '#1677ff', borderRadius: 8 } }}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  </StrictMode>
);