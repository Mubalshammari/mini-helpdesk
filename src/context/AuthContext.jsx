import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, created_at')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Failed to load profile', error)
    return null
  }
  return data
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return
      setSession(session)
      if (session?.user) {
        setProfile(await fetchProfile(session.user.id))
      }
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return
      setSession(session)
      if (session?.user) {
        setProfile(await fetchProfile(session.user.id))
      } else {
        setProfile(null)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUp = useCallback(async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw error
    // If email confirmation is enabled on the project, signUp() returns a
    // user but no session (identities array is also empty for a duplicate
    // signup attempt) - the caller uses this to decide whether to show a
    // "check your email" message or proceed straight to the dashboard.
    return { needsEmailConfirmation: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    // isAdmin: the top tier only - can manage user roles (see set_user_role()
    // in supabase/migrations/0002_role_tiers.sql). isStaff: 'it' or 'admin' -
    // can handle tickets (view all, change status/priority, read audit log).
    // Every admin is also staff; not every staff member is an admin.
    isAdmin: profile?.role === 'admin',
    isStaff: profile?.role === 'it' || profile?.role === 'admin',
    loading,
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
