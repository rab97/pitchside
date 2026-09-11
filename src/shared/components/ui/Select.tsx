import * as RadixSelect from '@radix-ui/react-select'
import { useContext, type JSX } from 'react'
import { DialogPortalContext } from './Dialog'

export type SelectOption<T extends string> = { value: T; label: string; disabled?: boolean }

// Radix, not a native <select>, because the parts that matter here are the
// ones you cannot see: focus returns to the trigger when the popover closes,
// Escape and the arrow keys work, typeahead jumps to an option as you type
// its first letters, and the popover flips to stay on screen instead of
// falling off the bottom of a phone. The ARIA roles it emits are what let a
// screen reader announce this as a combobox with a list of options. Every
// class below is ours — the theme tokens, the sizing — Radix supplies none
// of the appearance.
export function Select<T extends string>(props: {
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  // Shown in the trigger when `value` is Radix's own reserved "nothing
  // selected" sentinel, the empty string — see the comment where
  // `NewClosureDialog` picks a non-empty sentinel for the same reason.
  // Optional: most callers here always have a real value to show.
  placeholder?: string
  'aria-label'?: string
  id?: string
  disabled?: boolean
  className?: string
}): JSX.Element {
  const { value, onChange, options, placeholder, id, disabled, className } = props
  // `null` outside any `Dialog` — Radix's own default (document.body) then
  // applies. See DialogPortalContext in Dialog.tsx for why this is needed
  // at all: a Dialog's native <dialog> lives in the browser's top layer, and
  // a plain body portal would land outside it, invisible and inert.
  const dialogContainer = useContext(DialogPortalContext)

  return (
    <RadixSelect.Root value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
      <RadixSelect.Trigger
        id={id}
        aria-label={props['aria-label']}
        className={`field justify-between${className ? ` ${className}` : ''}`}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </RadixSelect.Trigger>
      <RadixSelect.Portal container={dialogContainer ?? undefined}>
        <RadixSelect.Content
          position="popper"
          sideOffset={-1}
          className="z-50 overflow-hidden rounded-b-[7px] border border-pitch bg-surface shadow-card"
          style={{ width: 'var(--radix-select-trigger-width)' }}
        >
          <RadixSelect.Viewport className="max-h-[min(18rem,var(--radix-select-content-available-height))]">
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="cursor-pointer select-none px-3 py-2 text-[13.5px] text-ink outline-none data-[highlighted]:bg-pitch-tint data-[highlighted]:text-pitch data-[disabled]:text-muted"
              >
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}
