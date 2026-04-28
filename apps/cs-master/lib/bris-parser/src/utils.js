/**
 * BRIS 파서 공통 유틸리티 — DOM 비의존 순수 함수
 * (esc 만 DOM API 사용)
 */

/** 짧은 고유 ID 생성 */
export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** NBSP(\u00a0) + 전각공백(\u3000) + ZWB(\u200b) → 일반 공백, trim */
export function normalizeText(str) {
  if (!str) return '';
  return str.replace(/[\u00a0\u3000\u200b]/g, ' ').trim();
}

/** 전화번호 정규화: 한글/공백/콜론 prefix 제거 → 숫자만 → 하이픈 포맷 */
export function normalizePhone(raw) {
  if (!raw) return '';
  let s = raw.replace(/^[가-힣\s:：]+/, '').trim();
  const digits = s.replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('02')) {
    if (digits.length <= 9) return digits.replace(/^(02)(\d{3,4})(\d{4})$/, '$1-$2-$3');
    return digits.replace(/^(02)(\d{4})(\d{4})$/, '$1-$2-$3');
  }
  if (digits.length === 11) return digits.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3');
  if (digits.length === 10) return digits.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3');
  return digits;
}

/** HTML escape — textContent → innerHTML 동등 (& < > 만 변환, ' " 는 그대로) */
export function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** YYYYMMDD → YYYY-MM-DD (이미 ISO면 통과) */
export function normalizeDate(str) {
  if (!str) return '';
  str = str.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const m = str.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return str;
}

/** BRIS 날짜 포맷: "2025/04/23~30" → {startDate, endDate} */
export function parseBrisDate(str) {
  str = (str || '').trim();
  const arrowMatch = str.match(/(\d{4})\/(\d{2})\/(\d{2})[→~](\d{2})\/(\d{2})/);
  if (arrowMatch) {
    const startDate = `${arrowMatch[1]}-${arrowMatch[2]}-${arrowMatch[3]}`;
    const endDate = `${arrowMatch[1]}-${arrowMatch[4]}-${arrowMatch[5]}`;
    return { startDate, endDate };
  }
  const singleMatch = str.match(/(\d{4})\/(\d{2})\/(\d{2})/);
  if (singleMatch) {
    const d = `${singleMatch[1]}-${singleMatch[2]}-${singleMatch[3]}`;
    return { startDate: d, endDate: d };
  }
  return { startDate: '', endDate: '' };
}

/** 팀 코드 제거: "201205002 - 변화디자인팀" → "변화디자인팀" */
export function normalizeTeamName(raw) {
  if (!raw) return '';
  const m = raw.match(/^\d+\s*-\s*(.+)$/);
  return m ? m[1].trim() : raw.trim();
}
