"""Sync 엔드포인트 테스트 — BrisSyncPipeline mock"""

from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from bris_api_server import app
from bris_api_server.deps import get_pipeline


client = TestClient(app)

# 공통 픽스처 디렉터리 (JS/Python/REST 3계층 공유)
FIX = (
    Path(__file__).resolve().parent.parent.parent
    / 'bris-parser' / 'test' / 'fixtures'
)


@pytest.fixture
def fake_pipeline():
    """모든 sync 테스트에서 BrisSyncPipeline mock 주입"""
    fake = MagicMock()
    fake.sync.return_value = {
        'sync_id': 'abc123', 'total_records': 5,
        'companies': 1, 'places': 1, 'contacts': 2,
        'projects': 1, 'courses': 5, 'members': 3,
        'batch_id': 'batch-1', 'auto_candidates': 7, 'errors': [],
    }
    fake.sync_from_html.return_value = {
        'sync_id': 'def456', 'total_records': 2,
        'companies': 1, 'contacts': 1, 'projects': 1,
        'courses': 2, 'members': 1, 'errors': [],
    }
    app.dependency_overrides[get_pipeline] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


def test_sync_by_date(fake_pipeline):
    r = client.post(
        '/v1/sync',
        json={'startDate': '2026-04-01', 'endDate': '2026-04-30', 'autoBatch': True},
        headers={'X-API-Key': 'test-key'},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body['sync_id'] == 'abc123'
    assert body['total_records'] == 5
    assert body['batch_id'] == 'batch-1'
    fake_pipeline.sync.assert_called_once_with(
        '2026-04-01', '2026-04-30', auto_batch=True
    )


def test_sync_from_html(fake_pipeline):
    r = client.post(
        '/v1/sync/from-html',
        json={'html': '<html></html>', 'periodStart': '2026-04-01',
              'periodEnd': '2026-04-30'},
        headers={'X-API-Key': 'test-key'},
    )
    assert r.status_code == 200, r.text
    assert r.json()['sync_id'] == 'def456'
    fake_pipeline.sync_from_html.assert_called_once()


def test_sync_unauthorized():
    # 인증 실패는 dependency 평가 전에 차단되므로 mock 불필요
    r = client.post('/v1/sync',
                    json={'startDate': '2026-04-01', 'endDate': '2026-04-30'})
    assert r.status_code == 401


def test_sync_invalid_request(fake_pipeline):
    # startDate, endDate 누락 → Pydantic 422
    r = client.post('/v1/sync', json={}, headers={'X-API-Key': 'test-key'})
    assert r.status_code == 422
    fake_pipeline.sync.assert_not_called()


def test_sync_from_html_uses_real_fixture(fake_pipeline):
    """
    2026-04 컴플레인참조 샘플 HTML 을 sync_from_html 에 주입 — 요청 shape 검증.

    실제 upsert 는 목이지만, 라우터가 파서·파이프라인에 HTML 을 올바르게
    전달하는지 확인한다. (파서 자체는 test_parse.py / test_equivalence.py 가 검증)
    """
    html = (FIX / 'integrated_complain_reference_2026_04.html').read_text(encoding='utf-8')
    r = client.post(
        '/v1/sync/from-html',
        json={
            'html': html,
            'periodStart': '2026-04-01',
            'periodEnd': '2026-04-15',
            'autoBatch': False,
        },
        headers={'X-API-Key': 'test-key'},
    )
    assert r.status_code == 200, r.text
    # 파이프라인에 html 이 통째로 넘어갔는지 확인
    call_kwargs = fake_pipeline.sync_from_html.call_args
    assert call_kwargs is not None
    passed_html = call_kwargs.args[0] if call_kwargs.args else call_kwargs.kwargs.get('html', '')
    assert 'business_id : 72909' in passed_html
    assert 'echo 제외 사유' in passed_html or '에코 제외 사유' in passed_html
