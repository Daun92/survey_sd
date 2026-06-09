"""[단계 6] 설문 응답 수집현황 요약 대시보드 (HTML) — 22회.

수집 과정 모니터링용(분석 리포트와 별개). raw All(완료+진행중)을 읽어 한 화면에:
  ① KPI 스트립(전체·완료·진행중·완료율·추천경유)  ② 일자별 수집 추세(완료/진행 스택)
  ③ 응답 개요(조직구분·업종·규모)                    ④ AM 추천 랭킹(유입 경로: AM추천/마케팅)
디자인 토큰(scripts/design_tokens.py) 재사용, ECharts 없이 CSS 막대(경량·일관).

사용:
    python scripts/stage6_render_dashboard.py
    # 출력: 5_report/preview/dashboard_collection_22th.html
"""
from __future__ import annotations

import argparse
import io
import re
import sys
from collections import Counter
from pathlib import Path

import pandas as pd
import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from design_tokens import TOKENS_CSS                     # noqa: E402
from stage5_render_html import map_r_div, map_r_cate     # noqa: E402
from stage2_flag_outliers import (apply_single_column_rules,    # noqa: E402
                                  apply_cross_column_rules, apply_respondent_rules)

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

DEFAULT_RAW_DIR = ROOT / "1_raw"
DEFAULT_OUT = ROOT / "5_report" / "preview" / "dashboard_collection_22th.html"
DEFAULT_VALIDATED = ROOT / "2_validated" / "raw_validated.xlsx"
DEFAULT_RULES = ROOT / "config" / "outlier_rules.yaml"
EMP_COL = "p1)R_1_2_2"
SEV_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}
SEV_LABEL = {"critical": "긴급", "high": "높음", "medium": "중간", "low": "낮음"}
SIZE_BINS = [(0, 100, "100명 미만"), (100, 300, "100–300"), (300, 500, "300–500"),
             (500, 1000, "500–1000"), (1000, None, "1000명 이상")]
_TITLE_RE = re.compile(r"\s*(대표이사|대표|이사|상무|전무|부사장|사장|본부장|실장|팀장|부장|차장|과장|대리|주임|사원|매니저|선임|책임|수석|님|씨)\s*$")


def _num(s):
    return pd.to_numeric(s, errors="coerce")


def _norm_recommender(v) -> str | None:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    s = str(v).strip()
    if not s or s.lower() == "nan":
        return None
    s = _TITLE_RE.sub("", s).strip()      # 후행 직급 제거('장채영 과장'→'장채영')
    return s or None


# ─────────────────────────────────────────────
# 데이터 집계
# ─────────────────────────────────────────────

def compute(raw: pd.DataFrame) -> dict:
    """완료(분석 가능) 중심 집계. 작성중은 참조용으로 분리 표기."""
    n_total = len(raw)
    status = raw["tesmi_status"].astype(str).str.strip()
    done_mask = status == "완료"
    done = raw[done_mask]
    prog = raw[~done_mask]
    n_done = int(done_mask.sum())
    n_prog = n_total - n_done

    # 일자별 추세 — 누적 완료(분석 가능) + 누적 전체(참조). '데이터가 쌓이고 있다' = 누적 완료 상승.
    reg = pd.to_datetime(raw.get("tesmi_regdate"), errors="coerce")
    by_day = {}
    for d, dn in zip(reg.dt.date, done_mask):
        if pd.isna(d):
            continue
        e = by_day.setdefault(str(d), {"done": 0, "prog": 0})
        e["done" if dn else "prog"] += 1
    trend, cum_done, cum_total = [], 0, 0
    for k in sorted(by_day):
        v = by_day[k]
        cum_done += v["done"]
        cum_total += v["done"] + v["prog"]
        trend.append({"date": k, "done": v["done"], "prog": v["prog"],
                      "cum_done": cum_done, "cum_total": cum_total})

    # 유입 경로 — recommend 채움 = AM 추천 / 공란 = 마케팅. 완료(분석 가능) 기준 + 진행중 참조.
    def _recs(df):
        return [r for r in (_norm_recommender(v) for v in df.get("recommend")) if r]
    rd, rp = _recs(done), _recs(prog)
    rc_done, rc_prog = Counter(rd), Counter(rp)
    n_referred = len(rd)                 # 완료 AM추천 (recommend 채움)
    n_direct = n_done - n_referred        # 완료 마케팅 (recommend 공란)
    n_referred_prog = len(rp)             # 진행중 AM추천(참조)
    recommenders = [{"name": k, "count": c, "ref": rc_prog.get(k, 0)} for k, c in rc_done.items()]
    recommenders.sort(key=lambda x: (-x["count"], -x["ref"]))

    # 응답 개요 — 완료(분석 가능) 기준 분포 + 진행중 참조(ref)
    div = _dist_list(done["R_Div"].apply(map_r_div),
                     prog["R_Div"].apply(map_r_div) if len(prog) else None,
                     order=["대기업", "중기업", "소기업", "공공기관", "학교"])
    cate = _dist_list(done.apply(lambda r: map_r_cate(r.get("R_Cate"), r.get("R_Div")), axis=1),
                      prog.apply(lambda r: map_r_cate(r.get("R_Cate"), r.get("R_Div")), axis=1) if len(prog) else None,
                      top=12, drop=["(미응답)"])
    size = _size_dist(done, prog)

    return {
        "n_total": n_total, "n_done": n_done, "n_prog": n_prog,
        "done_rate": round(100 * n_done / n_total, 1) if n_total else 0,
        "n_referred": n_referred, "n_direct": n_direct, "n_recommenders": len(rc_done),
        "n_referred_prog": n_referred_prog,
        "trend": trend, "recommenders": recommenders,
        "div": div, "cate": cate, "size": size,
        "first": str(reg.min()), "last": str(reg.max()),
    }


