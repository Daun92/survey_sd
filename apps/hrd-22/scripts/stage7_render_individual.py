"""[단계 7-개별] 개별 응답자 벤치마크 리포트 (HTML) — 22회.

2025(21회) 전체리포트 흐름·시각 언어 채택:
  Ⅰ 교육 관련 지표 · Ⅱ HRD 현황 · Ⅲ AI 도입과 활용 · Ⅳ HRD 이슈 · Ⅴ 종합평가
시각 표현:
  · 비교표 + 평가 배지(우수▲/보통●/개선▼) — 수치 지표(귀사 vs 전체·동종규모·동종업종, 평가는 동종규모 기준)
  · 카테고리: 귀사 선택 + 동종 최다응답 + 일치 여부
  · 제도 현황 갭 차트: 막대=동종 실시율, 색=귀사 상태(실시중/준비중/미운영)
  · 다항목: 동종 우선순위 막대 + 귀사 선택 ● 표시
  · 종합평가: 강점(▲)·개선 권고(▼ + 미운영 高실시율 제도) 자동 도출 — 또래 비중 문구

평가 polarity: 만족도(1=매우만족)만 낮을수록 우수, 나머지(교육비·시간·경영층관심·AI인식/활용)는 높을수록 우수.
산출(현 단계): 단일 HTML + 응답자 드롭다운. render_respondent_section 은 파일 분기에 그대로 재사용.
데이터: scripts/stage7_individual_data.build_all.  디자인: deck CSS(TOKENS_CSS 포함) + 토큰.
"""
from __future__ import annotations

import argparse
import sys
import warnings
from pathlib import Path

import pandas as pd
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from stage5_render_deck import CSS as DECK_CSS                  # noqa: E402
from stage7_individual_data import build_all, SMALL_N           # noqa: E402

warnings.filterwarnings("ignore", message="Mean of empty slice", category=RuntimeWarning)
warnings.filterwarnings("ignore", message="invalid value encountered", category=RuntimeWarning)

ROOT = Path(__file__).resolve().parents[1]
SEGMENTS_YAML = ROOT / "config" / "segments.yaml"
DEFAULT_SRC = ROOT / "2_validated" / "raw_validated.xlsx"
DEFAULT_OUT = ROOT / "5_report" / "preview" / "individual_report_22th_20260601.html"

SLOTS = [("overall", "전체"), ("size", "동종규모"), ("industry", "동종업종")]

# 단위 보정 (집계기 mean 기본 unit='명')
UNIT_OVERRIDE = {"edu_time": "시간"}

# 수치 지표 스펙: (src, key, label, unit, polarity, is_score)  src='headline'|'q'
# polarity: more=높을수록 우수 / low=낮을수록 우수.  is_score=1~5 척도(절대차 평가) / False=크기(비율 평가)
NUM_EDU = [
    ("headline", "peremp", "1인당 교육비", "만원", "more", False),
    ("headline", "rev", "매출 1억원당 교육비", "만원", "more", False),   # 매출대비 비율(%)를 만원/1억 환산
    ("q", "edu_time", "1인당 교육시간", "시간", "more", False),
    ("q", "satisfaction", "교육 투자 만족도", "점", "low", True),
]
NUM_HRD = [("q", "ceo_engage", None, "점", "more", True)]            # 3항목(경영층 관심)
NUM_AI = [("q", "ai_awareness", None, "점", "more", True),           # 중요성/활용 2항목
          ("q", "ai_satis", None, "점", "more", True)]               # 만족/활용 2항목

# 카테고리(dist) — 귀사 선택 vs 동종 최다응답
CAT_EDU = ["budget_chg"]
CAT_HRD = ["facility", "edu_system", "lms"]
CAT_AI = ["ai_ratio", "ai_strategy", "ai_ceo", "ai_stage", "ai_budget27", "ai_difficulty"]
# 다항목(multi/rank) — 동종 우선순위 + 귀사 선택 ●
MULTI_AI = ["ai_target", "ai_field", "ai_outcome", "ai_future"]
# HRD 이슈
RANK_ISSUE = "issue_rank"
CAT_ISSUE = ["perf_barrier"]


# ─────────────────────────────────────────────
# 헬퍼
# ─────────────────────────────────────────────

def _fnum(v, nd=1):
    if v is None:
        return "—"
    if isinstance(v, float) and v.is_integer():
        return f"{int(v)}"
    return f"{round(v, nd)}"


def primary_slot(fm: dict) -> str:
    return "size" if fm.get("size") else "overall"


