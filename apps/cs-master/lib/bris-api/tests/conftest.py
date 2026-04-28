"""테스트 환경 셋업 — API_KEY env 자동 주입"""

import pytest


@pytest.fixture(autouse=True)
def _set_api_key(monkeypatch):
    monkeypatch.setenv('BRIS_API_KEY', 'test-key')
    yield
