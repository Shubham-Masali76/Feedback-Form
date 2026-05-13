import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  server: {
    watch: {
      ignored: [
        '**/src/utils/**',
        '**/src/hooks/**',
        '**/src/components/HodDashboard/**',
        '**/src/components/AdminDashboard/**',
        '**/src/components/StudentDashboard/**'
      ],
      usePolling: false,
    },
  },
  base: '/feedback/',
})
