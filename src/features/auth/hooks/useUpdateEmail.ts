import { useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { accountMessage } from '../utils/accountMessages'

/**
 * `updateUser({ email })` does not change the account's address. It records a
 * pending change and sends a confirmation link; until the customer clicks it,
 * the account still carries the old address, or none at all.
 *
 * So `sent` means "the message has gone out", never "the address works". The
 * screen has to say the same thing — an address shown as active that receives
 * nothing is the product claiming something it is not doing (spec §3.2).
 */
export function useUpdateEmail() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function setEmail(email: string) {
    setSaving(true)
    setError(null)
    setSent(false)
    const { error } = await supabase.auth.updateUser({
      email: email.trim().toLowerCase(),
    })
    if (error) setError(accountMessage(error, 'email'))
    else setSent(true)
    setSaving(false)
  }

  return { setEmail, saving, error, sent }
}
