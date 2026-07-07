import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// build:desktop sets BUILD_TARGET=desktop. The desktop bundle is loaded from
// file:// (APP_MODE=local), so assets must resolve relatively (base './');
// the web bundle is served from a site root (base '/').
const isDesktop = process.env.BUILD_TARGET === 'desktop'

// Strict CSP, injected into the built index.html for BOTH web and desktop.
// Kept in sync with the CSP in electron/main.cjs. 'unsafe-inline' is styles-
// only (React inline style attributes + Google Fonts); scripts are 'self'
// with no eval.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://fonts.googleapis.com https://fonts.gstatic.com",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
].join('; ')

// apply: 'build' means this runs for `vite build` only, never `vite dev` -
// so HMR/React-Refresh (which need inline scripts + eval) aren't blocked in
// development, while every production artifact ships with the strict CSP.
function injectCsp() {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '</head>',
        `  <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n  </head>`
      )
    },
  }
}

export default defineConfig({
  base: isDesktop ? './' : '/',
  plugins: [react(), injectCsp()],
  build: {
    // Chromium (Electron) and every current browser support <link
    // rel="modulepreload"> natively, so Vite's polyfill - which it would
    // otherwise emit as an INLINE <script> and thus violate script-src
    // 'self' - is unnecessary and disabled.
    modulePreload: { polyfill: false },
  },
  server: {
    port: 6234,
    strictPort: true,
  },
})
