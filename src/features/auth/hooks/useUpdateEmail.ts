import { useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { accountMessage } from '../utils/accountMessages'

/**
 * `updateUser({ email })` does not change the account's address. It records a
 * pending change and sends a confirmation link; until the customer clicks it,
 * the account still carries the old address, or none at all.
 *
 * So `sentTo` means "the message went to this address", never "this address
 * works". The screen has to say the same thing — an address shown as active
 * that receives nothing is the product claiming something it is not doing
 * (spec §3.2).
 *
 * It is the address rather than a boolean because a boolean could never turn
 * itself off. The link can be opened anywhere — the customer saves on the
 * phone and confirms on a desktop — and the phone can only find out by
 * comparing: once the account's active address is the one we wrote to, the
 * waiting notice has become the same lie in the other direction.
 */
export function useUpdateEmail() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function setEmail(email: string) {
    const address = email.trim().toLowerCase()
    setSaving(true)
    setError(null)
    setSentTo(null)
    // `finally`, because `updateUser` runs inside gotrue's `_acquireLock` and
    // its `NavigatorLockAcquireTimeoutError` is thrown rather than returned:
    // two tabs of the app contending would otherwise leave `saving` true and
    // the button dead until the page is reloaded.
    try {
      const { error } = await supabase.auth.updateUser({ email: address })
      if (error) setError(accountMessage(error, 'email'))
      else setSentTo(address)
    } finally {
      setSaving(false)
    }
  }

  /**
   * What is left of the last attempt does not describe the address being typed
   * now. The screen calls this while the customer edits the field: a red note
   * about an address already taken must not sit under a different one.
   */
  function reset() {
    setError(null)
    setSentTo(null)
  }

  return { setEmail, reset, saving, error, sentTo }
}
