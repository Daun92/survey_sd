"""집계기(stage4_extract_chart_data) 도구 동작 검증 — 21회 데이터."""
import importlib.util
import json
import warnings
from pathlib import Path

import pytest

warnings.filterwarnings("ignore")
ROOT = Path(__file__).resolve().parents[1]


def _load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


ex = _load("stage4_extract_chart_data")
CHART_JSON = ROOT / "4_aggregated/chart_data_21th.json"


# ── 집계법 자동추론 ──

@pytest.mark.parametrize("resp_format,expected", [
    ("숫자(%)", "mean_pct"),
    ("1~5점 척도", "likert"),
    ("숫자(명)", "mean"),
    ("숫자(원)", "mean"),
    ("숫자(시간)", "mean"),
    ("쉼표구분 복수응답 (1~16번)", "multi_rate"),
    ("순위)항목번호_그룹번호 형식", "rank"),
    ("1=있음, 2=없음", "dist"),
    ("1~5=증가(1~5%/6~15%)", "dist"),
    ("1=매우만족, 2=만족", "dist"),
    ("텍스트", "skip"),
    ("이메일 형식", "skip"),
    ("YYYY-MM-DD HH:MM", "skip"),
])
def test_infer_agg(resp_format, expected):
    assert ex.infer_agg(resp_format) == expected


def test_likert_not_misclassified_as_dist():
    # '1~5점 척도'(likert)가 enum '1=' 규칙보다 우선
    assert ex.infer_agg("1~5점 척도") == "likert"


# ── 산출 JSON ──

@pytest.fixture(scope="module")
def data():
    assert CHART_JSON.exists(), "먼저 stage4_extract_chart_data.py 실행 필요"
    return json.loads(CHART_JSON.read_text(encoding="utf-8"))


def test_charts_produced(data):
    assert len(data["charts"]) > 80
    aggs = {c["agg"] for c in data["charts"]}
    assert {"mean", "dist", "mean_pct", "likert", "multi_rate"} <= aggs


def test_size_tier_rollup_sums(data):
    st = [c for c in data["charts"] if c["segment"] == "size_tier"][0]["segments"]
    parts = st["299이하"]["N"] + st["300-999"]["N"] + st["1000이상"]["N"]
    assert parts == st["전체"]["N"]            # 3단계 roll-up == 전체
    assert st["공공"]["N"] > 0                 # 공공 세그먼트 포함됨


def test_dist_sums_to_100(data):
    for c in data["charts"]:
        if c["agg"] != "dist":
            continue
        for seg in c["segments"].values():
            for var, dist in seg["agg"].items():
                if isinstance(dist, dict) and dist:
                    assert abs(sum(dist.values()) - 100) <= 1.0   # 분포 합 ≈ 100
            break
        break


def test_no_unknown_agg(data):
    for c in data["charts"]:
        assert c["agg"] in {"mean", "mean_pct", "dist", "likert", "multi_rate", "rank"}


def test_mean_pct_normalized_to_100(data):
    # 합계 100% 그룹(다항목)은 그룹 일관 분모 정규화로 합≈100
    checked = 0
    for c in data["charts"]:
        if c["agg"] != "mean_pct":
            continue
        for seg in c["segments"].values():
            a = seg["agg"]
            groups = [a] if "_sum" in a else [v for v in a.values() if isinstance(v, dict) and "_sum" in v]
            for g in groups:
                items = [k for k in g if not k.startswith("_")]
                if len(items) > 1 and g.get("_base_N", 0) > 0:   # 다항목 + 응답 있음
                    assert abs(g["_sum"] - 100) <= 1.0
                    checked += 1
    assert checked > 0


def test_corporate_public_split(data):
    # 합의 명세: 기업(주 분석)/공공(별도) 분리. POPULATION_FILTER_SPEC_22th.md
    pn = data["population_N"]
    assert isinstance(pn, dict) and "기업" in pn and "공공" in pn
    assert pn["기업"] > pn["공공"]          # 기업이 주 모집단
    assert pn["공공"] > 0                   # 공공 별도 집계 (한계2 해소: 0 아님)
    # size_tier 전체 == 기업 모집단, 공공 컬럼 별도
    st = [c for c in data["charts"] if c["segment"] == "size_tier"][0]["segments"]
    assert st["전체"]["N"] == pn["기업"]
    assert st["공공"]["N"] == pn["공공"]
