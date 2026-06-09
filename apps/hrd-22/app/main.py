"""정제·집계 작업대 — FastAPI + HTMX (스켈레톤).

설계: docs/CURATION_APP_DESIGN.md / 합의: docs/POPULATION_FILTER_SPEC_22th.md
상태: 골격 + 상태판(검증 엔진 실연결). 나머지 5탭은 다음 세션 구현 대상(스텁).

실행:
    uvicorn app.main:app --reload   (프로젝트 루트에서)
    → http://127.0.0.1:8000
"""
from __future__ import annotations
import sys
from pathlib import Path

import pandas as pd
import yaml
from fastapi import FastAPI, Form, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import curation_engine as ce            # noqa: E402  (검증된 엔진 재사용)
import stage4_extract_chart_data as ex  # noqa: E402

from app import outliers as ol          # noqa: E402
from app import reclassify as rc         # noqa: E402
from app import exclude as ex_app        # noqa: E402
from app import build as bd              # noqa: E402
from app import store                   # noqa: E402

# 21회 시험 데이터. 22회 본가동 시 3_cleaned/All_확인완료_22th.xlsx 로 교체.
DATA = ROOT / "3_cleaned/All_확인완료_21th.xlsx"
# 결정 원장(시험). 22회 본가동 시 config/decisions_22th.yaml 로 교체.
DECISIONS = ROOT / "config/decisions_21th.yaml"
SEG = yaml.safe_load((ROOT / "config/segments.yaml").read_text(encoding="utf-8"))

app = FastAPI(title="HRD 22회 정제·집계 작업대")
templates = Jinja2Templates(directory=str(Path(__file__).parent / "templates"))

# 6탭 (slug, 라벨, 구현여부) — docs/CURATION_APP_DESIGN.md §6
TABS = [
    ("", "상태판", True),
    ("outliers", "이상치 검토", True),
    ("reclassify", "업종 재분류", True),
    ("exclude", "포함/제외", True),
    ("build", "산출/미리보기", True),
    ("history", "이력", False),
]


def status_summary() -> dict:
    """상태판 지표 — 검증된 엔진으로 실제 산출."""
    df = ce.load_df(DATA)
    pop = ex.build_population(df, SEG["population_filter"])
    rdiv = pd.to_numeric(pop["R_Div"], errors="coerce")
    # 중복 그룹 수
    ided = ce.assign_ids(df)
    dup_groups = sum(1 for _, g in ided.groupby("org_key") if len(g) > 1)
    return {
        "data_file": DATA.name,
        "rows": len(df),
        "corp_N": int(rdiv.isin([1, 2, 3]).sum()),
        "pub_N": int(rdiv.isin([4, 5]).sum()),
        "dup_groups": dup_groups,
    }


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse(
        request, "status.html", {"s": status_summary(), "tabs": TABS})


# ── 이상치 검토 (설계 §6) ──────────────────────────────────────────
def _flags_and_decisions():
    df = ce.assign_ids(ce.load_df(DATA))
    flags = ol.build_flags(df)
    _, decisions = store.load(DECISIONS)
    return df, flags, decisions


@app.get("/outliers", response_class=HTMLResponse)
def outliers_page(request: Request, sev: str = "all", pending: int = 0):
    _, flags, decisions = _flags_and_decisions()
    rows = [{"f": f, "res": ol.resolution(f, decisions)} for f in flags]
    if sev != "all":
        rows = [r for r in rows if r["f"]["severity"] == sev]
    if pending:
        rows = [r for r in rows if r["res"] is None]
    return templates.TemplateResponse(request, "outliers.html", {
        "tabs": TABS, "rows": rows, "sev": sev, "pending": pending,
        "summary": ol.summarize(flags, decisions),
    })


@app.post("/outliers/decide", response_class=HTMLResponse)
def outliers_decide(
    request: Request,
    resp_id: str = Form(...), rule_id: str = Form(...), col: str = Form(...),
    action: str = Form(...), before: str = Form(""), after: str = Form(""),
    reason: str = Form(""),
):
    if action == "correct":
        store.append({
            "resp_id": resp_id, "type": "correction", "field": col,
            "before": before, "after": after, "rule_id": rule_id,
            "reason": reason or "이상치 보정", "source": "outlier_report",
        }, DECISIONS)
    else:  # approved | ignored
        store.append({
            "resp_id": resp_id, "type": "outlier_review", "field": col,
            "rule_id": rule_id, "resolution": action,
            "reason": reason or ("승인" if action == "approved" else "무시"),
            "source": "outlier_report",
        }, DECISIONS)
    _, flags, decisions = _flags_and_decisions()
    flag = next((f for f in flags if f["key"] == f"{resp_id}__{rule_id}"), None)
    return templates.TemplateResponse(request, "_outlier_row.html", {
        "r": {"f": flag, "res": ol.resolution(flag, decisions)},
        "summary": ol.summarize(flags, decisions), "oob": True,
    })


