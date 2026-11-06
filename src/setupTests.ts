import '@testing-library/jest-dom/vitest';

// jsdom has no scrollTo; the phone map strip scrolls itself with it. Like a browser, this one moves at once and clamps
// to the element's scroll range (none, unless a test gives the element a size).
if (typeof Element.prototype.scrollTo !== 'function') {
  const clamp = (v: number, max: number) => Math.max(0, Math.min(v, Math.max(0, max)));
  Element.prototype.scrollTo = function (this: Element, options?: ScrollToOptions | number) {
    if (typeof options !== 'object') return;
    if (options.left !== undefined) this.scrollLeft = clamp(options.left, this.scrollWidth - this.clientWidth);
    if (options.top !== undefined) this.scrollTop = clamp(options.top, this.scrollHeight - this.clientHeight);
  } as Element['scrollTo'];
}
