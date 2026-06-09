"""이상치 검토 화면 스모크 — flag 생성·resp_id 정합·결정 append·미결 집계."""
import pytest
from fastapi.testclient import TestClient

import app.main as main
from app import outliers as ol, store

client = TestClient(main.app)


@pytest.fixture
def tmp_ledger(tmp_path, monkeypatch):
    """결정은 임시 원장에 기록(실제 시험 원장 보존)."""
    led = tmp_path / "decisions_test.yaml"
    monkeypatch.setattr(main, "DECISIONS", led)
    return led


def _flags():
    import curation_engine as ce
    df = ce.assign_ids(ce.load_df(main.DATA))
    return df, ol.build_flags(df)


def test_flags_built_and_resp_id_aligned():
    df, flags = _flags()
    assert len(flags) > 50                       # 21회 cleaned 다수 후보
    f = flags[0]
    # row_idx(df 위치) → resp_id 정합 (R%04d)
    assert df.iloc[f["row_idx"]]["resp_id"] == f["resp_id"]
    assert f["key"] == f"{f['resp_id']}__{f['rule_id']}"


def test_page_renders(tmp_ledger):
    r = client.get("/outliers")
    assert r.status_code == 200
    assert "이상치 후보" in r.text and "미결" in r.text


def test_severity_filter(tmp_ledger):
    r = client.get("/outliers?sev=critical")
    assert r.status_code == 200
    assert "critical" in r.text


def test_approve_marks_resolved_and_drops_pending(tmp_ledger):
    _, flags = _flags()
    before = ol.summarize(flags, store.load(tmp_ledger)[1])["pending"]
    f = flags[0]
    r = client.post("/outliers/decide", data={
        "resp_id": f["resp_id"], "rule_id": f["rule_id"], "col": f["col"],
        "before": f["value"], "action": "approved",
    })
    assert r.status_code == 200
    assert "승인" in r.text
    after = ol.summarize(flags, store.load(tmp_ledger)[1])["pending"]
    assert after == before - 1


def test_correction_appends_correction_decision(tmp_ledger):
    _, flags = _flags()
    f = next(fl for fl in flags if fl["col"] == "p1)R_1_1_2")
    r = client.post("/outliers/decide", data={
        "resp_id": f["resp_id"], "rule_id": f["rule_id"], "col": f["col"],
        "before": f["value"], "after": "3400000000", "action": "correct",
    })
    assert r.status_code == 200
    assert "보정완료" in r.text
    _, decisions = store.load(tmp_ledger)
    corr = [d for d in decisions if d["type"] == "correction" and d["resp_id"] == f["resp_id"]]
    assert corr and str(corr[-1]["after"]) == "3400000000"
