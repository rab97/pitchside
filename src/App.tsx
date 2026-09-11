import { lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/features/auth/hooks/AuthProvider'
import { RequireAdmin } from '@/features/auth/components/RequireAdmin'
import { LoginPage } from '@/features/auth/components/LoginPage'
import { ClaimPhoneDialog } from '@/features/auth/components/ClaimPhoneDialog'
import { LOGIN_ROUTE } from '@/shared/lib/routes'
import { FacilityProvider } from '@/shared/tenant/FacilityProvider'
import { HomePage } from '@/features/booking/components/HomePage'
import { BookPage } from '@/features/booking/components/BookPage'
import { MyBookingsPage } from '@/features/booking/components/MyBookingsPage'
import { BookingPage } from '@/features/booking/components/BookingPage'

// Il pannello del gestore è pesante — griglia, dialoghi, ricorrenze — e chi
// apre la home come cliente non deve scaricarlo. lazy() lo mette in un file
// a parte, caricato solo entrando su /admin.
const AdminPage = lazy(() =>
  import('@/features/admin/components/AdminPage').then((m) => ({ default: m.AdminPage })))
const FacilityPage = lazy(() =>
  import('@/features/admin/components/FacilityPage').then((m) => ({ default: m.FacilityPage })))
const FieldsPage = lazy(() =>
  import('@/features/admin/components/FieldsPage').then((m) => ({ default: m.FieldsPage })))
const PriceBandsPage = lazy(() =>
  import('@/features/admin/components/PriceBandsPage').then((m) => ({ default: m.PriceBandsPage })))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <FacilityProvider>
          <AuthProvider>
            {/* Dentro i provider e fuori dalle rotte: la domanda sul telefono
                e il ricongiungimento dello storico valgono per tutte le rotte
                cliente autenticate, non per una schermata sola. È il
                componente a decidere da sé se aprirsi, e per chi. */}
            <ClaimPhoneDialog />
            <Suspense fallback={<div className="p-8 text-muted">Caricamento…</div>}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path={LOGIN_ROUTE} element={<LoginPage />} />
                <Route path="/prenota" element={<BookPage />} />
                <Route path="/prenotazioni" element={<MyBookingsPage />} />
                <Route path="/prenotazioni/:id" element={<BookingPage />} />
                <Route
                  path="/admin"
                  element={<RequireAdmin><AdminPage /></RequireAdmin>}
                />
                <Route path="/admin/struttura" element={<RequireAdmin><FacilityPage /></RequireAdmin>} />
                <Route path="/admin/campi" element={<RequireAdmin><FieldsPage /></RequireAdmin>} />
                <Route path="/admin/tariffe" element={<RequireAdmin><PriceBandsPage /></RequireAdmin>} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </FacilityProvider>
      </BrowserRouter>
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  )
}
