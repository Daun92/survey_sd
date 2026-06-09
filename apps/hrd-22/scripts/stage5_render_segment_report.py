"""세그먼트별 분석 리포트 (HTML) — 22회.

docs/SEGMENT_REPORT_PLAN_22th.md §6 결정 반영:
  ① 포맷 A + 요약 매트릭스(스크롤 + 좌측 세그먼트 nav, 첫 화면 매트릭스)
  ② 벤치마크 = 전체 대비 ±%p 배지
  ③ 1차 범위 = 규모5 + 공공 + 전체 (업종은 2차, 재분류 후)
  ④ 소표본 = 프레임워크 단계엔 전부 렌더 + prelim 배너, N<10 은 '표본 부족' 태그 (산출 시 숨김 임계 k=10)
  ⑤ 지표 = 핵심 6 (p5·p6·p11·p12·p15·p16) 먼저 + 부록 전체 (p4·p9·p10)

재사용:
  - compute_page_data(df), render_chart_body(pid)   ← scripts/stage5_render_html.py
  - CSS, JS (deck 디자인 시스템 — 폴리시 정본)        ← scripts/stage5_render_deck.py
  - 세그먼트 정의                                      ← config/segments.yaml (sheets 7개)

세그먼트 N개를 한 문서에 넣을 때의 DOM ID 충돌은
  · JS: deck 빌더 영역을 buildSegment(PAGE_DATA, NS) 로 감싸고 getElementById( → getElementById(NS+ 치환
  · 마크업: render_chart_body 출력의 id="..." 를 id="{ns}..." 로 치환
로 세그먼트별 네임스페이스를 부여해 해소한다 (기존 deck/html 코드 무수정).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pandas as pd
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from stage5_render_html import compute_page_data, render_chart_body, multi_dist, num  # noqa: E402
from stage5_render_deck import CSS as DECK_CSS, JS as DECK_JS         # noqa: E402
from segment_aggregate import (Codebook, aggregate_segment, load_questions,  # noqa: E402
                               industry_segments, industry_availability)

ROOT = Path(__file__).resolve().parent.parent
SEGMENTS_YAML = ROOT / "config" / "segments.yaml"
DEFAULT_SRC = ROOT / "2_validated" / "raw_validated.xlsx"
DEFAULT_OUT = ROOT / "5_report" / "preview" / "segment_report_22th_20260529.html"

SMALL_N = 10                          # 소표본 임계 (④ k=10)
EMP_COL = "p1)R_1_2_2"

# 기존 deck 페이지 + 1단계 extra 블록이 이미 커버하는 문항 id (③ 정적 렌더에서 중복 제외)
DECK_COVERED = {
    "macro", "budget_chg", "ai_ratio", "satisfaction", "ai_strategy", "ai_ceo",
    "ai_stage", "ai_budget27", "form_head", "form_spend", "role_spend",
    "inc_reason", "dec_reason", "edu_time",
}
ROMAN = {1: "Ⅰ", 2: "Ⅱ", 3: "Ⅲ", 4: "Ⅳ", 5: "Ⅴ"}

# has_data 페이지 = compute_page_data 가 채우는 9개. buildSegment 가 init 전부 호출하므로 전부 렌더.
CORE_PAGES = ["p5", "p6", "p11", "p12", "p15", "p16"]   # ⑤ 핵심 6
APPENDIX_PAGES = ["p4", "p9", "p10"]                     # ⑤ 부록
PAGE_TITLE = {
    "p4": "응답기업 특성 (조직·업종)", "p5": "거시지표 — 매출·인원·예산·집행",
    "p6": "교육예산 변동 (확대/유사/축소)", "p9": "교육 형태별 참가·지출",
    "p10": "직책별 교육비 지출", "p11": "교육비 중 AI 교육 비율 ⭐",
    "p12": "교육 투자 만족도", "p15": "AI 전사 전략·CEO 지원 ⭐",
    "p16": "AI 교육 도입 단계·27년 예산 ⭐",
}


# ─────────────────────────────────────────────
# 1. 세그먼트 분리 (config/segments.yaml sheets — 규모5 + 공공 + 전체)
# ─────────────────────────────────────────────

def _build_pop(df: pd.DataFrame, spec: dict, ec, ev) -> pd.DataFrame:
    m = pd.Series(True, index=df.index)
    if "rdiv_in" in spec:
        m &= pd.to_numeric(df["R_Div"], errors="coerce").isin(spec["rdiv_in"])
    for c in spec.get("required_all", []):
        m &= pd.to_numeric(df[c], errors="coerce").notna()
    if spec.get("required_any"):
        any_m = pd.Series(False, index=df.index)
        for c in spec["required_any"]:
            any_m |= pd.to_numeric(df[c], errors="coerce").notna()
        m &= any_m
    if ec and ec in df.columns:
        m &= ~(df[ec].astype(str).str.lower() == str(ev).lower())
    return df[m].copy()


def _apply_sheet_filter(base: pd.DataFrame, sd: dict) -> pd.DataFrame:
    if sd["filter"] == "all":
        return base
    if sd["filter"] == "emp_range":
        emp = pd.to_numeric(base[EMP_COL], errors="coerce")
        mask = emp.notna()
        lo, hi = sd.get("min_inclusive"), sd.get("max_exclusive")
        if lo is not None:
            mask &= emp >= lo
        if hi is not None:
            mask &= emp < hi
        return base[mask].copy()
    raise ValueError(f"unknown filter: {sd['filter']}")


def build_segments(df: pd.DataFrame, seg_yaml: dict) -> list[dict]:
    pf = seg_yaml["population_filter"]
    ec, ev = pf.get("optional_exclusion_column"), pf.get("optional_exclusion_value")
    pops = {"corporate": _build_pop(df, pf["corporate"], ec, ev),
            "public": _build_pop(df, pf["public"], ec, ev)}
    out = []
    for i, sd in enumerate(seg_yaml["sheets"]):
        base = pops[sd.get("population", "corporate")]
        seg_df = _apply_sheet_filter(base, sd)
        out.append({"name": sd["name"], "ns": f"s{i}_", "df": seg_df, "n": len(seg_df)})
    # 업종 세그먼트 (segments.yaml industry.enabled & N≥min_n) — 재분류 후 자동 포함
    src = (seg_yaml.get("industry") or {}).get("source", "R_Cate")
    corp = pops["corporate"]
    cate = corp[src].astype(str).str.strip()
    for j, ind in enumerate(industry_segments(corp, seg_yaml)):
        seg_df = corp[cate.isin([str(c) for c in ind["codes"]])].copy()
        out.append({"name": ind["name"], "ns": f"ind{j}_", "df": seg_df, "n": len(seg_df), "industry": True})
    return out


# ─────────────────────────────────────────────
# 2. 핵심지표 추출 + 전체 대비 델타 (검증된 로직)
# ─────────────────────────────────────────────

def _lpct(lst, *labels):
    return round(sum(x["pct"] for x in lst if x["label"] in labels), 1) if lst else None


# (key, 라벨, 단위, 추출함수)
HEADLINE = [
    ("peremp", "1인당 교육비", "만원",
     lambda d: round(d["p5"]["derived"]["per_emp_won"] / 1e4, 1) if d["p5"]["derived"]["per_emp_won"] else None),
    ("rev", "매출대비 교육비", "%",
     lambda d: d["p5"]["derived"]["ratio_bud_rev"]),
    ("expand", "예산 확대", "%",
     lambda d: next((s["pct"] for s in d["p6"]["summary"] if s["label"] == "확대"), 0)),
    ("ai", "AI 교육 실행", "%",
     lambda d: _lpct(d["p11"]["dist"], "10% 미만", "10~20% 미만", "20~30% 미만", "30~50% 미만", "50% 이상")),
    ("sat", "만족 이상", "%",
     lambda d: _lpct(d["p12"]["dist"], "매우만족", "만족")),
    ("aistrat", "AI 전략 보유", "%",
     lambda d: _lpct(d["p15"]["strategy"], "전략 있음")),
    ("aistage", "AI 정착·확대", "%",
     lambda d: _lpct(d["p16"]["stage"], "정착화", "확대 단계")),
]


def extract_headline(page_data: dict) -> dict:
    return {key: fn(page_data) for key, _, _, fn in HEADLINE}


def fmt_value(v, unit) -> str:
    if v is None:
        return "—"
    return f"{v}{unit}"


def fmt_delta(v, ov) -> tuple[str, str]:
    """(배지 텍스트, 방향클래스). 방향클래스: up/down/flat/na."""
    if v is None or ov is None:
        return ("", "na")
    dl = round(v - ov, 1)
    if dl == 0:
        return ("±0.0", "flat")
    if dl > 0:
        return (f"+{dl}", "up")
    return (f"{dl}", "down")          # 음수는 부호 포함


# ─────────────────────────────────────────────
# 2b. 1단계 추가 항목 (I.교육관련, 코드북 21회_매핑 O, deck 미포함):
#     교육비 증가/감소 이유(복수응답률) · 1인당 교육시간(평균·중앙값)
# ─────────────────────────────────────────────

INC_REASON = {1: "교육인원 증가", 2: "개인교육비 지원증가", 3: "컨설팅/개발비용 증가",
              4: "AI/DT 교육비용 증가", 5: "시스템 도입비용 증가", 6: "기타"}
DEC_REASON = {1: "경영상 사유", 2: "교육인원 감소", 3: "개인교육비 지원감소",
              4: "컨설팅/개발비용 축소", 5: "기타"}


def compute_extra_items(df) -> dict:
    t = num(df["p1)R_5_1_2"]) if "p1)R_5_1_2" in df.columns else None
    edu_time = {
        "n": int(t.notna().sum()) if t is not None else 0,
        "avg": round(float(t.mean()), 1) if t is not None and t.notna().any() else None,
        "median": round(float(t.median()), 1) if t is not None and t.notna().any() else None,
    }
    inc = multi_dist(df["p1)R_3_multi"], INC_REASON) if "p1)R_3_multi" in df.columns else {"items": []}
    dec = multi_dist(df["p1)R_4_multi"], DEC_REASON) if "p1)R_4_multi" in df.columns else {"items": []}
    return {"edu_time": edu_time, "inc": inc.get("items", []), "dec": dec.get("items", [])}


def _reason_bars(items: list, cls: str) -> str:
    if not items:
        return '<div class="rb-empty">응답 없음</div>'
    mx = max((x["pct"] for x in items), default=1) or 1
    rows = "".join(
        f'<div class="rb-row"><span class="rb-lab">{x["label"]}</span>'
        f'<span class="rb-track"><span class="rb-fill {cls}" style="width:{round(x["pct"] / mx * 100)}%"></span></span>'
        f'<span class="rb-val">{x["pct"]}%</span></div>'
        for x in sorted(items, key=lambda x: -x["pct"])
    )
    return f'<div class="reason-bars">{rows}</div>'


def render_extra_block(items: dict) -> str:
    et = items["edu_time"]
    et_val = f'{et["avg"]}시간' if et["avg"] is not None else "—"
    et_med = f'중앙값 {et["median"]}시간' if et["median"] is not None else ""
    return (
        '<div class="chart-block">'
        '<h4 class="cb-title">교육비 증감 배경 · 1인당 교육시간</h4>'
        f'<div class="et-kpi"><span class="et-lab">1인당 연간 교육시간(평균)</span>'
        f'<span class="et-v">{et_val}</span><span class="et-note">{et_med} · N={et["n"]}</span></div>'
        '<div class="reason-pair">'
        '<div class="reason-col"><div class="rc-h up">교육비 증가 이유</div>'
        f'{_reason_bars(items["inc"], "up")}</div>'
        '<div class="reason-col"><div class="rc-h down">교육비 감소 이유</div>'
        f'{_reason_bars(items["dec"], "down")}</div>'
        '</div>'
        '<div class="caveat">복수응답 — 응답자 대비 선택률(%). 21회 김태웅 항목(2-2·2-3·3) 재현.</div>'
        '</div>'
    )


# ─────────────────────────────────────────────
# 2c. ③ 집계기 데이터 → 정적 HTML 렌더러 (신규 40문항, JS·ID 불필요 빌드시점 데이터)
#     기존 deck 9페이지는 그대로 두고, DECK_COVERED 외 문항만 정적 블록으로.
# ─────────────────────────────────────────────

def _pct_bars(items, cls="neu", max_scale=None):
    if not items:
        return '<div class="rb-empty">응답 없음</div>'
    mx = max_scale or (max((x.get("pct") or 0 for x in items), default=1) or 1)
    rows = "".join(
        f'<div class="rb-row"><span class="rb-lab">{x["label"]}</span>'
        f'<span class="rb-track"><span class="rb-fill {cls}" style="width:{round((x.get("pct") or 0) / mx * 100)}%"></span></span>'
        f'<span class="rb-val">{x.get("pct") or 0}%</span></div>'
        for x in items
    )
    return f'<div class="reason-bars">{rows}</div>'


def _cf_bars(items):
    if not items:
        return '<div class="rb-empty">응답 없음</div>'
    mx = max((max((x.get("cur") or 0), (x.get("fut") or 0)) for x in items), default=1) or 1
    rows = []
    for x in items:
        cur, fut, d = x.get("cur") or 0, x.get("fut") or 0, x.get("delta") or 0
        dcls = "up" if d > 0 else ("down" if d < 0 else "flat")
        rows.append(
            f'<div class="cf-row"><div class="cf-lab">{x["label"]}'
            f'<span class="delta {dcls}">{"+" if d > 0 else ""}{d}</span></div>'
            f'<div class="cf-line"><span class="cf-tag cur">현재</span><span class="cf-track">'
            f'<span class="cf-fill cur" style="width:{round(cur / mx * 100)}%"></span></span><span class="cf-num">{cur}%</span></div>'
            f'<div class="cf-line"><span class="cf-tag fut">향후</span><span class="cf-track">'
            f'<span class="cf-fill fut" style="width:{round(fut / mx * 100)}%"></span></span><span class="cf-num">{fut}%</span></div>'
            f'</div>')
    return f'<div class="cf-wrap">{"".join(rows)}</div>'


def _kpi_cards(items, value_key, unit, sub_key=None):
    cards = []
    for x in items:
        v = x.get(value_key)
        sub = (f'<div class="kpi-sub">중앙 {x.get(sub_key)}{unit}</div>'
               if sub_key and x.get(sub_key) is not None else "")
        cards.append(
            f'<div class="kpi-card"><div class="kpi-lab">{x["label"]}</div>'
            f'<div class="kpi-v">{v if v is not None else "—"}<span class="kpi-u">{unit}</span></div>'
            f'{sub}<div class="kpi-n">N={x.get("n")}</div></div>')
    return f'<div class="kpi-grid">{"".join(cards)}</div>'


def _likert_rows(items):
    rows = []
    for x in items:
        dist = x.get("dist", {})
        seg = "".join(f'<span class="lk-seg s{k}" style="width:{dist.get(k, 0)}%" '
                      f'title="{k}점 {dist.get(k, 0)}%"></span>' for k in range(1, 6))
        rows.append(
            f'<div class="lk-row"><span class="rb-lab">{x["label"]}</span>'
            f'<span class="lk-bar">{seg}</span><span class="lk-mean">{x.get("mean")}</span></div>')
    legend = ('<div class="lk-legend">' + "".join(f'<span><i class="s{k}"></i>{k}</span>' for k in range(1, 6))
              + ' <em>막대=1~5점 분포 · 우측=평균</em></div>')
    return f'<div class="lk-wrap">{legend}{"".join(rows)}</div>'


def _iv_pairs(items):
    rows = []
    for x in items:
        imp, perf = x.get("imp_mean"), x.get("perf_mean")
        gap = round((imp or 0) - (perf or 0), 2)          # 표시평균 차로 재계산(검증 minor#4)
        gcls = "down" if gap > 0 else ("up" if gap < 0 else "flat")   # 중요>수행 = 갭(적색)
        rows.append(
            f'<div class="cf-row"><div class="cf-lab">{x["label"]}'
            f'<span class="delta {gcls}">gap {"+" if gap > 0 else ""}{gap}</span></div>'
            f'<div class="cf-line"><span class="cf-tag imp">중요</span><span class="cf-track">'
            f'<span class="cf-fill imp" style="width:{round((imp or 0) / 5 * 100)}%"></span></span><span class="cf-num">{imp}</span></div>'
            f'<div class="cf-line"><span class="cf-tag perf">수행</span><span class="cf-track">'
            f'<span class="cf-fill perf" style="width:{round((perf or 0) / 5 * 100)}%"></span></span><span class="cf-num">{perf}</span></div>'
            f'</div>')
    return (f'<div class="cf-wrap iv">{"".join(rows)}</div>'
            '<div class="caveat">중요도 vs 수행도(1~5점) · gap = 중요−수행(클수록 실행격차)</div>')


def _iv_duo(items, gap):
    gd = (round((items[0]["mean"] or 0) - (items[1]["mean"] or 0), 2)
          if len(items) >= 2 and items[0]["mean"] is not None and items[1]["mean"] is not None else None)
    cards = "".join(
        f'<div class="duo-card"><div class="duo-lab">{x["label"]}</div>'
        f'<div class="duo-v">{x.get("mean")}</div><div class="duo-n">N={x.get("n")}</div></div>'
        for x in items)
    g = f'<div class="duo-gap">격차 <b>{"+" if (gd or 0) > 0 else ""}{gd}</b></div>' if gd is not None else ""
    return f'<div class="duo-wrap">{cards}{g}</div><div class="caveat">1~5점 평균</div>'


def _issue_rank_rows(themes, n_resp, top=12):
    if not themes:
        return '<div class="rb-empty">응답 없음</div>'
    mx = max((t["weighted"] for t in themes), default=1) or 1
    rows = []
    for t in themes[:top]:
        seg = (f'<span class="ir-seg r1" style="width:{round(t["r1"] * 3 / mx * 100)}%" title="1순위 {t["r1"]}"></span>'
               f'<span class="ir-seg r2" style="width:{round(t["r2"] * 2 / mx * 100)}%" title="2순위 {t["r2"]}"></span>'
               f'<span class="ir-seg r3" style="width:{round(t["r3"] * 1 / mx * 100)}%" title="3순위 {t["r3"]}"></span>')
        rows.append(
            f'<div class="ir-row"><span class="rb-lab">{t["label"]}<small>({t["group"]})</small></span>'
            f'<span class="ir-bar">{seg}</span><span class="ir-val">{t["weighted"]}</span></div>')
    legend = ('<div class="ir-legend"><span><i class="r1"></i>1순위×3</span><span><i class="r2"></i>2순위×2</span>'
              f'<span><i class="r3"></i>3순위×1</span> <em>가중점수 상위 {min(top, len(themes))} · 응답 {n_resp}</em></div>')
    return f'<div class="ir-wrap">{legend}{"".join(rows)}</div>'


def _dist_multi_rows(items):
    its = sorted(items, key=lambda x: -(x.get("impl_rate") or 0))
    rows = "".join(
        f'<div class="rb-row"><span class="rb-lab">{x["label"]}</span>'
        f'<span class="rb-track"><span class="rb-fill up" style="width:{round((x.get("impl_rate") or 0))}%"></span></span>'
        f'<span class="rb-val">{x.get("impl_rate") or 0}%</span></div>'
        for x in its)
    return f'<div class="reason-bars">{rows}</div><div class="caveat">막대 = 실시중(4단계) 비율</div>'


def render_question_static(res: dict) -> str:
    """③ 집계 결과 → 정적 차트 블록."""
    agg, d = res["agg"], res["data"]
    is_core = res.get("html") == "핵심"
    title = f'<span class="qb-page">{ROMAN.get(res["page"], "")}</span> {res["title"]}'
    if d.get("note"):
        body = f'<div class="rb-empty">집계 불가: {d["note"]}</div>'
    elif agg == "multi_rate":
        body = (_pct_bars(sorted(d["items"], key=lambda x: -(x.get("pct") or 0)), cls="neu")
                + f'<div class="caveat">복수응답 선택률 · 응답 {d.get("n_respondents")}</div>')
    elif agg == "dist":
        body = _pct_bars(d["items"], cls="dist")
    elif agg == "dist_multi":
        body = _dist_multi_rows(d["items"])
    elif agg == "mean_pct":
        body = _pct_bars(d["items"], cls="neu") + f'<div class="caveat">평균 비율 합 {d.get("sum")}% · base {d.get("base_N")}</div>'
    elif agg == "mean_pct_cf":
        body = _cf_bars(d["items"]) + f'<div class="caveat">현재 base {d.get("base_N_cur")} / 향후 base {d.get("base_N_fut")} · Δ=향후−현재</div>'
    elif agg == "mean":
        body = _kpi_cards(d["items"], "mean", d.get("unit", ""), "median")
    elif agg == "tenure_ym":
        body = _kpi_cards(d["items"], "mean_years", "년", "median_years")
    elif agg == "likert":
        body = _likert_rows(d["items"])
    elif agg == "likert_iv":
        body = _iv_pairs(d["items"]) if d.get("mode") == "pairs" else _iv_duo(d["items"], d.get("gap"))
    elif agg == "issue_rank":
        body = _issue_rank_rows(d["themes"], d.get("n_respondents"))
    elif agg == "issue_multi":
        body = _issue_multi_rows(d["items"], d.get("n_respondents"))
    else:
        body = '<div class="rb-empty">(미지원 agg)</div>'
    cls = " is-new" if is_core else ""
    return f'<div class="chart-block qb{cls}"><h4 class="cb-title">{title}</h4>{body}</div>'


def _issue_multi_rows(items, n_resp, top=15):
    its = items[:top]
    return (_pct_bars([{"label": f'{x["label"]} ({x["group"]})', "pct": x["pct"]} for x in its], cls="neu")
            + f'<div class="caveat">A/B그룹 기타이슈 선택률 · 응답 {n_resp}</div>')


# ─────────────────────────────────────────────
# 3. JS — deck 빌더 영역을 buildSegment(PAGE_DATA, NS) 팩토리로 재구성
# ─────────────────────────────────────────────

_NAV_MARKER = "// ───── Deck navigation ─────"


def build_js(seg_payloads: list[tuple[str, dict]]) -> str:
    """seg_payloads: [(ns, page_data), ...]"""
    region = DECK_JS.split(_NAV_MARKER)[0]
    # 상단 두 const 제거 (PAGE_DATA 는 함수 인자로 대체, TOTAL 불필요)
    region = region.replace("const TOTAL = __TOTAL__;", "")
    region = region.replace("const PAGE_DATA = __PAGE_DATA__;", "")
    # DOM ID 네임스페이스: getElementById( → getElementById(NS+
    #   직접 호출(getElementById('p4-div'))과 헬퍼 경유(renderLikertMini('p15-strategy')→내부 getElementById(elId)) 모두 커버
    region = region.replace("getElementById(", "getElementById(NS+")

    factory = (
        "function buildSegment(PAGE_DATA, NS) {\n"
        + region
        + "\n  initP4();initP5();initP6();initP9();initP10();initP11();initP12();initP15();initP16();\n"
        + "}\n"
    )
    calls = "\n".join(
        f"  buildSegment({json.dumps(pd_, ensure_ascii=False)}, {json.dumps(ns)});"
        for ns, pd_ in seg_payloads
    )
    # ECharts 반응형: deck nav/resize 로직을 제거했으므로 스크롤 보고서용 resize 핸들러를 직접 둔다.
    #   (Sankey·heatstrip·likert 는 SVG/HTML 이라 자동 반응형 — ECharts canvas(.chart-box)만 resize 필요)
    resize_js = (
        "\nfunction _resizeAllCharts() {\n"
        "  document.querySelectorAll('.chart-box').forEach(el => {\n"
        "    const inst = echarts.getInstanceByDom(el);\n"
        "    if (inst) inst.resize();\n"
        "  });\n"
        "}\n"
        "let _rzT;\n"
        "window.addEventListener('resize', () => { clearTimeout(_rzT); _rzT = setTimeout(_resizeAllCharts, 150); });\n"
        "window.addEventListener('load', () => { setTimeout(_resizeAllCharts, 60); _initSpy(); });\n"
    )
    # 세그먼트 이동 네비 + 스크롤 스파이 (긴 스크롤 보고서 이동 보조)
    nav_js = (
        "\nfunction _navTargets() {\n"
        "  return [document.getElementById('summary-matrix'),\n"
        "          ...document.querySelectorAll('section.seg-block')].filter(Boolean);\n"
        "}\n"
        "function _absTop(el) { return el.getBoundingClientRect().top + window.scrollY; }\n"
        "function segNav(dir) {\n"
        "  const ts = _navTargets(); const y = window.scrollY; let idx = 0;\n"
        "  ts.forEach((t, i) => { if (_absTop(t) <= y + 40) idx = i; });\n"
        "  const ni = Math.min(ts.length - 1, Math.max(0, idx + dir));\n"
        "  window.scrollTo({ top: Math.max(0, _absTop(ts[ni]) - 24), behavior: 'smooth' });\n"
        "}\n"
        "let _navLinks = {}, _spyT = null;\n"
        "function _initSpy() {\n"
        "  document.querySelectorAll('nav.side a[href^=\"#\"]').forEach(a => { _navLinks[a.getAttribute('href').slice(1)] = a; });\n"
        "  window.addEventListener('scroll', () => { if (_spyT) return; _spyT = setTimeout(() => { _spyT = null; _spy(); }, 120); });\n"
        "  _spy();\n"
        "}\n"
        "function _spy() {\n"
        "  const ts = _navTargets(); const y = window.scrollY; let cur = ts[0];\n"
        "  ts.forEach(t => { if (_absTop(t) <= y + 90) cur = t; });\n"
        "  Object.values(_navLinks).forEach(a => a.classList.remove('active'));\n"
        "  if (cur && _navLinks[cur.id]) _navLinks[cur.id].classList.add('active');\n"
        "}\n"
    )
    # 부록 접기/펼치기 (#3). 펼칠 때 ECharts(p4 도넛 등)가 display:none 에서 0×0 init 됐으므로 resize 보정.
    toggle_js = (
        "\nfunction toggleAppendix(btn) {\n"
        "  const wrap = btn.closest('.seg-block').querySelector('.appendix-wrap');\n"
        "  const collapsed = wrap.classList.toggle('collapsed');\n"
        "  btn.textContent = collapsed ? '부록 펼치기 ▾' : '부록 접기 ▴';\n"
        "  if (!collapsed) setTimeout(_resizeAllCharts, 0);\n"
        "}\n"
        "function toggleAllAppendix(btn) {\n"
        "  const wraps = document.querySelectorAll('.appendix-wrap');\n"
        "  const anyOpen = [...wraps].some(w => !w.classList.contains('collapsed'));\n"
        "  wraps.forEach(w => w.classList.toggle('collapsed', anyOpen));\n"
        "  document.querySelectorAll('.appendix-toggle').forEach(b => b.textContent = anyOpen ? '부록 펼치기 ▾' : '부록 접기 ▴');\n"
        "  btn.textContent = anyOpen ? '전체 부록 펼치기 ▾' : '전체 부록 접기 ▴';\n"
        "  if (!anyOpen) setTimeout(_resizeAllCharts, 0);\n"
        "}\n"
    )
    return (factory
            + "\nwindow.addEventListener('DOMContentLoaded', () => {\n" + calls + "\n});\n"
            + resize_js + toggle_js + nav_js)


# ─────────────────────────────────────────────
# 4. 마크업 — 세그먼트 섹션 (벤치마크 스트립 + 핵심/부록 차트)
# ─────────────────────────────────────────────

def _ns_chart(pid: str, ns: str) -> str:
    """render_chart_body 출력의 컨테이너 id 를 네임스페이스."""
    return render_chart_body(pid).replace('id="', f'id="{ns}')


def render_bench_strip(headline: dict, overall: dict) -> str:
    cards = []
    for key, label, unit, _ in HEADLINE:
        v = headline.get(key)
        ov = overall.get(key)
        badge_txt, dir_cls = fmt_delta(v, ov)
        badge = (f'<span class="delta {dir_cls}">{badge_txt}{"%p" if unit == "%" else (unit if badge_txt else "")}</span>'
                 if badge_txt else "")
        cards.append(
            f'<div class="bench-card">'
            f'<div class="bk">{label}</div>'
            f'<div class="bv">{fmt_value(v, unit)}{badge}</div>'
            f'</div>'
        )
    return '<div class="bench-strip">' + "".join(cards) + "</div>"


def render_bench_oneline(headline: dict, overall: dict, k: int = 3) -> str:
    """sticky 헤더용 — 전체 대비 차이가 큰 대표 지표 k개를 한 줄 칩으로."""
    rows = []
    for key, label, unit, _ in HEADLINE:
        v, ov = headline.get(key), overall.get(key)
        if v is None or ov is None:
            continue
        dl = round(v - ov, 1)
        if dl != 0:
            rows.append((abs(dl), dl, key, label, unit))
    if not rows:
        return ""
    rows.sort(reverse=True)                       # 차이 큰 순
    chips = []
    for _, dl, key, label, unit in rows[:k]:
        badge_txt, dir_cls = fmt_delta(headline.get(key), overall.get(key))
        suffix = "%p" if unit == "%" else (unit if badge_txt else "")
        chips.append(f'<span class="bo-chip">{label}'
                     f'<span class="delta {dir_cls}">{badge_txt}{suffix}</span></span>')
    return ('<span class="bench-oneline"><span class="bo-cap">vs 전체</span>'
            + "".join(chips) + "</span>")


def render_chart_block(pid: str, ns: str) -> str:
    title = PAGE_TITLE.get(pid, pid)
    is_new = "⭐" in title
    cls = " is-new" if is_new else ""
    return (
        f'<div class="chart-block{cls}">'
        f'<h4 class="cb-title">{title}</h4>'
        f'{_ns_chart(pid, ns)}'
        f'</div>'
    )


def render_segment_section(seg: dict, headline: dict, overall: dict, is_baseline: bool,
                            agg_res: dict, questions: list[dict]) -> str:
    n = seg["n"]
    ns = seg["ns"]
    small = n < SMALL_N
    tags = []
    if is_baseline:
        tags.append('<span class="seg-tag base">벤치마크 기준</span>')
    if small:
        tags.append(f'<span class="seg-tag small">표본 부족 · N&lt;{SMALL_N}</span>')

    # 신규 정적 문항 블록 (deck 미커버) — config 순서, 핵심/부록 분리
    core_new = "".join(render_question_static(agg_res[q["id"]])
                       for q in questions if q.get("html") == "핵심" and q["id"] not in DECK_COVERED)
    app_new = "".join(render_question_static(agg_res[q["id"]])
                      for q in questions if q.get("html") == "부록" and q["id"] not in DECK_COVERED)

    bench = "" if is_baseline else render_bench_strip(headline, overall)
    bench_oneline = "" if is_baseline else render_bench_oneline(headline, overall)
    core = "".join(render_chart_block(p, ns) for p in CORE_PAGES)
    core += render_extra_block(compute_extra_items(seg["df"]))   # 1단계: 증감이유·교육시간
    core += core_new                                            # Ⅲ 교육내용·형태 · Ⅳ 주요이슈 · Ⅴ AI 대상/분야/성과/계획
    appendix = "".join(render_chart_block(p, ns) for p in APPENDIX_PAGES)
    appendix += app_new                                        # Ⅱ 전반 · Ⅲ 세부 · Ⅳ 나머지 · Ⅴ 나머지

    return f"""
  <section id="{ns}section" class="seg-block{' is-small' if small else ''}">
    <div class="seg-head">
      <h2 class="seg-name">{seg['name']}</h2>
      <div class="seg-n">N = {n}</div>
      <div class="seg-tags">{''.join(tags)}</div>
      {bench_oneline}
    </div>
    {bench}
    <div class="cb-group-label">핵심 지표</div>
    <div class="chart-grid">{core}</div>
    <div class="cb-group-label appendix">
      <span>부록 — 전체 지표 (HRD현황·활동·이슈·AI 세부)</span>
      <button class="appendix-toggle" onclick="toggleAppendix(this)">부록 펼치기 ▾</button>
    </div>
    <div class="appendix-wrap collapsed"><div class="chart-grid">{appendix}</div></div>
  </section>"""


# ─────────────────────────────────────────────
# 5. 요약 매트릭스 (첫 화면) + 좌측 nav
# ─────────────────────────────────────────────

def render_summary_matrix(segs: list[dict], headlines: dict, overall: dict) -> str:
    head_cols = "".join(f"<th>{label}<small>{ '%p' if unit=='%' else unit }</small></th>"
                        for _, label, unit, _ in HEADLINE)
    rows = []
    for seg in segs:
        hl = headlines[seg["name"]]
        is_base = seg["name"] == "전체"
        cells = [f'<td class="seg-cell"><a href="#{seg["ns"]}section">{seg["name"]}</a>'
                 f'<span class="mx-n">N={seg["n"]}{" · 표본부족" if seg["n"] < SMALL_N else ""}</span></td>']
        for key, _, unit, _ in HEADLINE:
            v = hl.get(key)
            ov = overall.get(key)
            badge_txt, dir_cls = fmt_delta(v, ov)
            delta = "" if is_base or not badge_txt else f'<span class="delta {dir_cls}">{badge_txt}</span>'
            cells.append(f'<td>{fmt_value(v, unit)}{delta}</td>')
        rows.append(f'<tr class="{ "base" if is_base else "" }">' + "".join(cells) + "</tr>")
    return f"""
  <section id="summary-matrix" class="matrix-section">
    <h2 class="mx-h">세그먼트 × 핵심지표 요약</h2>
    <p class="mx-sub">값 = 세그먼트 수치 · 배지 = 전체(기업) 대비 차이. 행 클릭 시 해당 세그먼트로 이동.</p>
    <div class="mx-scroll">
      <table class="matrix">
        <thead><tr><th class="seg-col">세그먼트</th>{head_cols}</tr></thead>
        <tbody>{''.join(rows)}</tbody>
      </table>
    </div>
  </section>"""


def render_industry_placeholder(avail: dict) -> str:
    """재분류 전 업종 게이트 현황 placeholder (enabled=False 일 때)."""
    min_n = avail["min_n"]
    chips = "".join(
        f'<span class="ind-chip{" ready" if n >= min_n else ""}">{lab}<b>{n}</b></span>'
        for lab, n in sorted(avail["counts"].items(), key=lambda x: -x[1])
    )
    ready_n = len(avail["ready"])
    return f"""
  <section id="industry-section" class="seg-block industry-ph">
    <div class="seg-head"><h2 class="seg-name">업종 세그먼트</h2>
      <span class="seg-tag small">재분류 전 · 비활성</span></div>
    <div class="prelim-banner">
      <b>업종 분석은 수기 재분류 후 자동 활성됩니다.</b> 현재 R_Cate <b>기타/미분류</b> 비중이 높아
      N≥{min_n} 업종이 <b>{ready_n}개</b>뿐입니다. <code>config/segments.yaml</code> 의
      <code>industry.enabled: true</code> 로 전환하면 ④ XLSX 시트·⑤ HTML 섹션에 N≥{min_n} 업종이 자동 추가됩니다.
    </div>
    <div class="ind-chips">{chips}</div>
    <div class="caveat">칩 = 업종별 현재 응답 수(기업 모집단). 진한 칩 = N≥{min_n} (산출 가능).</div>
  </section>"""


def render_nav(segs: list[dict], industry_disabled: bool = True) -> str:
    links = "\n".join(
        f'    <a href="#{s["ns"]}section">{s["name"]}'
        f'<span class="nn">N={s["n"]}{ " ⚠" if s["n"] < SMALL_N else "" }</span></a>'
        for s in segs
    )
    ind_link = ('    <a href="#industry-section">업종 <span class="nn">재분류 후</span></a>'
                if industry_disabled else "")
    total_n = next((s["n"] for s in segs if s["name"] == "전체"), sum(s["n"] for s in segs))
    return f"""<nav class="side">
  <div class="brand"><div class="mark"></div>
    <div><b>세그먼트 분석 리포트</b><span>HRD Survey · 22회</span></div></div>
  <div class="meta">prelim 스냅샷 · 전체 기업 N={total_n}<br>수집 종료(9월) 후 재계산</div>
  <div class="group"><div class="h">개요</div>
    <a href="#summary-matrix">요약 매트릭스</a></div>
  <div class="group"><div class="h">세그먼트</div>
{links}
{ind_link}</div>
  <div class="foot"><b>EXC · HRD Survey 2027</b><br>deck 디자인 시스템 재사용 · ±%p 벤치마크</div>
