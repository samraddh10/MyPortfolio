import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // three.js loads as its own lazy chunk (~700 kB) after the page is up
    chunkSizeWarningLimit: 800,
  },
});
