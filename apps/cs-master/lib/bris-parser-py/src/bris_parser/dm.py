"""
DM 상세 (dm/dm_view.asp) HTML → 고객 담당자 정보 추출
JS lib/bris-parser/src/dm.js 와 1:1 동등.
"""

import re
from bs4 import BeautifulSoup

from .utils import normalize_phone


def extract_dm_data(html: str) -> dict:
    soup = BeautifulSoup(html, 'html.parser')

    customer_id = ''
    cust_input = soup.select_one('input[name="CUSTOMER_ID"]')
    if cust_input:
        customer_id = cust_input.get('value', '') or ''

    company = ''
    company_grade = ''
    place_link = soup.select_one('a[href*="place_view.asp"]')
    if place_link:
        company = place_link.get_text(strip=True)

    td_headers = soup.select('td[bgcolor="#DDECB4"]')
    for td in td_headers:
        if '사업장등급' in td.get_text():
            nx = td.find_next_sibling()
            if nx:
                company_grade = nx.get_text(strip=True)

    name = ''
    position = ''
    for td in td_headers:
        if td.get_text(strip=True) == '성명':
            nx = td.find_next_sibling()
            if nx:
                parts = nx.get_text(strip=True).split()
                name = parts[0] if len(parts) >= 1 else ''
                position = parts[1] if len(parts) >= 2 else ''
            break

    phone = ''
    mobile = ''
    for td in td_headers:
        tx = td.get_text()
        if '전화' in tx and '휴대' in tx:
            nx = td.find_next_sibling()
            if nx:
                inner = nx.decode_contents()
                sms_match = re.search(r"goSMS\s*\(\s*'(\d+)'", inner)
                parts = re.split(r'<br\s*/?>', inner, flags=re.I)
                phone_part = re.sub(r'<[^>]*>', '', parts[0] if parts else '').strip()
                mobile_part_raw = parts[1] if len(parts) > 1 else ''
                mobile_part = re.sub(r'<[^>]*>', '', mobile_part_raw)
                mobile_part = re.sub(r'&nbsp;', '', mobile_part, flags=re.I).strip()
                phone_nums = re.findall(r'[\d\-]+', phone_part) or []
                mobile_nums = re.findall(r'[\d\-]+', mobile_part) or []
                phone = phone_nums[0] if phone_nums else ''
                mobile = sms_match.group(1) if sms_match else (mobile_nums[0] if mobile_nums else '')
            break

    department = ''
    for td in td_headers:
        if td.get_text(strip=True) == '부서':
            nx = td.find_next_sibling()
            if nx:
                department = nx.get_text(strip=True)
            break

    email = ''
    mail_link = soup.select_one('a[href^="mailto:"]')
    if mail_link:
        email = mail_link.get_text(strip=True)

    dm_subscription = ''
    for td in td_headers:
        if 'DM수신여부' in td.get_text():
            nx = td.find_next_sibling()
            if nx:
                dm_subscription = nx.get_text(strip=True)
            break

    customer_level = ''
    for td in td_headers:
        if '고객레벨' in td.get_text():
            nx = td.find_next_sibling()
            if nx:
                customer_level = nx.get_text(strip=True)
            break

    return {
        'customerId': customer_id,
        'company': company,
        'companyGrade': company_grade,
        'name': name,
        'position': position,
        'department': department,
        'phone': normalize_phone(phone),
        'mobile': normalize_phone(mobile),
        'email': email,
        'dmSubscription': dm_subscription,
        'customerLevel': customer_level,
    }
