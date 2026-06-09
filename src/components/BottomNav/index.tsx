import type { ReactNode } from 'react';
import { Home, MapPin, MessageCircle, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import GuideTabIcon from '../GuideTabIcon';
import { preloadBaiduMapIdle } from '../../utils/baiduMap';

type NavItem = {
  path: string;
  label: string;
  icon?: typeof Home;
  customIcon?: (active: boolean) => ReactNode;
};

const navItems: NavItem[] = [
  { path: '/', label: '首页', icon: Home },
  { path: '/footprint', label: '行程', icon: MapPin },
  { path: '/ai-trip-planner', label: '攻略', customIcon: (active) => <GuideTabIcon active={active} /> },
  { path: '/space', label: '动态', icon: MessageCircle },
  { path: '/profile', label: '我的', icon: User }
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around">
        {navItems.map((item) => {
          const isGuidePath =
            location.pathname === '/ai-trip-planner' || location.pathname.startsWith('/ai-trip-planner/');
          const isActive = item.path === '/ai-trip-planner' ? isGuidePath : location.pathname === item.path;
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
              className={`flex h-full flex-1 flex-col items-center justify-center transition-colors ${
                isActive ? 'text-emerald-500' : 'text-slate-400'
              }`}
            >
              {item.customIcon
                ? item.customIcon(isActive)
                : item.icon && <item.icon size={22} className={`transition-transform ${isActive ? 'scale-110' : ''}`} />}
              <span className="mt-1 whitespace-nowrap text-[11px]">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