</nav>"""


# ─────────────────────────────────────────────
# 6. 스크롤 레이아웃·매트릭스·배지 CSS (deck 토큰 재사용)
# ─────────────────────────────────────────────

EXTRA_CSS = """
/* ── 세그먼트 리포트 전용 (deck 토큰 위에 스크롤 레이아웃) ── */
/* deck CSS 는 슬라이드 쇼용이라 html,body { overflow:hidden } 으로 스크롤을 막는다 → 스크롤 보고서용으로 복구 */
html, body { overflow: visible; height: auto; background: var(--exc-bg); }
body { color: var(--exc-ink); font-family: var(--font-sans); margin: 0; }
#summary-matrix, .seg-block { scroll-margin-top: 24px; }   /* 앵커 점프는 즉시(긴 문서에서 smooth 는 과도) */

/* 좌측 nav 현재 세그먼트 하이라이트 (스크롤 스파이) */
nav.side a.active { background: rgba(255,255,255,.12); color: var(--exc-bg); box-shadow: inset 3px 0 0 var(--exc-green); }

/* 우하단 플로팅 네비 (이전/맨위/다음 세그먼트) */
.floatnav { position: fixed; right: 22px; bottom: 22px; display: flex; flex-direction: column; gap: 9px; z-index: 50; }
.floatnav button { width: 46px; height: 46px; border-radius: 50%; border: 1px solid var(--exc-line-2);
  background: var(--exc-bg); color: var(--exc-ink-2); font-size: 17px; font-weight: 700; cursor: pointer;
  box-shadow: var(--shadow-md); display: flex; align-items: center; justify-content: center; line-height: 1; }