def verdict(me, peer, polarity, is_score):
    """(텍스트, 클래스) 또는 None. good=우수▲ / mid=보통● / bad=개선▼."""
    if me is None or peer is None:
        return None
    if is_score:
        eff = (me - peer) if polarity == "more" else (peer - me)
        if eff >= 0.3:
            return ("우수", "good")
        if eff <= -0.3:
            return ("개선", "bad")
        return ("보통", "mid")
    if not peer:
        return ("우수", "good") if (me or 0) > 0 else ("보통", "mid")
    ratio = me / peer
    eff = ratio if polarity == "more" else (1 / ratio if ratio else 0)
    if eff >= 1.15:
        return ("우수", "good")
    if eff <= 0.85:
        return ("개선", "bad")
    return ("보통", "mid")


_VD_SYM = {"good": "▲", "mid": "●", "bad": "▼"}


def _vd_badge(vd):
    if not vd:
        return '<span class="vd na">—</span>'
    txt, cls = vd
    return f'<span class="vd {cls}">{txt} {_VD_SYM[cls]}</span>'


def numeric_rows(rec: dict, specs: list) -> list[dict]:
    """스펙 → 비교표 행 [{label, unit, me, frames{slot:val}, polarity, is_score}]."""
    rows = []
    hl = {h["key"]: h for h in rec["headline"]}
    for src, key, label, unit, pol, is_score in specs:
        if src == "headline":
            h = hl.get(key)
            if h is None:
                continue
            rows.append({"label": label or h["label"], "unit": h.get("unit", unit),
                         "me": h["me"], "frames": h["frames"], "polarity": pol, "is_score": is_score})
        else:
            q = rec["questions"].get(key)
            if not q or not q.get("items"):
                continue
            u = UNIT_OVERRIDE.get(key, unit)
            multi = len(q["items"]) > 1
            for it in q["items"]:
                lab = (f'{q["title"]} · {it["label"]}' if multi else (label or q["title"]))
                rows.append({"label": lab, "unit": u, "me": it["me"], "frames": it["frames"],
                             "polarity": pol, "is_score": is_score})
    return rows


def peer_mode(peer_map: dict):
    """프레임 분포 맵 → 최다 라벨, 비율."""
    if not peer_map:
        return None, None
    items = [(lab, p) for lab, p in peer_map.items() if p is not None and lab != "무응답"]
    if not items:
        return None, None
    lab, p = max(items, key=lambda x: x[1])
    return lab, p


# ─────────────────────────────────────────────
# 식별 헤더
# ─────────────────────────────────────────────

def render_identity(rec: dict) -> str:
    it = rec["identity"]
    fm = rec["frames"]
    chips = []
    if it.get("div_label"):
        chips.append(f'<span class="id-chip">{it["div_label"]}</span>')
    if it.get("emp") is not None:
        chips.append(f'<span class="id-chip">직원 {_fnum(it["emp"], 0)}명</span>')
    if it.get("size_label"):
        chips.append(f'<span class="id-chip">규모 {it["size_label"]}</span>')
    chips.append(f'<span class="id-chip">업종 {it.get("industry_label") or "미분류"}</span>')

    bench = []
    for slot, base in SLOTS:
        f = fm.get(slot)
        if f:
            small = " · 표본부족" if f.get("small") else ""
            bench.append(f'<span class="bg-item"><b>{f["label"]}</b> {f["n"]}개사{small}</span>')
        else:
            reason = "공공 미적용" if it["is_public"] and slot in ("size", "industry") else (
                "업종 미분류" if slot == "industry" else "규모 미상")
            bench.append(f'<span class="bg-item muted">{base}: {reason}</span>')
    return f"""
  <header class="ind-hero">
    <div class="ih-top">
      <div class="ih-co">{it.get("company") or "(회사명 미상)"}</div>
      <div class="ih-rid">{it["rid"]}</div>
    </div>
    <div class="ih-meta">{it.get("name") or ""} {it.get("position") or ""} · {it.get("email") or ""}</div>
    <div class="id-chips">{"".join(chips)}</div>
    <div class="ih-bench"><span class="bg-cap">비교 기준</span>{"".join(bench)}</div>
  </header>"""


# ─────────────────────────────────────────────
# Ⅰ~Ⅲ 공통 렌더러
# ─────────────────────────────────────────────