def _dist_list(labels: pd.Series, ref_labels: pd.Series | None = None,
               order=None, top=None, drop=()):
    """완료 분포(+진행중 ref). count=완료, pct=완료 구성비, ref=진행중."""
    vc = labels.value_counts()
    n = int(vc.sum())
    vcr = ref_labels.value_counts() if ref_labels is not None else None
    keys = order if order else list(vc.index)
    out = []
    for k in keys:
        if k in drop:
            continue
        c = int(vc.get(k, 0))
        r = int(vcr.get(k, 0)) if vcr is not None else 0
        if c == 0 and r == 0:
            continue
        out.append({"label": k, "count": c, "ref": r,
                    "pct": round(100 * c / n, 1) if n else 0})
    if not order:
        out.sort(key=lambda x: -x["count"])
    if top:
        out = out[:top]
    return out


def _size_dist(done, prog):
    emp = _num(done[EMP_COL]) if EMP_COL in done.columns else pd.Series(dtype=float)
    empP = _num(prog[EMP_COL]) if EMP_COL in prog.columns else pd.Series(dtype=float)
    n = int(emp.notna().sum())
    out = []
    for lo, hi, lab in SIZE_BINS:
        m = emp >= lo
        mp = empP >= lo
        if hi is not None:
            m &= emp < hi
            mp &= empP < hi
        c = int(m.sum())
        out.append({"label": lab, "count": c, "ref": int(mp.sum()),
                    "pct": round(100 * c / n, 1) if n else 0})
    return {"items": out, "n": n, "median": (round(float(emp.median()), 0) if n else None)}


# ─────────────────────────────────────────────
# 이상치 (stage2 검출 재실행 — stale 의존 없이 최신 검증 데이터로)
# ─────────────────────────────────────────────

def _rule_labels(rules: dict) -> dict:
    """rule_id → 한글 라벨 (yaml label, 없으면 id/flag 그대로)."""
    m = {}
    for r in rules.get("single_column_rules", []):
        rid = r.get("flag", "?")
        m[rid] = r.get("label", rid)
    for grp in ("cross_column_rules", "respondent_rules"):
        for r in rules.get(grp, []):
            m[r.get("id", "?")] = r.get("label", r.get("id", "?"))
    return m


def _fmt_val(v) -> str:
    try:
        v = float(v)
    except (TypeError, ValueError):
        return str(v)
    if v != v:
        return "—"
    a = abs(v)
    if a >= 1000:
        return f"{v:,.0f}"
    if a == int(a):
        return f"{int(v)}"
    return f"{v:,.4f}".rstrip("0").rstrip(".")


# rule_id → 분석 영향 한 줄 (분석 관점: 어떤 지표가 왜 영향받는가 + 조치)
_OC_IMPACT = {
    "budget_exceeds_revenue": "교육비가 매출 초과 — 매출/예산 단위 오류로 매출대비·비율 지표 분석 불가",
    "ratio_budget_vs_revenue": "매출대비 교육비 비율 비정상 — 매출·예산 단위 확인 필요",
    "매출_단위의심_과소": "매출 과소 입력(단위 의심) — 매출 기반 지표 정정 후 분석",
    "매출_단위의심_과대": "매출 과대 입력(단위 의심) — 매출 기반 지표 정정 후 분석",
    "매출_무응답": "매출 미입력 — 매출대비 교육비 등 매출 기반 지표는 분석 제외",
    "peremp_per_target": "교육대상 인원 과소 입력 — 1인당 교육비 과대(분모 확인 필요)",
    "교육예산_단위의심_과소": "교육예산 과소 입력(단위 의심) — 예산 기반 지표 정정 후 분석",
    "교육예산_단위의심_과대": "교육예산 과대 입력(단위 의심) — 예산 기반 지표 정정 후 분석",
    "교육예산_무응답": "교육예산 미입력 — 예산 기반 지표는 분석 제외",
    "many_zeros": "거시지표 다수 미입력 — 거시 분석에서 제외 권장",
    "emp_revenue_mismatch": "인원 대비 매출 불균형 — 규모 분류·단위 확인",
    "인원수_비정상": "인원수 비정상 — 규모 분류 확인",
}


def _outlier_comment(flags: list[dict]) -> str:
    """응답자 이상치 → 분석 영향 1줄 (최고 심각도 항목 중심 + 잔여 건수)."""
    if not flags:
        return ""
    top = flags[0]                                   # severity 순 정렬됨
    base = _OC_IMPACT.get(top.get("rule_id"), top.get("rule", "검수 필요"))
    extra = len(flags) - 1
    return base + (f" · 외 {extra}개 항목 검수" if extra > 0 else "")


