/**
 * info-row 내 <span><b>label : </b>value</span> 패턴 일괄 추출
 * (bris_api.py:_extract_label_values 포팅)
 */

export function extractLabelValues(row) {
  const result = {};
  // <b> 태그 직접 순회 — 한 <span> 안에 <b> 가 둘 이상 있어도 모두 포착
  // (예: "<b>에코 상태 : </b>...<b>에코 제외 사유 : </b>...")
  row.querySelectorAll('b').forEach(b => {
    const label = b.textContent.replace(/[:：]\s*$/, '').trim();
    if (!label) return;
    const parts = [];
    let sib = b.nextSibling;
    while (sib) {
      if (sib.nodeType === 1) {
        if (sib.tagName === 'B') break;
        if (sib.tagName === 'SPAN' && sib.querySelector('b')) break;
      }
      parts.push(sib.textContent != null ? sib.textContent : (sib.nodeValue || ''));
      sib = sib.nextSibling;
    }
    const value = parts.join('').trim();
    // 같은 라벨이 여러 번 나타나면 첫 번째만 유지
    if (!(label in result)) result[label] = value;
  });
  return result;
}
