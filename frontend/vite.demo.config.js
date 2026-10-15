// TEMPORARY build config for the /demo/ GitHub Pages deploy ONLY.
// Externalizes vendor deps (loaded via importmap from esm.sh) so the app
// bundle stays small. NOT for the shipped product — do not commit.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/laravel-react-salon-booking/demo/',
  build: {
    outDir: 'dist-demo',
    rollupOptions: {
      external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', 'react-router-dom', 'axios'],
    },
  },
});
