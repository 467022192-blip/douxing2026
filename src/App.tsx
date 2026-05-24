import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import Home from './pages/Home/index';
import Footprint from './pages/Footprint';
import RoutePlanning from './pages/RoutePlanning';
import AttractionDetail from './pages/AttractionDetail/index';
import Space from './pages/Space';
import Profile from './pages/Profile';
import Login from './pages/Login';
import { initTestHelpers } from './utils/testHelpers';
import { useAuthStore } from './stores/authStore';
import { useAppStore } from './stores/appStore';

// 路由配置组件
function AppRoutes() {
  const location = useLocation();
  const { initAuth, isAuthenticated, user } = useAuthStore();
  const { loadCheckins, clearData } = useAppStore();

  // 初始化认证状态
  useEffect(() => {
    initAuth();

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
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/footprint" element={<Footprint />} />
        <Route path="/route-planning" element={<RoutePlanning />} />
        <Route path="/attraction/:id" element={<AttractionDetail />} />
        <Route path="/space" element={<Space />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/login" element={<Login />} />
      </Routes>
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
