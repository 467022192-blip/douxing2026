import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const showBadge = env.VITE_SHOW_TRAE_BADGE === 'true';
  const devApiProxyTarget = env.VITE_DEV_API_PROXY_TARGET || 'https://douxing2026.vercel.app';

  return {
    server: {
      proxy: {
        '/api': {
          target: devApiProxyTarget,
          changeOrigin: true,
          secure: true
        }
      }
    },
    build: {
      sourcemap: 'hidden',
      rollupOptions: {
        output: {
          manualChunks: {
            router: ['react-router-dom'],
            supabase: ['@supabase/supabase-js'],
            motion: ['framer-motion'],
            icons: ['lucide-react'],
            virtual: ['react-window', 'react-virtualized-auto-sizer']
          }
        }
      }
    },
    plugins: [
      react({
        babel: {
          plugins: ['react-dev-locator']
        }
      }),
      ...(showBadge
        ? [
            traeBadgePlugin({
              variant: 'dark',
              position: 'bottom-right',
              prodOnly: true,
              clickable: true,
              clickUrl: 'https://www.trae.ai/solo?showJoin=1',
              autoTheme: true,
              autoThemeTarget: '#root'
            })
          ]
        : []),
      tsconfigPaths()
    ]
  };
});
