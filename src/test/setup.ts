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
