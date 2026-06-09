import { Home, MapPin, MessageCircle, Sparkles, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { preloadBaiduMapIdle } from '../../utils/baiduMap';

const navItems = [
  { path: '/', label: '首页', icon: Home },
  { path: '/ai-trip-planner', label: 'AI规划', icon: Sparkles },
  { path: '/footprint', label: '行程', icon: MapPin },
  { path: '/space', label: '动态', icon: MessageCircle },
  { path: '/profile', label: '我的', icon: User },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="max-w-md mx-auto flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              onPointerEnter={() => {
                if (item.path === '/footprint') preloadBaiduMapIdle();
              }}
              onTouchStart={() => {
                if (item.path === '/footprint') preloadBaiduMapIdle();
              }}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive ? 'text-emerald-500' : 'text-gray-400'
              }`}
            >
              <item.icon
                size={22}
                className={`transition-transform ${isActive ? 'scale-110' : ''}`}
              />
              <span className="text-xs mt-1">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
