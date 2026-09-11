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