# ── 업종 재분류 (설계 §6) ──────────────────────────────────────────
@app.get("/reclassify", response_class=HTMLResponse)
def reclassify_page(request: Request):
    df = ce.assign_ids(ce.load_df(DATA))
    _, decisions = store.load(DECISIONS)
    cands = rc.candidates(df)
    rows = [{"c": c, "res": rc.resolution(c["resp_id"], decisions)} for c in cands]
    return templates.TemplateResponse(request, "reclassify.html", {
        "tabs": TABS, "rows": rows, "choices": rc.CHOICES,
        "summary": rc.summarize(cands, decisions),
    })


@app.post("/reclassify/decide", response_class=HTMLResponse)
def reclassify_decide(
    request: Request,
    resp_id: str = Form(...), before: str = Form(""),
    after: str = Form(...), reason: str = Form(""),
):
    store.append({
        "resp_id": resp_id, "type": "reclassification", "field": "R_Cate",
        "before": before, "after": after, "after_label": rc.label_of(after),
        "reason": reason or "etc → 표준 업종", "source": "manual",
    }, DECISIONS)
    df = ce.assign_ids(ce.load_df(DATA))
    _, decisions = store.load(DECISIONS)
    cands = rc.candidates(df)
    c = next((x for x in cands if x["resp_id"] == resp_id), None)
    return templates.TemplateResponse(request, "_reclassify_row.html", {
        "r": {"c": c, "res": rc.resolution(resp_id, decisions)},
        "choices": rc.CHOICES, "summary": rc.summarize(cands, decisions), "oob": True,
    })


# ── 포함/제외 (설계 §5·§6) ─────────────────────────────────────────
@app.get("/exclude", response_class=HTMLResponse)
def exclude_page(request: Request):
    df = ce.assign_ids(ce.load_df(DATA))
    _, decisions = store.load(DECISIONS)
    return templates.TemplateResponse(request, "exclude.html", {
        "tabs": TABS, "counts": ex_app.counts(df, decisions),
        "excluded": ex_app.excluded_rows(df, decisions),
    })


@app.get("/exclude/search", response_class=HTMLResponse)
def exclude_search(request: Request, q: str = ""):
    df = ce.assign_ids(ce.load_df(DATA))
    _, decisions = store.load(DECISIONS)
    return templates.TemplateResponse(request, "_exclude_results.html", {
        "rows": ex_app.search(df, decisions, q), "q": q,
    })


@app.post("/exclude/toggle", response_class=HTMLResponse)
def exclude_toggle(
    request: Request,
    resp_id: str = Form(...), excluded: str = Form(...), reason: str = Form(""),
):
    excl = excluded == "true"
    store.append({
        "resp_id": resp_id, "type": "exclusion", "excluded": excl,
        "reason": reason or ("제외" if excl else "포함 복원"), "source": "manual",
    }, DECISIONS)
    df = ce.assign_ids(ce.load_df(DATA))
    _, decisions = store.load(DECISIONS)
    out = ex_app.applied(df, decisions)
    sel = out[out["resp_id"] == resp_id].iloc[0]
    row = {"resp_id": resp_id, "company": sel.get("R_Company_Name"),
           "rdiv": sel.get("R_Div"), "excluded": bool(sel["excluded_from_kim"]),
           "reason": "", "key": resp_id}
    return templates.TemplateResponse(request, "_exclude_row.html", {
        "row": row, "counts": ex_app.counts(df, decisions), "oob": True,
    })


# ── 산출/미리보기 (설계 §1 데이터 흐름) ────────────────────────────
@app.get("/build", response_class=HTMLResponse)
def build_page(request: Request):
    meta, decisions = store.load(DECISIONS)
    return templates.TemplateResponse(request, "build.html", {
        "tabs": TABS, "n_decisions": len(decisions),
        "status": bd.output_status(meta, kim_out=bd.KIM_OUT, chart_out=bd.CHART_OUT),
    })


@app.post("/build/run", response_class=HTMLResponse)
def build_run(request: Request):
    meta, decisions = store.load(DECISIONS)
    result = bd.run(DATA, decisions,
                    snap=bd.SNAPSHOT, kim_out=bd.KIM_OUT, chart_out=bd.CHART_OUT)
    return templates.TemplateResponse(request, "_build_result.html", {
        "result": result, "status": bd.output_status(meta),
    })


@app.get("/{slug}", response_class=HTMLResponse)
def tab_stub(request: Request, slug: str):
    label = dict((s, l) for s, l, _ in TABS).get(slug, slug)
    return templates.TemplateResponse(
        request, "stub.html", {"tabs": TABS, "slug": slug, "label": label})
