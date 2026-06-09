"""[단계 5] 22회 결과 HTML (main 산출물) 렌더러 v0.

설계:
  - chart_data JSON (source of truth) + raw_validated (현 시점 표본) 기반
  - 18 page outline (5_report/preview/report_outline_22th_*.md 와 동기화)
  - 단일 HTML 파일 self-contained, ECharts CDN
  - 좌측 sticky nav + 본문 + print CSS (PDF export 가능)
  - prototype v0: 데이터 있는 8개 페이지(p4·p5·p6·p9·p11·p12·p15·p16)에 실차트,
    나머지 10개 페이지는 placeholder

사용:
    python scripts/stage5_render_html.py \\
        --src 2_validated/raw_validated.xlsx \\
        --out 5_report/preview/result_22th_20260528.html
"""
from __future__ import annotations

import argparse
import io
import json
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

import pandas as pd
import yaml

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from design_tokens import TOKENS_CSS  # noqa: E402  (디자인 토큰 단일 소스)

DEFAULT_SRC = ROOT / "2_validated/raw_validated.xlsx"
DEFAULT_OUT = ROOT / "5_report/preview/result_22th_20260528.html"
SEGMENTS_YAML = ROOT / "config/segments.yaml"


# ────────────────────────────────────────────────
# 코드 → 라벨 매핑 (config/segments.yaml 마스터)
# ────────────────────────────────────────────────

