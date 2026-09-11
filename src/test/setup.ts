import '@testing-library/jest-dom/vitest'

// jsdom non implementa `ResizeObserver` né la cattura del puntatore, che il
// foglio di conferma usa per misurare il proprio contenuto e per seguire il
// dito. Sono mancanze dell'ambiente di prova, non del prodotto: si colmano
// qui, una volta, invece di sparpagliare guardie difensive nel codice che poi
// resterebbero anche in produzione.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = function setPointerCapture() {}
  Element.prototype.releasePointerCapture = function releasePointerCapture() {}
  Element.prototype.hasPointerCapture = function hasPointerCapture() { return false }
}

// jsdom does not implement `<dialog>`'s imperative API either: `showModal`
// and `close` are missing, so mounting `Dialog.tsx` with `open` throws
// instead of setting the `open` attribute the component's own effect expects
// to find set afterwards.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
}

// Radix's Select needs two more jsdom APIs that do not exist there: it scrolls
// the highlighted item into view as the pointer or keyboard moves, and it
// measures the trigger and viewport with DOMRect to position and size the
// popper. Gaps in the test environment, not in the product — filled here once.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {}
}
if (!globalThis.DOMRect) {
  globalThis.DOMRect = class {
    x: number; y: number; width: number; height: number
    top = 0; right = 0; bottom = 0; left = 0
    constructor(x = 0, y = 0, width = 0, height = 0) {
      this.x = x; this.y = y; this.width = width; this.height = height
    }
    static fromRect() { return new globalThis.DOMRect() }
    toJSON() { return {} }
  } as unknown as typeof DOMRect
}
