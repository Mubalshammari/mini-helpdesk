import { useEffect } from 'react'

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Mini Helpdesk` : 'Mini Helpdesk'
    return () => {
      document.title = 'Mini Helpdesk'
    }
  }, [title])
}
