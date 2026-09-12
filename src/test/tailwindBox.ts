import { compile } from '@tailwindcss/node'
import postcss from 'postcss'

/**
 * Measures a touch target from the classes it actually carries.
 *
 * jsdom performs no layout, so `getBoundingClientRect` reports zeros and
 * "render it and read the height" is not available to us; jsdom also drops
 * every `@media` rule outright (verified: a `.a { height: 24px }` plus an
 * `@media (pointer: coarse) { .a { height: 44px } }` resolves to 24px there),
 * which is exactly the branch the `pointer-coarse:` utilities live in. So
 * instead of guessing, this compiles the project's own Tailwind — the same
 * `@import "tailwindcss"` and the same version the app builds with — over the
 * class list an element really has, and reads the box back out of the
 * generated CSS. The numbers a test asserts are therefore the numbers a
 * browser would compute, not a table of utility names someone typed out.
 *
 * Only what a touch target needs is resolved: the explicit width/height pair
 * and their `min-` counterparts. Content-driven sizes are deliberately not
 * inferred — a control whose tap size depends on its text has no measurable
 * floor, and the right fix there is to declare one, not to estimate it here.
 *
 * What it does *not* see, because it compiles a bare `@import "tailwindcss"`
 * and not `src/index.css`:
 *
 * - **the project's own component classes.** `field` measures
 *   `{width: null, height: null}` here; it is really 36px, declared in
 *   `src/index.css` (`.field { height: 2.25rem }`).
 * - **the project's own theme extensions.** `h-topbar` and `h-tabbar` are
 *   `--spacing-topbar` / `--spacing-tabbar`, defined in the same file, so
 *   they measure `null` too. That is worth naming out loud, because §2.4 of
 *   the spec words its floor as "no smaller than the tab bar's" — and the
 *   tab bar is precisely the thing this helper cannot measure. 44 is the
 *   number the tests assert, read off `--spacing-tabbar: 3.5rem` by hand.
 * - **ceilings.** `max-width` and `max-height` are not read at all, so
 *   `h-11 max-h-6` reports 44 where a browser would paint 24.
 *
 * None of this touches the six figures the suite asserts today — every class
 * measured is a plain `h-`/`w-`/`min-h-`/`min-w-` utility, and every one of
 * them does come out of bare Tailwind. The rule that keeps it that way:
 * `null` means "bare Tailwind declares nothing on that axis", and never "the
 * element has no floor". Read as the second it would turn a class this
 * helper cannot see into a passing assertion.
 */

