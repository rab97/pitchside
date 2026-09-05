import type { ReactNode } from 'react'
import { useAuth } from './AuthProvider'
import { LoginPage } from './LoginPage'

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, isAdmin, loading } = useAuth()
  if (loading) return <div className="p-8 text-muted">Caricamento…</div>
  if (!session) return <LoginPage />
  if (!isAdmin) {
    return (
      <div className="p-8">
        <p className="font-medium">Non hai accesso a questa pagina.</p>
        <p className="text-muted text-sm mt-1">
          Chiedi al titolare dell’impianto di abilitare il tuo numero.
        </p>
      </div>
    )
  }
  return <>{children}</>
}
