import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Toaster } from 'sonner';
import ErrorBoundary from '@/components/ErrorBoundary';
import LoadingSpinner from '@/components/LoadingSpinner';
import { ServicesProvider } from '@/services';
import { useMediaQuery, useTheme } from '@/hooks';

// 懒加载页面组件
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const AdvancedDigitalHumanPage = lazy(() => import('@/pages/AdvancedDigitalHumanPage'));

// 页面加载 fallback
function PageLoader() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center light:bg-[#f4f5f9]">
      <LoadingSpinner size="lg" text="加载中..." />
    </div>
  );
}

// 全局通知跟随主题（主题状态由 useTheme 的模块级 store 提供）；
// 窄屏下下移，避免压住 /app 顶部 HUD 状态卡
function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  const isNarrowScreen = useMediaQuery('(max-width: 767px)');
  return (
    <Toaster
      position="top-center"
      theme={resolvedTheme}
      richColors
      closeButton
      offset={isNarrowScreen ? { top: 104 } : undefined}
      mobileOffset={isNarrowScreen ? { top: 104 } : undefined}
    />
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Landing Page - 产品落地页 */}
            <Route path="/" element={<LandingPage />} />

            {/* App Route - 数字人应用（服务容器仅在此路由挂载） */}
            <Route
              path="/app"
              element={
                <ServicesProvider>
                  <AdvancedDigitalHumanPage />
                </ServicesProvider>
              }
            />

            {/* Fallback - 防止未知 hash 路径导致空白页 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Router>
      <ThemedToaster />
    </ErrorBoundary>
  );
}
