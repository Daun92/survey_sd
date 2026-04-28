"""project_detail + project_biz_list 파서 — JS 골든 동등성"""

import json
from pathlib import Path

from bris_parser import extract_project_detail_data, extract_project_biz_list

FIX = Path(__file__).resolve().parent.parent.parent / 'bris-parser' / 'test' / 'fixtures'


def test_project_detail_equivalence():
    html = (FIX / 'project_detail.html').read_text(encoding='utf-8')
    expected = json.loads((FIX / 'project_detail.expected.json').read_text(encoding='utf-8'))
    actual = extract_project_detail_data(html)
    assert actual == expected


def test_project_biz_list_equivalence():
    html = (FIX / 'project_biz.html').read_text(encoding='utf-8')
    expected = json.loads((FIX / 'project_biz.expected.json').read_text(encoding='utf-8'))
    actual = extract_project_biz_list(html)
    assert actual == expected