.floatnav button:hover { background: var(--ai-dusk); color: var(--exc-bg); border-color: var(--ai-dusk); }
.floatnav .fn-label { font-size: 9px; }
@media print { .floatnav { display: none; } }
.layout { display: grid; grid-template-columns: 280px 1fr; min-height: 100vh; }
nav.side { position: sticky; top: 0; align-self: start; height: 100vh; overflow-y: auto;
  background: var(--ai-dusk); color: rgba(255,255,255,.78); padding: 24px 18px; box-sizing: border-box; }
nav.side .brand { display: flex; gap: 10px; align-items: center; margin-bottom: 16px; }
nav.side .brand .mark { width: 26px; height: 26px; border-radius: 7px; background: var(--exc-green); flex: none; }
nav.side .brand b { color: var(--exc-bg); font-size: 15px; display: block; }
nav.side .brand span { font-size: 11px; color: rgba(255,255,255,.5); }
nav.side .meta { font-size: 11px; color: rgba(255,255,255,.5); line-height: 1.5; margin-bottom: 18px;
  padding-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,.12); }
nav.side .group { margin-bottom: 18px; display: flex; flex-direction: column; gap: 2px; }
nav.side .group .h { font-size: 11px; letter-spacing: .08em; text-transform: uppercase;
  color: rgba(255,255,255,.4); margin-bottom: 6px; }