def _load_segments_yaml():
    """segments.yaml 1회 로드, column_groups 를 group_id → entry dict 로 인덱싱."""
    if not SEGMENTS_YAML.exists():
        return {}
    with SEGMENTS_YAML.open(encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    groups = data.get("column_groups", []) or []
    return {g.get("id"): g for g in groups if "id" in g}


_SEGMENT_GROUPS = _load_segments_yaml()


def segment_options(group_id):
    """group_id 의 options dict (코드→라벨). 없으면 빈 dict."""
    g = _SEGMENT_GROUPS.get(group_id) or {}
    return g.get("options") or {}


def segment_public_rule(group_id):
    """group_id 의 public_rule (R_Div 코드→라벨). 없으면 빈 dict."""
    g = _SEGMENT_GROUPS.get(group_id) or {}
    return g.get("public_rule") or {}


def _coerce_int_key(v):
    """1.0 / "1" / 1 모두 1로. 정수화 실패하면 원본 문자열."""
    if pd.isna(v):
        return None
    if isinstance(v, str):
        v = v.strip()
        if not v:
            return None
        try:
            return int(float(v))
        except ValueError:
            return v
    try:
        return int(v)
    except (TypeError, ValueError):
        return str(v)


def map_r_div(value):
    """R_Div 코드 → 라벨. 매핑 없으면 코드 그대로 노출."""
    key = _coerce_int_key(value)
    if key is None:
        return "(미응답)"
    opts = segment_options(0)
    return opts.get(str(key), f"코드{key}")


def map_r_cate(cate, rdiv):
    """R_Cate 코드 → 라벨 + public_rule.
    R_Cate=NaN 이고 R_Div=4/5 면 public_rule 따라 공공기관/공공기타.
    그 외 NaN 은 '(미응답)'.
    """
    cate_opts = segment_options(1)
    public_rule = segment_public_rule(1)
    cate_key = _coerce_int_key(cate) if not (isinstance(cate, str) and not cate.strip().lstrip("-").isdigit()) else cate.strip()
    # 'etc' 같은 비숫자 토큰 보존
    if isinstance(cate, str) and not cate.strip().lstrip("-").isdigit():
        cate_key = cate.strip()
    if cate_key is None or (isinstance(cate, float) and pd.isna(cate)):
        rd_key = _coerce_int_key(rdiv)
        if rd_key in public_rule:
            return public_rule[rd_key]
        return "(미응답)"
    return cate_opts.get(str(cate_key), f"코드{cate_key}")


# ────────────────────────────────────────────────
# 데이터 계산
# ────────────────────────────────────────────────

def num(s):
    return pd.to_numeric(s, errors="coerce")


def freq_dist(s, code_label_map):
    """단일 변수 빈도 분포 → [(label, count, pct), ...]"""
    vc = num(s).value_counts(dropna=False).sort_index()
    total = int(vc.sum())
    out = []
    for k, v in vc.items():
        if pd.isna(k):
            lbl = "무응답"
        else:
            ki = int(k) if float(k).is_integer() else k
            lbl = code_label_map.get(ki, f"코드{ki}")
        out.append({"label": lbl, "count": int(v), "pct": round(100 * v / total, 1) if total else 0})
    return out


def multi_dist(s, code_label_map):
    s = s.dropna().astype(str)
    s = s[s.str.strip() != ""].pipe(lambda x: x[x.str.lower() != "nan"])
    n_resp = int(s.size)
    c = Counter()
    for v in s:
        for tok in v.split(","):
            tok = tok.strip()
            if not tok or tok.lower() == "nan":
                continue
            try:
                c[int(float(tok))] += 1
            except ValueError:
                pass
    items = []
    for k in sorted(c.keys()):
        lbl = code_label_map.get(k, f"코드{k}")
        items.append({"label": lbl, "count": int(c[k]),
                      "pct": round(100 * c[k] / n_resp, 1) if n_resp else 0})
    return {"n_respondents": n_resp, "items": items}


def compute_page_data(df: pd.DataFrame) -> dict:
    d = {}
    n_total = int(len(df))

    # p4 응답기업 특성 (R_Div + R_Cate)
    #   라벨 마스터: config/segments.yaml (응답이 어떻든 코드 정의는 고정)
    #   R_Cate=NaN & R_Div∈{4,5} → public_rule 따라 공공기관/공공기타
    div_labels = df["R_Div"].apply(map_r_div)
    div_vc = div_labels.value_counts()
    div_order = (_SEGMENT_GROUPS.get(0) or {}).get("options_order") or list(div_vc.index)
    d["p4_div"] = [
        {"label": lbl, "count": int(div_vc.get(lbl, 0)),
         "pct": round(100 * div_vc.get(lbl, 0) / n_total, 1) if n_total else 0}
        for lbl in div_order if div_vc.get(lbl, 0) > 0
    ]

    cate_labels = df.apply(lambda r: map_r_cate(r.get("R_Cate"), r.get("R_Div")), axis=1)
    cate_vc = cate_labels.value_counts().head(10)
    d["p4"] = {
        "n": n_total,
        "div": d.pop("p4_div"),
        "cate_top": [
            {"label": lbl, "count": int(v),
             "pct": round(100 * v / n_total, 1) if n_total else 0}
            for lbl, v in cate_vc.items()
        ],
    }

    # p5 거시지표
    macros = [
        ("p1)R_1_1_2", "매출총액", "원"),
        ("p1)R_1_2_2", "전체 직원 수", "명"),
        ("p1)R_1_3_2", "교육대상 직원 수", "명"),
        ("p1)R_1_4_2", "교육예산 총액", "원"),
        ("p1)R_1_5_2", "교육경비 집행 총액", "원"),
    ]
    d["p5"] = {
        "metrics": [
            {
                "label": lbl, "unit": unit,
                "n": int(num(df[c]).notna().sum()),
                "avg": float(num(df[c]).mean()) if num(df[c]).notna().any() else None,
                "median": float(num(df[c]).median()) if num(df[c]).notna().any() else None,
            }
            for c, lbl, unit in macros
        ],
    }
    # 매출대비 교육비 비율, 1인당 교육비 — 파생
    rev = num(df["p1)R_1_1_2"])
    bud = num(df["p1)R_1_5_2"])
    emp = num(df["p1)R_1_3_2"])
    ratio = (bud / rev).replace([float("inf"), float("-inf")], None)
    per_emp = (bud / emp).replace([float("inf"), float("-inf")], None)
    # 정제 전 단계: outlier(예: 매출 단위 의심 → ratio 폭주)에 둔감한 중앙값 사용
    d["p5"]["derived"] = {
        "ratio_bud_rev": round(float(ratio.median() * 100), 3) if ratio.notna().any() else None,
        "per_emp_won": round(float(per_emp.median()), 0) if per_emp.notna().any() else None,
        "stat": "median (정제 전 안전 통계)",
    }

    # p6 예산 변동 (R_2_n_2, 11코드 → 증가5/동일1/감소5 그룹화)
    r2 = num(df["p1)R_2_n_2"])
    inc = int(r2.isin(range(1, 6)).sum())   # 1~5
    same = int(r2.isna().sum())              # NaN = 동일
    dec = int(r2.isin(range(6, 12)).sum())   # 6~11 (감소 1~5 + 동일 11)
    # 표기 분류 단순화: NaN + 11 (동일) → 동일
    same_only = int(r2.isna().sum() + (r2 == 11).sum())
    dec_only = int(r2.isin(range(6, 11)).sum())  # 6~10
    d["p6"] = {
        "n": n_total,
        "summary": [
            {"label": "확대", "count": inc, "pct": round(100 * inc / n_total, 1)},
            {"label": "유사·변동없음", "count": same_only, "pct": round(100 * same_only / n_total, 1)},
            {"label": "축소", "count": dec_only, "pct": round(100 * dec_only / n_total, 1)},
        ],
        "detail": freq_dist(df["p1)R_2_n_2"],
                            {1: "증가 1~5%", 2: "증가 6~15%", 3: "증가 16~25%", 4: "증가 26~50%",
                             5: "증가 51%+", 6: "감소 1~5%", 7: "감소 6~15%", 8: "감소 16~25%",
                             9: "감소 26~50%", 10: "감소 51%+", 11: "동일"}),
    }

    # p9 형태별 인원·지출 비율 (R_6_1_*, R_7_1_*)
    forms = [("집합", "p1)R_6_1_2", "p1)R_7_1_2"),
             ("실시간 비대면", "p1)R_6_1_3", "p1)R_7_1_3"),
             ("이러닝", "p1)R_6_1_4", "p1)R_7_1_4"),
             ("하이브리드 러닝", "p1)R_6_1_5", "p1)R_7_1_5"),
             ("북러닝", "p1)R_6_1_6", "p1)R_7_1_6"),
             ("개인별 외부", "p1)R_6_1_7", "p1)R_7_1_7")]
    d["p9"] = {
        "categories": [f for f, _, _ in forms],
        "headcount_pct": [round(float(num(df[h]).mean()), 1) if num(df[h]).notna().any() else 0 for _, h, _ in forms],
        "spend_pct": [round(float(num(df[s]).mean()), 1) if num(df[s]).notna().any() else 0 for _, _, s in forms],
    }

    # p10 직책별 교육비
    roles = [("신입", "p1)R_8_1_2"), ("비직책자", "p1)R_8_1_3"),
             ("직책자(팀장)", "p1)R_8_1_4"), ("임원급", "p1)R_8_1_5")]
    d["p10"] = {
        "categories": [r for r, _ in roles],
        "values": [round(float(num(df[c]).mean()), 1) if num(df[c]).notna().any() else 0 for _, c in roles],
    }

    # p11 교육비 중 AI 교육 비율
    d["p11"] = {
        "n": n_total,
        "dist": freq_dist(df["p1)R_9_multi"],
                          {1: "AI 교육 실행 안 함", 2: "10% 미만", 3: "10~20% 미만",
                           4: "20~30% 미만", 5: "30~50% 미만", 6: "50% 이상"}),
    }

    # p12 투자 만족도 Likert
    d["p12"] = {
        "n": n_total,
        "dist": freq_dist(df["p1)R_10_multi"],
                          {1: "매우만족", 2: "만족", 3: "보통", 4: "불만족", 5: "매우불만족"}),
    }

    # p15 AI 전략·CEO 지원
    d["p15"] = {
        "strategy": freq_dist(df["p5)R_1_multi"],
                              {1: "전략 있음", 2: "수립중", 3: "검토중", 4: "미검토"}),
        "ceo": freq_dist(df["p5)R_2_multi"],
                         {1: "매우높음", 2: "높음", 3: "보통", 4: "낮음", 5: "매우낮음"}),
    }

    # p16 AI 도입 단계·27년 예산
    d["p16"] = {
        "stage": freq_dist(df["p5)R_4_multi"],
                           {1: "미도입", 2: "검토중", 3: "초기 도입", 4: "확대 단계", 5: "정착화"}),
        "budget_27": freq_dist(df["p5)R_10_multi"],
                                {1: "대폭 확대(20%↑)", 2: "일부 확대(10%↓)", 3: "유사", 4: "감소"}),
    }

    return d


# ────────────────────────────────────────────────
# 18 page outline
# ────────────────────────────────────────────────

PAGES = [
    {"id": "p1", "num": "표지", "title": "제22회 인재개발 실태조사", "kind": "cover", "weight": "t1"},
    {"id": "p2", "num": "취지", "title": "조사 취지", "kind": "intro", "weight": "t1"},
    {"id": "p3", "num": "개요", "title": "Survey Overview", "kind": "overview", "weight": "t1"},
    {"id": "p4", "num": "04", "title": "응답기업 특성 (업종·규모)",
     "raw": "R_Div, R_Cate, p1)R_1_2_2", "viz": "도넛 + 막대", "has_data": True, "weight": "t2"},
    {"id": "p5", "num": "05", "title": "거시지표 — 매출·인원·예산·집행",
     "raw": "p1)R_1_1_2 ~ p1)R_1_5_2", "viz": "표 + 파생 지표", "has_data": True, "weight": "t2"},
    {"id": "p6", "num": "06", "title": "24→25년 교육예산 변동",
     "raw": "p1)R_2_n_2", "viz": "가로 100% 누적 + 상세", "has_data": True, "weight": "t2"},
    {"id": "p7", "num": "07", "title": "교육비 증가 이유",
     "raw": "p1)R_3_multi, p1)R_3_etc", "viz": "가로 막대 + 기타 리스트", "has_data": False, "weight": "t2"},
    {"id": "p8", "num": "08", "title": "교육비 감소 이유",
     "raw": "p1)R_4_multi, p1)R_4_etc", "viz": "가로 막대 + 기타 리스트", "has_data": False, "weight": "t2"},
    {"id": "p9", "num": "09", "title": "교육 형태별 참가인원·지출 비율",
     "raw": "p1)R_6_1_*, p1)R_7_1_*", "viz": "더블 막대 (인원 vs 지출)", "has_data": True, "weight": "t2"},
    {"id": "p10", "num": "10", "title": "직책별 교육비 지출 비율",
     "raw": "p1)R_8_1_*", "viz": "100% 누적", "has_data": True, "weight": "t2"},
    {"id": "p11", "num": "11", "title": "교육비 중 AI 교육 비율  ⭐ 22회 신규",
     "raw": "p1)R_9_multi", "viz": "히트 스트립 (6구간)", "has_data": True, "weight": "t3"},
    {"id": "p12", "num": "12", "title": "교육비 투자 효과 (만족도)",
     "raw": "p1)R_10_multi", "viz": "Likert 발산 바 + 5점 KPI", "has_data": True, "weight": "t2"},
    {"id": "p13", "num": "13", "title": "내년도 신규 추진 내용 (HRD 운영)",
     "raw": "p2)R_2_multi 외", "viz": "가로 막대 (상위 10)", "has_data": False, "weight": "t2"},
    {"id": "p14", "num": "14", "title": "리더십·비직책자·조직개발 교육 테마",
     "raw": "p3)R_*", "viz": "3 세트 막대", "has_data": False, "weight": "t2"},
    {"id": "p15", "num": "15", "title": "AI 도입과 활용 — 전사 전략·CEO 지원  ⭐ 22회 신규",
     "raw": "p5)R_1_multi, p5)R_2_multi", "viz": "가로 누적 × 2", "has_data": True, "weight": "t2"},
    {"id": "p16", "num": "16", "title": "AI 교육 — 도입 단계·27년 예산 전망  ⭐ 22회 신규",
     "raw": "p5)R_4_multi, p5)R_10_multi", "viz": "가로 누적 × 2", "has_data": True, "weight": "t2"},
    {"id": "p17", "num": "17", "title": "도움 필요 사항 (주관식)",
     "raw": "p5)R_11_etc 외 etc 종합", "viz": "키워드 카테고리", "has_data": False, "weight": "t4"},
    {"id": "p18", "num": "Summary", "title": "Summary + Contact", "kind": "summary", "weight": "t3"},
]


# ────────────────────────────────────────────────
# HTML 빌더
# ────────────────────────────────────────────────

CSS = """
@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css");

""" + TOKENS_CSS + """

/* 메인 HTML 고유 레이아웃 변수 (TOKENS_CSS 외) */
:root { --sidebar-w: 280px; --max-w: 1280px; --pad-x: 56px; }

* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0;
  font-family: var(--font-sans);
  color: var(--exc-ink);
  background: #fff;
  -webkit-font-smoothing: antialiased;
  word-break: keep-all;
  overflow-wrap: break-word;
  font-feature-settings: "ss06";
}
body { font-size: var(--fs-body); line-height: 1.6; }

.layout { display: grid; grid-template-columns: var(--sidebar-w) 1fr; min-height: 100vh; }

/* ─── Sidebar (dusk · catalog 톤) ─── */
nav.side {
  position: sticky; top: 0; height: 100vh; overflow-y: auto;
  background: var(--ai-dusk);
  color: #fff;
  padding: 36px 24px 40px;
  border-right: 1px solid rgba(255,255,255,.06);
  display: flex; flex-direction: column; gap: var(--space-6);
}
nav.side .brand {
  display: flex; align-items: center; gap: 12px;
  padding-bottom: var(--space-5);
  border-bottom: 1px solid rgba(255,255,255,.08);
}
nav.side .brand .mark {
  width: 36px; height: 36px;
  border-radius: var(--radius-sm);
  background:
    radial-gradient(circle at 30% 30%, var(--ai-cyan) 0%, transparent 55%),
    linear-gradient(135deg, var(--ai-violet) 0%, var(--ai-dusk-2) 100%);
  box-shadow: 0 0 22px rgba(91,91,240,.5);
  flex-shrink: 0;
}
nav.side .brand b {
  display: block; font-size: 15px; font-weight: 800;
  color: #fff; letter-spacing: -.01em;
}
nav.side .brand span {
  display: block; font-size: 10px; letter-spacing: .14em;
  text-transform: uppercase;
  color: rgba(255,255,255,.55); font-weight: 600; margin-top: 2px;
}
nav.side .meta {
  font-size: 11px; color: rgba(255,255,255,.45);
  line-height: 1.55; padding: 12px 12px 0;
}
nav.side .group { display: flex; flex-direction: column; gap: 2px; }
nav.side .group .h {
  font-size: 10px; font-weight: 800; letter-spacing: .18em;
  text-transform: uppercase; color: rgba(255,255,255,.4);
  margin: var(--space-3) 12px var(--space-2);
}
nav.side a {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
  font-size: 13px; font-weight: 600;
  color: rgba(255,255,255,.75);
  text-decoration: none;
  transition: background var(--dur-fast) var(--ease-out),
              color var(--dur-fast) var(--ease-out);
  letter-spacing: -.005em;
  line-height: 1.35;
}
nav.side a:hover { background: rgba(255,255,255,.06); color: #fff; }
nav.side a .num {
  font-size: 10px; font-weight: 800; letter-spacing: .04em;
  color: var(--ai-cyan);
  font-variant-numeric: tabular-nums;
  min-width: 28px;
}
nav.side a.new { color: rgba(255,255,255,.92); }
nav.side a.new .num { color: var(--ai-violet-2); }
nav.side a.new::after { content: " ⭐"; font-size: 10px; }
nav.side .foot {
  margin-top: auto; padding-top: var(--space-4);
  font-size: 11px; color: rgba(255,255,255,.4);
  line-height: 1.55; letter-spacing: -.005em;
  border-top: 1px solid rgba(255,255,255,.06);
}
nav.side .foot b { color: rgba(255,255,255,.7); font-weight: 700; }

/* ─── Main ─── */
main {
  padding: var(--space-12) var(--pad-x) 96px;
  max-width: var(--max-w);
}

section {
  background: #fff;
  border: 1px solid var(--exc-line);
  border-radius: var(--radius-md);
  padding: var(--space-16) var(--space-12) var(--space-12);
  margin-bottom: var(--space-6);
  page-break-after: always;
  position: relative;
}

/* ─── Slide chrome (header/footer) — deck 톤 ─── */
.slide-header,
.slide-footer {
  position: absolute;
  left: var(--space-12);
  right: var(--space-12);
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 5;
}
.slide-header { top: var(--space-6); }
.slide-footer { bottom: var(--space-5); }
.slide-header .logo {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 11px; font-weight: 800;
  letter-spacing: .12em; text-transform: uppercase;
  color: var(--exc-green);
}
.slide-header .logo .mark {
  width: 16px; height: 16px;
  background: var(--exc-green);
  border-radius: 50%;
  position: relative;
}
.slide-header .logo .mark::before {
  content: ""; position: absolute; inset: 4px;
  background: #fff; border-radius: 50%;
}
.slide-header .eyebrow {
  font-size: 12px; letter-spacing: .12em; text-transform: uppercase;
  font-weight: 700; color: var(--exc-muted);
}
.slide-header .eyebrow .dot {
  display: inline-block;
  width: 6px; height: 6px;
  border-radius: 999px;
  background: var(--exc-green);
  margin: 0 10px 2px;
  vertical-align: middle;
}
.new-section .slide-header .eyebrow .dot { background: var(--ai-violet); }
.slide-footer .meta {
  font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
  font-weight: 700; color: var(--exc-muted-2);
}
.slide-footer .page-no {
  font-variant-numeric: tabular-nums;
  font-weight: 800; font-size: 14px;
  letter-spacing: .06em;
  color: var(--exc-ink);
}
.slide-footer .page-no em {
  font-style: normal; color: var(--exc-muted-2);
  font-weight: 500;
}

/* dark variant (cover) */
.slide--dark .slide-header .logo { color: rgba(255,255,255,.85); }
.slide--dark .slide-header .logo .mark { background: var(--ai-cyan); }
.slide--dark .slide-header .logo .mark::before { background: var(--ai-dusk); }
.slide--dark .slide-header .eyebrow,
.slide--dark .slide-footer .meta { color: rgba(255,255,255,.55); }
.slide--dark .slide-footer .page-no { color: #fff; }
.slide--dark .slide-footer .page-no em { color: rgba(255,255,255,.4); }

/* ─── Cover (dusk + grid + ai-tag + display) ─── */
section.cover {
  padding: var(--space-20) var(--space-16);
  background:
    radial-gradient(ellipse 900px 600px at 70% 30%, color-mix(in srgb, var(--ai-violet) 36%, transparent) 0%, transparent 60%),
    radial-gradient(ellipse 600px 400px at 20% 80%, color-mix(in srgb, var(--ai-cyan) 20%, transparent) 0%, transparent 60%),
    var(--ai-dusk);
  color: #fff;
  border: none;
  overflow: hidden;
  min-height: 540px;
  display: grid;
  grid-template-rows: 1fr auto;
  gap: var(--space-8);
}
section.cover::before {
  content: "";
  position: absolute; inset: 0;
  background-image:
    linear-gradient(color-mix(in srgb, var(--ai-violet) 18%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--ai-violet) 18%, transparent) 1px, transparent 1px);
  background-size: 64px 64px;
  mask-image: radial-gradient(ellipse 1000px 600px at 50% 50%, black 30%, transparent 80%);
  -webkit-mask-image: radial-gradient(ellipse 1000px 600px at 50% 50%, black 30%, transparent 80%);
  opacity: .55;
  z-index: 0;
  pointer-events: none;
}
section.cover > * { position: relative; z-index: 2; }
section.cover .ai-tag {
  position: absolute; top: var(--space-6); right: var(--space-12);
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 14px;
  border: 1px solid rgba(255,255,255,.18);
  border-radius: var(--radius-pill);
  font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
  color: rgba(255,255,255,.85); font-weight: 700;
  backdrop-filter: blur(8px);
  z-index: 6;
}
section.cover .ai-tag::before {
  content: ""; width: 6px; height: 6px; border-radius: 50%;
  background: var(--ai-cyan); box-shadow: 0 0 10px var(--ai-cyan);
  animation: pulse 1.8s var(--ease-out) infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: .4; transform: scale(.8); }
}
section.cover .cover-eyebrow {
  display: inline-flex; align-items: center; gap: 14px;
  font-size: 13px; font-weight: 800;
  letter-spacing: .22em; text-transform: uppercase;
  color: var(--ai-cyan);
  margin-bottom: var(--space-6);
}
section.cover .cover-eyebrow::before {
  content: ""; width: 48px; height: 1px; background: var(--ai-cyan);
}
section.cover h1.cover-title {
  font-size: 88px; font-weight: 900;
  line-height: 1.02; letter-spacing: -.035em;
  color: #fff; margin: 0 0 var(--space-6);
  text-wrap: balance;
}
section.cover h1.cover-title .accent {
  background: linear-gradient(110deg, var(--ai-violet) 0%, var(--ai-cyan) 100%);
  -webkit-background-clip: text; background-clip: text;
  color: transparent;
}
section.cover .cover-sub {
  font-size: 20px; line-height: 1.55;
  color: rgba(255,255,255,.75);
  max-width: 720px;
}
section.cover .meta-stack {
  display: flex; gap: var(--space-12);
  padding-top: var(--space-6);
  border-top: 1px solid rgba(255,255,255,.12);
}
section.cover .meta-stack .item .k {
  font-size: 10px; letter-spacing: .14em; text-transform: uppercase;
  color: rgba(255,255,255,.5); font-weight: 700;
  margin-bottom: var(--space-1);
}
section.cover .meta-stack .item .v {
  font-size: 16px; font-weight: 700; color: #fff;
  letter-spacing: -.005em;
}

/* ─── Section chrome (content slides) ─── */
.slide-eyebrow {
  display: inline-flex; align-items: center;
  gap: 12px;
  font-size: 13px; font-weight: 800;
  letter-spacing: .14em; text-transform: uppercase;
  color: var(--exc-green);
  margin-bottom: var(--space-4);
}
.slide-eyebrow .num {
  display: inline-flex;
  width: 36px; height: 36px;
  border-radius: var(--radius-xs);
  background: color-mix(in srgb, var(--exc-green) 14%, white);
  align-items: center; justify-content: center;
  font-size: 12px; font-weight: 800;
  color: var(--exc-green);
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}
.new-section .slide-eyebrow { color: var(--ai-violet); }
.new-section .slide-eyebrow .num {
  background: color-mix(in srgb, var(--ai-violet) 14%, white);
  color: var(--ai-violet);
}

.slide-headline {
  font-size: 40px; font-weight: 800;
  line-height: 1.15; letter-spacing: -.022em;
  color: var(--exc-ink);
  margin: 0 0 var(--space-3);
  text-wrap: balance;
}
.slide-headline .accent { color: var(--exc-green); }
.new-section .slide-headline .accent { color: var(--ai-violet); }
.new-badge {
  display: inline-flex; align-items: center;
  background: color-mix(in srgb, var(--ai-violet) 14%, white);
  color: var(--ai-violet);
  font-size: 11px; font-weight: 700;
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  margin-left: var(--space-3);
  letter-spacing: .04em;
  vertical-align: middle;
}

section .meta-line {
  font-size: var(--fs-caption); color: var(--exc-muted);
  line-height: 1.7; margin: var(--space-3) 0 var(--space-8);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--exc-line);
}
section .meta-line code {
  font-family: var(--font-mono); font-size: 11px;
  background: var(--exc-panel);
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  color: var(--exc-ink-2);
}

/* Takeaway box (slide 하단 핵심 요약) */
.slide-takeaway {
  margin-top: var(--space-6);
  padding: var(--space-4) var(--space-6);
  font-size: 15px; font-weight: 500;
  line-height: 1.6;
  color: var(--exc-ink-2);
  background: var(--exc-panel);
  border-left: 3px solid var(--exc-green);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
}
.slide-takeaway strong { color: var(--exc-green); font-weight: 700; }
.new-section .slide-takeaway { border-left-color: var(--ai-violet); }
.new-section .slide-takeaway strong { color: var(--ai-violet); }
.slide-takeaway .label {
  display: block;
  font-size: 10px; font-weight: 800;
  letter-spacing: .14em; text-transform: uppercase;
  color: var(--exc-muted); margin-bottom: var(--space-2);
}

section.intro { padding-bottom: var(--space-16); }
section.intro p, section.intro li { font-size: var(--fs-body-lg); color: var(--exc-muted); line-height: 1.8; }

/* Overview 4타일 */
.ov-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 1fr;
  gap: var(--space-4);
  margin-top: var(--space-5);
}
@media (max-width: 1100px) { .ov-grid { grid-template-columns: 1fr 1fr; } }
.ov-tile {
  background: var(--exc-panel);
  border: 1px solid var(--exc-line);
  border-radius: var(--radius-md);
  padding: var(--space-5) var(--space-5) var(--space-6);
  display: flex; flex-direction: column; gap: var(--space-2);
  min-height: 160px;
}
.ov-tile .k {
  font-size: 10px; font-weight: 800;
  letter-spacing: .14em; text-transform: uppercase;
  color: var(--exc-muted);
}
.ov-tile .big {
  font-size: 44px; font-weight: 900;
  color: var(--exc-ink);
  letter-spacing: -.02em; line-height: 1;
  font-variant-numeric: tabular-nums;
}
.ov-tile .big small {
  font-size: 16px; font-weight: 700;
  color: var(--exc-muted-2);
  margin-left: 4px;
  letter-spacing: 0;
}
.ov-tile .v {
  font-size: 13px; color: var(--exc-ink-2); font-weight: 600;
  margin-top: auto;
}
.ov-tile .v small {
  display: block; font-size: 11px;
  color: var(--exc-muted); font-weight: 500;
  margin-top: 2px;
}
.ov-tile.is-hero {
  background: var(--ai-dusk);
  color: #fff;
  border-color: transparent;
}
.ov-tile.is-hero .k { color: var(--ai-cyan); }
.ov-tile.is-hero .topic-title {
  font-size: 24px; font-weight: 800;
  color: #fff; line-height: 1.25;
  letter-spacing: -.015em;
}
.ov-tile.is-hero .topic-title small {
  display: block; font-size: 12px; font-weight: 500;
  color: rgba(255,255,255,.65);
  margin-top: var(--space-2);
  letter-spacing: 0;
}

/* Chart layout */
.chart-row {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: var(--space-6);
}
@media (max-width: 1100px) { .chart-row { grid-template-columns: 1fr; } }
.chart-box { width: 100%; height: 380px; }

/* Placeholder */
.placeholder {
  background: var(--exc-panel);
  border: 1.5px dashed var(--exc-line-2);
  border-radius: var(--radius-sm);
  padding: 72px 24px;
  color: var(--exc-muted-2);
  text-align: center;
  font-size: var(--fs-body-sm);
  line-height: 1.7;
}

/* Caveat */
.caveat {
  background: color-mix(in srgb, var(--exc-amber) 16%, white);
  border-left: 3px solid var(--exc-amber);
  padding: var(--space-3) var(--space-4);
  font-size: var(--fs-body-sm);
  color: var(--exc-ink-2);
  margin: var(--space-5) 0 0;
  border-radius: var(--radius-xs);
  line-height: 1.55;
}

/* Tables */
table.metrics {
  width: 100%; border-collapse: collapse;
  margin-top: var(--space-3);
  border-top: 1px solid var(--exc-line);
}
table.metrics th, table.metrics td {
  border-bottom: 1px solid var(--exc-line);
  padding: var(--space-3) var(--space-4);
  text-align: left;
  font-size: var(--fs-body-sm);
  line-height: 1.5;
}
table.metrics th {
  background: var(--exc-panel);
  font-weight: 700; font-size: 12px;
  color: var(--exc-muted-2); letter-spacing: .02em;
}
table.metrics th.num,
table.metrics td.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* KPI cards */
.kpi-row {
  display: grid; grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4); margin-top: var(--space-5);
}
.kpi {
  background: var(--exc-panel);
  border: 1px solid var(--exc-line);
  padding: var(--space-5) var(--space-6);
  border-radius: var(--radius-sm);
}
.kpi .label {
  font-size: 11px; font-weight: 800;
  letter-spacing: .14em; text-transform: uppercase;
  color: var(--exc-muted); margin-bottom: var(--space-2);
}
.kpi .value {
  font-size: 30px; font-weight: 800;
  color: var(--exc-ink);
  letter-spacing: -.02em;
  font-variant-numeric: tabular-nums;
  line-height: 1.05;
}
.kpi.green .value { color: var(--exc-green); }
.kpi.violet .value { color: var(--ai-violet); }
.kpi .note {
  font-size: 11px; color: var(--exc-muted-2);
  margin-top: var(--space-1); line-height: 1.45;
}

/* Summary */
section.summary ul.summary-list {
  list-style: none; padding: 0; margin: var(--space-4) 0 0;
}
section.summary ul.summary-list li {
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--exc-line);
  font-size: var(--fs-body); line-height: 1.7;
  color: var(--exc-ink-2);
}
section.summary ul.summary-list li:last-child { border-bottom: none; }
section.summary ul.summary-list strong { color: var(--exc-green); }
section.summary .contact {
  margin-top: var(--space-8);
  padding-top: var(--space-5);
  border-top: 1px solid var(--exc-line);
  font-size: var(--fs-caption); color: var(--exc-muted);
  letter-spacing: .04em;
}

/* Print */
@media print {
  .layout { grid-template-columns: 1fr; }
  nav.side { display: none; }
  main { padding: 0; max-width: none; }
  section { border: none; margin: 0; padding: 36px; box-shadow: none; }
  section.cover { background: white; padding: 80px 40px; }
}
"""

JS_TEMPLATE = """
const PAGE_DATA = __PAGE_DATA__;

// EXC + AI 팔레트
const C = {
  green:   '#009858',
  green2:  '#4DBE89',
  green3:  '#8CD0AE',
  green4:  '#C2E6D3',
  navy:    '#0E2A47',
  amber:   '#F4B740',
  red:     '#E94B35',
  info:    '#2A6FDB',
  ink:     '#111111',
  ink2:    '#333333',
  muted:   '#888888',
  line:    '#E5E7EB',
  panel:   '#F7F8F9',
  violet:  '#5B5BF0',
  violet2: '#7C7CFF',
  cyan:    '#00E5C8',
};

// Likert (긍정→부정) 발산 팔레트
const LIKERT_5 = [C.green, C.green2, C.muted, C.amber, C.red];
// 도넛 회전 팔레트 (EXC + neutral)
const PIE_BASE = [C.green, C.navy, C.amber, C.green2, C.info, C.red, C.green3, C.muted];
// 22회 신규 ⭐ 차트 (AI 영역) 단색
const AI_COLOR = C.violet;

const BASE_TEXT = {
  fontFamily: '"Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", sans-serif',
  color: C.ink2,
};

function fmtNum(n, frac) {
  return Number(n).toLocaleString('ko-KR', { minimumFractionDigits: frac, maximumFractionDigits: frac });
}
function fmtKRW(v) {
  if (v == null) return '–';
  if (v >= 1e12) return fmtNum(v/1e12, 1) + '조';
  if (v >= 1e8)  return fmtNum(v/1e8, 1)  + '억';
  if (v >= 1e4)  return fmtNum(v/1e4, 1)  + '만';
  return Math.round(v).toLocaleString('ko-KR');
}

function chartTitle(text, color) {
  return {
    text: text,
    left: 'center',
    textStyle: { fontSize: 13, fontWeight: 700, color: color || C.ink, ...BASE_TEXT },
  };
}
function commonGrid() { return { left: 110, right: 70, top: 56, bottom: 36 }; }
function valueAxis() { return { type: 'value', max: 100, axisLabel: { formatter: '{value}%', color: C.muted, fontFamily: BASE_TEXT.fontFamily }, axisLine: { lineStyle: { color: C.line } }, splitLine: { lineStyle: { color: C.line, type: 'dashed' } } }; }
function categoryAxis(data) { return { type: 'category', data: data, axisLabel: { color: C.ink2, fontFamily: BASE_TEXT.fontFamily, fontSize: 12 }, axisLine: { lineStyle: { color: C.line } }, axisTick: { show: false } }; }

function horizontalBar100(elId, items, title, color) {
  color = color || C.green;
  echarts.init(document.getElementById(elId)).setOption({
    title: chartTitle(title),
    grid: commonGrid(),
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, textStyle: BASE_TEXT },
    xAxis: valueAxis(),
    yAxis: categoryAxis(items.map(x => x.label)),
    series: [{
      type: 'bar',
      data: items.map(x => x.pct),
      barWidth: '60%',
      label: { show: true, position: 'right', formatter: '{c}%', color: C.ink2, fontSize: 12, fontFamily: BASE_TEXT.fontFamily, fontWeight: 600 },
      itemStyle: { color: color, borderRadius: [0, 4, 4, 0] },
    }]
  });
}

function initP4() {
  const d = PAGE_DATA.p4;
  if (!d) return;
  echarts.init(document.getElementById('p4-div')).setOption({
    title: chartTitle('조직 구분'),
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)', textStyle: BASE_TEXT },
    color: PIE_BASE,
    series: [{
      type: 'pie', radius: ['46%', '72%'],
      data: d.div.map(x => ({ name: x.label, value: x.count })),
      label: { formatter: '{b}\\n{c}건 · {d}%', fontFamily: BASE_TEXT.fontFamily, fontSize: 12, color: C.ink2 },
      itemStyle: { borderWidth: 2, borderColor: '#fff' },
    }]
  });
  echarts.init(document.getElementById('p4-cate')).setOption({
    title: chartTitle('업종 분포 (상위 10)'),
    tooltip: { trigger: 'item', textStyle: BASE_TEXT },
    color: PIE_BASE,
    series: [{
      type: 'pie', radius: ['46%', '72%'],
      data: d.cate_top.map(x => ({ name: x.label, value: x.count })),
      label: { formatter: '{b}: {c}건', fontFamily: BASE_TEXT.fontFamily, fontSize: 12, color: C.ink2 },
      itemStyle: { borderWidth: 2, borderColor: '#fff' },
    }]
  });
}

function initP5() {
  const d = PAGE_DATA.p5;
  if (!d) return;
  const tbody = document.getElementById('p5-tbody');
  tbody.innerHTML = d.metrics.map(m => `
    <tr>
      <td>${m.label}</td>
      <td class="num">${m.n}</td>
      <td class="num">${m.avg != null ? (m.unit === '원' ? fmtKRW(m.avg) + '원' : m.avg.toLocaleString('ko-KR') + m.unit) : '–'}</td>
      <td class="num">${m.median != null ? (m.unit === '원' ? fmtKRW(m.median) + '원' : m.median.toLocaleString('ko-KR') + m.unit) : '–'}</td>
    </tr>`).join('');
  document.getElementById('p5-ratio').textContent = d.derived.ratio_bud_rev != null ? d.derived.ratio_bud_rev.toFixed(3) + '%' : '–';
  document.getElementById('p5-peremp').textContent = d.derived.per_emp_won != null ? fmtKRW(d.derived.per_emp_won) + '원' : '–';
}

function initP6() {
  const d = PAGE_DATA.p6;
  if (!d) return;
  // 요약은 발산 색 (확대=green, 유사=muted, 축소=red)
  const summaryColors = [C.green, C.muted, C.red];
  echarts.init(document.getElementById('p6-summary')).setOption({
    title: chartTitle('예산 변동 요약 (확대 / 유사 / 축소)'),
    grid: commonGrid(),
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, textStyle: BASE_TEXT },
    xAxis: valueAxis(),
    yAxis: categoryAxis(d.summary.map(x => x.label)),
    series: [{
      type: 'bar',
      data: d.summary.map((x, i) => ({ value: x.pct, itemStyle: { color: summaryColors[i] || C.green, borderRadius: [0, 4, 4, 0] }})),
      barWidth: '60%',
      label: { show: true, position: 'right', formatter: '{c}%', color: C.ink2, fontSize: 12, fontFamily: BASE_TEXT.fontFamily, fontWeight: 600 },
    }]
  });
  horizontalBar100('p6-detail', d.detail, '증감율 구간 상세', C.green);
}

function initP9() {
  const d = PAGE_DATA.p9;
  if (!d) return;
  echarts.init(document.getElementById('p9-double')).setOption({
    title: chartTitle('형태별 참가인원 vs 지출 비율 평균'),
    legend: { top: 28, textStyle: BASE_TEXT, itemWidth: 14, itemHeight: 8 },
    tooltip: { trigger: 'axis', textStyle: BASE_TEXT },
    grid: { left: 50, right: 30, top: 76, bottom: 60 },
    xAxis: { type: 'category', data: d.categories, axisLabel: { interval: 0, rotate: 24, fontFamily: BASE_TEXT.fontFamily, color: C.ink2 }, axisLine: { lineStyle: { color: C.line } }, axisTick: { show: false } },
    yAxis: { type: 'value', axisLabel: { formatter: '{value}%', color: C.muted, fontFamily: BASE_TEXT.fontFamily }, splitLine: { lineStyle: { color: C.line, type: 'dashed' } } },
    series: [
      { name: '참가인원 비율', type: 'bar', data: d.headcount_pct, itemStyle: { color: C.green, borderRadius: [4,4,0,0] }, barWidth: '32%' },
      { name: '지출 비율', type: 'bar', data: d.spend_pct, itemStyle: { color: C.navy, borderRadius: [4,4,0,0] }, barWidth: '32%' },
    ]
  });
}

function initP10() {
  const d = PAGE_DATA.p10;
  if (!d) return;
  echarts.init(document.getElementById('p10-bar')).setOption({
    title: chartTitle('직책별 교육비 지출 평균'),
    grid: commonGrid(),
    tooltip: { trigger: 'axis', textStyle: BASE_TEXT },
    xAxis: { type: 'value', axisLabel: { formatter: '{value}%', color: C.muted, fontFamily: BASE_TEXT.fontFamily }, splitLine: { lineStyle: { color: C.line, type: 'dashed' } } },
    yAxis: categoryAxis(d.categories),
    series: [{ type: 'bar', data: d.values,
      barWidth: '60%',
      label: { show: true, position: 'right', formatter: '{c}%', color: C.ink2, fontSize: 12, fontFamily: BASE_TEXT.fontFamily, fontWeight: 600 },
      itemStyle: { color: C.green, borderRadius: [0, 4, 4, 0] }
    }]
  });
}

function initP11() {
  const d = PAGE_DATA.p11;
  if (!d) return;
  horizontalBar100('p11-bar', d.dist, '교육비 중 AI 교육 비율 (6구간)', AI_COLOR);
}

function initP12() {
  const d = PAGE_DATA.p12;
  if (!d) return;
  // Likert: 발산 팔레트 (긍정→부정)
  echarts.init(document.getElementById('p12-likert')).setOption({
    title: chartTitle('교육 투자 만족도 (5점 Likert)'),
    grid: commonGrid(),
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, textStyle: BASE_TEXT },
    xAxis: valueAxis(),
    yAxis: categoryAxis(d.dist.map(x => x.label)),
    series: [{
      type: 'bar',
      data: d.dist.map((x, i) => ({ value: x.pct, itemStyle: { color: LIKERT_5[i] || C.muted, borderRadius: [0, 4, 4, 0] }})),
      barWidth: '60%',
      label: { show: true, position: 'right', formatter: '{c}%', color: C.ink2, fontSize: 12, fontFamily: BASE_TEXT.fontFamily, fontWeight: 600 },
    }]
  });
}

function initP15() {
  const d = PAGE_DATA.p15;
  if (!d) return;
  horizontalBar100('p15-strategy', d.strategy, 'AI 전사 전략 실행 여부', AI_COLOR);
  horizontalBar100('p15-ceo', d.ceo, 'CEO 관심·지원 수준', AI_COLOR);
}

function initP16() {
  const d = PAGE_DATA.p16;
  if (!d) return;
  horizontalBar100('p16-stage', d.stage, 'AI 교육 도입 단계', AI_COLOR);
  horizontalBar100('p16-budget', d.budget_27, '27년 AI 교육예산 전망', AI_COLOR);
}

window.addEventListener('DOMContentLoaded', () => {
  initP4(); initP5(); initP6(); initP9(); initP10(); initP11(); initP12(); initP15(); initP16();
});
"""


TOTAL_PAGES = 18

def _slide_header(num: str, eyebrow_text: str) -> str:
    return f"""    <header class="slide-header">
      <div class="logo"><span class="mark"></span>EXPERT · HRD</div>
      <div class="eyebrow">{num}<span class="dot"></span>{eyebrow_text}</div>
    </header>"""


def _slide_footer(page_num: str, meta_text: str = "EXPERT SURVEY · 2027 EDUCATION PLAN") -> str:
    # page_num may be "04" or "표지" — only digits → use as page no
    try:
        n = int(page_num)
        pageno_html = f'{n:02d}<em> / {TOTAL_PAGES}</em>'
    except (ValueError, TypeError):
        pageno_html = f'{page_num}'
    return f"""    <footer class="slide-footer">
      <div class="meta">{meta_text}</div>
      <div class="page-no">{pageno_html}</div>
    </footer>"""


# 페이지별 takeaway 자동 생성 룰 (간단 텍스트, 분석가 수기 수정 가능 영역)
TAKEAWAYS = {
    "p4": "응답 표본 42건 중 <strong>중기업 24건(57.1%)</strong>·대기업 11건(26.2%)·소기업 3건(7.1%)·공공기관 3건(7.1%)·학교 1건(2.4%). 21회 대비 중기업 비중 여전히 높음 — 수집 종료 후 모집단 가중치 검토.",
    "p5": "표본 매출 평균 7,809억(중앙 889억), 교육예산 평균 8.48억(중앙 1.34억). <strong>매출대비 교육비 비율 0.032%</strong> (중앙값 기준, 정제 전 안전 통계).",
    "p6": "<strong>확대 81% · 축소 19% · 동일 0%</strong>. 증가 1~5% 구간이 45%로 가장 두텁고, 51%+ 급증 응답도 5% 존재. 21회 \"유사\" 다수 분포와 추세 자체가 다름.",
    "p9": "참가 <strong>집합 50% · 이러닝 29% · 개인외부 20%</strong>. 지출은 <strong>집합 53% · 개인외부 28% · 이러닝 22%</strong> — 이러닝 참가 대비 지출 비중 낮고, 개인외부는 반대 패턴.",
    "p10": "직책별 합 ≈ 109% (직접 입력 응답의 합 일관성 결함, N=42 기준 동일 패턴 유지). <strong>비직책자 47.7% · 직책자 27.4% · 신입 23.3% · 임원 10.7%</strong> 분포.",
    "p11": "<strong>\"10% 미만\" 45.2%</strong>로 다수. \"AI 교육 실행 안 함\" 21.4% — 도입 초기 단계 신호. 50%+ 응답 0건.",
    "p12": "<strong>만족 이상 47.6% (매우만족 7.1% + 만족 40.5%) · 보통 47.6% · 불만족 4.8%</strong>. 매우불만족 0건 — 21회 대비 분포 안정.",
    "p15": "AI 전사 전략 <strong>\"검토중\" 36% · 수립중 21% · 있음 31%</strong>, CEO 관심 \"높음 이상\" <strong>64%</strong>. 검토·수립 단계가 절반 이상 — 실행기 진입 직전.",
    "p16": "AI 교육 도입 <strong>\"확대단계\" 31% + 초기 21%</strong> 합 52% (이미 실행 중). 27년 AI 예산 전망 <strong>\"확대\" 응답 74%</strong> (대폭 21% + 일부 52%) — 22회 가장 강한 시그널.",
}


def render_page_section(page: dict) -> str:
    kind = page.get("kind", "content")
    pid = page["id"]
    if kind == "cover":
        return f"""
  <section id="{pid}" class="cover slide--dark">
    <div class="ai-tag">AI × HR Transformation</div>
    <div>
      <div class="cover-eyebrow">EXC Survey Report · 결과 미리보기</div>
      <h1 class="cover-title">제22회 인재개발<br><span class="accent">실태조사</span></h1>
      <p class="cover-sub">2027년 임직원 교육, 어떻게 준비하고 계십니까?<br>데이터에 기반한 HR 트렌드 인사이트.</p>
    </div>
    <div class="meta-stack">
      <div class="item"><div class="k">Survey Period</div><div class="v">2026.05 ~ 07 (예정)</div></div>
      <div class="item"><div class="k">Responses</div><div class="v">완료 10건 / 진행 30건</div></div>
      <div class="item"><div class="k">Issued</div><div class="v">2026.05.28 Preview</div></div>
      <div class="item"><div class="k">Issuer</div><div class="v">엑스퍼트컨설팅</div></div>
    </div>
  </section>"""

    if kind == "intro":
        return f"""
  <section id="{pid}" class="intro">
{_slide_header("02", "Letter · 조사 취지")}
{_slide_footer("02")}
    <div class="slide-eyebrow"><span class="num">02</span>Introduction</div>
    <h1 class="slide-headline">HR의 미래를,<br><span class="accent">데이터로 그리다</span>.</h1>
    <div class="meta-line"></div>
    <p>엑스퍼트컨설팅이 <strong>데이터에 기반한 경영 인사이트</strong>를 제공하고자 실시한 Survey 의 결과를 바탕으로 작성되었습니다. 본 서베이에 참여해주신 모든 분들께 감사드립니다.</p>
  </section>"""

    if kind == "overview":
        return f"""
  <section id="{pid}">
{_slide_header("03", "Overview · Survey Profile")}
{_slide_footer("03")}
    <div class="slide-eyebrow"><span class="num">03</span>Survey Snapshot</div>
    <h1 class="slide-headline">2027년 교육계획 <span class="accent">컨설팅 니즈</span> 발굴,<br>최적의 컨설팅 방안을 모색하여 공유합니다.</h1>
    <div class="meta-line">조사 기간 · 방법 · 응답 현황</div>
    <div class="ov-grid">
      <div class="ov-tile is-hero">
        <div class="k">Survey Topic · 주제</div>
        <div class="topic-title">2027년 교육계획<br>구체적 컨설팅 니즈 발굴<small>최적의 컨설팅 방안을 모색하여 공유</small></div>
      </div>
      <div class="ov-tile">
        <div class="k">Period · 기간</div>
        <div class="big">~60<small>일 (예정)</small></div>
        <div class="v">2026.05.27 ~ 07<small>모바일·PC 온라인 수집</small></div>
      </div>
      <div class="ov-tile">
        <div class="k">Method · 방법</div>
        <div class="big">100<small>% Online</small></div>
        <div class="v">웹앱 응답<small>research.exc.co.kr</small></div>
      </div>
      <div class="ov-tile">
        <div class="k">Responses · 응답수</div>
        <div class="big">10<small>/ 40</small></div>
        <div class="v">완료 10 · 진행 30<small>2026-05-28 08:30 기준</small></div>
      </div>
    </div>
    <div class="caveat" style="margin-top:24px;">⚠ 본 결과 미리보기는 표본 10건 기준. 비율·평균은 수집 종료 후 재계산 필수. 본 문서의 목적은 (1) 페이지 구성 합의, (2) 자동화·포맷 결함 조기 검출.</div>
  </section>"""

    if kind == "summary":
        return f"""
  <section id="{pid}" class="summary">
{_slide_header("18", "Summary · Key Signals")}
{_slide_footer("18")}
    <div class="slide-eyebrow"><span class="num">18</span>Summary</div>
    <h1 class="slide-headline">핵심 <span class="accent">시그널</span></h1>
    <div class="meta-line">수집 종료 후 본 영역에 핵심 인사이트 5가지를 확정. 현재 10건 기반 미리보기:</div>
    <ul class="summary-list">
      <li><strong>교육예산</strong> — 24→25년 증가 응답 80% (8/10), 감소 20%. 21회와 동일한 점진 증가 추세.</li>
      <li><strong>AI 교육 비율</strong> — 30% 가 "실행 안 함" 응답. 도입 초기 단계.</li>
      <li><strong>AI 전사 전략</strong> — "검토중" 50% — 도입 검토 정점 시기.</li>
      <li><strong>27년 AI 예산 전망</strong> — 70% 가 확대 (대폭 10% + 일부 60%) — 22회 핵심 시그널.</li>
      <li><strong>교육 투자 만족도</strong> — 보통 50% + 만족 40% — 21회 대비 큰 변화 없음 (단 표본 작음).</li>
    </ul>
    <div class="contact">Tel. 02-538-2221 · help@exc.co.kr · expertconsulting.co.kr</div>
  </section>"""

    # content
    is_new = '⭐' in page['title']
    sec_cls = " class=\"new-section\"" if is_new else ""
    new_badge = ' <span class="new-badge">22회 신규</span>' if is_new else ''
    title_clean = page['title'].replace('  ⭐ 22회 신규', '').replace(' ⭐ 22회 신규', '')
    meta = f'raw: <code>{page.get("raw","—")}</code> &nbsp; · &nbsp; 시각화: {page.get("viz","—")}'
    if page.get("has_data"):
        body = render_chart_body(pid)
        takeaway = TAKEAWAYS.get(pid)
        if takeaway:
            body += f'\n    <div class="slide-takeaway"><div class="label">Takeaway · 핵심 요약</div>{takeaway}</div>'
    else:
        body = '<div class="placeholder">[ 차트 영역 — 실데이터는 수집 누적 후 자동 생성 ]<br><br>현 표본(10건)에서는 응답 수 부족으로 의미 있는 시각화 불가. placeholder 로 유지.</div>'
    return f"""
  <section id="{pid}"{sec_cls}>
{_slide_header(page['num'], "Body · " + title_clean)}
{_slide_footer(page['num'])}
    <div class="slide-eyebrow"><span class="num">{page['num']}</span>{title_clean[:24]}</div>
    <h1 class="slide-headline">{title_clean}{new_badge}</h1>
    <div class="meta-line">{meta}</div>
    {body}
  </section>"""


def render_chart_body(pid: str) -> str:
    if pid == "p4":
        return '<div class="chart-row"><div id="p4-div" class="chart-box"></div><div id="p4-cate" class="chart-box"></div></div>'
    if pid == "p5":
        return """
    <div class="p5-grid">
      <table class="metrics">
        <thead><tr><th>지표</th><th class="num">N</th><th class="num">평균</th><th class="num">중앙값</th></tr></thead>
        <tbody id="p5-tbody"></tbody>
      </table>
      <div class="p5-kpi-stack">
        <div class="kpi green"><div class="label">매출대비 교육비 비율</div><div class="value" id="p5-ratio">–</div><div class="note">중앙값 = 집행경비 / 매출총액 (정제 전 안전 통계)</div></div>
        <div class="kpi green"><div class="label">1인당 교육비 (교육대상)</div><div class="value" id="p5-peremp">–</div><div class="note">중앙값 = 집행경비 / 교육대상 직원수</div></div>
      </div>
    </div>
    <div class="caveat">일부 응답에 단위 오기로 보이는 극단값이 있어, 평균보다 이상치에 둔감한 <b>중앙값</b>을 함께 제시했습니다.</div>"""
    if pid == "p6":
        return '<div class="chart-row"><div id="p6-summary" class="chart-box"></div><div id="p6-detail" class="divergent"></div></div>'
    if pid == "p9":
        return '<div id="p9-sankey" class="slope-wrap"></div>'
    if pid == "p10":
        return ('<div id="p10-stack" class="stack-with-surplus"></div>'
                '<div class="caveat">직접 입력 응답의 합이 100%를 넘어(평균 합 109%), 절대 비율보다 <b>상대 비중</b>으로 해석해 주세요.</div>')
    if pid == "p11":
        return ('<div id="p11-heatstrip" class="heatstrip-wrap"></div>'
                '<div class="caveat">22회 신규 문항 — 전년도 비교 기준선이 없는 첫 측정치입니다.</div>')
    if pid == "p12":
        return (
            '<div class="likert-legend">'
            '<span class="it"><span class="sw" style="background:var(--ds-rose)"></span>매우불만족</span>'
            '<span class="it"><span class="sw" style="background:color-mix(in srgb, var(--ds-rose) 55%, white)"></span>불만족</span>'
            '<span class="it"><span class="sw" style="background:var(--exc-line-2)"></span>보통</span>'
            '<span class="it"><span class="sw" style="background:color-mix(in srgb, var(--ds-mint) 55%, white)"></span>만족</span>'
            '<span class="it"><span class="sw" style="background:var(--ds-mint)"></span>매우만족</span>'
            '</div>'
            '<div id="p12-likert" class="likert"></div>'
            '<div id="p12-score-grid" class="likert-score-grid"></div>'
        )
    if pid == "p15":
        return ('<div class="chart-row">'
                '<div id="p15-strategy" class="likert-mini"></div>'
                '<div id="p15-ceo" class="likert-mini"></div>'
                '</div>'
                '<div class="caveat">22회 신규 섹션 — AI 도입·활용 영역의 첫 측정.</div>')
    if pid == "p16":
        return ('<div class="chart-row">'
                '<div id="p16-stage" class="likert-mini"></div>'
                '<div id="p16-budget" class="likert-mini"></div>'
                '</div>')
    return '<div class="placeholder">(차트 미정의)</div>'


def render_nav() -> str:
    intro_pages = [p for p in PAGES if p.get("kind") in ("cover", "intro", "overview")]
    summary_pages = [p for p in PAGES if p.get("kind") == "summary"]
    body_pages = [p for p in PAGES if p.get("kind", "content") == "content"]

    def link(p):
        cls = ' class="new"' if '⭐' in p['title'] else ''
        title = p['title'].replace('  ⭐ 22회 신규', '').replace(' ⭐ 22회 신규', '')
        return f'<a href="#{p["id"]}"{cls}><span class="num">{p["num"]}</span><span>{title}</span></a>'

    lines = [
        '<nav class="side">',
        '  <div class="brand">',
        '    <div class="mark"></div>',
        '    <div><b>제22회 결과 미리보기</b><span>HRD Survey · 2027</span></div>',
        '  </div>',
        '  <div class="meta">2026-05-28 · 완료 10건<br>source: chart_data_22th.json</div>',
        '  <div class="group">',
        '    <div class="h">도입</div>',
        *['    ' + link(p) for p in intro_pages],
        '  </div>',
        '  <div class="group">',
        '    <div class="h">본문</div>',
        *['    ' + link(p) for p in body_pages],
        '  </div>',
        '  <div class="group">',
        '    <div class="h">요약</div>',
        *['    ' + link(p) for p in summary_pages],
        '  </div>',
        '  <div class="foot"><b>EXC · HRD Survey 2027</b><br>Preview v0 · 18 pages · ECharts + Pretendard · Design System Catalog v1 적용</div>',
        '</nav>',
    ]
    return "\n".join(lines)


def build_html(page_data: dict) -> str:
    sections = "\n".join(render_page_section(p) for p in PAGES)
    js = JS_TEMPLATE.replace("__PAGE_DATA__", json.dumps(page_data, ensure_ascii=False))
    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>제22회 인재개발 실태조사 — 결과 미리보기 (2026-05-28)</title>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
<style>{CSS}</style>
</head>
<body>
<div class="layout">
{render_nav()}
<main>
{sections}
</main>
</div>
<script>{js}</script>
</body>
</html>"""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--src", type=Path, default=DEFAULT_SRC)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()

    df = pd.read_excel(args.src, dtype=object)
    print(f"[load] {args.src.relative_to(ROOT)}  ({df.shape})")
    page_data = compute_page_data(df)
    print(f"[compute] {len(page_data)} 페이지 데이터 산출")

    html = build_html(page_data)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(html, encoding="utf-8")
    try:
        shown = args.out.resolve().relative_to(ROOT)
    except ValueError:
        shown = args.out
    print(f"[save] {shown}  ({args.out.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
