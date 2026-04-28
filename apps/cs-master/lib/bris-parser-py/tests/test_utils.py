"""공통 유틸 단위 테스트 — JS 와 동일한 결과 보장"""

from bris_parser.utils import (
    normalize_text, normalize_phone, normalize_date,
    parse_bris_date, normalize_team_name, esc,
)


def test_normalize_text():
    assert normalize_text('  hello\u00a0world\u3000!  ') == 'hello world !'
    assert normalize_text('') == ''
    assert normalize_text(None) == ''


def test_normalize_date():
    assert normalize_date('20260401') == '2026-04-01'
    assert normalize_date('2026-04-01') == '2026-04-01'
    assert normalize_date('') == ''
    assert normalize_date('invalid') == 'invalid'


def test_parse_bris_date():
    assert parse_bris_date('2025/04/23~05/30') == {
        'startDate': '2025-04-23', 'endDate': '2025-05-30'
    }
    assert parse_bris_date('2025/11/17') == {
        'startDate': '2025-11-17', 'endDate': '2025-11-17'
    }
    assert parse_bris_date('') == {'startDate': '', 'endDate': ''}


def test_normalize_phone():
    assert normalize_phone('0212345678') == '02-1234-5678'
    assert normalize_phone('전화: 0212345678') == '02-1234-5678'
    assert normalize_phone('01012345678') == '010-1234-5678'
    assert normalize_phone('휴대: 010-1234-5678') == '010-1234-5678'
    assert normalize_phone('') == ''


def test_normalize_team_name():
    assert normalize_team_name('201205002 - 변화디자인팀') == '변화디자인팀'
    assert normalize_team_name('서울1팀') == '서울1팀'
    assert normalize_team_name('') == ''


def test_esc():
    assert esc('<b>hi & bye</b>') == '&lt;b&gt;hi &amp; bye&lt;/b&gt;'
    assert esc('') == ''
