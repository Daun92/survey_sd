"""dm 파서 — JS 골든 동등성"""

import json
from pathlib import Path

from bris_parser import extract_dm_data

FIX = Path(__file__).resolve().parent.parent.parent / 'bris-parser' / 'test' / 'fixtures'


def test_dm_equivalence():
    html = (FIX / 'dm.html').read_text(encoding='utf-8')
    expected = json.loads((FIX / 'dm.expected.json').read_text(encoding='utf-8'))
    actual = extract_dm_data(html)
    assert actual == expected
