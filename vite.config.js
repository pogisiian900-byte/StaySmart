import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/', // Use absolute paths for Vercel
  build: {
    cssCodeSplit: false, // Disable CSS code splitting to ensure all CSS is bundled
    cssMinify: true,
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js'
      }
    }
  },
  // Ensure proper handling of static assets
  publicDir: 'public'
})
