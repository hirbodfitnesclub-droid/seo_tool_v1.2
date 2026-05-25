import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// پیش‌گرم‌کردن کامپایل ورکر در dev mode تا اولین استفاده سریع باشد
// @ts-ignore
import('./workers/scoringWorker?worker').catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
