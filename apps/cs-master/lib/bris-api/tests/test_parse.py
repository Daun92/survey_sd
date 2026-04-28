"""파서 엔드포인트 테스트 — 공통 픽스처 사용"""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from bris_api_server import app

client = TestClient(app)

# lib/bris-api/tests/test_parse.py → lib/bris-parser/test/fixtures/
FIX = (
    Path(__file__).resolve().parent.parent.parent
    / 'bris-parser' / 'test' / 'fixtures'
)

assert FIX.exists(), f'공통 픽스처 디렉터리 없음: {FIX}'

H = {'X-API-Key': 'test-key', 'Content-Type': 'text/html'}

# (kind, fixture name)
GOLDEN_CASES = [
    ('edu-detail',     'edu_detail'),
    ('echo-view',      'echo_view'),
    ('echo-data',      'echo_data'),
    ('project-detail', 'project_detail'),
    ('project-biz',    'project_biz'),
    ('dm',             'dm'),
    ('integrated/camelcase', 'integrated_with_instructors'),
    ('integrated/camelcase', 'integrated_basic'),
    ('integrated/camelcase', 'integrated_echo_excluded'),
    ('integrated/camelcase', 'integrated_complain_reference_2026_04'),
]


@pytest.mark.parametrize('kind,fixture', GOLDEN_CASES)
def test_parse_golden(kind, fixture):
    html = (FIX / f'{fixture}.html').read_text(encoding='utf-8')
    expected = json.loads((FIX / f'{fixture}.expected.json').read_text(encoding='utf-8'))
    r = client.post(f'/v1/parse/{kind}', content=html, headers=H)
    assert r.status_code == 200, r.text
    assert r.json() == expected


def test_integrated_korean_keys():
    """한글 키 출력 확인 — expected.json은 camelCase이므로 길이만 검증"""
    html = (FIX / 'integrated_with_instructors.html').read_text(encoding='utf-8')
    r = client.post('/v1/parse/integrated', content=html, headers=H)
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, list) and len(body) == 1
    assert '과정명' in body[0]
    assert '사내강사' in body[0]


def test_parse_via_json_body():
    html = (FIX / 'dm.html').read_text(encoding='utf-8')
    expected = json.loads((FIX / 'dm.expected.json').read_text(encoding='utf-8'))
    r = client.post(
        '/v1/parse/dm',
        json={'html': html},
        headers={'X-API-Key': 'test-key'},
    )
    assert r.status_code == 200
    assert r.json() == expected


def test_parse_unauthorized_no_key():
    r = client.post('/v1/parse/dm', content='<html></html>',
                    headers={'Content-Type': 'text/html'})
    assert r.status_code == 401


def test_parse_unauthorized_wrong_key():
    r = client.post('/v1/parse/dm', content='<html></html>',
                    headers={'X-API-Key': 'wrong', 'Content-Type': 'text/html'})
    assert r.status_code == 401


def test_parse_unknown_kind():
    r = client.post('/v1/parse/unknown', content='<html></html>', headers=H)
    # FastAPI는 라우터 미등록 path → 404
    assert r.status_code == 404
