/**
 * DOMParser 주입 — 브라우저는 native, Node는 linkedom/jsdom 주입 필요
 */

let _DOMParser = (typeof globalThis !== 'undefined' && typeof globalThis.DOMParser !== 'undefined')
  ? globalThis.DOMParser
  : null;

/** Node 환경에서 DOMParser 구현체 주입 — `import { DOMParser } from 'linkedom'; setDOMParser(DOMParser);` */
export function setDOMParser(impl) {
  _DOMParser = impl;
}

export function getDOMParser() {
  if (!_DOMParser) {
    throw new Error(
      '[bris-parser] DOMParser is not available. ' +
      'In Node.js: `import { DOMParser } from "linkedom"; setDOMParser(DOMParser);` before parsing.'
    );
  }
  return _DOMParser;
}
