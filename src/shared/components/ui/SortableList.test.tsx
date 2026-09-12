import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SortableList } from './SortableList'

const items = [{ id: 'c1', name: 'Campo 1' }, { id: 'c2', name: 'Campo 2' }]

function renderList() {
  return render(
    <SortableList
      className="divide-y"
      items={items}
      onReorder={() => {}}
      renderItem={(item) => <span>{item.name}</span>}
    />,
  )
}

describe('SortableList', () => {
  /**
   * `DndContext` renders its accessibility layer — a hidden instructions
   * div and a `role="status"` live region — inline, as a sibling of its
   * children, because no portal container is passed. While the caller owned
   * the `<ul>`, those two `div`s were direct children of a list: invisible,
   * but a `ul` may hold only `li`, and assistive technology varies in what
   * it does with anything else — which put the Italian drag announcements at
   * risk of being mis-scoped or dropped. This is the shape assertion the
   * list element moving in here is for.
   */
  it('puts nothing but list items inside its <ul>', () => {
    const { container } = renderList()

    const lists = container.querySelectorAll('ul')
    expect(lists).toHaveLength(1)

    const children = Array.from(lists[0].children).map((el) => el.tagName)
    expect(children).toEqual(['LI', 'LI'])
  })

  it('keeps the drag live region outside the list', () => {
    const { container } = renderList()

    const liveRegion = container.querySelector('[role="status"]')
    expect(liveRegion).not.toBeNull()
    expect(liveRegion?.closest('ul')).toBeNull()
  })

  it('renders each item through renderItem', () => {
    renderList()
    expect(screen.getByText('Campo 1')).toBeInTheDocument()
    expect(screen.getByText('Campo 2')).toBeInTheDocument()
  })
})
