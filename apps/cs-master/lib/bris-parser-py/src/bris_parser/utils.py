"""
공통 정규화 유틸 — JS lib/bris-parser/src/utils.js 와 1:1 동등.
"""

import re
import time
import random


def gen_id() -> str:
    """JS genId(): Date.now().toString(36) + Math.random().toString(36).slice(2,7)"""
    ts = int(time.time() * 1000)
    ts_b36 = _to_base36(ts)
    rand = ''.join(
        random.choice('0123456789abcdefghijklmnopqrstuvwxyz')
        for _ in range(5)
    )
    return ts_b36 + rand


def _to_base36(n: int) -> str:
    chars = '0123456789abcdefghijklmnopqrstuvwxyz'
    if n == 0:
        return '0'
    out = []
    while n:
        out.append(chars[n % 36])
        n //= 36
    return ''.join(reversed(out))


def normalize_text(s: str) -> str:
    """NBSP(\\u00a0) + 전각공백(\\u3000) + ZWB(\\u200b) → 일반 공백, trim"""
    if not s:
        return ''
    return re.sub(r'[\u00a0\u3000\u200b]', ' ', s).strip()


def normalize_phone(raw: str) -> str:
    """한글/공백/콜론 prefix 제거 → 숫자만 → 02/휴대/일반 하이픈 포맷"""
    if not raw:
        return ''
    s = re.sub(r'^[가-힣\s:：]+', '', raw).strip()
    digits = re.sub(r'[^\d]', '', s)
    if not digits:
        return ''
    if digits.startswith('02'):
        if len(digits) <= 9:
            return re.sub(r'^(02)(\d{3,4})(\d{4})$', r'\1-\2-\3', digits)
        return re.sub(r'^(02)(\d{4})(\d{4})$', r'\1-\2-\3', digits)
    if len(digits) == 11:
        return re.sub(r'^(\d{3})(\d{4})(\d{4})$', r'\1-\2-\3', digits)
    if len(digits) == 10:
        return re.sub(r'^(\d{3})(\d{3})(\d{4})$', r'\1-\2-\3', digits)
    return digits


def normalize_date(s: str) -> str:
    """YYYYMMDD → YYYY-MM-DD (이미 ISO면 통과)"""
    if not s:
        return ''
    s = s.strip()
    if re.match(r'^\d{4}-\d{2}-\d{2}$', s):
        return s
    m = re.match(r'^(\d{4})(\d{2})(\d{2})$', s)
    if m:
        return f'{m.group(1)}-{m.group(2)}-{m.group(3)}'
    return s


def parse_bris_date(s: str) -> dict:
    """"2025/04/23~05/30" → {startDate, endDate}"""
    s = (s or '').strip()
    m = re.search(r'(\d{4})/(\d{2})/(\d{2})[→~](\d{2})/(\d{2})', s)
    if m:
        return {
            'startDate': f'{m.group(1)}-{m.group(2)}-{m.group(3)}',
            'endDate': f'{m.group(1)}-{m.group(4)}-{m.group(5)}',
        }
    m = re.search(r'(\d{4})/(\d{2})/(\d{2})', s)
    if m:
        d = f'{m.group(1)}-{m.group(2)}-{m.group(3)}'
        return {'startDate': d, 'endDate': d}
    return {'startDate': '', 'endDate': ''}


def normalize_team_name(raw: str) -> str:
    """팀 코드 제거: '201205002 - 변화디자인팀' → '변화디자인팀'"""
    if not raw:
        return ''
    m = re.match(r'^\d+\s*-\s*(.+)$', raw)
    return m.group(1).strip() if m else raw.strip()


def esc(s: str) -> str:
    """HTML escape — & < > 만 변환 (JS textContent→innerHTML 과 동등)"""
    if not s:
        return ''
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
