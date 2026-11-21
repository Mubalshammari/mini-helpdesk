# Mini Helpdesk Preview

Open [index.html](https://github.com/Mubalshammari/mini-helpdesk/raw/refs/heads/main/preview/index.html) in a browser for the self-contained demo. The role picker includes an administrator, an IT support agent and an employee. All three use the same fictional workspace on this device. Keep this copy of the file in the same location to continue with your changes.

## Windows setup

Build the installer on Windows x64 with Node.js 24 from the root of this repository.

```powershell
cd preview
npm ci
npm run setup:windows
```

Open `dist/Mini-Helpdesk-Preview-Setup-x64.exe` and follow the wizard. You can then open **Mini Helpdesk Preview** from Start. The installed preview runs offline and keeps its demo data in your Windows profile. The download is unsigned.

The desktop app loads the same [HTML file](index.html) as the browser preview. [main.cjs](main.cjs) defines the desktop window and the local application address. The company application and its Supabase setup are documented in the [project README](../README.md#connected-application).
