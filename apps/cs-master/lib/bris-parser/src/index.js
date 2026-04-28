/**
 * bris-parser — BRIS HTML 순수 파서 라이브러리
 *
 * 브라우저: native DOMParser 자동 사용
 * Node:    `import { DOMParser } from 'linkedom'; setDOMParser(DOMParser);` 1회 설정 필요
 */

export { setDOMParser, getDOMParser } from './dom.js';

export {
  genId, normalizeText, normalizePhone, esc,
  normalizeDate, parseBrisDate, normalizeTeamName
} from './utils.js';

export { extractLabelValues } from './label-values.js';
export { extractIntegratedData } from './integrated.js';
export { extractEduDetailData } from './edu-detail.js';
export { extractEchoviewData } from './echo-view.js';
export { extractEchoData } from './echo-data.js';
export { extractProjectDetailData, extractProjectBizList } from './project.js';
export { extractDmData } from './dm.js';

export const VERSION = '0.1.0';