def render_cmp_table(rows: list[dict], fm: dict, note=""):
    if not rows:
        return ""
    prim = primary_slot(fm)
    prim_label = fm[prim]["label"] if fm.get(prim) else "전체"
    heads = ['<th class="t-metric">지표</th>', '<th class="t-me">귀사</th>']
    for slot, base in SLOTS:
        f = fm.get(slot)
        heads.append(f'<th>{f["label"] if f else base}</th>')
    heads.append(f'<th class="t-vd">평가 <small>vs {prim_label}</small></th>')
    body = []
    for r in rows:
        me_u = f'<span class="u">{r["unit"]}</span>' if r["me"] is not None else ""
        cells = [f'<td class="t-metric">{r["label"]}</td>',
                 f'<td class="t-me">{_fnum(r["me"])}{me_u}</td>']
        for slot, _ in SLOTS:
            f = fm.get(slot)
            fv = (r["frames"].get(slot) if f else None)
            small = '<span class="sm">◦</span>' if (f and f.get("small")) else ""
            cells.append(f'<td>{_fnum(fv)}{r["unit"] if fv is not None else ""}{small}</td>'
                         if f else '<td class="muted">—</td>')
        vd = verdict(r["me"], r["frames"].get(prim), r["polarity"], r["is_score"])
        cells.append(f'<td class="t-vd">{_vd_badge(vd)}</td>')
        body.append(f'<tr>{"".join(cells)}</tr>')
    cap = f'<div class="caveat">{note}</div>' if note else ""
    return (f'<div class="cmp-wrap"><table class="cmp"><thead><tr>{"".join(heads)}</tr></thead>'
            f'<tbody>{"".join(body)}</tbody></table>{cap}</div>')


def render_cat_table(rec: dict, qids: list, fm: dict):
    prim = primary_slot(fm)
    plabel = fm[prim]["label"] if fm.get(prim) else "동종"
    rows = []
    for qid in qids:
        q = rec["questions"].get(qid)
        if not q:
            continue
        me = q.get("me") or []
        me_lab = me[0] if me else None
        pm = (q.get("peer") or {}).get(prim)
        mode_lab, mode_pct = peer_mode(pm)
        me_cell = (f'<span class="me-chip">{me_lab}</span>' if me_lab
                   else '<span class="muted">응답 없음</span>')
        mode_cell = (f'{mode_lab} <span class="pct">{_fnum(mode_pct)}%</span>' if mode_lab
                     else '—')
        if me_lab and mode_lab:
            align = ('<span class="algn same">일치</span>' if me_lab == mode_lab
                     else '<span class="algn diff">상이</span>')
        else:
            align = ""
        # 귀사 선택을 또래(primary)가 고른 비율
        me_peer = (pm or {}).get(me_lab) if me_lab else None
        peer_cell = f'{_fnum(me_peer)}%' if me_peer is not None else "—"
        rows.append(f'<tr><td class="t-metric">{q["title"]}</td>'
                    f'<td class="t-me">{me_cell}</td>'
                    f'<td>{peer_cell}</td>'
                    f'<td>{mode_cell}</td>'
                    f'<td>{align}</td></tr>')
    if not rows:
        return ""
    return (f'<div class="cmp-wrap"><table class="cmp cat">'
            f'<thead><tr><th class="t-metric">항목</th><th class="t-me">귀사 선택</th>'
            f'<th>{plabel}<small>같은 선택 비율</small></th>'
            f'<th>{plabel} 최다응답</th><th>비교</th></tr></thead>'
            f'<tbody>{"".join(rows)}</tbody></table></div>')


def render_rank_card(rec: dict, qid: str, fm: dict, top=8):
    q = rec["questions"].get(qid)
    if not q:
        return ""
    prim = primary_slot(fm)
    plabel = fm[prim]["label"] if fm.get(prim) else "동종"
    pm = (q.get("peer") or {}).get(prim) or {}
    me = set(q.get("me") or [])
    ranking = sorted([(lab, p) for lab, p in pm.items() if p is not None],
                     key=lambda x: -x[1])
    # 귀사가 골랐지만 또래 상위에 없는 항목도 포함되도록 me 우선 노출
    shown = ranking[:top]
    shown_labels = {l for l, _ in shown}
    for lab in me:
        if lab not in shown_labels and lab in pm:
            shown.append((lab, pm[lab]))
    mx = max([p for _, p in shown], default=1) or 1
    rows = []
    for lab, p in shown:
        picked = lab in me
        dot = '<span class="rk-dot on">●</span>' if picked else '<span class="rk-dot">○</span>'
        rows.append(
            f'<div class="rk-row{" picked" if picked else ""}">{dot}'
            f'<span class="rk-lab">{lab}</span>'
            f'<span class="rk-track"><span class="rk-fill" style="width:{round(p / mx * 100)}%"></span></span>'
            f'<span class="rk-v">{_fnum(p)}%</span></div>')
    miss = [l for l in me if l not in pm]
    extra = (f'<div class="caveat">귀사 선택 중 {plabel} 미집계: {", ".join(miss)}</div>' if miss else "")
    return (f'<div class="rank-card"><h4 class="cb-title">{q["title"]}'
            f'<small>{plabel} 우선순위 · ●=귀사 선택</small></h4>'
            f'<div class="rk-wrap">{"".join(rows)}</div>{extra}</div>')


