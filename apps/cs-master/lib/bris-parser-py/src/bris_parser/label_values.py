"""
info-row 내 <span><b>label : </b>value</span> 패턴 일괄 추출
(JS lib/bris-parser/src/label-values.js 와 1:1 동등)
"""


def extract_label_values(row) -> dict:
    """
    BeautifulSoup row element → {label: value} dict.

    같은 라벨이 여러 번 나타나면 첫 번째만 유지.
    <b> 태그 직접 순회 — 한 <span> 안에 <b> 가 둘 이상 있어도 모두 포착.
    (예: "<b>에코 상태 : </b>...<b>에코 제외 사유 : </b>...")
    """
    result = {}
    for b in row.find_all('b', recursive=True):
        label = b.get_text(strip=True).rstrip(':').rstrip(' :').rstrip('：').strip()
        if not label or label in result:
            continue
        value_parts = []
        for sib in b.next_siblings:
            if hasattr(sib, 'name') and sib.name == 'b':
                break
            if hasattr(sib, 'name') and sib.name == 'span' and sib.find('b'):
                break
            txt = sib.get_text() if hasattr(sib, 'get_text') else str(sib)
            value_parts.append(txt)
        result[label] = ''.join(value_parts).strip()
    return result
