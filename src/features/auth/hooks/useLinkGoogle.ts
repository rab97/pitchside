import { useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { accountMessage } from '../utils/accountMessages'

/**
 * Attaches a Google identity to the account the customer already has, so that
 * signing in with either door lands on the same person.
 *
 * Supabase links identities by itself when the verified emails match; this is
 * for the case it cannot cover — an account created with the SMS code, which
 * has no email to match on. The stake: Supabase never merges users, so once a
 * second account exists there is no undoing it.
 *
 * Manual linking is a beta feature and is off until it is enabled in the
 * project's auth configuration. When it is off this call fails, and the
 * screen says so: a button that silently does nothing is worse than one that
 * explains.
 *
 * Redirect target follows `LoginPage.tsx`'s `signInWithGoogle`: the current
 * location, not a hardcoded route — this hook is invoked from the profile
 * screen, so `window.location.pathname` already resolves to it.
 */
export function useLinkGoogle() {
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function linkGoogle() {
    setLinking(true)
    setError(null)
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${window.location.pathname}` },
    })
    if (error) setError(accountMessage(error, 'google'))
    setLinking(false)
  }

  return { linkGoogle, linking, error }
}