# 제도 현황 갭 차트 (dist_multi)
def _status_cls(status: str) -> str:
    s = status or ""
    if "실시" in s:
        return "run"
    if "중단" in s or "미고려" in s or "없" in s or "안" in s:
        return "none"
    return "prep"


def render_gap_chart(rec: dict, qid: str, fm: dict):
    q = rec["questions"].get(qid)
    if not q or not q.get("systems"):
        return ""
    prim = primary_slot(fm)
    plabel = fm[prim]["label"] if fm.get(prim) else "동종"
    systems = []
    for s in q["systems"]:
        impl = (s.get("peer_impl") or {}).get(prim)
        systems.append({**s, "impl": impl if impl is not None else 0})
    systems.sort(key=lambda x: -x["impl"])
    rows = []
    for s in systems:
        cls = _status_cls(s.get("me_status"))
        rows.append(
            f'<div class="gp-row"><span class="gp-lab">{s["label"]}</span>'
            f'<span class="gp-track"><span class="gp-fill {cls}" style="width:{round(s["impl"])}%"></span></span>'
            f'<span class="gp-v">{_fnum(s["impl"])}%</span>'
            f'<span class="gp-status {cls}">{s.get("me_status") or "무응답"}</span></div>')
    legend = ('<div class="gp-legend"><span><i class="run"></i>실시중</span>'
              '<span><i class="prep"></i>준비·검토</span><span><i class="none"></i>미운영</span>'
              f'<em>막대 = {plabel} 실시율 · 색 = 귀사 상태</em></div>')
    return (f'<div class="gap-card"><h4 class="cb-title">HRD 제도 현황 '
            f'<small>{plabel} 실시율 순 · 색=귀사 운영상태</small></h4>'
            f'{legend}<div class="gp-wrap">{"".join(rows)}</div></div>')


# ─────────────────────────────────────────────
# Ⅴ 종합평가 (자동 도출)
# ─────────────────────────────────────────────

def summary_eval(rec: dict) -> tuple[list, list]:
    fm = rec["frames"]
    prim = primary_slot(fm)
    plabel = fm[prim]["label"] if fm.get(prim) else "동종"
    strengths, improves = [], []
    # 수치 지표
    for rows in (numeric_rows(rec, NUM_EDU), numeric_rows(rec, NUM_HRD), numeric_rows(rec, NUM_AI)):
        for r in rows:
            peer = r["frames"].get(prim)
            vd = verdict(r["me"], peer, r["polarity"], r["is_score"])
            if not vd:
                continue
            phrase = (f'{r["label"]} {_fnum(r["me"])}{r["unit"]} '
                      f'({plabel} {_fnum(peer)}{r["unit"]})')
            if vd[1] == "good":
                strengths.append(phrase)
            elif vd[1] == "bad":
                improves.append(phrase)
    # 제도 미운영 + 동종 高실시율 → 개선 권고
    hs = rec["questions"].get("hrd_system")
    if hs and hs.get("systems"):
        for s in hs["systems"]:
            impl = (s.get("peer_impl") or {}).get(prim)
            if s.get("me_status") and "실시" not in s["me_status"] and impl is not None and impl >= 50:
                improves.append(f'{s["label"]} 도입 검토 ({plabel} 실시율 {_fnum(impl)}%)')
    return strengths[:6], improves[:6]


def render_summary(rec: dict) -> str:
    strengths, improves = summary_eval(rec)
    if not strengths and not improves:
        body = '<div class="rb-empty">평가 가능한 비교 지표가 부족합니다(표본·응답 부족).</div>'
    else:
        def ul(items, empty):
            if not items:
                return f'<div class="se-empty">{empty}</div>'
            return '<ul class="se-list">' + "".join(f'<li>{x}</li>' for x in items) + '</ul>'
        body = (f'<div class="se-grid">'
                f'<div class="se-col good"><div class="se-head">▲ 강점 영역</div>'
                f'{ul(strengths, "동종규모 대비 두드러진 강점 지표 없음")}</div>'
                f'<div class="se-col bad"><div class="se-head">▼ 개선 권고 영역</div>'
                f'{ul(improves, "동종규모 대비 개선 시급 지표 없음")}</div></div>')
    return body