nav.side a { color: rgba(255,255,255,.82); text-decoration: none; font-size: 13px; padding: 7px 10px;
  border-radius: 8px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
nav.side a:hover { background: rgba(255,255,255,.08); color: var(--exc-bg); }
nav.side a .nn { font-size: 11px; color: rgba(255,255,255,.45); font-variant-numeric: tabular-nums; }
nav.side .foot { font-size: 10px; color: rgba(255,255,255,.4); line-height: 1.5;
  margin-top: 20px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,.12); }
main { padding: 40px 56px 120px; max-width: 1280px; }

.prelim-banner { background: color-mix(in srgb, var(--exc-amber) 14%, white);
  border: 1px solid color-mix(in srgb, var(--exc-amber) 45%, white); border-radius: var(--radius-md);
  padding: 14px 20px; margin-bottom: 32px; font-size: 14px; color: var(--exc-ink-2); line-height: 1.6; }
.prelim-banner b { color: var(--exc-ink); }

/* 요약 매트릭스 */
.matrix-section { margin-bottom: 56px; }
.mx-h { font-size: 26px; font-weight: 800; margin: 0 0 6px; }
.mx-sub { font-size: 13px; color: var(--exc-muted); margin: 0 0 18px; }
.mx-scroll { overflow-x: auto; border: 1px solid var(--exc-line); border-radius: var(--radius-md); }
table.matrix { border-collapse: collapse; width: 100%; font-size: 13px; }
table.matrix th, table.matrix td { padding: 10px 12px; text-align: right; white-space: nowrap;
  border-bottom: 1px solid var(--exc-line); font-variant-numeric: tabular-nums; }
