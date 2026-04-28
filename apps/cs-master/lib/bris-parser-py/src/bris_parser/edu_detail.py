"""
교육세부 (education_view.asp) HTML → 과정 상세 추출
JS lib/bris-parser/src/edu-detail.js 와 1:1 동등.
"""

import json
import re
from bs4 import BeautifulSoup

from .utils import normalize_text


def extract_edu_detail_data(html: str) -> dict:
    soup = BeautifulSoup(html, 'html.parser')

    biz_input = soup.select_one(
        'input[id="businessId"], input[name="businessId"], input[name="business_id"]'
    )
    business_id = biz_input.get('value', '') if biz_input else ''

    order_code = ''
    project_id = ''
    project_link = soup.select_one('a[href*="project_view.asp"]')
    if project_link:
        order_code = project_link.get_text(strip=True)
        href = project_link.get('href', '') or ''
        m = re.search(r'PROJECT_ID=(\d+)', href)
        project_id = m.group(1) if m else ''

    td_headers = soup.select('td[bgcolor="#DDECB4"]')
    company = ''
    internal_manager = ''
    course_name = ''
    program_name = ''
    customer_id = ''
    customer_name = ''

    for th in td_headers:
        text = normalize_text(th.get_text()).replace('*', '')
        next_td = th.find_next_sibling()
        if not next_td:
            continue
        val = normalize_text(next_td.get_text())
        if text == '회사명':
            company = val
        elif text == '담당자':
            internal_manager = val
            customer_id = next_td.get('data-customer-id', '') or ''
            customer_name = next_td.get('data-customer-name', '') or ''
            if not customer_id:
                dm_link = next_td.select_one(
                    'a[href*="dm_view.asp"], a[href*="CUSTOMER_ID"]'
                )
                if dm_link:
                    href = dm_link.get('href', '') or ''
                    m = re.search(r'CUSTOMER_ID=(\d+)', href)
                    if m:
                        customer_id = m.group(1)
                    if not customer_name:
                        customer_name = dm_link.get_text(strip=True)
        elif text == '과정명':
            course_name = val
        elif text == '프로그램명':
            program_name = val

    # fallback: 페이지 전체에서 dm_view.asp 링크 탐색
    if not customer_id:
        dm_link_fallback = soup.select_one('a[href*="dm_view.asp"]')
        if dm_link_fallback:
            href = dm_link_fallback.get('href', '') or ''
            m = re.search(r'CUSTOMER_ID=(\d+)', href)
            if m:
                customer_id = m.group(1)
            if not customer_name:
                customer_name = dm_link_fallback.get_text(strip=True)

    # 강사: inst_fee_edit 링크 텍스트
    instructor_links = soup.select('a[href*="inst_fee_edit.asp"]')
    instructors = [
        a.get_text(strip=True) for a in instructor_links if a.get_text(strip=True)
    ]

    # 진행자(LF): al_person 배열에서 name 추출
    facilitators = []
    al_match = re.search(r'al_person\s*:\s*\[([\s\S]*?)\]', html)
    if al_match and al_match.group(1).strip():
        try:
            fixed = re.sub(r'(\w+)\s*:', r'"\1":', al_match.group(1))
            fixed = fixed.replace("'", '"')
            arr = json.loads('[' + fixed + ']')
            seen = set()
            for p in arr:
                nm = p.get('name') if isinstance(p, dict) else None
                if nm and nm not in seen:
                    seen.add(nm)
                    facilitators.append(nm)
        except Exception:
            # 패턴 2: name 필드만 regex 추출
            seen = set()
            for m in re.finditer(
                r'name\s*:\s*[\'"]([^\'"]+)[\'"]', al_match.group(1)
            ):
                nm = m.group(1)
                if nm and nm not in seen:
                    seen.add(nm)
                    facilitators.append(nm)

    # 대면/비대면
    edu_delivery = ''
    for th in td_headers:
        text = th.get_text(strip=True)
        if '비대면' in text:
            next_td = th.find_next_sibling()
            if next_td:
                val = next_td.get_text(strip=True)
                if '비대면' in val:
                    edu_delivery = '비대면'
                elif '대면' in val:
                    edu_delivery = '대면'
                else:
                    edu_delivery = val
            break

    return {
        'businessId': business_id,
        'orderCode': order_code,
        'projectId': project_id,
        'company': company,
        'internalManager': internal_manager,
        'courseName': course_name,
        'programName': program_name,
        'customerId': customer_id,
        'customerName': customer_name,
        'instructors': instructors,
        'facilitators': facilitators,
        'eduDelivery': edu_delivery,
    }
