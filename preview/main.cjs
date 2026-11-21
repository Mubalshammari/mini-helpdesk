const { app, BrowserWindow, dialog, protocol, session } = require('electron')
const { readFile } = require('node:fs/promises')
const path = require('node:path')

const home = 'helpdesk://workspace/'
const productName = 'Mini Helpdesk Preview'
let mainWindow

app.setName(productName)
app.setPath('userData', path.join(app.getPath('appData'), productName))
protocol.registerSchemesAsPrivileged([{
  scheme: 'helpdesk',
  privileges: { standard: true, secure: true, supportFetchAPI: true },
}])

function isWorkspace(url) {
  try {
    return new URL(url).href.split('#')[0] === home
  } catch {
    return false
  }
}

function focusWorkspace() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

async function start() {
  const page = await readFile(path.join(__dirname, 'index.html'))
  const workspaceSession = session.defaultSession
  protocol.handle('helpdesk', request => {
    if (request.method !== 'GET' || !isWorkspace(request.url)) {
      return new Response('Not found', { status: 404 })
    }
    return new Response(page, { headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
    } })
  })
  function mayCopy(contents, permission) {
    return permission === 'clipboard-sanitized-write' && isWorkspace(contents?.getURL())
  }
  workspaceSession.setPermissionCheckHandler(mayCopy)
  workspaceSession.setPermissionRequestHandler((contents, permission, respond) => {
    respond(mayCopy(contents, permission))
  })
  app.setAppUserModelId('com.minihelpdesk.preview')
  mainWindow = new BrowserWindow({
    title: 'Mini Helpdesk',
    width: 1320, height: 860, minWidth: 720, minHeight: 540,
    backgroundColor: '#f5f4ef', show: false, autoHideMenuBar: true,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, webviewTag: false },
  })
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isWorkspace(url)) event.preventDefault()
  })
  mainWindow.once('ready-to-show', focusWorkspace)
  mainWindow.on('closed', () => { mainWindow = null })
  await mainWindow.loadURL(home)
}

// Separate the preview from any company installation and its stored sessions.
if (process.platform === 'win32' && !app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', focusWorkspace)
  app.on('window-all-closed', () => app.quit())
  app.whenReady().then(start).catch(error => {
    dialog.showErrorBox('Mini Helpdesk could not open', error.message)
    app.quit()
  })
}