table.matrix thead th { background: var(--exc-panel); font-weight: 700; color: var(--exc-ink-2);
  position: sticky; top: 0; }
table.matrix th small { display: block; font-weight: 500; color: var(--exc-muted-2); font-size: 10px; }
table.matrix th.seg-col, table.matrix td.seg-cell { text-align: left; position: sticky; left: 0;
  background: var(--exc-bg); z-index: 1; }
table.matrix thead th.seg-col { z-index: 2; background: var(--exc-panel); }
table.matrix td.seg-cell a { color: var(--exc-green-700); font-weight: 700; text-decoration: none; }
table.matrix td.seg-cell a:hover { text-decoration: underline; }
table.matrix .mx-n { display: block; font-size: 10px; color: var(--exc-muted-2); font-weight: 500; }
table.matrix tr.base td { background: color-mix(in srgb, var(--exc-green) 7%, white); font-weight: 600; }
table.matrix tr.base td.seg-cell { background: color-mix(in srgb, var(--exc-green) 9%, white); }

/* 델타 배지 */
.delta { display: inline-block; margin-left: 6px; font-size: 11px; font-weight: 700; padding: 1px 6px;
  border-radius: var(--radius-pill); vertical-align: middle; font-variant-numeric: tabular-nums; }
.delta.up   { background: color-mix(in srgb, var(--exc-green) 16%, white); color: var(--exc-green-700); }
.delta.down { background: color-mix(in srgb, var(--ds-rose) 15%, white);  color: var(--ds-rose-700); }
.delta.flat { background: var(--exc-panel-2); color: var(--exc-muted); }

