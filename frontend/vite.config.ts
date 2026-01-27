import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../static/react-build',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          antd: ['antd'],
          markdown: ['react-markdown', 'rehype-sanitize', 'rehype-highlight', 'remark-gfm', 'react-syntax-highlighter']
        }
      }
    }
  },
  server: {
    proxy: {
      // SSE 代理（需要特殊配置）
      '/api/sse': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // SSE 请求需要保持连接
            if (req.headers.accept === 'text/event-stream') {
              proxyReq.setHeader('Connection', 'keep-alive');
              proxyReq.setHeader('Cache-Control', 'no-cache');
              proxyReq.setHeader('Accept', 'text/event-stream');
            }
          });
          // ✅ 关键：确保 SSE 响应头正确传递
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // 如果是 SSE 请求，确保响应头正确设置
            if (req.headers.accept === 'text/event-stream') {
              // 确保 Content-Type 正确传递
              if (proxyRes.headers['content-type']) {
                res.setHeader('Content-Type', proxyRes.headers['content-type']);
              } else {
                res.setHeader('Content-Type', 'text/event-stream');
              }
              // 确保其他 SSE 必需的响应头
              res.setHeader('Cache-Control', 'no-cache, no-transform');
              res.setHeader('Connection', 'keep-alive');
              res.setHeader('X-Accel-Buffering', 'no');
              // ✅ 禁用响应缓冲，确保流式传输
              res.flushHeaders();
            }
          });
          // ✅ 禁用代理超时，允许长连接
          // proxy.proxyTimeout = 0; // 无超时限制 - 此属性在 vite proxy 中不存在
          proxy.on('error', (err) => {
            console.error('[vite-proxy] SSE proxy error:', err);
          });
        },
      },
      // 其他 API 请求
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    }
  }
})
