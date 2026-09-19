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
  },
});
