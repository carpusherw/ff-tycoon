import '@testing-library/jest-dom/vitest';

// jsdom has no scrollTo; the phone map strip scrolls itself with it. This one moves to the given offsets at once.
if (typeof Element.prototype.scrollTo !== 'function') {
  Element.prototype.scrollTo = function (this: Element, options?: ScrollToOptions | number) {
    if (typeof options !== 'object') return;
    if (options.left !== undefined) this.scrollLeft = options.left;
    if (options.top !== undefined) this.scrollTop = options.top;
  } as Element['scrollTo'];
}
