"""
에코현황 (project_echoview.asp) HTML → 에코 프로젝트 정보 추출
JS lib/bris-parser/src/echo-view.js 와 1:1 동등.
"""

import re
from bs4 import BeautifulSoup

from .utils import normalize_team_name


def extract_echoview_data(html: str) -> dict:
    soup = BeautifulSoup(html, 'html.parser')

    # e_id: var e_id = "4137"
    e_id = ''
    m = re.search(r'(?:var|let|const)\s+e_id\s*=\s*"(\d+)"', html)
    if m:
        e_id = m.group(1)

    # projectId
    project_id = ''
    proj_link = soup.select_one(
        'a[href*="project_view.asp"], button[onclick*="project_view.asp"]'
    )
    if proj_link:
        href = proj_link.get('href', '') or proj_link.get('onclick', '') or ''
        pm = re.search(r'project_id=(\d+)', href, re.I)
        if pm:
            project_id = pm.group(1)

    title_tds = soup.select('td.title')
    order_code = ''
    echo_project_name = ''
    company = ''
    team = ''
    echo_period = ''
    am_raw = ''
    client_contact_raw = ''

    for td in title_tds:
        label = re.sub(r'\s+', ' ', td.get_text()).strip()
        next_td = td.find_next_sibling()
        if not next_td:
            continue

        if '수주코드' in label:
            code_match = re.search(r'\d{4}-\d{3}', next_td.get_text())
            if code_match:
                order_code = code_match.group(0)
        elif '에코프로젝트명' in label:
            b = next_td.find('b')
            val = b.get_text(strip=True) if b else next_td.get_text(strip=True)
            echo_project_name = re.sub(r'\s*과정개요.*$', '', val).strip()
        elif '고객사' in label and '담당' not in label:
            b = next_td.find('b')
            company = b.get_text(strip=True) if b else next_td.get_text(strip=True)
        elif '수행팀' in label:
            b = next_td.find('b')
            raw = b.get_text(strip=True) if b else next_td.get_text(strip=True)
            team = normalize_team_name(raw)
        elif '에코 운영기간' in label or '운영기간' in label:
            echo_period = next_td.get_text(strip=True)
        elif 'AM' in label and '운영' in label:
            am_raw = next_td.get_text(strip=True)
        elif '고객사 담당' in label:
            client_contact_raw = next_td.get_text(strip=True)

    # AM / 운영 파싱
    am = ''
    operation_manager = ''
    am_team = ''
    if am_raw:
        b_tags = []
        for td in title_tds:
            if 'AM' in td.get_text() and '운영' in td.get_text():
                next_td = td.find_next_sibling()
                if next_td:
                    for b in next_td.find_all('b'):
                        b_tags.append(b.get_text(strip=True))
                    silver_span = next_td.select_one(
                        'span[style*="color:silver"], span[style*="color: silver"]'
                    )
                    if silver_span:
                        am_team = silver_span.get_text(strip=True)
                break
        am = b_tags[0] if len(b_tags) >= 1 else ''
        operation_manager = b_tags[1] if len(b_tags) >= 2 else ''
        if not am and '/' in am_raw:
            parts = am_raw.split('/')
            am = parts[0].strip().split()[0] if parts[0].strip() else ''
            operation_manager = parts[1].strip() if len(parts) > 1 else ''

    # 구성내역: 교육내역 건수
    edu_count = ''
    cont_tds = soup.select('td.cont')
    for td in cont_tds:
        prev = td.find_previous_sibling()
        if prev and '교육내역' in prev.get_text():
            m = re.search(r'(\d+)건', td.get_text())
            edu_count = m.group(1) if m else td.get_text(strip=True)
            break

    # 구성내역: 고객사 담당자 수, 강사 수
    client_contact_count = ''
    instructor_count = ''
    for td in cont_tds:
        prev = td.find_previous_sibling()
        if prev and '담당인원' in prev.get_text():
            mem_spans = td.select('span.memCount')
            if len(mem_spans) >= 1:
                cm = re.search(r'(\d+)', mem_spans[0].get_text())
                if cm:
                    client_contact_count = cm.group(1)
            if len(mem_spans) >= 2:
                instructor_count = mem_spans[1].get_text(strip=True)
            if not instructor_count:
                im = re.search(r'강사\((\d+)', td.get_text())
                if im:
                    instructor_count = im.group(1)
            break

    return {
        'eId': e_id,
        'projectId': project_id,
        'orderCode': order_code,
        'echoProjectName': echo_project_name,
        'company': company,
        'team': team,
        'echoPeriod': echo_period,
        'am': am,
        'operationManager': operation_manager,
        'amTeam': am_team,
        'clientContactRaw': client_contact_raw,
        'eduCount': edu_count,
        'clientContactCount': client_contact_count,
        'instructorCount': instructor_count,
    }
