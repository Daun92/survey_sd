"""
에코 운영 (echo/operate/main_2024.asp) HTML → 운영 상세 + 다차수 일정 추출
JS lib/bris-parser/src/echo-data.js 와 1:1 동등.
"""

import re
from bs4 import BeautifulSoup


def extract_echo_data(html: str) -> dict:
    soup = BeautifulSoup(html, 'html.parser')

    # projectId
    project_id = ''
    pid_input = soup.select_one('input[name="project_id"]')
    if pid_input:
        project_id = pid_input.get('value', '') or ''
    if not project_id:
        m = re.search(r'const\s+project_id\s*=\s*"(\d+)"', html)
        if m:
            project_id = m.group(1)

    # orderCode
    order_code = ''
    for s in soup.select('.cont span'):
        txt = s.get_text(strip=True)
        if re.match(r'^\d{4}-\d{3}$', txt):
            order_code = txt
            break

    # company
    company = ''
    title_tds = soup.select('td.title')
    for td in title_tds:
        if '고객사' in td.get_text():
            nx = td.find_next_sibling()
            if nx:
                company = re.sub(r'\s+', ' ', nx.get_text(strip=True))
            break

    # educationType
    education_type = ''
    val_spans = soup.select('span.val')
    for s in val_spans:
        t = s.get_text(strip=True)
        if '대면' in t or '비대면' in t or '혼합' in t:
            education_type = t
            break

    # totalParticipants
    total_participants = ''
    for s in val_spans:
        parent = s.parent
        if parent and '총' in parent.get_text() and '명' in parent.get_text():
            total_participants = s.get_text(strip=True)
            break

    # venue / venueAddress
    venue = ''
    venue_address = ''
    for td in title_tds:
        if '연수원명' in td.get_text():
            nx = td.find_next_sibling()
            if nx:
                v = nx.select_one('span.val')
                venue = v.get_text(strip=True) if v else nx.get_text(strip=True)
        if '주소' in td.get_text():
            nx = td.find_next_sibling()
            if nx:
                v = nx.select_one('span.val')
                venue_address = v.get_text(strip=True) if v else nx.get_text(strip=True)

    # operationIM
    operation_im = ''
    im_select = soup.select_one('select[name="im_no"]')
    if im_select:
        selected = im_select.select_one('option[selected]')
        if selected:
            operation_im = selected.get_text(strip=True).replace('\u00a0', ' ')

    # amName, amPhone
    am_name = ''
    am_phone = ''
    for td in title_tds:
        if '담당AM' in td.get_text():
            nx = td.find_next_sibling()
            if nx:
                b = nx.find('b')
                am_name = b.get_text(strip=True) if b else ''
                tel = nx.select_one('span.contactTel')
                am_phone = tel.get_text(strip=True) if tel else ''
            break

    # clientContact
    client_contact = ''
    client_contact_id = ''
    client_contact_position = ''
    client_contact_dept = ''
    contact_select = soup.select_one('select[name="im_contactor"]')
    if contact_select:
        selected = contact_select.select_one('option[selected]')
        if selected:
            client_contact_id = selected.get('value', '') or ''
            raw = selected.get_text(strip=True).replace('\u00a0', ' ')
            cm = re.match(r'^(.+?)\s+(.*?)\((.*?)\)$', raw)
            if cm:
                client_contact = cm.group(1)
                client_contact_position = cm.group(2)
                client_contact_dept = cm.group(3)
            else:
                client_contact = raw

    # clientContactPhone / Mobile
    client_contact_phone = ''
    client_contact_mobile = ''
    contact_tels = soup.select('span.contactTel')
    tel_arr = [t.get_text(strip=True) for t in contact_tels]
    if len(tel_arr) >= 3:
        client_contact_phone = tel_arr[1] or ''
        client_contact_mobile = tel_arr[2] or ''

    # echoStatus
    echo_status = ''
    for s in soup.select('span.alert'):
        if '에코 제외' in s.get_text():
            echo_status = '에코 제외'
            break

    # sheetState
    sheet_state = ''
    m = re.search(r'const\s+sheetState\s*=\s*"([^"]+)"', html)
    if m:
        sheet_state = m.group(1)

    # surveyUsed
    survey_used = ''
    for chk in soup.select('input[name="survey"]'):
        # BeautifulSoup에서는 checked 속성 존재로 판단
        if chk.has_attr('checked'):
            survey_used = chk.get('value', '') or ''
            break
    if not survey_used:
        for td in title_tds:
            if '설문지' in td.get_text():
                nx = td.find_next_sibling()
                if nx:
                    v = nx.select_one('span.val')
                    raw = v.get_text(strip=True) if v else ''
                    if raw and '기존 설문문항' not in raw and '고객사제공' not in raw:
                        survey_used = raw
                break

    # 다차수 교육일정
    schedules = []
    # sDate 대소문자 소문자 주의: BeautifulSoup 기본 lxml/html.parser 는 lowercase
    for idx, div in enumerate(soup.find_all('div', attrs={'sdate': True})):
        d1 = div.get('courseday_d1', '') or ''
        schedules.append({
            'sessionIndex': idx + 1,
            'startDate': div.get('sdate', '') or '',
            'endDate': div.get('edate', '') or '',
            'days': d1,
            'nights': div.get('courseday_d2', '') or '',
            'participants': div.get('courseday_person', '') or '0',
            'isOvernight': _parse_int(d1) > 0,
        })

    return {
        'projectId': project_id,
        'orderCode': order_code,
        'company': company,
        'educationType': education_type,
        'totalParticipants': total_participants,
        'venue': venue,
        'venueAddress': venue_address,
        'operationIM': operation_im,
        'amName': am_name,
        'amPhone': am_phone,
        'clientContact': client_contact,
        'clientContactId': client_contact_id,
        'clientContactPosition': client_contact_position,
        'clientContactDept': client_contact_dept,
        'clientContactPhone': client_contact_phone,
        'clientContactMobile': client_contact_mobile,
        'echoStatus': echo_status,
        'sheetState': sheet_state,
        'surveyUsed': survey_used,
        'schedules': schedules,
    }


def _parse_int(s) -> int:
    try:
        return int(str(s).strip() or '0')
    except (ValueError, TypeError):
        return 0
