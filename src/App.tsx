import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AdminPage } from './admin/AdminPage'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAdmin } from './auth/RequireAdmin'
import { FacilityProvider, useFacility } from './tenant/FacilityProvider'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

/** Segnaposto: la home pubblica è materia della fase 1B. */
function Home() {
  const facility = useFacility()
  return (
    <main className="p-8">
      <p className="tabular-nums text-[11px] uppercase tracking-[.14em] text-pitch">
        Prenota Campi
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{facility.name}</h1>
      <p className="mt-2 max-w-[60ch] text-ink-2">
        {facility.address} · {facility.phone}
      </p>
      <Link className="mt-6 inline-block text-pitch underline" to="/admin">
        Pannello del gestore →
      </Link>
    </main>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <FacilityProvider>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route
                path="/admin"
                element={<RequireAdmin><AdminPage /></RequireAdmin>}
              />
            </Routes>
          </AuthProvider>
        </FacilityProvider>
      </BrowserRouter>
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  )
}
