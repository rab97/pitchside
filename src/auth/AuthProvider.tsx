import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useFacility } from '../tenant/FacilityProvider'

type AuthState = { session: Session | null; isAdmin: boolean; loading: boolean }
const Ctx = createContext<AuthState>({ session: null, isAdmin: false, loading: true })

export function useAuth(): AuthState {
  return useContext(Ctx)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const facility = useFacility()
  const [state, setState] = useState<AuthState>(
    { session: null, isAdmin: false, loading: true })

  useEffect(() => {
    let alive = true

    async function refresh(session: Session | null) {
      if (!session) {
        if (alive) setState({ session: null, isAdmin: false, loading: false })
        return
      }
      // La policy admins_read_self limita la riga a chi la sta chiedendo:
      // il risultato è "sono admin di questa struttura", non l'elenco.
      const { data } = await supabase
        .from('facility_admins')
        .select('role')
        .eq('facility_id', facility.id)
        .eq('user_id', session.user.id)
        .maybeSingle()
      if (alive) setState({ session, isAdmin: !!data, loading: false })
    }

    supabase.auth.getSession().then(({ data }) => refresh(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => refresh(s))
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [facility.id])

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}
