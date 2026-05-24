import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  Settings,
  ChevronRight,
  LogOut,
  User,
  Lock,
  Bell,
  HelpCircle,
  Edit3,
  Award,
  Calendar,
  TrendingUp,
  Database
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useAuthStore } from '../../stores/authStore';
import { searchAttractions } from '../../services/supabaseService';
import type { Attraction } from '../../types';

export default function Profile() {
  const navigate = useNavigate();
  const { checkins, loadMockData } = useAppStore();
  const { user, isAuthenticated, logout, updateProfile } = useAuthStore();
  const [privacyEnabled, setPrivacyEnabled] = useState(user?.is_private || false);
  const [isEditing, setIsEditing] = useState(false);
  const [editNickname, setEditNickname] = useState(user?.nickname || '');
  const [visitedAttractionsData, setVisitedAttractionsData] = useState<Attraction[]>([]);

  // 获取去过的景区详情
  useEffect(() => {
    const visitedIds = checkins.filter((c) => c.status === 'visited').map((c) => c.attraction_id);
    if (visitedIds.length > 0) {
      searchAttractions('', visitedIds).then(data => {
        setVisitedAttractionsData(data);
      }).catch(console.error);
    } else {
      setVisitedAttractionsData([]);
    }
  }, [checkins]);

  // 同步隐私设置到用户资料
  useEffect(() => {
    if (user && user.is_private !== privacyEnabled) {
      updateProfile({ is_private: privacyEnabled });
    }
  }, [privacyEnabled, user, updateProfile]);

  // 计算统计数据
  const stats = {
    visited: checkins.filter((c) => c.status === 'visited').length,
    wantToVisit: checkins.filter((c) => c.status === 'want_to_visit').length,
    posts: 3, // 模拟已发布动态数
  };

  // 计算去过的省份数
  const visitedProvinces = new Set(
    visitedAttractionsData
      .map((a) => a.province)
      .filter(Boolean)
  ).size;

  // 计算打卡进度（去过 / 总5A景区数）
  const totalAttractions = 358; // 数据库中目前的总数
  const progressPercent = Math.round((stats.visited / totalAttractions) * 100);

  // 获取最近打卡的景区
  const recentCheckins = checkins
    .filter((c) => c.status === 'visited')
    .slice(-3)
    .map((c) => {
      const attraction = visitedAttractionsData.find((a) => a.id === c.attraction_id);
      return attraction;
    })
    .filter(Boolean);

  // 保存编辑的昵称
  const saveNickname = () => {
    if (editNickname.trim()) {
      updateProfile({ nickname: editNickname.trim() });
    }
    setIsEditing(false);
  };

  const menuItems = [
    {
      icon: User,
      label: '编辑资料',
      onClick: () => setIsEditing(true),
    },
    {
      icon: Lock,
      label: '隐私设置',
      description: '空间内容仅自己可见',
      rightElement: (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setPrivacyEnabled(!privacyEnabled);
          }}
          className={`w-11 h-6 rounded-full transition-colors ${
            privacyEnabled ? 'bg-emerald-500' : 'bg-gray-300'
          }`}
        >
          <div
            className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
              privacyEnabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      ),
    },
    {
      icon: Bell,
      label: '消息通知',
      onClick: () => {},
    },
    {
      icon: HelpCircle,
      label: '帮助与反馈',
      onClick: () => {},
    },
    {
      icon: Settings,
      label: '设置',
      onClick: () => {},
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 头部背景 */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-4 pt-12 pb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-white">我的</h1>
          <button className="p-2 text-white/80 hover:text-white">
            <Settings size={20} />
          </button>
        </div>

        {/* 用户信息 */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-white/20 border-4 border-white/30 overflow-hidden">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.nickname}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white">
                  <User size={40} />
                </div>
              )}
            </div>
            {isAuthenticated && (
              <button
                onClick={() => setIsEditing(true)}
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-full shadow-md flex items-center justify-center text-emerald-600"
              >
                <Edit3 size={14} />
              </button>
            )}
          </div>
          <div className="flex-1">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editNickname}
                  onChange={(e) => setEditNickname(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && saveNickname()}
                  className="px-3 py-1.5 rounded-lg text-gray-800 text-lg font-bold w-40 focus:outline-none focus:ring-2 focus:ring-white/50"
                  placeholder="输入昵称"
                  autoFocus
                />
                <button
                  onClick={saveNickname}
                  className="px-3 py-1.5 bg-white/20 text-white rounded-lg text-sm"
                >
                  保存
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-white">
                  {isAuthenticated ? user?.nickname || '游客' : '未登录'}
                </h2>
                <p className="text-white/70 text-sm mt-1">
                  {isAuthenticated ? '记录你的旅行足迹' : '登录后解锁更多功能'}
                </p>
              </>
            )}
            {isAuthenticated && (
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs text-white flex items-center gap-1">
                  <Award size={12} />
                  Lv.{Math.min(Math.floor(stats.visited / 5) + 1, 10)}
                </span>
                <span className="text-xs text-white/60">
                   joined {user?.created_at ? new Date(user.created_at).getFullYear() : '2024'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="mx-4 -mt-4 bg-white rounded-xl shadow-sm p-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">{stats.visited}</div>
            <div className="text-xs text-gray-500 mt-1">去过</div>
          </div>
          <div className="text-center border-x border-gray-100">
            <div className="text-2xl font-bold text-amber-500">{stats.wantToVisit}</div>
            <div className="text-xs text-gray-500 mt-1">想去</div>
          </div>
          <div className="text-center border-r border-gray-100">
            <div className="text-2xl font-bold text-blue-500">{visitedProvinces}</div>
            <div className="text-xs text-gray-500 mt-1">省份</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-500">{stats.posts}</div>
            <div className="text-xs text-gray-500 mt-1">动态</div>
          </div>
        </div>
      </div>

      {/* 打卡进度 */}
      {isAuthenticated && (
        <div className="mx-4 mt-4 bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-emerald-500" />
              <span className="font-medium text-gray-800">打卡进度</span>
            </div>
            <span className="text-sm text-gray-500">
              {stats.visited} / {totalAttractions}
            </span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            已完成 {progressPercent}% 的5A级景区打卡
          </p>
        </div>
      )}

      {/* 最近打卡 */}
      {recentCheckins.length > 0 && (
        <div className="mx-4 mt-4 bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-emerald-500" />
              <span className="font-medium text-gray-800">最近打卡</span>
            </div>
            <button className="text-sm text-emerald-600 flex items-center gap-1">
              查看全部 <ChevronRight size={14} />
            </button>
          </div>
          <div className="space-y-3">
            {recentCheckins.map((attraction, index) => (
              <div
                key={attraction?.id || index}
                className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
              >
                <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <MapPin size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{attraction?.name}</p>
                  <p className="text-xs text-gray-500">
                    📍 {attraction?.province} · {attraction?.city}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 功能菜单 */}
      <div className="mx-4 mt-4 bg-white rounded-xl shadow-sm overflow-hidden">
        {menuItems.map((item, index) => (
          <button
            key={item.label}
            onClick={item.onClick}
            className={`w-full flex items-center justify-between px-4 py-4 ${
              index !== menuItems.length - 1 ? 'border-b border-gray-100' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
                <item.icon size={18} />
              </div>
              <div className="text-left">
                <span className="text-gray-800 block">{item.label}</span>
                {item.description && (
                  <span className="text-xs text-gray-400">{item.description}</span>
                )}
              </div>
            </div>
            {item.rightElement || <ChevronRight size={18} className="text-gray-400" />}
          </button>
        ))}
      </div>

      {/* 开发者工具 - 仅在开发环境显示 */}
      {import.meta.env.DEV && (
        <div className="mx-4 mt-4 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
          <button
            onClick={() => loadMockData()}
            className="w-full px-4 py-4 flex items-center justify-between border-b border-gray-100"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
                <Database size={18} />
              </div>
              <div className="text-left">
                <span className="text-gray-800 block">加载模拟数据</span>
                <span className="text-xs text-gray-400">用于测试路线规划功能</span>
              </div>
            </div>
            <span className="text-xs text-purple-500 bg-purple-50 px-2 py-1 rounded">Dev</span>
          </button>
          
          <button
            onClick={() => {
              localStorage.removeItem('app-storage');
              window.location.reload();
            }}
            className="w-full px-4 py-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                <Settings size={18} />
              </div>
              <div className="text-left">
                <span className="text-red-600 block">清除本地缓存</span>
                <span className="text-xs text-gray-400">清空打卡数据并刷新</span>
              </div>
            </div>
            <span className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">Dev</span>
          </button>
        </div>
      )}

      {/* 关于 */}
      <div className="mx-4 mt-4 bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
              <MapPin size={18} />
            </div>
            <span className="text-gray-800">关于足迹</span>
          </div>
          <span className="text-sm text-gray-400">v1.0.0</span>
        </div>
      </div>

      {/* 退出登录 */}
      {isAuthenticated && (
        <div className="mx-4 mt-4">
          <button
            onClick={logout}
            className="w-full py-3 bg-white rounded-xl shadow-sm text-red-500 font-medium flex items-center justify-center gap-2"
          >
            <LogOut size={18} />
            退出登录
          </button>
        </div>
      )}

      {/* 未登录提示 */}
      {!isAuthenticated && (
        <div className="mx-4 mt-4">
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 bg-emerald-500 rounded-xl shadow-sm text-white font-medium"
          >
            登录 / 注册
          </button>
        </div>
      )}
    </div>
  );
}
