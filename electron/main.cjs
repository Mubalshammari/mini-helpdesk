// Electron main process. CommonJS (.cjs) on purpose: package.json has
// "type": "module", so a plain .js here would be treated as ESM and Electron's
// ESM support is version-dependent - .cjs is unambiguous and works everywhere.
const { app, BrowserWindow, shell, session } = require('electron')
const path = require('node:path')

// APP_MODE decides what the window loads:
//   local  (default) - the bundled Vite build (dist/), so the app is a real
//                      self-contained installed program that works offline
//                      against Supabase.
//   remote           - the deployed Netlify URL, so the desktop app always
//                      shows the latest deployed version with no reinstall.
// Both modes talk to the SAME Supabase project, so data is identical either
// way; Realtime + the in-app Refresh button keep views current.
const APP_MODE = process.env.APP_MODE || 'local'
const REMOTE_URL = process.env.APP_REMOTE_URL || 'https://mini-helpdesk.netlify.app'
// Set by the dev:desktop script so `electron .` points at the Vite dev server
// with HMR instead of a stale bundle.
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

// The single Supabase origin the renderer is allowed to reach. Kept in sync
// with connect-src in the CSP below. Wildcarded to the project's region host.
const SUPABASE_CONNECT = 'https://*.supabase.co wss://*.supabase.co'

function contentSecurityPolicy() {
  // Strict by intent: no remote scripts, no eval. 'unsafe-inline' is allowed
  // for STYLES only (React inline style attributes + the Google Fonts
  // stylesheet need it; there is no safe nonce path for inline style
  // attributes). Scripts are 'self' only - the entire JS bundle is
  // same-origin and nothing is eval'd.
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    `connect-src 'self' ${SUPABASE_CONNECT} https://fonts.googleapis.com https://fonts.gstatic.com`,
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join('; ')
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0c0a09', // stone-950, so no white flash before React paints
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      // The Electron security trifecta: the renderer runs as an isolated,
      // sandboxed context with no Node.js access. It can only reach the
      // main process through the narrow, explicit bridge in preload.cjs.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Deprecated @electron/remote is never enabled (it's off by default in
      // modern Electron and this project never adds it).
      webviewTag: false,
      // Expose APP_MODE to the preload via argv (sandboxed preload can read
      // process.argv but not the full environment).
      additionalArguments: [`--app-mode=${APP_MODE}`],
    },
  })

  win.once('ready-to-show', () => win.show())

  if (DEV_SERVER_URL) {
    win.loadURL(DEV_SERVER_URL)
  } else if (APP_MODE === 'remote') {
    win.loadURL(REMOTE_URL)
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  return win
}

app.whenReady().then(() => {
  // Enforce the CSP on every response, belt-and-suspenders with the <meta>
  // CSP baked into the built HTML - this one also covers the remote-mode
  // Netlify document and any subresource, regardless of what headers the
  // origin server sends.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [contentSecurityPolicy()],
      },
    })
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // Standard on Windows/Linux: quit when the last window closes.
  if (process.platform !== 'darwin') app.quit()
})

// Security hardening for navigation and popups, per the Electron security
// checklist:
app.on('web-contents-created', (_event, contents) => {
  // 1. Never let the app itself navigate away from its own origin - a
  //    hijacked link or injected script can't turn the window into an
  //    arbitrary browser. In-app SPA navigation (hash/history) is unaffected
  //    because it doesn't fire will-navigate to a different origin.
  contents.on('will-navigate', (event, url) => {
    const allowed = DEV_SERVER_URL || (APP_MODE === 'remote' ? REMOTE_URL : 'file://')
    if (!url.startsWith(allowed)) event.preventDefault()
  })

  // 2. window.open / target=_blank opens in the user's real browser, never
  //    in a new unsandboxed Electron window. Only http(s) links open at all.
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // 3. Refuse attaching <webview> and disallow new WebContents entirely.
  contents.on('will-attach-webview', (event) => event.preventDefault())
})