// The project root: `compile` resolves `@import "tailwindcss"` against it.
// Vite serves modules from outside its root under a `/@fs` prefix, so under
// Vitest `import.meta.url` reads `http://…/@fs/home/…/src/test/…` rather
// than a plain `file://`. The prefix is stripped rather than worked around
// with `process.cwd()`, which would depend on where the runner was started.
// `pathname` is percent-encoded, so it is decoded first: a checkout under a
// path with a space in it would otherwise arrive as `…/my%20projects/…` and
// resolve to nothing.
const ROOT = decodeURIComponent(new URL('../../', import.meta.url).pathname)
  .replace(/^\/@fs\//, '/')

export type Pointer = 'fine' | 'coarse'

export type Box = {
  width: number | null
  height: number | null
  minWidth: number | null
  minHeight: number | null
}

const SIZE_PROPERTIES = ['width', 'height', 'min-width', 'min-height'] as const

type CompiledRule = {
  className: string
  coarseOnly: boolean
  declarations: Map<string, string>
}

type Stylesheet = {
  rules: CompiledRule[]
  spacing: string
}

// One Tailwind compile per test file, not per assertion: it reads the whole
// framework off disk.
const sheets = new Map<string, Promise<Stylesheet>>()

function stylesheetFor(candidates: string[]): Promise<Stylesheet> {
  const key = [...candidates].sort().join(' ')
  let sheet = sheets.get(key)
  if (!sheet) {
    sheet = build(candidates)
    sheets.set(key, sheet)
  }
  return sheet
}

async function build(candidates: string[]): Promise<Stylesheet> {
  const compiler = await compile('@import "tailwindcss";', {
    base: ROOT,
    onDependency: () => {},
  })
  return parse(compiler.build(candidates))
}

function parse(css: string): Stylesheet {
  const root = postcss.parse(css)
  const rules: CompiledRule[] = []
  // Tailwind's own default, restated by the theme it emits; read rather than
  // assumed, so a project that redefines the spacing scale still measures.
  let spacing = '0.25rem'

  root.walkDecls('--spacing', (decl) => { spacing = decl.value })

  root.walkRules((rule) => {
    // A single class selector, and nothing else: `.h-11`, `.px-2\.5`,
    // `.pointer-coarse\:h-11`. Anything compound belongs to a utility this
    // helper does not claim to measure.
    const match = /^\.((?:[^\s,.:#>+~[\]()]|\\.)+)$/.exec(rule.selector.trim())
    if (!match) return

    let coarseOnly = false
    let reachable = true
    for (
      let node: postcss.Node | undefined = rule.parent;
      node;
      node = node.parent
    ) {
      if (node.type !== 'atrule') continue
      const atRule = node as postcss.AtRule
      if (atRule.name === 'layer') continue
      if (atRule.name === 'media' && /\(\s*pointer\s*:\s*coarse\s*\)/.test(atRule.params)) {
        coarseOnly = true
        continue
      }
      // Some other condition gates this rule — a width breakpoint, a
      // `@supports`. Reporting it as unconditional would overstate the box.
      reachable = false
    }
    if (!reachable) return

    const declarations = new Map<string, string>()
    rule.walkDecls((decl) => {
      if ((SIZE_PROPERTIES as readonly string[]).includes(decl.prop)) {
        declarations.set(decl.prop, decl.value)
      }
    })
    if (declarations.size === 0) return

    rules.push({ className: unescapeClass(match[1]), coarseOnly, declarations })
  })

  return { rules, spacing }
}

function unescapeClass(selector: string): string {
  return selector.replace(/\\(.)/g, '$1')
}

/**
 * `calc(var(--spacing) * 11)`, `2.75rem`, `44px` → 44. Root font size is the
 * browser default of 16px: `rem` resolves against `<html>`, which this app
 * never restyles (`body` sets 15px, and that is not what `rem` reads).
 */
function lengthToPx(value: string): number | null {
  const literal = /^(-?[\d.]+)(px|rem)$/.exec(value.trim())
  if (!literal) return null
  return literal[2] === 'px' ? Number(literal[1]) : Number(literal[1]) * 16
}

function toPx(value: string, spacing: string): number | null {
  const calc = /^calc\(\s*var\(--spacing\)\s*\*\s*([\d.]+)\s*\)$/.exec(value.trim())
  if (calc) {
    const unit = lengthToPx(spacing)
    return unit === null ? null : unit * Number(calc[1])
  }
  return lengthToPx(value)
}

/**
 * The box an element's classes declare, at the given pointer type. Pass the
 * element itself, so the measurement is taken from what was rendered rather
 * than from a class string retyped into the test.
 */
export async function boxOf(element: Element, pointer: Pointer): Promise<Box> {
  const classes = element.className.toString().split(/\s+/).filter(Boolean)
  const sheet = await stylesheetFor(classes)
  const owned = new Set(classes)

  const resolved = new Map<string, string>()
  for (const rule of sheet.rules) {
    if (!owned.has(rule.className)) continue
    if (rule.coarseOnly && pointer !== 'coarse') continue
    for (const [property, value] of rule.declarations) resolved.set(property, value)
  }

  const read = (property: string): number | null => {
    const value = resolved.get(property)
    return value === undefined ? null : toPx(value, sheet.spacing)
  }

  return {
    width: read('width'),
    height: read('height'),
    minWidth: read('min-width'),
    minHeight: read('min-height'),
  }
}

/**
 * The smallest tap area the classes guarantee, in px. `null` on an axis
 * means bare Tailwind declares nothing there — usually a control sized by
 * its own content, which cannot be asserted, but also anything declared in
 * `src/index.css` instead, which this helper never compiles. See the note at
 * the top of the file: `null` is "not declared here", not "no floor".
 */
export async function tapTarget(element: Element, pointer: Pointer): Promise<{
  width: number | null
  height: number | null
}> {
  const box = await boxOf(element, pointer)
  const floor = (exact: number | null, minimum: number | null): number | null => {
    if (exact !== null && minimum !== null) return Math.max(exact, minimum)
    return exact ?? minimum
  }
  return {
    width: floor(box.width, box.minWidth),
    height: floor(box.height, box.minHeight),
  }
}
