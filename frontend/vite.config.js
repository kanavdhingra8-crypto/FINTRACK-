import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envDir: '..',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('/node_modules/recharts/')
            || id.includes('/node_modules/d3-')
            || id.includes('/node_modules/victory-vendor/')
          ) {
            return 'charts';
          }
          if (id.includes('/node_modules/')) return 'vendor';
          return undefined;
        },
      },
    },
  },
});
