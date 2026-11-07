import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Single root .env (ADR-008); Vite exposes only VITE_* variables to the bundle.
  envDir: '../..',
  server: { port: 5173, strictPort: true },
});
