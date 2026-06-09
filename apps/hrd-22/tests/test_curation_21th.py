"""정제 엔진(라운드 어댑터 + curation_engine) 도구 동작 검증 — 21회 데이터."""
import importlib.util
import warnings
from pathlib import Path

import pandas as pd
import pytest
import yaml

warnings.filterwarnings("ignore")
ROOT = Path(__file__).resolve().parents[1]


def _load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


ra = _load("round_adapter")
ce = _load("curation_engine")

ORIG = ROOT / "reference/21th_cleaned.xlsx"
ADAPTED = ROOT / "workspace/21th_cleaned_as22.xlsx"


@pytest.fixture(scope="module")
def adapted():
    inv = ra.load_inverse_map()
    df = pd.read_excel(ORIG, sheet_name="Sheet1", dtype=object)
    df2, log = ra.adapt(df, inv)
    return df, df2, log


# ── 라운드 어댑터 ──

def test_no_duplicate_columns(adapted):
    _, df2, _ = adapted
    assert df2.columns.duplicated().sum() == 0


def test_collision_value_preserved(adapted):
    orig, df2, _ = adapted

    def eq(a, b):
        return a.fillna("∅").astype(str).reset_index(drop=True).equals(
            b.fillna("∅").astype(str).reset_index(drop=True))
    # 21 R_5_1_2(시간)→22 R_7_1_2, 21 R_7_1_2(지출집합)→22 R_11_1_2
    assert eq(df2["p1)R_7_1_2"], orig["p1)R_5_1_2"])
    assert eq(df2["p1)R_11_1_2"], orig["p1)R_7_1_2"])
    assert eq(df2["p1)R_9_1_2"], orig["p1)R_6_1_2"])
    assert eq(df2["p1)R_3_n_2"], orig["p1)R_2_n_2"])


def test_missing_includes_22th_new(adapted):
    _, _, log = adapted
    miss = set(log["missing_in_21th"])
    assert "p1)R_13_multi" in miss      # AI 비율 (22회 신규)
    assert "p5)R_11_multi" in miss      # 향후 AI 계획 (22회 신규)


def test_dropped_21native_R9(adapted):
    _, _, log = adapted
    # 21회 공공직급별 R_9_1_*(22회 삭제)가 drop됨
    assert all(c.startswith("p1)R_9_1_") for c in log["dropped_21native"])
    assert len(log["dropped_21native"]) == 6


# ── curation_engine ──

@pytest.fixture(scope="module")
def src_df():
    return ce.load_df(ADAPTED)


@pytest.fixture(scope="module")
def decisions():
    doc = yaml.safe_load((ROOT / "config/decisions_21th.yaml").read_text(encoding="utf-8"))
    return doc["decisions"]


def test_idempotent(src_df, decisions):
    o1, _ = ce.apply_decisions(src_df, decisions)
    o2, _ = ce.apply_decisions(
        o1.drop(columns=["resp_id", "org_key", "src_hash", "excluded_from_kim"]), decisions)
    assert o1.reset_index(drop=True).astype(str).equals(o2.reset_index(drop=True).astype(str))


def test_apply_effects(src_df, decisions):
    o, _ = ce.apply_decisions(src_df, decisions)
    assert bool(o.loc[o.resp_id == "R0010", "excluded_from_kim"].iloc[0]) is True
    assert str(o.loc[o.resp_id == "R0020", "R_Cate"].iloc[0]) == "9"
    assert str(o.loc[o.resp_id == "R0030", "p1)R_1_1_2"].iloc[0]) == "999999999999"
    assert int(o["excluded_from_kim"].sum()) == 1


def test_dedup_groups(src_df):
    df = ce.assign_ids(src_df)
    df["_comp"] = ce.completeness(df)
    groups = [g for _, g in df.groupby("org_key") if len(g) > 1]
    assert len(groups) >= 8       # 최소 8개 사업자번호 중복 그룹
    conflict = sum(1 for g in groups if g["R_Div"].astype(str).nunique() > 1)
    assert conflict == 3          # 인천공항·디알비동일·넥센타이어 R_Div 불일치