def compute_outliers(validated_path: Path = DEFAULT_VALIDATED,
                     rules_path: Path = DEFAULT_RULES) -> dict | None:
    """완료 응답 검증본에 outlier_rules 적용 → 구조화 요약. 파일 없으면 None."""
    if not validated_path.exists() or not rules_path.exists():
        return None
    df = pd.read_excel(validated_path, sheet_name=0, dtype=object)
    rules = yaml.safe_load(rules_path.read_text(encoding="utf-8"))
    labels = _rule_labels(rules)
    flags = (apply_single_column_rules(df, rules.get("single_column_rules", []))
             + apply_cross_column_rules(df, rules.get("cross_column_rules", []))
             + apply_respondent_rules(df, rules.get("respondent_rules", [])))

    # severity / rule 집계
    by_sev_c = Counter(f.get("severity", "medium") for f in flags)
    by_sev = [{"label": s, "ko": SEV_LABEL.get(s, s), "count": by_sev_c.get(s, 0)}
              for s in sorted(by_sev_c, key=lambda s: SEV_ORDER.get(s, 9))]
    by_rule_c = Counter(f.get("rule_id", "?") for f in flags)
    by_rule = [{"label": labels.get(rid, rid), "count": c}
               for rid, c in by_rule_c.most_common()]

    # 응답자별 그룹 (회사 단위, severity 순 → 건수 순)
    groups: dict = {}
    for f in flags:
        key = f.get("row_idx")
        g = groups.setdefault(key, {"company": f.get("R_Company_Name") or "(회사명 미상)",
                                    "div": map_r_div(f.get("R_Div")), "flags": []})
        g["flags"].append({
            "rule_id": f.get("rule_id"),
            "rule": labels.get(f.get("rule_id"), f.get("rule_id")),
            "severity": f.get("severity", "medium"),
            "value": _fmt_val(f.get("value")),
            "note": f.get("note", ""),
        })
    companies = []
    for g in groups.values():
        g["flags"].sort(key=lambda x: SEV_ORDER.get(x["severity"], 9))
        g["max_sev"] = min((x["severity"] for x in g["flags"]),
                           key=lambda s: SEV_ORDER.get(s, 9))
        g["comment"] = _outlier_comment(g["flags"])         # 분석 영향 1줄 요약
        companies.append(g)
    companies.sort(key=lambda g: (SEV_ORDER.get(g["max_sev"], 9), -len(g["flags"])))

    n_complete = int(len(df))
    n_affected = len(groups)
    n_crit_resp = sum(1 for g in companies if g["max_sev"] == "critical")
    return {"n_complete": n_complete, "n_flags": len(flags),
            "n_affected": n_affected, "n_clean": n_complete - n_affected,
            "n_crit_resp": n_crit_resp,
            "by_sev": by_sev, "by_rule": by_rule, "companies": companies,
            "n_critical": by_sev_c.get("critical", 0), "n_high": by_sev_c.get("high", 0)}


# ─────────────────────────────────────────────
# 렌더
# ─────────────────────────────────────────────

def _bars(items, cls="neu", max_scale=None, ref=False):
    """가로 막대. ref=True 면 진행중(x['ref'])을 옅은 세그먼트+'+N'으로 별도 표기(완료 막대 뒤)."""
    if not items:
        return '<div class="rb-empty">응답 없음</div>'
    if ref:
        mx = max_scale or (max((x["count"] + x.get("ref", 0) for x in items), default=1) or 1)
    else:
        mx = max_scale or (max((x["count"] for x in items), default=1) or 1)
    rows = []
    for x in items:
        seg_ref = (f'<span class="rb-fill prog" style="width:{round(x.get("ref", 0) / mx * 100)}%"></span>'
                   if ref and x.get("ref", 0) else "")
        val_ref = (f'<small class="prog">+{x["ref"]}</small>'
                   if ref and x.get("ref", 0) else "")
        rows.append(
            f'<div class="rb-row"><span class="rb-lab">{x["label"]}</span>'
            f'<span class="rb-track"><span class="rb-fill {cls}" style="width:{round(x["count"] / mx * 100)}%"></span>{seg_ref}</span>'
            f'<span class="rb-val">{x["count"]}<small>{x.get("pct", "")}%</small>{val_ref}</span></div>')
    return f'<div class="d-bars">{"".join(rows)}</div>'


def _trend(trend):
    """당일 수집 추세 — 막대=당일 수집(녹색=당일 완료, 옅은 부분=당일 진행중 참조), 막대 아래 수치=당일 완료.
    누적 합계는 차트 상단(_trend_top)에 별도 표기."""
    if not trend:
        return '<div class="rb-empty">데이터 없음</div>'
    mx = max((d["done"] + d["prog"] for d in trend), default=1) or 1
    H = 130
    # 절대 높이(px) — 진행중(참조) 토글로 숨겨도 당일 완료 막대 높이 그대로 유지
    cols = "".join(
        f'<div class="tr-col"><div class="tr-stack">'
        f'<span class="tr-done" style="height:{round(d["done"] / mx * H)}px" title="당일 완료 {d["done"]}"></span>'
        f'<span class="tr-prog" style="height:{round(d["prog"] / mx * H)}px" title="당일 작성중(미완료) {d["prog"]}"></span>'
        f'</div><div class="tr-n">{d["done"]}</div>'
        f'<div class="tr-d">{d["date"][5:]}</div></div>'
        for d in trend
    )
    return (f'<div class="trend">{cols}</div>'
            '<div class="tr-legend"><span><i class="done"></i>당일 완료</span>'
            '<span class="leg-prog"><i class="prog"></i>당일 작성중 (미완료)</span>'
            '<em>막대 = 당일 수집 · 막대 아래 수치 = 당일 완료</em></div>')


def _trend_top(n_done, n_prog, n_total) -> str:
    """차트 상단 — 누적 합계 별도 표기."""
    return ('<div class="trend-top">'
            '<span class="tt-cap">누적 합계</span>'
            f'<span class="tt-main">완료 <b>{n_done}</b>건</span>'
            f'<span class="tt-ref dl-prog">· 작성중 {n_prog} · 전체 {n_total}</span>'
            '</div>')


