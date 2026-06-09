"""업종 재분류 화면 스모크 — etc 후보·재분류 결정 append·미결 집계."""
import pytest
from fastapi.testclient import TestClient

import app.main as main
from app import reclassify as rc, store
import curation_engine as ce

client = TestClient(main.app)


@pytest.fixture
def tmp_ledger(tmp_path, monkeypatch):
    led = tmp_path / "decisions_test.yaml"
    monkeypatch.setattr(main, "DECISIONS", led)
    return led


def _cands():
    df = ce.assign_ids(ce.load_df(main.DATA))
    return rc.candidates(df)


def test_candidates_are_corporate_etc():
    cands = _cands()
    assert len(cands) == 38                       # 21회 cleaned 기업 etc
    assert all(c["resp_id"].startswith("R") for c in cands)


def test_page_renders(tmp_ledger):
    r = client.get("/reclassify")
    assert r.status_code == 200
    assert "etc 후보" in r.text and "표준 업종" in r.text


def test_reclassify_appends_decision_and_resolves(tmp_ledger):
    cands = _cands()
    before = rc.summarize(cands, store.load(tmp_ledger)[1])["pending"]
    rid = cands[0]["resp_id"]
    r = client.post("/reclassify/decide", data={"resp_id": rid, "before": "etc", "after": "9"})
    assert r.status_code == 200
    assert "IT/Software" in r.text                 # after_label 표기
    _, decisions = store.load(tmp_ledger)
    d = [x for x in decisions if x["resp_id"] == rid and x["type"] == "reclassification"]
    assert d and d[-1]["after"] == "9" and d[-1]["after_label"] == "IT/Software"
    after = rc.summarize(cands, decisions)["pending"]
    assert after == before - 1
