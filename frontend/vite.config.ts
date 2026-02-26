import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // 🌍 环境适配：
  // - 本地开发：base = '/static/react-build/' (FastAPI 提供静态文件)
  // - 生产环境：base = '/' (Nginx 直接提供静态文件)
  base: mode === 'production' ? '/' : '/static/react-build/',
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    // ★ P1: 预构建关键依赖，提升首屏加载速度
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'zustand',
      '@tanstack/react-query',
    ],
    // ★ P1: 排除大体积依赖的预构建（按需加载）
    exclude: [
      'react-syntax-highlighter',
    ],
  },
  build: {
    outDir: '../static/react-build',
    emptyOutDir: true,
    // ★ P1: 源码映射（生产环境关闭）
    sourcemap: mode === 'development',
    // ★ P1: 压缩选项（使用 esbuild，更快）
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // ★ P1: 代码分割策略
        manualChunks: {
          // 核心框架（首屏必需）
          'core-vendor': ['react', 'react-dom', 'react-router-dom'],
          // UI 库（异步加载）
          'ui-vendor': ['antd'],
          // 状态管理（首屏必需）
          'state-vendor': ['zustand', '@tanstack/react-query'],
          // Markdown 渲染（大体积，独立 chunk）
          'markdown-renderer': [
            'react-markdown',
            'rehype-sanitize',
            'rehype-highlight',
            'remark-gfm',
          ],
          // 语法高亮（最大体积，独立 chunk）
          'syntax-highlighter': ['react-syntax-highlighter'],
        },
        // ★ P1: 资源文件名哈希策略
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name || ''
          if (info.endsWith('.css')) {
            return 'assets/[name]-[hash][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
    // ★ P1:  chunk 大小警告阈值
    chunkSizeWarningLimit: 500,
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
  },
  // ★ P1: 预览配置
  preview: {
    port: 4173,
    strictPort: true,
  },
}))