def _sev_bars(by_sev, total):
    if not by_sev:
        return '<div class="rb-empty">이상치 없음</div>'
    mx = max((s["count"] for s in by_sev), default=1) or 1
    rows = "".join(
        f'<div class="rb-row"><span class="rb-lab">{s["ko"]}<small>{s["label"]}</small></span>'
        f'<span class="rb-track"><span class="rb-fill sev-{s["label"]}" style="width:{round(s["count"] / mx * 100)}%"></span></span>'
        f'<span class="rb-val">{s["count"]}</span></div>'
        for s in by_sev)
    return f'<div class="d-bars">{rows}</div>'


def _rule_bars(by_rule):
    if not by_rule:
        return '<div class="rb-empty">이상치 없음</div>'
    mx = max((r["count"] for r in by_rule), default=1) or 1
    rows = "".join(
        f'<div class="rb-row"><span class="rb-lab" title="{r["label"]}">{r["label"]}</span>'
        f'<span class="rb-track"><span class="rb-fill oc-rule" style="width:{round(r["count"] / mx * 100)}%"></span></span>'
        f'<span class="rb-val">{r["count"]}</span></div>'
        for r in by_rule)
    return f'<div class="d-bars oc-rulebars">{rows}</div>'


def _outlier_companies(companies):
    if not companies:
        return '<div class="rb-empty">플래그된 응답자 없음 ✓</div>'
    cards = []
    for g in companies:
        items = "".join(
            f'<li class="oc-flag sev-{f["severity"]}">'
            f'<span class="oc-fl-dot"></span>'
            f'<span class="oc-fl-rule">{f["rule"]}</span>'
            f'<span class="oc-fl-note">{f["note"]}</span>'
            f'<span class="oc-fl-val">{f["value"]}</span></li>'
            for f in g["flags"])
        cards.append(
            f'<div class="oc-co sev-{g["max_sev"]}-edge">'
            f'<div class="oc-co-h"><span class="oc-co-name">{g["company"]}</span>'
            f'<span class="oc-co-div">{g["div"]}</span>'
            f'<span class="oc-sev-badge sev-{g["max_sev"]}">{SEV_LABEL.get(g["max_sev"], g["max_sev"])}</span>'
            f'<span class="oc-co-n">{len(g["flags"])}건</span></div>'
            f'<div class="oc-co-cmt sev-{g["max_sev"]}">▶ {g.get("comment", "")}</div>'
            f'<ul class="oc-flags">{items}</ul></div>')
    return f'<div class="oc-list">{"".join(cards)}</div>'


def _outlier_section(oc) -> str:
    if oc is None:
        return ""
    nC, nA = oc["n_complete"], oc["n_affected"]
    fit_pct = round(100 * oc["n_clean"] / nC) if nC else 0
    chk_pct = round(100 * nA / nC) if nC else 0
    if oc["n_flags"] == 0:
        body = ('<div class="oc-clean">✓ 분석 대상(완료) '
                f'{nC}건 전부 분석 적합 — 거시지표 입력 이상 없음</div>')
    else:
        tiles = [("분석 대상 (완료)", nC, "건", "all"),
                 ("분석 적합", oc["n_clean"], f'명 · {fit_pct}%', "ok"),
                 ("검수 필요", nA, f'명 · {chk_pct}%', "aff"),
                 ("긴급 정정", oc["n_crit_resp"], "명", "crit")]
        tiles_html = "".join(
            f'<div class="oc-kpi oc-k-{cls}"><div class="ok-lab">{lab}</div>'
            f'<div class="ok-v">{val}<span class="ok-u">{unit}</span></div></div>'
            for lab, val, unit, cls in tiles)
        body = (
            f'<div class="oc-kpis">{tiles_html}</div>'
            '<div class="grid2 oc-dist">'
            f'<section class="subcard"><h3>심각도 분포 <small>분석 영향 정도</small></h3>{_sev_bars(oc["by_sev"], oc["n_flags"])}</section>'
            f'<section class="subcard"><h3>규칙별 빈도</h3>{_rule_bars(oc["by_rule"])}</section>'
            '</div>'
            '<h3 class="oc-list-h">검수 필요 응답자 <small>긴급순 · 분석 영향 1줄 요약 + 상세 (내부 검수용)</small></h3>'
            f'{_outlier_companies(oc["companies"])}')
    return f'<section class="card oc">{body}</section>'


def _block(num: int, title: str, intent: str, body: str) -> str:
    """내러티브 블록 — 번호 + 제목 + 한 줄 의도 + 본문(관련 정보 묶음)."""
    return (f'<section class="block">'
            f'<div class="sec-head"><span class="sec-num">{num}</span>'
            f'<div class="sec-tt"><h2 class="sec-title">{title}</h2>'
            f'<p class="sec-intent">{intent}</p></div></div>'
            f'<div class="sec-body">{body}</div></section>')


