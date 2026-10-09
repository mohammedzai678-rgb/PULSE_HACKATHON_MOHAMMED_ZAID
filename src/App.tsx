import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useThemeStore } from '@/lib/store';
import { AppLayout } from '@/components/layout/AppLayout';
import { Toaster } from '@/components/ui/Toaster';
import { lazy, Suspense, useEffect } from 'react';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

// Lazy-loaded route components
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const AnalysisPage = lazy(() => import('@/pages/AnalysisPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const ReportDetail = lazy(() => import('@/pages/ReportDetail'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

export default function App() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.className = `theme-${theme}`;
  }, [theme]);

  return (
    <BrowserRouter>
      <div className={`theme-${theme} min-h-screen`}>
        <AppLayout>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/analysis" element={<AnalysisPage />} />
              <Route path="/upload" element={<Navigate to="/analysis" replace />} />
              <Route path="/upload/*" element={<Navigate to="/analysis" replace />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/reports/:id" element={<ReportDetail />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Suspense>
        </AppLayout>
        <Toaster />
      </div>
    </BrowserRouter>
  );
}
