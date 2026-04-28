import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3001,
    allowedHosts: ['.modal.host', 'localhost', '127.0.0.1'],
  },
});
