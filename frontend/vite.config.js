import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'path';
import { renameSync, existsSync } from 'fs';

function renameToDashboard() {
  return {
    name: 'rename-to-dashboard',
    closeBundle() {
      const outDir = resolve(__dirname, 'dist');
      const src = resolve(outDir, 'index.html');
      const dest = resolve(__dirname, '..', 'dashboard.html');
      if (existsSync(src)) {
        renameSync(src, dest);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), viteSingleFile(), renameToDashboard()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8420',
      '/ws': { target: 'ws://localhost:8420', ws: true },
      '/fonts': 'http://localhost:8420',
    },
  },
});
