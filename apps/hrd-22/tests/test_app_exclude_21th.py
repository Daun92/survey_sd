"""포함/제외 화면 스모크 — 실시간 N·검색·제외/복원 토글."""
import pytest
from fastapi.testclient import TestClient

import app.main as main
from app import exclude as ex_app, store
import curation_engine as ce

client = TestClient(main.app)


@pytest.fixture
def tmp_ledger(tmp_path, monkeypatch):
    led = tmp_path / "decisions_test.yaml"
    monkeypatch.setattr(main, "DECISIONS", led)
    return led


def _df():
    return ce.assign_ids(ce.load_df(main.DATA))


def test_counts_live():
    c = ex_app.counts(_df(), [])
    assert c["corp_N"] > 0 and c["pub_N"] > 0 and c["excluded_n"] == 0


def test_page_and_search(tmp_ledger):
    r = client.get("/exclude")
    assert r.status_code == 200 and "기업 모집단(실시간)" in r.text
    rid = _df()["resp_id"].iloc[0]
    rs = client.get("/exclude/search", params={"q": rid})
    assert rs.status_code == 200 and rid in rs.text


def test_exclude_then_restore_changes_N(tmp_ledger):
    df = _df()
    # 기업(R_Div 1·2·3)이면서 모집단에 포함된 응답자 1명 선택
    pop = ex_app.applied(df, [])
    import pandas as pd
    base = ex_app.counts(df, [])
    target = df[pd.to_numeric(df["R_Div"], errors="coerce").isin([1, 2, 3])]["resp_id"].iloc[0]

    r = client.post("/exclude/toggle", data={"resp_id": target, "excluded": "true"})
    assert r.status_code == 200 and "제외됨" in r.text
    after_excl = ex_app.counts(df, store.load(tmp_ledger)[1])
    assert after_excl["excluded_n"] == 1

    r2 = client.post("/exclude/toggle", data={"resp_id": target, "excluded": "false"})
    assert r2.status_code == 200 and "포함" in r2.text
    restored = ex_app.counts(df, store.load(tmp_ledger)[1])
    assert restored["excluded_n"] == 0 and restored["corp_N"] == base["corp_N"]
