import { lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/features/auth/hooks/AuthProvider'
import { RequireAdmin } from '@/features/auth/components/RequireAdmin'
import { LoginPage } from '@/features/auth/components/LoginPage'
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

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <FacilityProvider>
          <AuthProvider>
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
              </Routes>
            </Suspense>
          </AuthProvider>
        </FacilityProvider>
      </BrowserRouter>
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  )
}
