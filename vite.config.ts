import { defineConfig } from 'vite';

export default defineConfig({
  build: { target: 'es2022' },
  esbuild: { jsx: 'automatic' },
  server: {
    allowedHosts: ['.trycloudflare.com'],
  },
  preview: {
    host: '0.0.0.0',
    port: process.env.PORT ? Number(process.env.PORT) : 4173,
    strictPort: true,
    proxy: {
      '/fetchDevices': {
        target: 'http://127.0.0.1:9000',
        changeOrigin: true,
        secure: false,
      },
      '/fetchRules': {
        target: 'http://127.0.0.1:9000',
        changeOrigin: true,
        secure: false,
      },
      '/fetchGrants': {
        target: 'http://127.0.0.1:9000',
        changeOrigin: true,
        secure: false,
      },
      '/commandDevice': {
        target: 'http://127.0.0.1:9000',
        changeOrigin: true,
        secure: false,
      },
      '/approveWhyCard': {
        target: 'http://127.0.0.1:9000',
        changeOrigin: true,
        secure: false,
      },
      '/dismissWhyCard': {
        target: 'http://127.0.0.1:9000',
        changeOrigin: true,
        secure: false,
      },
      '/pollFeed': {
        target: 'http://127.0.0.1:9000',
        changeOrigin: true,
        secure: false,
      },
      '/submitSentence': {
        target: 'http://127.0.0.1:9000',
        changeOrigin: true,
        secure: false,
      },
      '/saveRule': {
        target: 'http://127.0.0.1:9000',
        changeOrigin: true,
        secure: false,
      },
      '/postWhyOverride': {
        target: 'http://127.0.0.1:9000',
        changeOrigin: true,
        secure: false,
      },
      '/createGrant': {
        target: 'http://127.0.0.1:9000',
        changeOrigin: true,
        secure: false,
      },
      '/triggerSos': {
        target: 'http://127.0.0.1:9000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
});