# ─────────────────────────────────────────────
# 섹션 조립
# ─────────────────────────────────────────────

def _section(roman, title, *blocks):
    inner = "".join(b for b in blocks if b)
    if not inner.strip():
        return ""
    return (f'<section class="rsec"><div class="rsec-h"><span class="rsec-n">{roman}</span>{title}</div>'
            f'{inner}</section>')


def _sub(label):
    return f'<div class="sub-label">{label}</div>'


def render_respondent_section(rec: dict, active: bool = False) -> str:
    rid = rec["identity"]["rid"]
    fm = rec["frames"]
    edu_note = ("값=귀사·각 그룹 / 평가=주 비교군(동종규모, 없으면 전체) 기준"
                "(만족도는 1=매우만족이라 낮을수록 우수). ◦=표본부족")
    fl = rec.get("flags", {})
    if fl.get("rev_bad"):
        raw = fl.get("rev_raw")
        rawtxt = _fnum(raw, 0) if raw is not None else "?"
        edu_note += (f' ⚠ 매출 입력값({rawtxt}원)이 교육비보다 작아 '
                     '매출 1억원당 교육비는 <b>보류</b>(원자료 매출 입력 확인 필요).')
    if fl.get("peremp_bad"):
        tgt = fl.get("tgt_raw")
        tgttxt = f"{_fnum(tgt, 0)}명" if tgt is not None else "?"
        edu_note += (f' ⚠ 교육대상 인원({tgttxt})이 비정상적으로 작아 '
                     '1인당 교육비는 <b>보류</b>(원자료 교육대상 인원 확인 필요).')
    sec1 = _section("Ⅰ", "교육 관련 지표",
                    render_cmp_table(numeric_rows(rec, NUM_EDU), fm, edu_note),
                    _sub("교육예산 증감"), render_cat_table(rec, CAT_EDU, fm))
    sec2 = _section("Ⅱ", "HRD 현황",
                    _sub("경영층 관심·참여 (1~5점)"), render_cmp_table(numeric_rows(rec, NUM_HRD), fm),
                    _sub("교육 인프라"), render_cat_table(rec, CAT_HRD, fm),
                    render_gap_chart(rec, "hrd_system", fm))
    sec3 = _section("Ⅲ", "AI 도입과 활용",
                    _sub("AI 전략·인식 (선택형)"), render_cat_table(rec, CAT_AI, fm),
                    _sub("AI 인식·활용·만족 (1~5점)"), render_cmp_table(numeric_rows(rec, NUM_AI), fm),
                    _sub("AI 교육 대상·분야·성과·계획 (동종 우선순위 · ●=귀사)"),
                    '<div class="rank-grid">'
                    + "".join(render_rank_card(rec, q, fm) for q in MULTI_AI) + '</div>')
    sec4 = _section("Ⅳ", "HRD 이슈",
                    _sub("주요 이슈 우선순위 (동종 · ●=귀사 선택)"),
                    '<div class="rank-grid">' + render_rank_card(rec, RANK_ISSUE, fm) + '</div>',
                    _sub("HRD 수행 방해 요인"), render_cat_table(rec, CAT_ISSUE, fm))
    sec5 = (f'<section class="rsec eval"><div class="rsec-h"><span class="rsec-n">Ⅴ</span>종합평가</div>'
            f'{render_summary(rec)}</section>')
    return f"""
  <section class="resp{' active' if active else ''}" id="resp-{rid}" data-rid="{rid}">
    {render_identity(rec)}
    {sec1}{sec2}{sec3}{sec4}{sec5}
  </section>"""


# ─────────────────────────────────────────────
# CSS
# ─────────────────────────────────────────────

