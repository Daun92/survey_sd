"""산출/미리보기 스모크 — 결정 적용 스냅샷 → stage4 2종 실행 → 요약."""
import pytest
from fastapi.testclient import TestClient

import app.main as main
from app import build as bd

client = TestClient(main.app)


@pytest.fixture
def tmp_outputs(monkeypatch):
    """산출물을 repo 4_aggregated/_test_* 로 (운영 경로 레이아웃 동일·검증 fixture 보존).

    stage4_build_kim_xlsx 가 out.relative_to(ROOT) 를 호출하므로 ROOT 하위여야 함.
    """
    base = bd.ROOT / "4_aggregated"
    paths = {"SNAPSHOT": base / "_test_snap.xlsx", "KIM_OUT": base / "_test_kim.xlsx",
             "CHART_OUT": base / "_test_chart.json"}
    for name, p in paths.items():
        monkeypatch.setattr(bd, name, p)
    yield paths
    for p in paths.values():
        p.unlink(missing_ok=True)


def test_page_renders():
    r = client.get("/build")
    assert r.status_code == 200
    assert "재생성" in r.text


def test_run_builds_outputs_and_summary(tmp_outputs):
    r = client.post("/build/run")
    assert r.status_code == 200
    assert "재생성 완료" in r.text
    assert "도표 데이터" in r.text
    # 산출물 실제 생성
    assert tmp_outputs["KIM_OUT"].exists()
    assert tmp_outputs["CHART_OUT"].exists()


def test_run_engine_summary_shape(tmp_outputs):
    from app import store
    meta, decisions = store.load(main.DECISIONS)
    res = bd.run(main.DATA, decisions, snap=tmp_outputs["SNAPSHOT"],
                 kim_out=tmp_outputs["KIM_OUT"], chart_out=tmp_outputs["CHART_OUT"])
    assert res["ok"]
    assert res["chart"]["n_charts"] > 80
    assert res["chart"]["population_N"]["기업"] > res["chart"]["population_N"]["공공"] > 0
    assert len(res["sheets"]) == 7          # 전체+규모5+공공
