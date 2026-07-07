import AppShell from '../components/layout/AppShell'
import { useAuditLog } from '../hooks/useAuditLog'
import { usePageTitle } from '../hooks/usePageTitle'
import { useRefreshable } from '../context/RefreshContext'
import AuditLogTable from '../components/staff/AuditLogTable'

export default function AuditLogPage() {
  usePageTitle('Audit log')
  const { entries, loading, refetch, rowLimit } = useAuditLog()
  useRefreshable('audit-log', refetch)

  return (
    <AppShell>
      <p className="text-sm text-stone-500 dark:text-stone-400">
        Every status, priority, title, and description change, in one immutable record.
      </p>

      <div className="mt-5">
        <AuditLogTable entries={entries} loading={loading} rowLimit={rowLimit} />
      </div>
    </AppShell>
  )
}
