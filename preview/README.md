# Mini Helpdesk Preview

[Download the HTML preview](https://github.com/Mubalshammari/mini-helpdesk/releases/download/preview-v1.0.0/Mini-Helpdesk-Preview.html) and open it in your browser. The role picker includes an administrator, an IT support agent and an employee. All three use the same fictional workspace on this device. Keep this copy of the file in the same location to continue with your changes.

## Windows setup

[Download Windows setup (x64)](https://github.com/Mubalshammari/mini-helpdesk/releases/download/preview-v1.0.0/Mini-Helpdesk-Preview-Setup-x64.exe), open the file and follow the wizard. Launch **Mini Helpdesk Preview** from Start. The installed app runs offline and keeps its demo data in your Windows profile. The installer is unsigned.

To build your own installer on Windows x64, install Node.js 24 and run these commands from the repository root.

```powershell
cd preview
npm ci
npm run setup:windows
```

The build produces `dist/Mini-Helpdesk-Preview-Setup-x64.exe`.

The desktop app loads the same [HTML file](index.html) as the browser preview. [main.cjs](main.cjs) defines the desktop window and the local application address. The company application and its Supabase setup are documented in the [project README](../README.md#connected-application).
