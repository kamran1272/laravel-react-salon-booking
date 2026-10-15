// TEMPORARY build config for the /demo/ GitHub Pages deploy ONLY.
// Externalizes vendor deps (loaded via importmap from esm.sh) so the app
// bundle stays small. NOT for the shipped product — do not commit.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Injects the esm.sh import map into the demo's index.html so the
// externalized vendor imports (react, react-dom, react-router-dom, axios)
// resolve in the browser. Also sets the demo page title.
function demoImportmap() {
  return {
    name: 'demo-importmap',
    transformIndexHtml(html) {
      const importmap = `<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@18.3.1",
    "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
    "react-dom": "https://esm.sh/react-dom@18.3.1",
    "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
    "react-router-dom": "https://esm.sh/react-router-dom@6.26.0?external=react,react-dom",
    "axios": "https://esm.sh/axios@1.7.0"
  }
}
</script>`;
      return html
        .replace('<title>Salon Booking System</title>', '<title>Salon Booking System — Live Demo</title>')
        .replace('</title>', '</title>\n    ' + importmap);
    },
  };
}

export default defineConfig({
  plugins: [react(), demoImportmap()],
  base: '/laravel-react-salon-booking/demo/',
  build: {
    outDir: 'dist-demo',
    rollupOptions: {
      external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', 'react-router-dom', 'axios'],
    },
  },
});
