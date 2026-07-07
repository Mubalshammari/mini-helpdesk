import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { playNotificationSound } from '../lib/notificationSound'

const ROW_LIMIT = 50

export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const isInitialLoad = useRef(true)

  const fetchNotifications = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    // actor_id and recipient_id both reference profiles, so the embed needs
    // a column hint (!actor_id) to tell PostgREST which of the two FKs to
    // follow - without it, the relationship is ambiguous and the query
    // errors instead of guessing.
    const { data, error } = await supabase
      .from('notifications')
      .select('*, actor:profiles!actor_id(full_name), ticket:tickets(title)')
      .order('created_at', { ascending: false })
      .limit(ROW_LIMIT)

    if (!error) setNotifications(data)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  useEffect(() => {
    if (!userId) return

    isInitialLoad.current = true

    // RLS (notifications_select_own) already guarantees this client can
    // only ever receive realtime events for its own rows - the recipient_id
    // filter here is a query-efficiency narrowing, not the security
    // boundary. See supabase/migrations/0003_notifications.sql.
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` },
        async (payload) => {
          // The realtime payload doesn't include the actor/ticket embeds
          // used elsewhere, so it's fetched once to keep the shape
          // consistent with the initial list rather than special-casing
          // "notifications that arrived live" in every consumer of this hook.
          const { data } = await supabase
            .from('notifications')
            .select('*, actor:profiles!actor_id(full_name), ticket:tickets(title)')
            .eq('id', payload.new.id)
            .single()

          if (data) {
            setNotifications((prev) => [data, ...prev])
            if (!isInitialLoad.current) playNotificationSound(data.type)
          }
        }
      )
      .subscribe()

    // A brief window where "just subscribed" shouldn't play a sound for
    // whatever the initial fetch already showed, only for what arrives
    // after the user is actively looking at a live session.
    const initialLoadTimer = setTimeout(() => {
      isInitialLoad.current = false
    }, 2000)

    return () => {
      clearTimeout(initialLoadTimer)
      supabase.removeChannel(channel)
    }
  }, [userId])

  const markAsRead = useCallback(async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  }, [])

  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    if (unreadIds.length === 0) return
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
  }, [notifications])

  const unreadCount = notifications.filter((n) => !n.read).length

  return { notifications, loading, unreadCount, markAsRead, markAllAsRead }
}
