import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Google Analytics 4. The measurement ID is public (it ships in every page).
const GA_ID = 'G-1C9XVVLQLX'

// Adds the GA tag to every HTML page in the production build, so local dev
// visits aren't counted.
const googleAnalytics = {
  name: 'google-analytics',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'script',
      attrs: {
        async: true,
        src: `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`,
      },
      injectTo: 'head',
    },
    {
      tag: 'script',
      children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}');`,
      injectTo: 'head',
    },
  ],
}

export default defineConfig({
  plugins: [react(), googleAnalytics],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        log: resolve(__dirname, 'log/index.html'),
        gvisorSyscall: resolve(__dirname, 'gvisor-syscall/index.html'),
      },
    },
  },
})