EXTRA_CSS = """
html, body { overflow: visible; height: auto; background: var(--exc-bg); }
body { color: var(--exc-ink); font-family: var(--font-sans); margin: 0; }
.wrap { max-width: 1060px; margin: 0 auto; padding: 0 28px 120px; }

.topbar { position: sticky; top: 0; z-index: 30; background: var(--ai-dusk); color: var(--exc-bg);
  display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 12px 28px; box-shadow: var(--shadow-md); }
.topbar .tb-title { font-size: 15px; font-weight: 800; }
.topbar .tb-title span { font-weight: 500; color: rgba(255,255,255,.6); font-size: 12px; margin-left: 8px; }
.topbar select { font-family: inherit; font-size: 14px; font-weight: 600; padding: 7px 12px;
  border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,.25); background: var(--exc-bg);
  color: var(--exc-ink); min-width: 340px; }
.topbar .tb-nav { display: flex; gap: 6px; margin-left: auto; }
.topbar .tb-nav button { width: 36px; height: 36px; border-radius: 50%; border: 1px solid rgba(255,255,255,.25);
  background: rgba(255,255,255,.08); color: var(--exc-bg); font-size: 16px; font-weight: 700; cursor: pointer; }
.topbar .tb-nav button:hover { background: rgba(255,255,255,.18); }
.topbar .tb-pos { font-size: 12px; color: rgba(255,255,255,.7); font-variant-numeric: tabular-nums; }

.prelim-banner { background: color-mix(in srgb, var(--exc-amber) 14%, white);
  border: 1px solid color-mix(in srgb, var(--exc-amber) 45%, white); border-radius: var(--radius-md);
  padding: 13px 18px; margin: 24px 0 20px; font-size: 13px; color: var(--exc-ink-2); line-height: 1.6; }
.prelim-banner b { color: var(--exc-ink); }

.resp { display: none; }
.resp.active { display: block; }

/* 식별 헤더 */
.ind-hero { background: var(--ai-dusk); color: var(--exc-bg); border-radius: var(--radius-lg);
  padding: 22px 26px; margin: 22px 0 8px; box-shadow: var(--shadow-md); }
.ih-top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.ih-co { font-size: 28px; font-weight: 800; }
.ih-rid { font-size: 13px; font-weight: 700; color: rgba(255,255,255,.55); font-variant-numeric: tabular-nums; }
.ih-meta { font-size: 13px; color: rgba(255,255,255,.7); margin-top: 4px; }
.id-chips { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 14px; }
.id-chip { font-size: 12px; font-weight: 600; padding: 4px 11px; border-radius: var(--radius-pill);
  background: rgba(255,255,255,.13); color: var(--exc-bg); }
.ih-bench { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; margin-top: 14px;
  padding-top: 12px; border-top: 1px solid rgba(255,255,255,.14); font-size: 12px; color: rgba(255,255,255,.78); }
.ih-bench .bg-cap { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: rgba(255,255,255,.5); }
.ih-bench .bg-item b { color: var(--exc-bg); font-weight: 700; }
.ih-bench .bg-item.muted { color: rgba(255,255,255,.4); }

/* 섹션 */
.rsec { margin: 30px 0 8px; }
.rsec-h { display: flex; align-items: center; gap: 10px; font-size: 19px; font-weight: 800;
  color: var(--exc-ink); margin-bottom: 14px; padding-bottom: 8px; border-bottom: 2px solid var(--exc-ink); }
.rsec-n { font-size: 13px; font-weight: 800; color: var(--exc-bg); background: var(--ai-dusk);
  border-radius: var(--radius-pill); padding: 2px 11px; }
.sub-label { font-size: 13px; font-weight: 700; color: var(--exc-ink-2); margin: 18px 0 9px; }

/* 비교표 */
.cmp-wrap { overflow-x: auto; }
table.cmp { border-collapse: collapse; width: 100%; font-size: 13px; }
table.cmp th, table.cmp td { padding: 9px 12px; text-align: right; border-bottom: 1px solid var(--exc-line);
  font-variant-numeric: tabular-nums; white-space: nowrap; }
table.cmp thead th { background: var(--exc-panel); font-weight: 700; color: var(--exc-ink-2); }
table.cmp th small { display: block; font-weight: 500; color: var(--exc-muted-2); font-size: 10px; }
table.cmp td.t-metric, table.cmp th.t-metric { text-align: left; color: var(--exc-ink); font-weight: 600; white-space: normal; }
table.cmp td.t-me, table.cmp th.t-me { background: color-mix(in srgb, var(--ai-violet) 7%, white);
  font-weight: 800; color: var(--ai-violet); }
table.cmp td.t-me .u, table.cmp td .u { font-size: 10px; font-weight: 600; color: var(--exc-muted); margin-left: 1px; }
table.cmp td.muted { color: var(--exc-muted-2); }
table.cmp .sm { color: var(--exc-amber); font-size: 11px; }
table.cmp td.t-vd, table.cmp th.t-vd { text-align: center; }
table.cmp .pct { color: var(--exc-muted); font-weight: 600; }
.me-chip { display: inline-block; font-size: 12px; font-weight: 700; padding: 2px 9px; border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--ai-violet) 12%, white); color: var(--ai-violet); }
.algn { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: var(--radius-pill); }
.algn.same { background: color-mix(in srgb, var(--exc-green) 14%, white); color: var(--exc-green-700); }
.algn.diff { background: var(--exc-panel-2); color: var(--exc-muted); }

/* 평가 배지 */
.vd { display: inline-block; font-size: 11px; font-weight: 800; padding: 2px 9px; border-radius: var(--radius-pill);
  font-variant-numeric: tabular-nums; }
.vd.good { background: color-mix(in srgb, var(--exc-green) 16%, white); color: var(--exc-green-700); }
.vd.bad  { background: color-mix(in srgb, var(--ds-rose) 15%, white);  color: var(--ds-rose-700); }
.vd.mid  { background: var(--exc-panel-2); color: var(--exc-muted); }
.vd.na   { background: transparent; color: var(--exc-muted-2); }

/* 다항목 우선순위 카드 */
.rank-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.rank-card, .gap-card { border: 1px solid var(--exc-line); border-radius: var(--radius-lg); padding: 16px 20px; background: var(--exc-bg); }
.cb-title { font-size: 14px; font-weight: 700; margin: 0 0 12px; color: var(--exc-ink); display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.cb-title small { font-size: 11px; font-weight: 500; color: var(--exc-muted); }
.rk-wrap { display: flex; flex-direction: column; gap: 6px; }
.rk-row { display: grid; grid-template-columns: 16px 1fr 90px 38px; align-items: center; gap: 8px; font-size: 12px; }
.rk-dot { color: var(--exc-line-2); font-size: 11px; }
.rk-dot.on { color: var(--ai-violet); }
.rk-row.picked .rk-lab { font-weight: 800; color: var(--ai-violet); }
.rk-lab { color: var(--exc-ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rk-track { height: 9px; background: var(--exc-panel-2); border-radius: var(--radius-pill); overflow: hidden; }
.rk-fill { display: block; height: 100%; background: var(--ai-dusk); border-radius: var(--radius-pill); }
.rk-row.picked .rk-fill { background: var(--ai-violet); }
.rk-v { text-align: right; font-weight: 700; color: var(--exc-ink); font-variant-numeric: tabular-nums; }
@media (max-width: 820px) { .rank-grid { grid-template-columns: 1fr; } }

/* 제도 갭 차트 */
.gap-card { margin-top: 16px; }
.gp-legend { display: flex; gap: 14px; align-items: center; font-size: 11px; color: var(--exc-muted); margin-bottom: 10px; flex-wrap: wrap; }
.gp-legend i { display: inline-block; width: 11px; height: 11px; border-radius: 3px; margin-right: 4px; vertical-align: -1px; }
.gp-legend i.run { background: var(--exc-green); } .gp-legend i.prep { background: var(--exc-amber); } .gp-legend i.none { background: var(--exc-muted-2); }
.gp-legend em { color: var(--exc-muted-2); }
.gp-wrap { display: flex; flex-direction: column; gap: 6px; }
.gp-row { display: grid; grid-template-columns: 130px 1fr 42px 64px; align-items: center; gap: 9px; font-size: 12px; }
.gp-lab { color: var(--exc-ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gp-track { height: 13px; background: var(--exc-panel-2); border-radius: var(--radius-pill); overflow: hidden; }
.gp-fill { display: block; height: 100%; border-radius: var(--radius-pill); }
.gp-fill.run { background: var(--exc-green); } .gp-fill.prep { background: var(--exc-amber); } .gp-fill.none { background: var(--exc-muted-2); }
.gp-v { text-align: right; font-weight: 700; color: var(--exc-ink); font-variant-numeric: tabular-nums; }
.gp-status { font-size: 10px; font-weight: 700; text-align: center; padding: 1px 0; border-radius: var(--radius-pill); }
.gp-status.run { background: color-mix(in srgb, var(--exc-green) 14%, white); color: var(--exc-green-700); }
.gp-status.prep { background: color-mix(in srgb, var(--exc-amber) 20%, white); color: color-mix(in srgb, var(--exc-amber) 55%, var(--exc-ink)); }
.gp-status.none { background: var(--exc-panel-2); color: var(--exc-muted); }

/* 종합평가 */
.rsec.eval .rsec-h { border-color: var(--ai-dusk); }
.se-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.se-col { border: 1px solid var(--exc-line); border-radius: var(--radius-lg); padding: 16px 20px; }
.se-col.good { background: color-mix(in srgb, var(--exc-green) 5%, white); border-color: color-mix(in srgb, var(--exc-green) 30%, white); }
.se-col.bad { background: color-mix(in srgb, var(--ds-rose) 5%, white); border-color: color-mix(in srgb, var(--ds-rose) 28%, white); }
.se-head { font-size: 14px; font-weight: 800; margin-bottom: 10px; }
.se-col.good .se-head { color: var(--exc-green-700); }
.se-col.bad .se-head { color: var(--ds-rose-700); }
.se-list { margin: 0; padding-left: 18px; }
.se-list li { font-size: 13px; color: var(--exc-ink-2); line-height: 1.7; }
.se-empty { font-size: 12px; color: var(--exc-muted-2); }
.caveat { font-size: 11px; color: var(--exc-muted-2); margin-top: 10px; line-height: 1.5; }
.rb-empty { font-size: 12px; color: var(--exc-muted-2); padding: 8px 0; }
@media (max-width: 820px) { .se-grid { grid-template-columns: 1fr; } }
"""


