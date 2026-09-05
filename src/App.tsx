import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { FacilityProvider, useFacility } from './tenant/FacilityProvider'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

function Home() {
  const facility = useFacility()
  return (
    <main className="p-8">
      <p className="font-mono text-[11px] uppercase tracking-[.14em] text-pitch">
        Prenota Campi
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{facility.name}</h1>
      <p className="mt-2 max-w-[60ch] text-ink-2">
        {facility.address} · {facility.phone}
      </p>
    </main>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FacilityProvider>
        <Home />
      </FacilityProvider>
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  )
}
