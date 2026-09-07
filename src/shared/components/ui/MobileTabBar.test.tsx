import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { MobileTabBar, matchesTab } from './MobileTabBar'

describe('matchesTab', () => {
  it('non accende «Prenota» quando si è fra le prenotazioni', () => {
    // `/prenotazioni`.startsWith('/prenota') è vero: con un confronto ingenuo
    // si accenderebbero due tab su tre.
    expect(matchesTab('/prenota', '/prenotazioni')).toBe(false)
    expect(matchesTab('/prenota', '/prenota')).toBe(true)
  })

  it('tiene accesso il tab mentre si guarda una schermata spinta', () => {
    expect(matchesTab('/prenotazioni', '/prenotazioni/abc-123')).toBe(true)
  })

  it('la home si accende solo sulla home', () => {
    expect(matchesTab('/', '/')).toBe(true)
    expect(matchesTab('/', '/prenota')).toBe(false)
  })
})

describe('MobileTabBar', () => {
  function renderAt(pathname: string) {
    return render(
      <MemoryRouter initialEntries={[pathname]}>
        <MobileTabBar />
      </MemoryRouter>,
    )
  }

  it('segna il tab della rotta corrente, e uno solo', () => {
    renderAt('/prenota')

    expect(screen.getByRole('link', { name: /Prenota$/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getAllByRole('link').filter((l) => l.getAttribute('aria-current')))
      .toHaveLength(1)
  })

  it('sul dettaglio di una prenotazione resta segnato «Prenotazioni»', () => {
    renderAt('/prenotazioni/0000-1111')

    expect(screen.getByRole('link', { name: /Prenotazioni/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /Prenota$/ })).not.toHaveAttribute('aria-current')
  })

  it('offre solo i tre tab che portano da qualche parte', () => {
    renderAt('/')

    // Il mockup ne disegna cinque: tornei, «trova» e profilo non esistono
    // ancora, e un tab che non porta da nessuna parte insegna a non fidarsi.
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })
})
