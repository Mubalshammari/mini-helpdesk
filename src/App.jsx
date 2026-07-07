import { Routes, Route, Navigate } from 'react-router-dom'
import AppRouter from './components/AppRouter'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { NotificationsProvider } from './context/NotificationsContext'
import { RefreshProvider } from './context/RefreshContext'
import { LiveSyncProvider } from './context/LiveSyncContext'
import { NewTicketProvider } from './context/NewTicketContext'
import ProtectedRoute from './components/ProtectedRoute'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import TicketsPage from './pages/TicketsPage'
import TicketDetailPage from './pages/TicketDetailPage'
import AuditLogPage from './pages/AuditLogPage'
import ManageUsersPage from './pages/ManageUsersPage'
import NotFoundPage from './pages/NotFoundPage'

// Routes by role:
//   everyone:  / (dashboard), /tickets, /tickets/:id
//   IT staff:  /audit-log
//   admin:     /users
// The redirects at the bottom keep every URL from earlier iterations of the
// app working - bookmarks and muscle memory don't break on a restructure.
export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppRouter>
          <AuthProvider>
            <NotificationsProvider>
              <RefreshProvider>
                <LiveSyncProvider>
                <NewTicketProvider>
                  <Routes>
                    <Route path="/login" element={<AuthPage />} />

                    <Route
                      path="/"
                      element={
                        <ProtectedRoute>
                          <DashboardPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/tickets"
                      element={
                        <ProtectedRoute>
                          <TicketsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/tickets/:id"
                      element={
                        <ProtectedRoute>
                          <TicketDetailPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/audit-log"
                      element={
                        <ProtectedRoute staffOnly>
                          <AuditLogPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/users"
                      element={
                        <ProtectedRoute adminOnly>
                          <ManageUsersPage />
                        </ProtectedRoute>
                      }
                    />

                    <Route path="/dashboard" element={<Navigate to="/" replace />} />
                    <Route path="/it" element={<Navigate to="/tickets" replace />} />
                    <Route path="/it/audit-log" element={<Navigate to="/audit-log" replace />} />
                    <Route path="/admin" element={<Navigate to="/tickets" replace />} />
                    <Route path="/admin/audit-log" element={<Navigate to="/audit-log" replace />} />
                    <Route path="/admin/users" element={<Navigate to="/users" replace />} />

                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </NewTicketProvider>
                </LiveSyncProvider>
              </RefreshProvider>
            </NotificationsProvider>
          </AuthProvider>
        </AppRouter>
      </ToastProvider>
    </ThemeProvider>
  )
}
