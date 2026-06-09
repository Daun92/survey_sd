"""작업대 앱 스켈레톤 스모크 — 라우트 200 + 상태판 엔진 연결."""
from fastapi.testclient import TestClient

from app.main import app, status_summary

client = TestClient(app)


def test_status_summary_engine_wired():
    s = status_summary()
    assert s["corp_N"] > 0 and s["pub_N"] > 0      # 기업/공공 분리 산출
    assert s["corp_N"] > s["pub_N"]


def test_home_renders():
    r = client.get("/")
    assert r.status_code == 200
    assert "기업 모집단" in r.text


def test_stub_tabs_respond():
    for slug in ("history",):
        r = client.get(f"/{slug}")
        assert r.status_code == 200
        assert "TODO" in r.text
