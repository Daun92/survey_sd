"""echo_view 파서 — JS 골든 동등성"""

import json
from pathlib import Path

from bris_parser import extract_echoview_data

FIX = Path(__file__).resolve().parent.parent.parent / 'bris-parser' / 'test' / 'fixtures'


def test_echo_view_equivalence():
    html = (FIX / 'echo_view.html').read_text(encoding='utf-8')
    expected = json.loads((FIX / 'echo_view.expected.json').read_text(encoding='utf-8'))
    actual = extract_echoview_data(html)
    assert actual == expected