# ─────────────────────────────────────────────
# 조립
# ─────────────────────────────────────────────

def _option_label(rec: dict) -> str:
    it = rec["identity"]
    tail = it.get("div_label") or ""
    if it.get("size_label"):
        tail += f' {it["size_label"]}'
    return f'{it["rid"]} · {it.get("company") or "(미상)"}' + (f' ({tail.strip()})' if tail.strip() else "")


def build_report(data: dict) -> str:
    order = data["order"]
    options = "".join(
        f'<option value="{rid}">{_option_label(data["records"][rid])}</option>' for rid in order)
    sections = "\n".join(
        render_respondent_section(data["records"][rid], active=(i == 0))
        for i, rid in enumerate(order))

    banner = (
        '<div class="prelim-banner">⚠ <b>prelim 스냅샷</b> — 완료 '
        f'{data["n_total"]}명(기업 {data["n_corp"]}·공공 {data["n_public"]}, 수집 종료 9월 예정). '
        '평가(▲/●/▼)는 <b>동종규모</b>(공공은 공공 전체) 기준이며 현재 규모군·업종 표본이 작아(N&lt;'+str(SMALL_N)+' 다수) <b>잠정값</b>입니다. '
        '업종 비교는 R_Cate 재분류 완료 후 충실해집니다. '
        '<b>식별정보 포함 · 내부 검토용</b> — 외부 발송 시 동의·보안 확인 필요.'
        '</div>')

    js = """
(function(){
  const ids = [...document.querySelectorAll('.resp')].map(s => s.dataset.rid);
  const sel = document.getElementById('resp-select');
  const pos = document.getElementById('tb-pos');
  function show(rid){
    document.querySelectorAll('.resp').forEach(s => s.classList.toggle('active', s.dataset.rid === rid));
    sel.value = rid; const i = ids.indexOf(rid); pos.textContent = (i+1)+' / '+ids.length;
    window.scrollTo({top:0});
  }
  function step(d){ const i = ids.indexOf(sel.value); show(ids[Math.min(ids.length-1, Math.max(0, i+d))]); }
  sel.addEventListener('change', e => show(e.target.value));
  document.getElementById('tb-prev').addEventListener('click', () => step(-1));
  document.getElementById('tb-next').addEventListener('click', () => step(1));
  show(ids[0]);
})();
"""
    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>제22회 인재개발 실태조사 — 개별 응답자 벤치마크 리포트 (prelim · 내부용)</title>
