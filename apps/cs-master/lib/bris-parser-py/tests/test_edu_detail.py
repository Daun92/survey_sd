"""edu_detail 파서 — JS 골든 동등성"""

import json
from pathlib import Path

from bris_parser import extract_edu_detail_data

FIX = Path(__file__).resolve().parent.parent.parent / 'bris-parser' / 'test' / 'fixtures'


def test_edu_detail_equivalence():
    html = (FIX / 'edu_detail.html').read_text(encoding='utf-8')
    expected = json.loads((FIX / 'edu_detail.expected.json').read_text(encoding='utf-8'))
    actual = extract_edu_detail_data(html)
    assert actual == expected
