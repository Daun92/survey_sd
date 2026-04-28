"""echo_data 파서 — JS 골든 동등성"""

import json
from pathlib import Path

from bris_parser import extract_echo_data

FIX = Path(__file__).resolve().parent.parent.parent / 'bris-parser' / 'test' / 'fixtures'


def test_echo_data_equivalence():
    html = (FIX / 'echo_data.html').read_text(encoding='utf-8')
    expected = json.loads((FIX / 'echo_data.expected.json').read_text(encoding='utf-8'))
    actual = extract_echo_data(html)
    assert actual == expected