def build_dashboard(raw: pd.DataFrame, updated: str, outliers: dict | None = None) -> str:
    d = compute(raw)
    kpis = [
        ("분석 가능 (완료)", d["n_done"], "건", "done"),
        ("작성중 (미완료)", d["n_prog"], "건", "prog"),
        ("전체 응답", d["n_total"], "건", "all"),
        ("완료율", d["done_rate"], "%", "rate"),
        ("AM 추천", d["n_referred"], f'/ 마케팅 {d["n_direct"]}', "ref"),
    ]
    kpi_html = "".join(
        f'<div class="kpi k-{cls}"><div class="k-lab">{lab}</div>'
        f'<div class="k-v">{val}<span class="k-u">{unit}</span></div></div>'
        for lab, val, unit, cls in kpis
    )
    rec_items = [{"label": r["name"], "count": r["count"], "ref": r.get("ref", 0),
                  "pct": round(100 * r["count"] / d["n_done"], 1) if d["n_done"] else 0}
                 for r in d["recommenders"][:12]]
    rec_bars = _bars(rec_items, cls="ref", ref=True)
    size_note = f' · 중앙값 {int(d["size"]["median"])}명' if d["size"]["median"] else ""

    # ① 수집 추세 (당일 수집 건수 + 누적 합계 상단 별도 표기)
    block1 = _block(
        1, "수집 추세", "날짜별 당일 수집 건수 — 누적 합계는 차트 상단에 별도 표기",
        f'<div class="card">{_trend_top(d["n_done"], d["n_prog"], d["n_total"])}{_trend(d["trend"])}</div>')

    # ② 응답 구성 (완료 기준 분포 + 진행중 참조)
    dist_cards = (
        '<div class="dist-legend">막대 = <b>완료(분석 가능)</b> · '
        '<span class="dl-prog">옅은 칸 / +N = 작성중(미완료)</span></div>'
        '<div class="grid3">'
        f'<section class="card"><h3 class="card-h">조직 구분</h3>{_bars(d["div"], "div", ref=True)}</section>'
        f'<section class="card"><h3 class="card-h">업종 <small>상위 12</small></h3>{_bars(d["cate"], "cate", ref=True)}</section>'
        f'<section class="card"><h3 class="card-h">인력 규모 <small>완료 {d["size"]["n"]}{size_note}</small></h3>{_bars(d["size"]["items"], "size", ref=True)}</section>'
        '</div>')
    block2 = _block(2, "응답 구성", "완료 응답의 조직·업종·규모 — 분석 표본 프로필", dist_cards)

    # ③ 유입 경로 (AM 추천 vs 마케팅 — 완료 기준 + 진행중 참조)
    block3 = _block(
        3, "유입 경로",
        f'완료 기준 — AM 추천 {d["n_referred"]}건 · 마케팅 {d["n_direct"]}건 · 추천 AM {d["n_recommenders"]}명'
        f' <span class="dl-prog">(작성중 AM추천 +{d["n_referred_prog"]} 참조)</span>',
        '<div class="card">'
        '<div class="dist-legend">막대 = <b>AM별 추천 완료 건수</b> · '
        '<span class="dl-prog">옅은 칸 / +N = 작성중(미완료)</span></div>'
        f'{rec_bars}</div>')

    # ④ 분석 적합성 (이상치 — 완료 데이터 품질)
    block4 = ""
    if outliers is not None:
        if outliers["n_flags"] == 0:
            oc_intent = f'완료 {outliers["n_complete"]}건 전부 분석 적합 — 입력 이상 없음'
        else:
            oc_intent = (f'완료 {outliers["n_complete"]}건 중 분석 적합 {outliers["n_clean"]} · '
                         f'검수 필요 {outliers["n_affected"]} · 긴급 정정 {outliers["n_crit_resp"]}')
        block4 = _block(4, "분석 적합성", oc_intent, _outlier_section(outliers))

    return f"""<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>설문 응답 수집현황 — 제22회 인재개발 실태조사</title>
<style>{TOKENS_CSS}</style>
<style>{DASH_CSS}</style>
</head><body class="hide-prog">
<div class="wrap">
  <header class="d-head">
    <div class="d-head-tt">
      <div class="eyebrow">HRD Survey · 제22회 인재개발 실태조사 · 모니터링</div>
      <h1>설문 응답 수집현황</h1>
      <p class="sub"><b>분석 가능(완료) 중심</b> · 작성중은 참조 · 수집 {d["first"][:10]} ~ 진행중</p>
    </div>
    <div class="upd">데이터 기준<br><b>{updated}</b></div>
  </header>

  <section class="kpis">{kpi_html}</section>

  <div class="ctrl-bar">
    <label class="tgl"><input type="checkbox" id="tgl-prog">
      <span>작성중 <span class="tgl-ref">(미완료)</span> 함께 보기</span></label>
    <span class="ctrl-note">기본은 <b>완료(분석 가능)만</b> 표시 — 체크하면 추세·분포·유입에 작성중(미완료)을 추가합니다. (KPI 카운트는 항상 유지)</span>
  </div>

  {block1}
  {block2}
  {block3}
  {block4}

  <footer class="d-foot">EXC · HRD Survey 2027 · 수집현황 대시보드 · 완료(분석 가능) 중심 · 작성중은 참조 · 이상치는 완료 검증본 기준</footer>
</div>
<script>
(function() {{
  var t = document.getElementById('tgl-prog');
  if (!t) return;
  function apply() {{ document.body.classList.toggle('hide-prog', !t.checked); }}
  t.addEventListener('change', apply);
  apply();
}})();
</script>
</body></html>"""


