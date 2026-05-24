import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

type AuthMode = 'login' | 'register';

export default function Login() {
  const navigate = useNavigate();
  const { loginWithEmail, registerWithEmail, loginAsGuest } = useAuthStore();
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  // 表单数据
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nickname: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const emailPrefix = formData.email.split('@')[0] || '新用户';

    try {
      if (mode === 'login') {
        const { error } = await loginWithEmail(formData.email, formData.password);
        if (error) {
          const shouldAutoRegister = window.confirm(
            '该邮箱可能尚未注册，是否为你创建账号并直接登录？\n\n如果你已注册，请取消并检查密码。'
          );

          if (!shouldAutoRegister) {
            setError(error.message || '登录失败，请检查邮箱和密码');
            return;
          }

          const { error: registerError, needsEmailConfirmation } = await registerWithEmail(
            formData.email,
            formData.password,
            emailPrefix
          );

          if (registerError) {
            setError(registerError.message || '创建账号失败，请稍后重试');
          } else if (needsEmailConfirmation) {
            setRegistrationSuccess(true);
          } else {
            navigate('/profile');
          }
        } else {
          navigate('/profile');
        }
      } else {
        if (!formData.nickname.trim()) {
          setError('请输入昵称');
          setIsLoading(false);
          return;
        }
        const { error, needsEmailConfirmation } = await registerWithEmail(
          formData.email,
          formData.password,
          formData.nickname
        );
        if (error) {
          setError(error.message || '注册失败，请稍后重试');
        } else if (needsEmailConfirmation) {
          setRegistrationSuccess(true);
        } else {
          navigate('/profile');
        }
      }
    } catch {
      setError('操作失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
    setFormData({ email: '', password: '', nickname: '' });
  };

  if (registrationSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm max-w-md w-full text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">注册成功！</h2>
          <p className="text-gray-600 mb-6">
            验证邮件已发送至 <strong className="text-gray-800">{formData.email}</strong>。请查收邮件并点击验证链接，完成账号激活。
          </p>
          <button
            onClick={() => {
              setRegistrationSuccess(false);
              setMode('login');
            }}
            className="w-full py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors"
          >
            返回登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <div className="bg-white px-4 py-3 sticky top-0 z-10 shadow-sm flex items-center">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 hover:bg-gray-100 rounded-full"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold ml-2">
          {mode === 'login' ? '登录' : '注册'}
        </h1>
      </div>

      {/* 表单区域 */}
      <div className="p-6">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <span className="text-3xl text-white font-bold">迹</span>
          </div>
          <h2 className="text-xl font-bold text-gray-800">
            {mode === 'login' ? '欢迎回来' : '加入足迹'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {mode === 'login'
              ? '登录后记录你的旅行足迹'
              : '注册账号，开启你的打卡之旅'}
          </p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 邮箱 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              邮箱
            </label>
            <div className="relative">
              <Mail
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="请输入邮箱"
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* 密码 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              密码
            </label>
            <div className="relative">
              <Lock
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="请输入密码"
                required
                minLength={6}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">密码至少6位字符</p>
          </div>

          {/* 昵称（仅注册时显示） */}
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                昵称
              </label>
              <div className="relative">
                <User
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={formData.nickname}
                  onChange={(e) =>
                    setFormData({ ...formData, nickname: e.target.value })
                  }
                  placeholder="给自己起个名字"
                  required={mode === 'register'}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-4"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                处理中...
              </span>
            ) : mode === 'login' ? (
              '登录'
            ) : (
              '注册'
            )}
          </button>

          {/* 游客一键登录 */}
          <button
            type="button"
            onClick={async () => {
              setIsLoading(true);
              const { error } = await loginAsGuest();
              setIsLoading(false);
              if (error) {
                setError(error.message);
              } else {
                navigate(-1);
              }
            }}
            disabled={isLoading}
            className="w-full py-3 bg-white text-emerald-600 border-2 border-emerald-500 rounded-lg font-bold hover:bg-emerald-50 disabled:opacity-50 transition-colors"
          >
            游客一键免密登录
          </button>
        </form>

        {/* 切换模式 */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            {mode === 'login' ? '还没有账号？' : '已有账号？'}
            <button
              onClick={toggleMode}
              className="ml-1 text-emerald-500 font-medium hover:underline"
            >
              {mode === 'login' ? '立即注册' : '立即登录'}
            </button>
          </p>
        </div>

        {/* 游客模式提示 */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 text-center">
            登录后可以同步你的打卡数据，在不同设备间无缝切换
          </p>
        </div>
      </div>
    </div>
  );
}
