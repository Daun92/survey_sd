"""
BRIS 통합 페이지 (complain_reference_list.asp) HTML → 구조화된 dict 리스트

JS 파서(`lib/bris-parser/src/integrated.js`)와 동등성 보장:
- projectClosed 는 빨간색 span 만 추출 (없으면 '미적용')
- echo_id/customer_id 는 '없음' → '' (None 아님)
- 사내/외부 강사 합산을 '강사' 키에도 저장 (하위호환)
- 구버전 "강사:" 단일 라벨도 지원
"""

import re
from bs4 import BeautifulSoup

from .label_values import extract_label_values
from .utils import normalize_team_name, normalize_date


class BrisParser:
    """BRIS 컴플레인참조 HTML → 한글 키 dict 리스트"""

    # 내보내기 시 사용할 컬럼 순서
    COLUMNS = [
        'business_id', 'project_id', 'echo_id', 'place_id', 'customer_id',
        '과정명', '프로그램명', '과정_총매출', '시작일', '종료일',
        '대면_비대면', '수주코드', '수주_프로젝트명', '수주_프로젝트_등록일',
        '수주일', '수주_프로젝트_마감일',
        '에코_상태', '에코_제외_사유',
        '수주_담당자', '수주팀', '수행_담당자', '수행팀',
        '사내강사', '외부강사', '강사',
        '회사명', '사업자번호', '사업장명',
        '고객_담당자', '고객_부서', '고객_이메일', '고객_전화', '고객_휴대폰',
    ]

    @staticmethod
    def parse(html_content: str) -> list:
        soup = BeautifulSoup(html_content, 'html.parser')
        table = soup.find('table', class_='ntbl_list_c')
        if not table:
            return []

        rows = table.find_all('tr')
        records = []
        i = 0

        while i < len(rows):
            row = rows[i]

            # 헤더/info-row 건너뛰기
            row_classes = row.get('class', [])
            if 'tfirst' in row_classes or 'info-row' in row_classes:
                i += 1
                continue

            tds = row.find_all('td', recursive=False)
            if len(tds) < 5 or any(td.get('colspan') for td in tds):
                i += 1
                continue

            try:
                record = BrisParser._parse_main_row(tds)
            except Exception:
                i += 1
                continue

            # 후속 info-row 수집 (최대 10개 — 사내/외부 강사가 별개 행일 수 있음)
            info_rows = []
            j = i + 1
            while j < len(rows) and j <= i + 10:
                nr = rows[j]
                nr_tds = nr.find_all('td', recursive=False)
                if nr_tds and nr_tds[0].get('colspan'):
                    info_rows.append(nr)
                    j += 1
                else:
                    break

            BrisParser._parse_info_rows(record, info_rows)

            # 하위호환: 사내+외부 강사 합산을 '강사'(단일 키)에도 보관
            combined = ', '.join(
                v for v in [record.get('사내강사', ''), record.get('외부강사', '')]
                if v
            )
            if combined and not record.get('강사'):
                record['강사'] = combined

            records.append(record)
            i = j

        return records

    @staticmethod
    def _parse_main_row(tds) -> dict:
        rec = {}
        # ID 추출 — '없음' 은 '' 로 (JS 동등)
        for span in tds[0].find_all('span'):
            t = span.get_text(strip=True)
            for key in ('business_id', 'project_id', 'echo_id', 'place_id', 'customer_id'):
                if key in t:
                    val = t.split(':')[-1].strip()
                    rec[key] = '' if val == '없음' else val

        rec['과정명'] = tds[1].get_text(strip=True)
        rec['프로그램명'] = tds[2].get_text(strip=True)

        revenue = tds[3].get_text(strip=True).replace(',', '')
        try:
            rec['과정_총매출'] = int(revenue) if revenue else 0
        except ValueError:
            rec['과정_총매출'] = 0

        rec['시작일'] = normalize_date(tds[4].get_text(strip=True))
        rec['종료일'] = normalize_date(tds[5].get_text(strip=True))
        rec['대면_비대면'] = tds[6].get_text(strip=True)
        rec['수주코드'] = tds[7].get_text(strip=True)
        rec['수주_프로젝트명'] = tds[8].get_text(strip=True)
        rec['수주_프로젝트_등록일'] = tds[9].get_text(strip=True)
        rec['수주일'] = tds[10].get_text(strip=True)

        # 수주_프로젝트_마감일: 빨간색 span 안의 값만 마감일로 간주 (JS 동등)
        # 없으면 '미적용'
        if len(tds) > 11:
            close_td = tds[11]
            red = close_td.find('span', style=lambda s: s and 'red' in str(s))
            if red and red.get_text(strip=True):
                rec['수주_프로젝트_마감일'] = red.get_text(strip=True)
            else:
                rec['수주_프로젝트_마감일'] = '미적용'
        else:
            rec['수주_프로젝트_마감일'] = '미적용'

        return rec

    # BRIS info-row 라벨 → record dict 키 매핑.
    # 새 라벨이 HTML 에 등장해도 _extra_labels 에 수집되므로 관찰 후 여기 추가.
    _LABEL_MAP = {
        '에코 상태':      '에코_상태',
        '에코 제외 사유': '에코_제외_사유',
        '수주':           '수주_담당자',
        '수주팀':         '수주팀',
        '수행':           '수행_담당자',
        '수행팀':         '수행팀',
        '사내강사':       '사내강사',
        '외부강사':       '외부강사',
        '회사명':         '회사명',
        '사업자번호':     '사업자번호',
        '사업장명':       '사업장명',
        '담당자':         '고객_담당자',
        '부서':           '고객_부서',
        '이메일':         '고객_이메일',
        '전화':           '고객_전화',
        '휴대':           '고객_휴대폰',
    }

    @staticmethod
    def _parse_info_rows(record, info_rows):
        """각 info-row 에서 <b>라벨:</b>값 을 일괄 추출해 record 에 매핑.

        특수 처리:
          - '에코 상태' 는 빨간색 span 이 감싼 "에코 제외" 텍스트가 우선.
          - '수주팀'/'수행팀' 은 소괄호 제거 후 normalize.
          - 구버전 단일 '강사:' 라벨은 정규식 fallback.
          - 매핑에 없는 신규 라벨은 record['_extra_labels'] 에 관찰용 보관.
        """
        extra: dict[str, str] = {}
        for row in info_rows:
            lv = extract_label_values(row)
            text = row.get_text()

            # 에코 상태: 빨간 span 우선 override
            if '에코 상태' in lv:
                red = row.find('span', style=lambda s: s and 'red' in str(s))
                if red and '에코 제외' in red.get_text():
                    lv['에코 상태'] = '에코 제외'

            for label, value in lv.items():
                field = BrisParser._LABEL_MAP.get(label)
                if field is None:
                    extra[label] = value
                    continue
                if field == '수주팀':
                    value = value.strip().strip('()')
                elif field == '수행팀':
                    value = normalize_team_name(value.strip().strip('()'))
                record[field] = value

            # 구버전 단일 "강사:" 라벨 (사내/외부강사 둘 다 없을 때만)
            if ('강사 :' in text
                    and '사내강사' not in text
                    and '외부강사' not in text
                    and not record.get('강사')):
                m = re.search(r'강사\s*:\s*(.+?)$', text, re.M)
                if m:
                    record['강사'] = m.group(1).strip()

        if extra:
            record['_extra_labels'] = extra