/* 세그먼트 섹션 */
.seg-block { padding: 32px 0 12px; border-top: 2px solid var(--exc-line); margin-top: 24px; }
.seg-block.is-small { opacity: .96; }
/* 세그먼트 헤더 sticky — 다크 리본(좌측 nav 와 일관)으로 흰 콘텐츠와 구별, 벤치마크 한 줄 동반.
   섹션마다 자체 sticky 라 다음 세그먼트 진입 시 자연 교체(핸드오프). */
.seg-head { display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  position: sticky; top: 0; z-index: 20;
  background: var(--ai-dusk); color: var(--exc-bg);
  padding: 12px 18px; margin-bottom: 18px;
  border-radius: var(--radius-md); box-shadow: var(--shadow-md); }
.seg-name { font-size: 26px; font-weight: 800; margin: 0; color: var(--exc-bg); }
.seg-n { font-size: 15px; color: rgba(255,255,255,.6); font-weight: 700; font-variant-numeric: tabular-nums; }
/* 벤치마크 한 줄 (전체 대비 대표 델타) */
.bench-oneline { margin-left: auto; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.bench-oneline .bo-cap { font-size: var(--fs-micro); color: rgba(255,255,255,.45);
  text-transform: uppercase; letter-spacing: .06em; }
.bo-chip { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;
  font-size: var(--fs-caption); color: rgba(255,255,255,.82); font-weight: var(--fw-semi); }
.seg-tags { display: flex; gap: 8px; }
.seg-tag { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: var(--radius-pill); }
.seg-tag.base  { background: color-mix(in srgb, var(--exc-green) 14%, white); color: var(--exc-green-700); }
.seg-tag.small { background: color-mix(in srgb, var(--exc-amber) 22%, white); color: color-mix(in srgb, var(--exc-amber) 55%, var(--exc-ink)); }

/* 벤치마크 스트립 */
.bench-strip { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; margin-bottom: 26px; }
.bench-card { background: var(--exc-panel); border: 1px solid var(--exc-line); border-radius: var(--radius-md);
  padding: 12px 14px; }
.bench-card .bk { font-size: 11px; color: var(--exc-muted); margin-bottom: 6px; line-height: 1.3; min-height: 28px; }
.bench-card .bv { font-size: 18px; font-weight: 800; color: var(--exc-ink); font-variant-numeric: tabular-nums; }
@media (max-width: 1100px) { .bench-strip { grid-template-columns: repeat(3, 1fr); } }

/* 차트 블록 */
.cb-group-label { font-size: 12px; letter-spacing: .06em; text-transform: uppercase; font-weight: 700;
  color: var(--exc-muted); margin: 28px 0 12px; padding-bottom: 6px; border-bottom: 1px dashed var(--exc-line); }
.cb-group-label.appendix { color: var(--exc-muted-2); display: flex; justify-content: space-between;
  align-items: center; text-transform: none; letter-spacing: 0; }

/* 부록 접기/펼치기 (#3 분량) */
.appendix-wrap.collapsed { display: none; }
.appendix-toggle, .global-toggle { font-family: inherit; font-size: 12px; font-weight: 700; cursor: pointer;
  border: 1px solid var(--exc-line-2); background: var(--exc-panel); color: var(--exc-ink-2);
  padding: 5px 14px; border-radius: var(--radius-pill); white-space: nowrap; }
.appendix-toggle:hover, .global-toggle:hover { background: var(--exc-panel-2); border-color: var(--exc-muted-2); }
.report-controls { display: flex; align-items: center; gap: 14px; margin: 0 0 28px; padding: 12px 16px;
  background: var(--exc-panel); border: 1px solid var(--exc-line); border-radius: var(--radius-md); }
.report-controls .rc-note { font-size: 12px; color: var(--exc-muted); line-height: 1.4; }
.global-toggle { background: var(--ai-dusk); color: var(--exc-bg); border-color: var(--ai-dusk); }
.global-toggle:hover { background: var(--ai-dusk-2); }
@media print {
  .appendix-wrap.collapsed { display: block !important; }
  .report-controls, .appendix-toggle { display: none !important; }
}
/* 1열 풀폭 — deck ECharts 여백(left:200)·폰트(18px)가 슬라이드 폭 기준이라, 풀폭이라야 비율이 복원됨 */
.chart-grid { display: grid; grid-template-columns: 1fr; gap: 22px; }
.chart-block { border: 1px solid var(--exc-line); border-radius: var(--radius-lg); padding: 22px 26px;
  background: var(--exc-bg); min-width: 0; }
.chart-block.is-new { border-color: color-mix(in srgb, var(--ai-violet) 35%, white);
  background: color-mix(in srgb, var(--ai-violet) 4%, white); }
.cb-title { font-size: 16px; font-weight: 700; margin: 0 0 16px; color: var(--exc-ink); }
.chart-block.is-new .cb-title { color: var(--ai-violet); }
/* ECharts 컨테이너는 스크롤 맥락에서 명시 높이 필요 (deck 의 flex:1 미적용) */
.chart-block .chart-box { height: 340px; width: 100%; }
.chart-block .chart-row { display: flex; gap: 26px; align-items: stretch; }
.chart-block .chart-row > * { flex: 1; min-width: 0; }
.chart-block .slope-wrap { width: 100%; min-height: 300px; }
.chart-block .slope-wrap svg { width: 100%; height: auto; }
.chart-block .heatstrip-wrap, .chart-block .likert, .chart-block .stack-with-surplus { width: 100%; }

/* 1단계 추가 항목: 교육시간 KPI + 증감 이유 막대 */
.et-kpi { display: flex; align-items: baseline; gap: 14px; padding: 14px 18px; margin-bottom: 18px;
  background: var(--exc-panel); border: 1px solid var(--exc-line); border-radius: var(--radius-md); }
.et-kpi .et-lab { font-size: 13px; color: var(--exc-muted); }
.et-kpi .et-v { font-size: 26px; font-weight: 800; color: var(--exc-green-700); font-variant-numeric: tabular-nums; }
.et-kpi .et-note { font-size: 12px; color: var(--exc-muted-2); }
.reason-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 26px; }
.reason-col .rc-h { font-size: 13px; font-weight: 700; margin-bottom: 10px; }
.reason-col .rc-h.up { color: var(--exc-green-700); }
.reason-col .rc-h.down { color: var(--ds-rose-700); }
.reason-bars { display: flex; flex-direction: column; gap: 7px; }
.rb-row { display: grid; grid-template-columns: 150px 1fr 44px; align-items: center; gap: 10px; font-size: 12px; }
.rb-lab { color: var(--exc-ink-2); text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rb-track { height: 14px; background: var(--exc-panel-2); border-radius: var(--radius-pill); overflow: hidden; }
.rb-fill { display: block; height: 100%; border-radius: var(--radius-pill); }
.rb-fill.up { background: var(--exc-green); }
.rb-fill.down { background: var(--ds-rose); }
.rb-val { text-align: right; font-weight: 700; color: var(--exc-ink); font-variant-numeric: tabular-nums; }
.rb-empty { font-size: 12px; color: var(--exc-muted-2); padding: 8px 0; }
@media (max-width: 1100px) { .reason-pair { grid-template-columns: 1fr; } }
/* p12 만족도 점수 그리드: deck 의 .val 60px·gap 20px·padding 28px 는 슬라이드(1920px) 기준 →
   보고서 폭(~940px)에선 5칸 콘텐츠 합(1072px)이 프레임을 벗어남. 보고서용으로 축소 + minmax(0,1fr) 로 균등 축소 */
.chart-block .likert-score-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin-top: 16px; }
.chart-block .likert-score-grid .cell { padding: 14px 12px; border-radius: 12px; gap: 6px; border-top-width: 4px; }
.chart-block .likert-score-grid .cell .val { font-size: 30px; }
.chart-block .likert-score-grid .cell .lab { font-size: 13px; }
.chart-block .likert-score-grid .cell .n { font-size: 12px; }

