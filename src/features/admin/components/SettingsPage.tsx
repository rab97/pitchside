import type { ReactNode } from 'react'
import { useFacility } from '@/shared/tenant/FacilityProvider'
import { SettingsTabs } from './SettingsTabs'

/**
 * The frame shared by the four settings screens. It repeats the shell the day
 * grid uses (`AdminPage.tsx:20-27`) rather than importing it: the grid is one
 * page with its own toolbar, and pulling a shared layout out of it would be a
 * refactor this work does not need.
 */
export function SettingsPage({ title, children }: {
  title: string
  children: ReactNode
}) {
  const facility = useFacility()

  return (
    <div className="min-h-screen bg-ground p-4 sm:p-6">
      <div className="mx-auto max-w-[1140px]">
        <SettingsTabs />

        <p className="mt-5 text-[11px] uppercase tracking-[.14em] text-pitch">
          {facility.name}
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-[-.02em]">{title}</h1>

        <div className="mt-4 flex flex-col gap-4">{children}</div>
      </div>
    </div>
  )
}
