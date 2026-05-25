import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import { initTestHelpers } from './utils/testHelpers';
import { useAuthStore } from './stores/authStore';
import { useAppStore } from './stores/appStore';
import { env } from './config/env';

// Code Splitting with React.lazy
const Home = lazy(() => import('./pages/Home/index'));
const Footprint = lazy(() => import('./pages/Footprint'));
const RoutePlanning = lazy(() => import('./pages/RoutePlanning'));
const AttractionDetail = lazy(() => import('./pages/AttractionDetail/index'));
const Space = lazy(() => import('./pages/Space'));
const Profile = lazy(() => import('./pages/Profile'));
const Login = lazy(() => import('./pages/Login'));

// Loading Fallback Component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

// 路由配置组件
function AppRoutes() {
  const location = useLocation();
  const { initAuth, isAuthenticated, user } = useAuthStore();
  const { loadCheckins, clearData } = useAppStore();

  // 初始化认证状态
  useEffect(() => {
    initAuth();

    try {
      const url = new URL(env.supabaseUrl);
      const origin = url.origin;
      const addLink = (rel: string) => {
        const el = document.createElement('link');
        el.rel = rel;
        el.href = origin;
        if (rel === 'preconnect') el.crossOrigin = '';
        document.head.appendChild(el);
      };
      addLink('dns-prefetch');
      addLink('preconnect');
    } catch {
      // ignore
    }

    // 在开发环境下初始化测试辅助函数
    if (import.meta.env.DEV) {
      initTestHelpers();
    }
  }, [initAuth]);

  // 登录状态变化时加载/清除数据
  useEffect(() => {
    if (isAuthenticated && user) {
      loadCheckins(user.id);
    } else {
      clearData();
    }
  }, [isAuthenticated, user, loadCheckins, clearData]);

  // 判断是否隐藏底部导航
  const hideBottomNav = location.pathname === '/route-planning' || location.pathname.startsWith('/attraction/');

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen">
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/footprint" element={<Footprint />} />
          <Route path="/route-planning" element={<RoutePlanning />} />
          <Route path="/attraction/:id" element={<AttractionDetail />} />
          <Route path="/space" element={<Space />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </Suspense>
      {!hideBottomNav && <BottomNav />}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

export default App;
