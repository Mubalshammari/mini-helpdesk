import AppShell from '../components/layout/AppShell'
import { useAuditLog } from '../hooks/useAuditLog'
import { usePageTitle } from '../hooks/usePageTitle'
import { useRefreshable } from '../context/RefreshContext'
import AuditLogTable from '../components/staff/AuditLogTable'

export default function AuditLogPage() {
  usePageTitle('Audit log')
  const { entries, loading, error, refetch, rowLimit } = useAuditLog()
  useRefreshable('audit-log', refetch)

  return (
    <AppShell>
      <div className="page-intro">
        <h1>Audit trail</h1>
        <p>Assignment, status and ticket edits in the order they happened.</p>
      </div>
      <div className="sheet audit-feed">
        {error ? (
          <p role="alert">
            Couldn’t load the audit trail. <button onClick={refetch}>Try again</button>
          </p>
        ) : (
          <AuditLogTable entries={entries} loading={loading} rowLimit={rowLimit} />
        )}
      </div>
    </AppShell>
  )
}
