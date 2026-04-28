"""
JS↔Python 동등성 검증

공통 픽스처(`lib/bris-parser/test/fixtures/`)의 HTML 을 Python 으로 파싱하고
camelCase 로 변환한 결과가 JS 가 생성한 `*.expected.json` 과 일치하는지 확인.
"""

import json
from pathlib import Path

from bris_parser import parse_as_camelcase

FIXTURES_DIR = Path(__file__).resolve().parent.parent.parent / 'bris-parser' / 'test' / 'fixtures'


EQUIV_CASES = [
    'integrated_basic',
    'integrated_with_instructors',
    'integrated_echo_excluded',
    'integrated_complain_reference_2026_04',
]


def _check_equivalence(name: str):
    html_path = FIXTURES_DIR / f'{name}.html'
    expected_path = FIXTURES_DIR / f'{name}.expected.json'

    html = html_path.read_text(encoding='utf-8')
    expected = json.loads(expected_path.read_text(encoding='utf-8'))
    actual = parse_as_camelcase(html)

    assert actual == expected, (
        f'Python camelCase ≠ JS expected for {name}\n'
        f'  expected: {json.dumps(expected, ensure_ascii=False, indent=2)[:500]}\n'
        f'  actual:   {json.dumps(actual, ensure_ascii=False, indent=2)[:500]}'
    )


def test_equivalence_basic():
    _check_equivalence('integrated_basic')


def test_equivalence_with_instructors():
    _check_equivalence('integrated_with_instructors')


def test_equivalence_echo_excluded():
    _check_equivalence('integrated_echo_excluded')


def test_equivalence_complain_reference_2026_04():
    """place_id + echoExcludeReason 회귀 — 2026-04 샘플"""
    _check_equivalence('integrated_complain_reference_2026_04')
