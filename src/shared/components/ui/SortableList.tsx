import type { ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  type ScreenReaderInstructions,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

export type SortHandleProps = {
  // `Element`, not `HTMLElement`: the handle in this app is an inline
  // <svg>, and dnd-kit's own ref setter only widens, never narrows, what it
  // accepts.
  ref: (node: Element | null) => void
  attributes: DraggableAttributes
  listeners: DraggableSyntheticListeners
}

// dnd-kit narrates the gesture to screen readers on its own — its defaults
// are English ("Picked up sortable item…", "was moved…"), and a translated
// `aria-label` on the handle does not reach any of that. Every string a
// screen reader user hears has to be Italian too, the same as every string
// a sighted user reads.
const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    'Per sollevare un elemento trascinabile, premi la barra spaziatrice. ' +
    'Durante il trascinamento, usa le frecce per spostarlo. ' +
    'Premi di nuovo la barra spaziatrice per rilasciarlo nella nuova posizione, oppure premi Esc per annullare.',
}

function buildAnnouncements(items: { id: string }[]): Announcements {
  const total = items.length
  const positionOf = (id: UniqueIdentifier) => items.findIndex((item) => item.id === id) + 1

  return {
    onDragStart({ active }) {
      return `Elemento sollevato dalla posizione ${positionOf(active.id)} di ${total}.`
    },
    onDragOver({ over }) {
      if (!over) return undefined
      return `Elemento spostato in posizione ${positionOf(over.id)} di ${total}.`
    },
    onDragEnd({ over }) {
      if (!over) return 'Elemento rilasciato.'
      return `Elemento rilasciato in posizione ${positionOf(over.id)} di ${total}.`
    },
    onDragCancel() {
      return 'Riordino annullato: l’elemento è tornato al suo posto.'
    },
  }
}

/**
 * A vertical drag-to-reorder list. It owns the gesture — pointer, touch and
 * keyboard alike — and reports the new order through `onReorder`; it never
 * writes anything itself, because whether a reordered row is worth keeping
 * is a decision for whoever owns the data, not for the widget that moved it.
 *
 * `renderItem` gets the item back together with the props for its drag
 * handle, so the caller decides where the handle sits in the row and the
 * rest of the row stays exactly as clickable as before.
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
}: {
  items: T[]
  onReorder: (next: T[]) => void
  renderItem: (item: T, handleProps: SortHandleProps) => ReactNode
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    // A short delay and tolerance keep a finger that is scrolling the page
    // from being mistaken for a finger that grabbed the handle.
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = items.findIndex((item) => item.id === active.id)
    const to = items.findIndex((item) => item.id === over.id)
    if (from === -1 || to === -1) return
    const next = items.slice()
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onReorder(next)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{ screenReaderInstructions, announcements: buildAnnouncements(items) }}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        {items.map((item) => (
          <SortableRow key={item.id} item={item} renderItem={renderItem} />
        ))}
      </SortableContext>
    </DndContext>
  )
}

function SortableRow<T extends { id: string }>({
  item,
  renderItem,
}: {
  item: T
  renderItem: (item: T, handleProps: SortHandleProps) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({
    id: item.id,
  })

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition: transition ?? undefined,
  }

  return (
    <li ref={setNodeRef} style={style}>
      {renderItem(item, {
        ref: (node) => setActivatorNodeRef(node as HTMLElement | null),
        attributes,
        listeners,
      })}
    </li>
  )
}
