import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { initTestHelpers } from './utils/testHelpers'
import { initMonitoring } from './utils/monitoring'
import { env, getMissingCriticalEnv } from './config/env'

initMonitoring();

if (env.isDev) {
  initTestHelpers();
}

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      const missing = getMissingCriticalEnv();
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="text-gray-900 font-semibold text-lg mb-2">页面出错了</div>
            <div className="text-gray-600 text-sm mb-4">
              请刷新重试。如果问题持续出现，可以把错误信息反馈给开发同学。
            </div>
            {missing.length > 0 && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
                缺少环境变量：{missing.join(', ')}
              </div>
            )}
            {env.isDev && (
              <pre className="text-xs text-red-600 whitespace-pre-wrap break-words bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
                {this.state.error?.stack || this.state.error?.toString()}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full h-10 rounded-xl bg-emerald-600 text-white text-sm font-medium"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
