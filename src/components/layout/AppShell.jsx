import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function AppShell({ children }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('mh-sidebar-collapsed') === '1')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem('mh-sidebar-collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  return (
    <div className="flex min-h-dvh bg-stone-50 dark:bg-stone-950">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  )
}