<style>{DECK_CSS}</style>
<style>{EXTRA_CSS}</style>
</head>
<body>
<div class="topbar">
  <div class="tb-title">개별 벤치마크 리포트<span>HRD Survey · 22회 · 내부 검토용</span></div>
  <select id="resp-select">{options}</select>
  <div class="tb-pos" id="tb-pos"></div>
  <div class="tb-nav"><button id="tb-prev" title="이전 응답자">↑</button>
    <button id="tb-next" title="다음 응답자">↓</button></div>
</div>
<div class="wrap">
{banner}
{sections}
</div>
<script>{js}</script>
</body>
</html>"""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--src", type=Path, default=DEFAULT_SRC)
    ap.add_argument("--src-sheet", default="Sheet1")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--rid", default=None, help="한 응답자만 (파일분기 미리보기)")
    args = ap.parse_args()

    seg_yaml = yaml.safe_load(SEGMENTS_YAML.read_text(encoding="utf-8"))
    df = pd.read_excel(args.src, sheet_name=args.src_sheet, dtype=object)
    data = build_all(df, seg_yaml)

    if args.rid:
        if args.rid not in data["records"]:
            print(f"⚠ {args.rid} 없음")
            return 1
        data = {**data, "order": [args.rid]}

    html = build_report(data)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(html, encoding="utf-8")
    try:
        shown = args.out.resolve().relative_to(ROOT)
    except ValueError:
        shown = args.out
    print(f"출력: {shown}  ({len(html):,} bytes · 응답자 {len(data['order'])}명)")
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
