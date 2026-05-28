
import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import NewProject from './pages/NewProject';
import Config from './pages/Config';
import Results from './pages/Results';
import ProjectPages from './pages/ProjectPages';
import PageDetail from './pages/PageDetail';
import { Network } from 'lucide-react';
import { ToastProvider } from './contexts/ToastContext';
import { ToastContainer } from './components/ui/Toast';
import { useQueueAutoResume } from './hooks/useQueueAutoResume';
import { TemporalProvider } from './contexts/TemporalContext';

export default function App() {
  // اجرای پایش خودکار بازنشانی صف‌های ناتمام در زمان بالا آمدن تب
  useQueueAutoResume();

  return (
    <TemporalProvider>
      <ToastProvider>
        <BrowserRouter>
          <div className="min-h-screen flex flex-col">
          {/* Navigation Bar */}
          <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2 text-xl font-bold text-blue-600">
                <Network size={24} />
                <span>LinkMesh</span>
              </Link>
              <nav className="flex gap-4">
                <Link to="/" className="text-gray-600 hover:text-blue-600 transition-colors">داشبورد</Link>
                <Link to="/new" className="text-gray-600 hover:text-blue-600 transition-colors">پروژه جدید</Link>
              </nav>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 w-full max-w-7xl mx-auto py-6 px-4">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/new" element={<NewProject />} />
              <Route path="/config/:projectId" element={<Config />} />
              <Route path="/project/:projectId" element={<ProjectPages />} />
              <Route path="/project/:projectId/page/:pageId" element={<PageDetail />} />
              <Route path="/results/:projectId" element={<Results />} />
            </Routes>
          </main>

          {/* Footer */}
          <footer className="bg-white border-t border-gray-200 py-6 text-center text-gray-500 text-sm">
            LinkMesh - ابزار هوشمند لینکسازی داخلی سئو
          </footer>
        </div>
      </BrowserRouter>
      <ToastContainer />
    </ToastProvider>
    </TemporalProvider>
  );
}

