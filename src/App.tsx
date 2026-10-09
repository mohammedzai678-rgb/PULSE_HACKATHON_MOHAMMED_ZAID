import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useThemeStore } from '@/lib/store';
import { AppLayout } from '@/components/layout/AppLayout';
import { Toaster } from '@/components/ui/Toaster';
import { lazy, Suspense, useEffect } from 'react';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

// Lazy-loaded route components
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const UploadHub = lazy(() => import('@/pages/UploadHub'));
const WhatsAppUpload = lazy(() => import('@/pages/WhatsAppUpload'));
const TelegramUpload = lazy(() => import('@/pages/TelegramUpload'));
const GmailUpload = lazy(() => import('@/pages/GmailUpload'));
const SmsUpload = lazy(() => import('@/pages/SmsUpload'));
const CircularsUpload = lazy(() => import('@/pages/CircularsUpload'));
const DocumentsUpload = lazy(() => import('@/pages/DocumentsUpload'));
const ImagesUpload = lazy(() => import('@/pages/ImagesUpload'));
const OtherUpload = lazy(() => import('@/pages/OtherUpload'));
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
              <Route path="/upload" element={<UploadHub />} />
              <Route path="/upload/whatsapp" element={<WhatsAppUpload />} />
              <Route path="/upload/telegram" element={<TelegramUpload />} />
              <Route path="/upload/gmail" element={<GmailUpload />} />
              <Route path="/upload/sms" element={<SmsUpload />} />
              <Route path="/upload/circulars" element={<CircularsUpload />} />
              <Route path="/upload/documents" element={<DocumentsUpload />} />
              <Route path="/upload/images" element={<ImagesUpload />} />
              <Route path="/upload/other" element={<OtherUpload />} />
              <Route path="/analysis" element={<AnalysisPage />} />
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
