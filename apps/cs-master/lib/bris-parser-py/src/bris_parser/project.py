"""
프로젝트세부 (project_view.asp) + 교육내역 목록 (project_biz_list.asp) 파싱
JS lib/bris-parser/src/project.js 와 1:1 동등.
"""

import re
from bs4 import BeautifulSoup


def _split_am_team(val: str) -> tuple:
    """AM 셀에서 (이름, 팀) 분리.

    - 공백 분리 우선 ("정용호 경기팀")
    - 공백 없으면 한국 이름 표준 길이(3자 우선, 4자·2자)로 시도하고
      그 뒤가 [가-힣\\d]{2,5}팀|파트 패턴이면 매칭
      ("정용호경기팀" → "정용호" / "경기팀")
    """
    if not val:
        return '', ''
    val = val.strip()
    parts = val.split()
    if len(parts) >= 2:
        return parts[0], ' '.join(parts[1:])
    for name_len in (3, 4, 2):
        if name_len >= len(val):
            continue
        cand_team = val[name_len:].strip()
        if re.match(r'^[가-힣\d]{2,5}(?:팀|파트)$', cand_team):
            return val[:name_len], cand_team
    return val, ''


def extract_project_detail_data(html: str) -> dict:
    soup = BeautifulSoup(html, 'html.parser')

    project_id = ''
    pid_input = soup.select_one('input[name="PROJECT_ID"]')
    if pid_input:
        project_id = pid_input.get('value', '') or ''
    if not project_id:
        m = re.search(r'var\s+project_id\s*=\s*"(\d+)"', html)
        if m:
            project_id = m.group(1)

    order_code = ''
    code_input = soup.select_one('input[name="successCode"]')
    if code_input:
        order_code = code_input.get('value', '') or ''
    if not order_code:
        td_headers = soup.select('td.bris_tb_title, td[bgcolor="#dee8ef"]')
        for td in td_headers:
            if '수주코드' in td.get_text():
                nx = td.find_next_sibling()
                if nx:
                    cm = re.search(r'\d{4}-\d{3}', nx.get_text(strip=True))
                    if cm:
                        order_code = cm.group(0)
                break

    project_closed = '미적용'
    all_tds = soup.find_all('td')
    for td in all_tds:
        if '프로젝트 마감' in td.get_text() and td.find('b'):
            nx = td.find_next_sibling()
            if nx:
                val = nx.get_text(strip=True)
                project_closed = val if val else '미적용'
            break

    project_name = ''
    company = ''
    am = ''
    am_team = ''
    team = ''
    info_tds = soup.select('td.bris_tb_title, td[bgcolor="#dee8ef"]')
    for td in info_tds:
        text = td.get_text(strip=True).replace('*', '')
        nx = td.find_next_sibling()
        if not nx:
            continue
        val = nx.get_text(strip=True)
        if '프로젝트명' in text:
            project_name = re.sub(r'\s*과정개요.*$', '', val).strip()
        elif '고객사' in text:
            company = val
        elif 'AM' in text and 'Account' in text:
            am, am_team = _split_am_team(val)
        elif '수행팀' in text:
            team = val

    # echoActive: False(초기) 또는 '현황'/'등록'/'제외'
    echo_active = False
    btn = soup.select_one('button.btnEcho')
    if btn:
        bt = btn.get_text(strip=True)
        if '에코 현황' in bt:
            echo_active = '현황'
        elif '에코 등록' in bt:
            echo_active = '등록'
        elif '에코 제외' in bt:
            echo_active = '제외'

    return {
        'projectId': project_id,
        'orderCode': order_code,
        'projectClosed': project_closed,
        'projectName': project_name,
        'company': company,
        'am': am,
        'amTeam': am_team,   # AM 의 수주팀 (별도)
        'team': team,        # 수행팀
        'echoActive': echo_active,
    }


def extract_project_biz_list(html: str) -> dict:
    soup = BeautifulSoup(html, 'html.parser')
    sessions = []

    for link in soup.select('a[href*="go_page"]'):
        row = link.find_parent('tr')
        if not row:
            continue
        tds = row.find_all('td')
        if len(tds) < 4:
            continue

        try:
            session_index = int((tds[0].get_text() or '').strip())
        except (ValueError, TypeError):
            session_index = 0

        href = link.get('href', '') or ''
        bm = re.search(r"go_page\s*\(\s*'[^']*'\s*,\s*'(\d+)'", href)
        business_id = bm.group(1) if bm else ''

        date_text = (link.get_text() or '').strip()
        start_date = ''
        end_date = ''
        dm = re.search(r'(\d{4})\.(\d{2})\.(\d{2})(?:~(\d{2}))?', date_text)
        if dm:
            y, m, d, d2 = dm.group(1), dm.group(2), dm.group(3), dm.group(4)
            start_date = f'{y}-{m}-{d}'
            end_date = f'{y}-{m}-{d2.zfill(2)}' if d2 else start_date

        course_name = (tds[3].get_text() or '').strip()
        revenue_raw = (tds[4].get_text() if len(tds) > 4 else '') or ''
        revenue = re.sub(r'[^\d]', '', revenue_raw)

        if not business_id and not start_date:
            continue

        sessions.append({
            'businessId': business_id,
            'sessionIndex': session_index,
            'startDate': start_date,
            'endDate': end_date,
            'courseName': course_name,
            'nonFaceToFace': bool((tds[1].get_text() or '').strip()),
            'revenue': revenue,
        })

    return {'sessions': sessions, 'totalCount': len(sessions)}
