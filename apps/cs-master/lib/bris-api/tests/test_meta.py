"""메타 엔드포인트 테스트 (인증 불필요)"""

from fastapi.testclient import TestClient

from bris_api_server import app

client = TestClient(app)


def test_health():
    r = client.get('/v1/health')
    assert r.status_code == 200
    body = r.json()
    assert body['status'] == 'ok'
    assert 'version' in body


def test_root_lists_parsers():
    r = client.get('/')
    assert r.status_code == 200
    body = r.json()
    assert body['name'] == 'BRIS Parser & Sync API'
    assert isinstance(body['parsers'], list)
    assert len(body['parsers']) == 8
    # 핵심 종류 포함 확인
    for k in ['integrated', 'integrated/camelcase', 'edu-detail', 'echo-view',
              'echo-data', 'project-detail', 'project-biz', 'dm']:
        assert k in body['parsers']


def test_openapi_available():
    r = client.get('/openapi.json')
    assert r.status_code == 200
    assert r.json()['info']['title'] == 'BRIS Parser & Sync API'
