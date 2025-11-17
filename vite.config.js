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
        chunkFileNames: 'assets/[name]-[hash].js',
        manualChunks: (id) => {
          // Split node_modules into separate chunks
          if (id.includes('node_modules')) {
            // Firebase is large, put it in its own chunk
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }
            // React and React DOM together
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            // React Router
            if (id.includes('react-router')) {
              return 'vendor-router';
            }
            // PayPal SDK
            if (id.includes('@paypal')) {
              return 'vendor-paypal';
            }
            // Framer Motion
            if (id.includes('framer-motion')) {
              return 'vendor-framer';
            }
            // Other large libraries
            if (id.includes('jspdf') || id.includes('emailjs')) {
              return 'vendor-utils';
            }
            // All other node_modules
            return 'vendor';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000 // Increase warning limit to 1MB after manual chunking
  },
  // Ensure proper handling of static assets
  publicDir: 'public'
})