/* deck 슬라이드(1920px) 컴포넌트의 보고서 폭 스코프 축소 (규격 §2.2 — score-grid 외 누락분 보완) */
/* p11 히트스트립: 슬라이드 라벨26·값34·셀60px·space-evenly → 보고서서 폰트 과대 + 셀 세로 겹침 */
.chart-block .heatstrip-wrap { justify-content: flex-start; gap: var(--space-3); margin-top: var(--space-3); }
.chart-block .heatstrip { grid-template-columns: minmax(110px, 200px) 1fr 64px; gap: var(--space-4); }
.chart-block .heatstrip .lbl { font-size: var(--fs-body-sm); }
.chart-block .heatstrip .strip { height: 26px; gap: 4px; }
.chart-block .heatstrip .v { font-size: var(--fs-h3); white-space: nowrap; }
/* p12 만족도 발산바(.likert): 슬라이드 라벨26·바64·net34 */
.chart-block .likert { gap: var(--space-3); margin-top: var(--space-3); }
.chart-block .likert-legend { font-size: var(--fs-caption); gap: var(--space-4); }
.chart-block .likert .row { grid-template-columns: minmax(110px, 200px) 1fr 56px; gap: var(--space-3); }
.chart-block .likert .row .lbl { font-size: var(--fs-body-sm); }
.chart-block .likert .row .bar { height: 30px; }
.chart-block .likert .row .seg { font-size: var(--fs-caption); }
.chart-block .likert .row .net { font-size: var(--fs-h3); }
/* p15·p16 likert-mini · p10 stack-with-surplus 는 아래 실측 후 필요 시 추가 */

/* ── ③ 집계기 정적 문항 블록 (신규 40문항) ── */
.chart-block.qb { padding: 18px 22px; }
.qb .cb-title { display: flex; align-items: center; gap: 8px; }
.qb-page { font-size: 11px; font-weight: 800; color: var(--exc-bg); background: var(--ai-dusk);
  border-radius: var(--radius-pill); padding: 1px 9px; flex: none; }
.chart-block.qb.is-new .qb-page { background: var(--ai-violet); }
.caveat { font-size: 11px; color: var(--exc-muted-2); margin-top: 10px; line-height: 1.5; }

/* dist/neu 막대 색 (reason-bars 재사용) */
.rb-fill.neu  { background: var(--ai-dusk); }
.rb-fill.dist { background: var(--exc-green-700); }

/* KPI 카드 (mean·tenure) */
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.kpi-card { background: var(--exc-panel); border: 1px solid var(--exc-line); border-radius: var(--radius-md); padding: 14px 16px; }
.kpi-lab { font-size: 12px; color: var(--exc-muted); margin-bottom: 6px; min-height: 32px; line-height: 1.3; }
.kpi-v { font-size: 26px; font-weight: 800; color: var(--exc-green-700); font-variant-numeric: tabular-nums; }
.kpi-v .kpi-u { font-size: 13px; font-weight: 600; color: var(--exc-muted); margin-left: 3px; }
.kpi-sub { font-size: 11px; color: var(--exc-muted-2); margin-top: 2px; }
.kpi-n { font-size: 11px; color: var(--exc-muted-2); margin-top: 4px; }

/* 현재/향후 · 중요/수행 페어 막대 */
.cf-wrap { display: flex; flex-direction: column; gap: 14px; }
.cf-row { display: flex; flex-direction: column; gap: 4px; }
.cf-lab { font-size: 12px; font-weight: 600; color: var(--exc-ink-2); display: flex; gap: 8px; align-items: center; }
.cf-line { display: grid; grid-template-columns: 40px 1fr 48px; align-items: center; gap: 8px; }
.cf-tag { font-size: 10px; font-weight: 700; color: var(--exc-muted); text-align: center;
  border-radius: var(--radius-pill); padding: 1px 0; background: var(--exc-panel-2); }
.cf-tag.fut, .cf-tag.imp { color: var(--exc-green-700); background: color-mix(in srgb, var(--exc-green) 14%, white); }
.cf-tag.perf { color: var(--ai-dusk); background: color-mix(in srgb, var(--ai-dusk) 12%, white); }
.cf-track { height: 13px; background: var(--exc-panel-2); border-radius: var(--radius-pill); overflow: hidden; }
.cf-fill { display: block; height: 100%; border-radius: var(--radius-pill); }
.cf-fill.cur  { background: var(--exc-muted-2); }
.cf-fill.fut  { background: var(--exc-green); }
.cf-fill.imp  { background: var(--ai-violet); }
.cf-fill.perf { background: var(--ai-dusk); }
.cf-num { font-size: 11px; font-weight: 700; text-align: right; color: var(--exc-ink); font-variant-numeric: tabular-nums; }