DASH_CSS = """
html, body { background: var(--exc-panel); }
* { box-sizing: border-box; }
body { margin: 0; font-family: var(--font-sans); color: var(--exc-ink); }
.wrap { max-width: 1180px; margin: 0 auto; padding: var(--space-8) var(--space-6) var(--space-12); }
.d-head { display: flex; justify-content: space-between; align-items: flex-end; gap: var(--space-4); margin-bottom: var(--space-6); }
.d-head h1 { font-size: var(--fs-h1); font-weight: var(--fw-xbold); margin: 0; letter-spacing: var(--ls-tight); }
.d-head .sub { font-size: var(--fs-body-sm); color: var(--exc-muted); margin: var(--space-2) 0 0; }
.d-head .upd { font-size: var(--fs-caption); color: var(--exc-muted); text-align: right; line-height: 1.5; }
.d-head .upd b { color: var(--exc-ink-2); font-size: var(--fs-body-sm); }
.d-head .eyebrow { font-size: var(--fs-micro); font-weight: var(--fw-bold); letter-spacing: .08em;
  text-transform: uppercase; color: var(--ai-dusk); margin-bottom: var(--space-2); }

/* 내러티브 블록 (번호 + 제목 + 한 줄 의도로 흐름 제공) */
.block { margin-bottom: var(--space-8); }
.block:last-of-type { margin-bottom: var(--space-4); }
.sec-head { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4);
  padding-bottom: var(--space-3); border-bottom: 1px solid var(--exc-line); }
.sec-num { flex: none; width: 27px; height: 27px; border-radius: 50%; background: var(--ai-dusk);
  color: var(--exc-bg); font-size: var(--fs-body-sm); font-weight: var(--fw-xbold);
  display: flex; align-items: center; justify-content: center; }
.sec-tt { display: flex; align-items: baseline; gap: var(--space-3); flex-wrap: wrap; }
.sec-title { font-size: var(--fs-h3); font-weight: var(--fw-xbold); margin: 0; letter-spacing: var(--ls-tight); }
.sec-intent { font-size: var(--fs-body-sm); color: var(--exc-muted); margin: 0; }
.card-h { font-size: var(--fs-body); font-weight: var(--fw-bold); margin: 0 0 var(--space-3);
  display: flex; align-items: baseline; gap: var(--space-2); }
.card-h small { font-size: var(--fs-caption); color: var(--exc-muted-2); font-weight: var(--fw-regular); }

/* KPI 스트립 */
.kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--space-3); margin-bottom: var(--space-5); }
.kpi { background: var(--exc-bg); border: 1px solid var(--exc-line); border-radius: var(--radius-lg);
  padding: var(--space-5) var(--space-5); box-shadow: var(--shadow-sm); }
.kpi .k-lab { font-size: var(--fs-caption); color: var(--exc-muted); margin-bottom: var(--space-2); font-weight: var(--fw-semi); }
.kpi .k-v { font-size: var(--fs-h1); font-weight: var(--fw-xbold); font-variant-numeric: tabular-nums; line-height: 1; }
.kpi .k-v .k-u { font-size: var(--fs-body-sm); font-weight: var(--fw-semi); color: var(--exc-muted); margin-left: 4px; }
.kpi.k-all  { border-top: 3px solid var(--exc-ink-2); }
.kpi.k-done { border-top: 3px solid var(--exc-green); }
.kpi.k-done .k-v { color: var(--exc-green-700); }
.kpi.k-prog { border-top: 3px solid var(--exc-amber); }
.kpi.k-prog .k-v { color: color-mix(in srgb, var(--exc-amber) 55%, var(--exc-ink)); }
.kpi.k-rate { border-top: 3px solid var(--ai-violet); }
.kpi.k-rate .k-v { color: var(--ai-violet); }
.kpi.k-ref  { border-top: 3px solid var(--exc-info); }

/* 카드 공통 */
.grid2 { display: grid; grid-template-columns: 1fr; gap: var(--space-4); margin-bottom: var(--space-4); }
.dist-legend { font-size: var(--fs-caption); color: var(--exc-muted); margin: 0 0 var(--space-3); }
.dist-legend b { color: var(--exc-ink-2); }
.dist-legend .dl-prog { color: color-mix(in srgb, var(--exc-amber) 60%, var(--exc-ink)); }

/* 진행중(참조) 토글 */
.ctrl-bar { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;
  margin-bottom: var(--space-4); padding: var(--space-3) var(--space-4); background: var(--exc-bg);
  border: 1px solid var(--exc-line); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); }
.tgl { display: inline-flex; align-items: center; gap: 7px; font-size: var(--fs-body-sm);
  font-weight: var(--fw-bold); color: var(--exc-ink); cursor: pointer; user-select: none; }
.tgl input { width: 16px; height: 16px; cursor: pointer; accent-color: var(--exc-amber); }
.tgl .tgl-ref { color: color-mix(in srgb, var(--exc-amber) 60%, var(--exc-ink)); font-weight: var(--fw-semi); }
.ctrl-note { font-size: var(--fs-caption); color: var(--exc-muted-2); }
.ctrl-note b { color: var(--exc-green-700); }
/* 토글 OFF → 진행중(참조) 시각요소 숨김 (완료=분석 가능만) */
body.hide-prog .tr-prog,
body.hide-prog .rb-fill.prog,
body.hide-prog .rb-val small.prog,
body.hide-prog .tr-legend .leg-prog,
body.hide-prog .dl-prog { display: none; }
.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); margin-bottom: var(--space-4); }
.card { background: var(--exc-bg); border: 1px solid var(--exc-line); border-radius: var(--radius-lg);
  padding: var(--space-5) var(--space-6); box-shadow: var(--shadow-sm); }
.card h2 { font-size: var(--fs-h4); font-weight: var(--fw-bold); margin: 0 0 var(--space-4); display: flex;
  align-items: baseline; gap: var(--space-3); }
.card h2 small { font-size: var(--fs-caption); color: var(--exc-muted-2); font-weight: var(--fw-regular); }

/* 가로 막대 */
.d-bars { display: flex; flex-direction: column; gap: var(--space-2); }
.rb-row { display: grid; grid-template-columns: 96px 1fr 56px; align-items: center; gap: var(--space-3); font-size: var(--fs-body-sm); }
.rb-lab { color: var(--exc-ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rb-track { height: 14px; background: var(--exc-panel-2); border-radius: var(--radius-pill); overflow: hidden; display: flex; }
.rb-fill { display: block; height: 100%; flex: none; }
.rb-fill.neu  { background: var(--ai-dusk); }
.rb-fill.div  { background: var(--exc-green); }
.rb-fill.cate { background: var(--exc-green-600); }
.rb-fill.size { background: var(--ai-violet); }
.rb-fill.ref  { background: var(--exc-info); }
.rb-fill.prog { background: color-mix(in srgb, var(--exc-amber) 32%, white); }   /* 진행중(참조) */
.rb-val { text-align: right; font-weight: var(--fw-bold); font-variant-numeric: tabular-nums; }
.rb-val small { color: var(--exc-muted-2); font-weight: var(--fw-regular); font-size: var(--fs-micro); margin-left: 3px; }
.rb-val small.prog { color: color-mix(in srgb, var(--exc-amber) 60%, var(--exc-ink)); }
.rb-empty { font-size: var(--fs-body-sm); color: var(--exc-muted-2); padding: var(--space-2) 0; }

/* 수집 추세 — 상단 누적 합계 별도 표기 */
.trend-top { display: flex; align-items: baseline; gap: var(--space-3); flex-wrap: wrap;
  margin-bottom: var(--space-3); padding-bottom: var(--space-3); border-bottom: 1px dashed var(--exc-line); }
.trend-top .tt-cap { font-size: var(--fs-caption); color: var(--exc-muted); text-transform: uppercase;
  letter-spacing: .06em; font-weight: var(--fw-semi); }
.trend-top .tt-main { font-size: var(--fs-h3); font-weight: var(--fw-bold); color: var(--exc-green-700); }
.trend-top .tt-main b { font-size: var(--fs-h1); font-weight: var(--fw-xbold); font-variant-numeric: tabular-nums; }
.trend-top .tt-ref { font-size: var(--fs-body-sm); color: var(--exc-muted); font-variant-numeric: tabular-nums; }

/* 수집 추세 (세로 스택) */
.trend { display: flex; gap: var(--space-3); align-items: flex-end; padding: var(--space-3) 0 0;
  overflow-x: auto; min-height: 170px; }
.tr-col { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 44px; flex: 1; }
.tr-stack { width: 100%; max-width: 56px; display: flex; flex-direction: column-reverse;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0; overflow: hidden; min-height: 4px; }
.tr-done, .tr-prog { display: block; width: 100%; flex: none; }
.tr-done { background: var(--exc-green); }
.tr-prog { background: color-mix(in srgb, var(--exc-amber) 32%, white); }
.tr-n { font-size: var(--fs-body-sm); font-weight: var(--fw-bold); font-variant-numeric: tabular-nums; color: var(--exc-green-700); }
.tr-d { font-size: var(--fs-micro); color: var(--exc-muted-2); }
.tr-legend { display: flex; gap: var(--space-4); margin-top: var(--space-3); font-size: var(--fs-caption); color: var(--exc-muted); align-items: center; }
.tr-legend i { display: inline-block; width: 11px; height: 11px; border-radius: 3px; margin-right: 4px; vertical-align: -1px; }
.tr-legend i.done { background: var(--exc-green); }
.tr-legend i.prog { background: color-mix(in srgb, var(--exc-amber) 32%, white); }
.tr-legend em { color: var(--exc-muted-2); font-style: normal; margin-left: auto; }

.d-foot { font-size: var(--fs-micro); color: var(--exc-muted-2); margin-top: var(--space-6); text-align: center; }
@media (max-width: 900px) { .kpis { grid-template-columns: repeat(2, 1fr); } .grid3 { grid-template-columns: 1fr; } }

/* ── 이상치 섹션 ── */
.oc { margin-top: var(--space-4); border-top: 3px solid var(--exc-amber); }
.oc-clean { font-size: var(--fs-body); color: var(--exc-green-700); font-weight: var(--fw-semi);
  background: color-mix(in srgb, var(--exc-green) 7%, white); border: 1px solid color-mix(in srgb, var(--exc-green) 25%, white);
  border-radius: var(--radius-md); padding: var(--space-4) var(--space-5); }
.oc-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-3); margin-bottom: var(--space-4); }
.oc-kpi { background: var(--exc-panel); border: 1px solid var(--exc-line); border-radius: var(--radius-md);
  padding: var(--space-4); }
.oc-kpi .ok-lab { font-size: var(--fs-caption); color: var(--exc-muted); margin-bottom: var(--space-1); font-weight: var(--fw-semi); }
.oc-kpi .ok-v { font-size: var(--fs-h2); font-weight: var(--fw-xbold); font-variant-numeric: tabular-nums; line-height: 1; }
.oc-kpi .ok-v .ok-u { font-size: var(--fs-caption); font-weight: var(--fw-semi); color: var(--exc-muted); margin-left: 3px; }
.oc-k-crit { border-left: 3px solid var(--exc-red); } .oc-k-crit .ok-v { color: var(--exc-red); }
.oc-k-high { border-left: 3px solid var(--exc-amber); } .oc-k-high .ok-v { color: color-mix(in srgb, var(--exc-amber) 55%, var(--exc-ink)); }
.oc-k-all { border-left: 3px solid var(--exc-ink-2); }
.oc-k-ok { border-left: 3px solid var(--exc-green); } .oc-k-ok .ok-v { color: var(--exc-green-700); }
.oc-k-aff { border-left: 3px solid var(--ai-dusk); } .oc-k-aff .ok-v { color: var(--ai-dusk); }
.oc-dist { margin-bottom: var(--space-4); }
.subcard { background: var(--exc-panel); border: 1px solid var(--exc-line); border-radius: var(--radius-md); padding: var(--space-4) var(--space-5); }
.subcard h3 { font-size: var(--fs-body-sm); font-weight: var(--fw-bold); margin: 0 0 var(--space-3); color: var(--exc-ink-2); }
.rb-lab small { color: var(--exc-muted-2); font-weight: var(--fw-regular); font-size: var(--fs-micro); margin-left: 4px; text-transform: uppercase; }
.oc-rulebars .rb-row { grid-template-columns: 180px 1fr 36px; }
.rb-fill.sev-critical { background: var(--exc-red); }
.rb-fill.sev-high { background: var(--exc-amber); }
.rb-fill.sev-medium { background: var(--ai-dusk); }
.rb-fill.sev-low { background: var(--exc-muted-2); }
.rb-fill.oc-rule { background: var(--ai-violet); }
.oc-list-h { font-size: var(--fs-body-sm); font-weight: var(--fw-bold); margin: var(--space-2) 0 var(--space-3); display: flex; align-items: baseline; gap: var(--space-3); }
.oc-list-h small { font-size: var(--fs-caption); color: var(--exc-muted-2); font-weight: var(--fw-regular); }
.oc-list { display: flex; flex-direction: column; gap: var(--space-3); }
.oc-co { border: 1px solid var(--exc-line); border-radius: var(--radius-md); padding: var(--space-3) var(--space-4); background: var(--exc-bg); }
.oc-co.sev-critical-edge { border-left: 4px solid var(--exc-red); }
.oc-co.sev-high-edge { border-left: 4px solid var(--exc-amber); }
.oc-co.sev-medium-edge { border-left: 4px solid var(--ai-dusk); }
.oc-co-h { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-2); flex-wrap: wrap; }
.oc-co-name { font-size: var(--fs-body); font-weight: var(--fw-bold); color: var(--exc-ink); }
.oc-co-div { font-size: var(--fs-caption); color: var(--exc-muted); background: var(--exc-panel-2); border-radius: var(--radius-pill); padding: 1px 9px; }
.oc-co-n { font-size: var(--fs-caption); color: var(--exc-muted-2); margin-left: auto; font-variant-numeric: tabular-nums; }
.oc-co-cmt { font-size: var(--fs-body-sm); font-weight: var(--fw-semi); line-height: 1.5; margin: 0 0 var(--space-2);
  padding: var(--space-2) var(--space-3); background: var(--exc-panel); border-radius: var(--radius-sm); }
.oc-co-cmt.sev-critical { color: var(--exc-red); background: color-mix(in srgb, var(--exc-red) 6%, white); }
.oc-co-cmt.sev-high { color: color-mix(in srgb, var(--exc-amber) 60%, var(--exc-ink)); background: color-mix(in srgb, var(--exc-amber) 9%, white); }
.oc-co-cmt.sev-medium { color: var(--exc-ink-2); }
.oc-sev-badge { font-size: var(--fs-micro); font-weight: var(--fw-bold); padding: 2px 9px; border-radius: var(--radius-pill); }
.oc-sev-badge.sev-critical { background: color-mix(in srgb, var(--exc-red) 14%, white); color: var(--exc-red); }
.oc-sev-badge.sev-high { background: color-mix(in srgb, var(--exc-amber) 22%, white); color: color-mix(in srgb, var(--exc-amber) 55%, var(--exc-ink)); }
.oc-sev-badge.sev-medium { background: color-mix(in srgb, var(--ai-dusk) 12%, white); color: var(--ai-dusk); }
.oc-flags { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.oc-flag { display: grid; grid-template-columns: 14px 200px 1fr auto; align-items: baseline; gap: var(--space-3); font-size: var(--fs-body-sm); }
.oc-fl-dot { width: 8px; height: 8px; border-radius: 50%; align-self: center; }
.oc-flag.sev-critical .oc-fl-dot { background: var(--exc-red); }
.oc-flag.sev-high .oc-fl-dot { background: var(--exc-amber); }
.oc-flag.sev-medium .oc-fl-dot { background: var(--ai-dusk); }
.oc-flag.sev-low .oc-fl-dot { background: var(--exc-muted-2); }
.oc-fl-rule { font-weight: var(--fw-semi); color: var(--exc-ink-2); }
.oc-fl-note { font-size: var(--fs-caption); color: var(--exc-muted); }
.oc-fl-val { font-variant-numeric: tabular-nums; font-weight: var(--fw-bold); color: var(--exc-ink); white-space: nowrap; }
@media (max-width: 900px) { .oc-kpis { grid-template-columns: repeat(2, 1fr); } .oc-dist { grid-template-columns: 1fr; }
  .oc-flag { grid-template-columns: 12px 1fr auto; } .oc-fl-note { display: none; } }
"""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--raw-dir", type=Path, default=DEFAULT_RAW_DIR)
    ap.add_argument("--src", type=Path, default=None, help="raw All xlsx 직접 지정")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()

    src = args.src or max(args.raw_dir.glob("*.xlsx"), key=lambda p: p.stat().st_mtime)
    raw = pd.read_excel(src, dtype=object)
    updated = pd.to_datetime(raw.get("tesmi_regdate"), errors="coerce").max()
    updated_str = updated.strftime("%Y-%m-%d %H:%M") if pd.notna(updated) else src.stem
    print(f"입력 {src.name} ({raw.shape}) · 최신 응답 {updated_str}")

    outliers = compute_outliers()
    if outliers:
        print(f"이상치: {outliers['n_flags']}건 · 영향 {outliers['n_affected']}명 "
              f"(critical {outliers['n_critical']} / high {outliers['n_high']})")

    html = build_dashboard(raw, updated_str, outliers)
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
