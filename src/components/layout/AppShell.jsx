import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import '../../overview.css'

export default function AppShell({ children }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('mh-sidebar-collapsed') === '1')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem('mh-sidebar-collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  useEffect(() => {
    if (!mobileNavOpen) return
    const desktop = window.matchMedia('(min-width: 1024px)')
    function closeDesktopDrawer(event) {
      if (event.matches) setMobileNavOpen(false)
    }
    desktop.addEventListener('change', closeDesktopDrawer)
    return () => desktop.removeEventListener('change', closeDesktopDrawer)
  }, [mobileNavOpen])

  return (
    <div className="workspace flex min-h-dvh">
      <a
        className="skip-link"
        href="#workspace-main"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('workspace-main')?.focus()
        }}
      >
        Skip to content
      </a>
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main id="workspace-main" tabIndex={-1} className="workspace-main">
          {children}
        </main>
      </div>
    </div>
  )
}
