import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error(
    'VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY mancanti: copia .env.local.example in .env.local.',
  )
}

export const supabase = createClient<Database>(url, key)
