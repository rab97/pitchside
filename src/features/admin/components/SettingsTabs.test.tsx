import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { SettingsTabs } from './SettingsTabs'

function renderAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <SettingsTabs />
    </MemoryRouter>,
  )
}

describe('SettingsTabs', () => {
  it('marks the tab of the current route, and only that one', () => {
    renderAt('/admin/tariffe')

    expect(screen.getByRole('link', { name: 'Tariffe' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getAllByRole('link').filter((l) => l.getAttribute('aria-current')))
      .toHaveLength(1)
  })

  it('offers the four sections and a way back to the day grid', () => {
    renderAt('/admin/campi')

    expect(screen.getByRole('link', { name: 'Campi' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tariffe' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Chiusure' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Struttura' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Giornata' })).toHaveAttribute('href', '/admin')
  })
})
