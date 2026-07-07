// Preload script - the ONLY bridge between the sandboxed renderer and the
// main process. It runs with contextIsolation on, so anything it exposes must
// go through contextBridge into an isolated world; the renderer never gets
// direct access to Node, ipcRenderer, or the preload's own scope.
//
// Deliberately minimal: this app's data layer is Supabase over HTTPS/WSS
// straight from the renderer (the anon key is safe to ship - RLS is the real
// gate), so the desktop shell needs no privileged IPC at all. We expose only
// read-only, non-sensitive facts so the UI can know it's running in the
// desktop app if it ever wants to. No functions that touch the filesystem,
// shell, or Node are bridged, because none are needed.
const { contextBridge } = require('electron')

const appModeArg = process.argv.find((arg) => arg.startsWith('--app-mode='))
const appMode = appModeArg ? appModeArg.split('=')[1] : 'local'

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  appMode,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
})