/* likert 분포 막대 */
.lk-wrap { display: flex; flex-direction: column; gap: 7px; }
.lk-legend { display: flex; gap: 12px; align-items: center; font-size: 11px; color: var(--exc-muted); margin-bottom: 4px; }
.lk-legend i { display: inline-block; width: 11px; height: 11px; border-radius: 3px; margin-right: 3px; vertical-align: -1px; }
.lk-legend em { color: var(--exc-muted-2); }
.lk-row { display: grid; grid-template-columns: 200px 1fr 40px; align-items: center; gap: 10px; }
.lk-bar { display: flex; height: 15px; border-radius: var(--radius-pill); overflow: hidden; background: var(--exc-panel-2); }
.lk-seg { display: block; height: 100%; }
.lk-seg.s1, .lk-legend i.s1 { background: var(--lk-1); }
.lk-seg.s2, .lk-legend i.s2 { background: var(--lk-2); }
.lk-seg.s3, .lk-legend i.s3 { background: var(--lk-3); }
.lk-seg.s4, .lk-legend i.s4 { background: var(--lk-4); }
.lk-seg.s5, .lk-legend i.s5 { background: var(--lk-5); }
.lk-mean { font-size: 13px; font-weight: 800; color: var(--exc-ink); text-align: right; font-variant-numeric: tabular-nums; }

/* likert duo (인식/활용·만족/활용) */
.duo-wrap { display: flex; gap: 14px; align-items: stretch; flex-wrap: wrap; }
.duo-card { flex: 1; min-width: 130px; background: var(--exc-panel); border: 1px solid var(--exc-line); border-radius: var(--radius-md); padding: 14px 16px; }
.duo-lab { font-size: 12px; color: var(--exc-muted); margin-bottom: 6px; }
.duo-v { font-size: 30px; font-weight: 800; color: var(--ai-dusk); font-variant-numeric: tabular-nums; }
.duo-n { font-size: 11px; color: var(--exc-muted-2); }
.duo-gap { align-self: center; font-size: 13px; color: var(--exc-muted); }
.duo-gap b { font-size: 20px; color: var(--exc-ink); }

/* issue_rank 가중 순위 막대 (1/2/3순위 스택) */
.ir-wrap { display: flex; flex-direction: column; gap: 7px; }
.ir-legend { display: flex; gap: 12px; align-items: center; font-size: 11px; color: var(--exc-muted); margin-bottom: 4px; flex-wrap: wrap; }
.ir-legend i { display: inline-block; width: 11px; height: 11px; border-radius: 3px; margin-right: 3px; vertical-align: -1px; }
.ir-legend em { color: var(--exc-muted-2); }
.ir-row { display: grid; grid-template-columns: 230px 1fr 36px; align-items: center; gap: 10px; }
.ir-row .rb-lab small { color: var(--exc-muted-2); font-weight: 500; }
.ir-bar { display: flex; height: 15px; background: var(--exc-panel-2); border-radius: var(--radius-pill); overflow: hidden; }
.ir-seg { display: block; height: 100%; }
.ir-seg.r1, .ir-legend i.r1 { background: var(--rank-1); }
.ir-seg.r2, .ir-legend i.r2 { background: var(--rank-2); }
.ir-seg.r3, .ir-legend i.r3 { background: var(--rank-3); }
.ir-val { font-size: 13px; font-weight: 800; text-align: right; color: var(--exc-ink); font-variant-numeric: tabular-nums; }
@media (max-width: 1100px) {
  .lk-row { grid-template-columns: 130px 1fr 36px; }
  .ir-row { grid-template-columns: 150px 1fr 32px; }
}

/* 업종 placeholder (재분류 전) */
.industry-ph .ind-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
.ind-chip { font-size: 12px; color: var(--exc-muted); background: var(--exc-panel); border: 1px solid var(--exc-line);
  border-radius: var(--radius-pill); padding: 4px 12px; display: inline-flex; gap: 6px; align-items: center; }
.ind-chip b { color: var(--exc-ink-2); font-variant-numeric: tabular-nums; }
.ind-chip.ready { background: color-mix(in srgb, var(--exc-green) 12%, white); border-color: var(--exc-green);
  color: var(--exc-green-700); }
.ind-chip.ready b { color: var(--exc-green-700); }
"""


# ─────────────────────────────────────────────
# 7. 전체 HTML 조립
# ─────────────────────────────────────────────

def build_report(df: pd.DataFrame, seg_yaml: dict, src_name: str) -> str:
    segs = build_segments(df, seg_yaml)
    page_data = {s["name"]: compute_page_data(s["df"]) for s in segs}
    headlines = {s["name"]: extract_headline(page_data[s["name"]]) for s in segs}
    overall = headlines["전체"]

    # ③ 범용 집계기 — 세그먼트별 54문항 (deck 미커버 항목의 정적 렌더 데이터)
    cb = Codebook()
    questions = load_questions()
    agg = {s["name"]: aggregate_segment(s["df"], questions, cb) for s in segs}

    # 업종 게이트 현황 (enabled=False 면 placeholder, True 면 segs 에 이미 포함되어 정상 렌더)
    avail = industry_availability(next(s["df"] for s in segs if s["name"] == "전체"), seg_yaml)
    industry_block = "" if avail["enabled"] else render_industry_placeholder(avail)

    matrix = render_summary_matrix(segs, headlines, overall)
    sections = "\n".join(
        render_segment_section(s, headlines[s["name"]], overall, is_baseline=(s["name"] == "전체"),
                               agg_res=agg[s["name"]], questions=questions)
        for s in segs
    )
    nav = render_nav(segs, industry_disabled=not avail["enabled"])
    js = build_js([(s["ns"], page_data[s["name"]]) for s in segs])

    total_n = next((s["n"] for s in segs if s["name"] == "전체"), sum(s["n"] for s in segs))
    n_segs = len(segs)
    small_count = sum(1 for s in segs if s["n"] < SMALL_N)
    banner = (
        '<div class="prelim-banner">'
        f'⚠ <b>prelim 스냅샷</b> — 전체 기업 N={total_n} (수집 종료 9월 예정). '
        f'{n_segs}개 세그먼트 중 {small_count}개가 N&lt;{SMALL_N} 으로, 비율·델타는 <b>잠정값</b>입니다. '
        '본 단계의 목적은 (1) 세그먼트 리포트 구조·디자인 확정, (2) 자동화 결함 조기 검출. '
        '업종 세그먼트는 수기 재분류 후 2차에서 활성화.'
        '</div>'
    )

    controls = (
        '<div class="report-controls">'
        '<button class="global-toggle" onclick="toggleAllAppendix(this)">전체 부록 펼치기 ▾</button>'
        '<span class="rc-note">기본은 <b>핵심 지표</b>만 표시 — 부록(응답특성·교육형태·직책별)은 '
        '세그먼트별 버튼 또는 이 토글로 펼쳐 보세요. (인쇄 시 부록 자동 포함)</span>'
        '</div>'
    )

    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>제22회 인재개발 실태조사 — 세그먼트 분석 리포트 (prelim)</title>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
<style>{DECK_CSS}</style>
<style>{EXTRA_CSS}</style>
</head>
<body>
<div class="layout">
{nav}
<main>
{banner}
{matrix}
{controls}
{sections}
{industry_block}
</main>
</div>
<div class="floatnav">
  <button onclick="segNav(-1)" title="이전 세그먼트">↑</button>
  <button onclick="window.scrollTo({{top:0,behavior:'smooth'}})" title="맨 위 (요약 매트릭스)">⌂</button>
  <button onclick="segNav(1)" title="다음 세그먼트">↓</button>
</div>
<script>{js}</script>
</body>
</html>"""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--src", type=Path, default=DEFAULT_SRC)
    ap.add_argument("--src-sheet", default="Sheet1")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()

    seg_yaml = yaml.safe_load(SEGMENTS_YAML.read_text(encoding="utf-8"))
    df = pd.read_excel(args.src, sheet_name=args.src_sheet, dtype=object)
    html = build_report(df, seg_yaml, args.src.name)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(html, encoding="utf-8")
    try:
        shown = args.out.resolve().relative_to(ROOT)
    except ValueError:
        shown = args.out
    print(f"출력: {shown}  ({len(html):,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
