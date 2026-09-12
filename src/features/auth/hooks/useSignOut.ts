import { useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { accountMessage } from '../utils/accountMessages'

/**
 * There was no way out of the app before this. On a phone left on the bench at
 * a pitch, a session nobody can end is the whole account.
 *
 * `AuthProvider` listens to `onAuthStateChange`, so the screen follows the
 * signed-out state on its own — there is nothing to navigate and nothing to
 * invalidate here.
 */
export function useSignOut() {
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signOut() {
    setLeaving(true)
    setError(null)
    // See `useUpdateEmail`: gotrue's lock throws instead of returning, and a
    // stuck `leaving` is a sign-out button that no longer signs out.
    try {
      const { error } = await supabase.auth.signOut()
      if (error) setError(accountMessage(error, 'signout'))
    } finally {
      setLeaving(false)
    }
  }

  return { signOut, leaving, error }
}
