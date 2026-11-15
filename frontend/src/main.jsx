import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import './styles/variables.css';
import './styles/base.css';
import App from './App.jsx';
import AuthProvider from './contexts/AuthProvider.jsx';

const theme = {
  token: { colorPrimary: '#1677ff', borderRadius: 8 },
  components: {
    Layout: {
      bodyBg: '#f5f7fa',
      headerBg: '#ffffff',
      headerHeight: 56,
      headerPadding: '0 24px',
    },
  },
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider locale={viVN} theme={theme}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  </StrictMode>
);