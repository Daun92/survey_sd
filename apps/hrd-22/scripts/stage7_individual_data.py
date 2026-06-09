"""[단계 7-개별] 개별 응답자 벤치마크 데이터 빌더 — 22회.

각 완료 응답자(1행) 본인 집계 + 귀속 프레임 비교:
  · 전체 기업 (공공 응답자는 공공 전체)
  · 동일 규모군 (인력규모 5구간; 공공은 미적용)
  · 동일 업종 (R_Cate → segments.yaml column_groups id:1; 재분류 후 자동 충실)

§2(handoff) 분기 — 1행 집계는 agg 별 의미가 다름:
  · mean·macro·tenure_ym·likert·likert_iv·mean_pct(_cf) = 본인 '수치' → 프레임 평균과 수치 델타.
  · dist·multi_rate·dist_multi·issue_*               = 본인 '선택'(분모 1이라 분포 아님)
                                                       → 내 선택 + 프레임의 그 선택 비율(또래 비중).

재사용:
  · segment_aggregate.aggregate_segment / aggregate_question / load_questions / Codebook
  · stage5_render_html.compute_page_data, num
  · stage5_render_segment_report.build_segments / extract_headline / HEADLINE
  · config/segments.yaml (규모·업종 라벨 마스터)

본인↔프레임 추출은 이 레이어에서 마무리한다(렌더러는 결과만 표시).

사용(단독 sanity):
    python scripts/stage7_individual_data.py --rid R01           # 한 응답자 레코드 덤프
    python scripts/stage7_individual_data.py --list             # 응답자 목록
"""
from __future__ import annotations

import argparse
import io
import json
import sys
import warnings
from pathlib import Path

import pandas as pd
import yaml

# 1행 집계 시 전부 NaN 컬럼 평균 → numpy 'Mean of empty slice' (무해). 억제.
warnings.filterwarnings("ignore", message="Mean of empty slice", category=RuntimeWarning)
warnings.filterwarnings("ignore", message="invalid value encountered", category=RuntimeWarning)

sys.path.insert(0, str(Path(__file__).resolve().parent))
from segment_aggregate import Codebook, aggregate_segment, load_questions   # noqa: E402
from stage5_render_html import compute_page_data, num                        # noqa: E402
from stage5_render_segment_report import build_segments, extract_headline    # noqa: E402

if __name__ == "__main__" and sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
SEGMENTS_YAML = ROOT / "config" / "segments.yaml"
DEFAULT_SRC = ROOT / "2_validated" / "raw_validated.xlsx"

SMALL_N = 10                       # 또래 프레임 소표본 임계 (세그먼트 리포트와 동일)
EMP_COL = "p1)R_1_2_2"
PEREMP_CEIL = 1000                 # 1인당 교육비(만원/명) 타당성 상한 — 초과 시 분모 입력오류 의심·보류
                                   # (현 데이터 정상 최고 ~293만원, 다음 이상치 27,000만원 → 사이 안전)

# agg 분류 (§2)
NUMERIC_AGGS = {"macro", "mean", "tenure_ym", "likert", "likert_iv", "mean_pct", "mean_pct_cf"}
SELECTION_AGGS = {"dist", "multi_rate", "dist_multi", "issue_rank", "issue_multi"}

# 식별 컬럼
ID_COLS = {
    "company": "R_Company_Name", "name": "R_Name", "position": "R_Position",
    "email": "R_Email", "div": "R_Div", "cate": "R_Cate",
}
DIV_LABEL = {1: "대기업", 2: "중기업", 3: "소기업", 4: "공공기관", 5: "학교"}


# ─────────────────────────────────────────────
# 라벨 헬퍼 (segments.yaml)
# ─────────────────────────────────────────────

def _size_group(seg_yaml: dict):
    return next(g for g in seg_yaml["column_groups"] if g.get("id") == 2)


def _industry_group(seg_yaml: dict):
    return next(g for g in seg_yaml["column_groups"] if g.get("id") == 1)


def size_label(emp, seg_yaml: dict) -> str | None:
    """직원수 → 규모 구간 라벨 (id:2 bins). 결측·범위밖이면 None."""
    e = pd.to_numeric(pd.Series([emp]), errors="coerce").iloc[0]
    if pd.isna(e):
        return None
    g = _size_group(seg_yaml)
    bins, labels = g["bins"], g["labels"]
    for i, lab in enumerate(labels):
        lo = bins[i]
        hi = bins[i + 1]
        if (lo is None or e >= lo) and (hi is None or e < hi):
            return lab
    return None


def industry_label(rcate, seg_yaml: dict) -> str | None:
    """R_Cate 코드 → 업종 라벨. 'etc'/미분류/공란은 None(미분류)."""
    s = "" if rcate is None else str(rcate).strip()
    if s == "" or s.lower() == "nan" or s == "etc":
        return None                       # etc(기업기타)·미분류는 업종 또래 비교 보류
    opts = _industry_group(seg_yaml).get("options", {})
    return opts.get(s)                    # 코드(str) → 라벨, 없으면 None


# ─────────────────────────────────────────────
# 프레임 캐시
# ─────────────────────────────────────────────

class FrameCache:
    """프레임 df 1회 집계 캐시. 응답자 50명이 공유."""

    def __init__(self, df: pd.DataFrame, seg_yaml: dict, cb: Codebook, questions: list[dict]):
        self.df = df
        self.seg_yaml = seg_yaml
        self.cb = cb
        self.questions = questions

        segs = build_segments(df, seg_yaml)        # 전체/규모5/공공조직 (+enabled시 업종)
        self.seg_by_name = {s["name"]: s for s in segs}
        self.corp_df = self.seg_by_name["전체"]["df"]
        self.public_df = self.seg_by_name["공공조직"]["df"]

        # 업종 프레임 — enabled 플래그와 무관하게 R_Cate 코드별로 구성(개별 리포트는 항상 본인 업종 앎)
        cate = self.corp_df[ID_COLS["cate"]].astype(str).str.strip()
        ig = _industry_group(seg_yaml)
        self.industry_codes: dict[str, list[str]] = {}      # 라벨 → 코드 리스트
        for code, lab in ig.get("options", {}).items():
            if lab == "기업기타":
                continue
            self.industry_codes.setdefault(lab, []).append(str(code))
        self.industry_df: dict[str, pd.DataFrame] = {}
        for lab, codes in self.industry_codes.items():
            sub = self.corp_df[cate.isin(codes)]
            if len(sub):
                self.industry_df[lab] = sub.copy()

        # 집계 캐시 (lazy)
        self._agg: dict[str, dict] = {}
        self._hl: dict[str, dict] = {}

    # 프레임 df 조회
    def df_for(self, key: str) -> pd.DataFrame | None:
        if key == "corp":
            return self.corp_df
        if key == "public":
            return self.public_df
        if key.startswith("size:"):
            return self.seg_by_name.get(key[5:], {}).get("df")
        if key.startswith("ind:"):
            return self.industry_df.get(key[4:])
        return None

    def agg_for(self, key: str) -> dict | None:
        if key not in self._agg:
            d = self.df_for(key)
            self._agg[key] = aggregate_segment(d, self.questions, self.cb) if d is not None else None
        return self._agg[key]

    def hl_for(self, key: str) -> dict | None:
        if key not in self._hl:
            d = self.df_for(key)
            self._hl[key] = extract_headline(compute_page_data(d)) if d is not None and len(d) else None
        return self._hl[key]

    def n_for(self, key: str) -> int:
        d = self.df_for(key)
        return int(len(d)) if d is not None else 0


# ─────────────────────────────────────────────
# 헤드라인(파생) 수치 — peremp·rev 는 compute_page_data 파생에만 존재
# ─────────────────────────────────────────────

HEADLINE_NUMERIC = [
    ("peremp", "1인당 교육비", "만원", "more",
     lambda hl: hl.get("peremp")),
    # 매출대비 교육비(%)는 0.0x% 수준이라 식별 어려움 → '매출 1억원당 교육비(만원)'로 환산(=% × 100).
    # 비율 비교라 평가(델타) 방향은 단위 환산과 무관.
    ("rev", "매출 1억원당 교육비", "만원", "more",
     lambda hl: (hl.get("rev") * 100) if hl.get("rev") is not None else None),
]


def _r(v, nd=2):
    if v is None:
        return None
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    return round(float(v), nd)


# ─────────────────────────────────────────────
# 본인↔프레임 비교 추출 (agg 별)
# ─────────────────────────────────────────────

def _numeric_items(me_q: dict, frame_qs: dict[str, dict]) -> list[dict]:
    """mean/macro/tenure/likert/likert_iv/mean_pct(_cf) → 항목별 본인값 + 프레임 평균.

    frame_qs: {frameKey: aggregate_question_result(같은 q) | None}
    항목 정렬은 동일 questions/cb 라 프레임 간 인덱스 일치.
    """
    agg = me_q["agg"]
    me_items = me_q["data"].get("items", [])

    def val(item):
        # agg 별 '대표 수치' 키
        if agg == "tenure_ym":
            return item.get("mean_years")
        if agg in ("mean_pct",):
            return item.get("pct")
        return item.get("mean")            # macro/mean/likert/likert_iv(duo)

    if agg == "mean_pct_cf":
        # 현재/향후 페어 — 본 개별 리포트 핵심에선 미사용(데이터만 보존). cur 값으로 표기.
        def val_cf(item):
            return item.get("cur")
        getval = val_cf
    elif agg == "likert_iv" and me_q["data"].get("mode") == "pairs":
        # 중요도/수행도 페어 — imp_mean 대표(수행도는 별도 항목 필요시 확장)
        def val_iv(item):
            return item.get("imp_mean")
        getval = val_iv
    else:
        getval = val

    out = []
    for k, mi in enumerate(me_items):
        row = {"label": mi.get("label"), "me": _r(getval(mi))}
        frames = {}
        for fk, fq in frame_qs.items():
            fv = None
            if fq is not None:
                fitems = fq["data"].get("items", [])
                if k < len(fitems):
                    fv = _r(getval(fitems[k]))
            frames[fk] = fv
        row["frames"] = frames
        row["delta"] = {fk: (_r(row["me"] - fv) if (row["me"] is not None and fv is not None) else None)
                        for fk, fv in frames.items()}
        out.append(row)
    return out


def _selection(me_q: dict, frame_qs: dict[str, dict]) -> dict:
    """dist/multi_rate/dist_multi/issue_* → 본인 선택 + 프레임 선택비율."""
    agg = me_q["agg"]

    # 본인 선택 라벨 (분모 1)
    me_labels: list[str] = []
    if agg in ("dist", "multi_rate"):
        for it in me_q["data"].get("items", []):
            if (it.get("count") or 0) >= 1 and it.get("label") != "무응답":
                me_labels.append(it["label"])
    elif agg == "dist_multi":
        # 다항목 각 단일선택 → '실시중'인 항목 라벨
        for it in me_q["data"].get("items", []):
            impl = it.get("impl_rate") or 0
            if impl >= 100:
                me_labels.append(it["label"])
    elif agg == "issue_rank":
        for t in me_q["data"].get("themes", []):
            me_labels.append(t["label"])
    elif agg == "issue_multi":
        for it in me_q["data"].get("items", []):
            me_labels.append(it["label"])

    # 프레임별 라벨→비율 맵
    def peer_map(fq):
        if fq is None:
            return None
        d = fq["data"]
        if agg in ("dist", "multi_rate"):
            return {it["label"]: it.get("pct") for it in d.get("items", [])}
        if agg == "dist_multi":
            return {it["label"]: it.get("impl_rate") for it in d.get("items", [])}
        if agg == "issue_rank":
            return {t["label"]: t.get("mention_pct") for t in d.get("themes", [])}
        if agg == "issue_multi":
            return {it["label"]: it.get("pct") for it in d.get("items", [])}
        return {}

    peer = {fk: peer_map(fq) for fk, fq in frame_qs.items()}
    return {"me": me_labels, "peer": peer}


def _dist_multi_detail(me_q: dict, frame_qs: dict[str, dict]) -> list[dict]:
    """dist_multi(제도 현황) → 제도별 본인 상태 + 프레임 실시율. 갭 차트용."""
    out = []
    me_items = me_q["data"].get("items", [])
    for k, mi in enumerate(me_items):
        me_status = next((x["label"] for x in mi.get("dist", [])
                          if (x.get("count") or 0) >= 1 and x.get("label") != "무응답"), None)
        peer_impl = {}
        for fk, fq in frame_qs.items():
            v = None
            if fq is not None:
                fitems = fq["data"].get("items", [])
                if k < len(fitems):
                    v = fitems[k].get("impl_rate")
            peer_impl[fk] = v
        out.append({"label": mi.get("label"), "me_status": me_status, "peer_impl": peer_impl})
    return out


# ─────────────────────────────────────────────
# 응답자 레코드
# ─────────────────────────────────────────────

def respondent_frames(row: pd.Series, fc: FrameCache, seg_yaml: dict) -> dict:
    """응답자 → 적용 프레임 키·라벨·N. 기업: corp/size/ind. 공공: public 만."""
    div = pd.to_numeric(pd.Series([row.get(ID_COLS["div"])]), errors="coerce").iloc[0]
    is_public = bool(div in (4, 5))
    frames: dict[str, dict] = {}
    if is_public:
        frames["overall"] = {"key": "public", "label": "공공 전체", "n": fc.n_for("public")}
        # 규모·업종은 공공 미적용
        frames["size"] = None
        frames["industry"] = None
    else:
        frames["overall"] = {"key": "corp", "label": "전체 기업", "n": fc.n_for("corp")}
        slab = size_label(row.get(EMP_COL), seg_yaml)
        if slab:
            k = f"size:{slab}"
            n = fc.n_for(k)
            frames["size"] = {"key": k, "label": f"{slab} 규모군", "n": n, "small": n < SMALL_N}
        else:
            frames["size"] = None
        ilab = industry_label(row.get(ID_COLS["cate"]), seg_yaml)
        if ilab and ilab in fc.industry_df:
            k = f"ind:{ilab}"
            n = fc.n_for(k)
            frames["industry"] = {"key": k, "label": f"{ilab} 업종", "n": n, "small": n < SMALL_N}
        else:
            frames["industry"] = None       # 미분류(etc/공란) 또는 해당 코드 표본 0
    return {"is_public": is_public, "frames": frames}


def build_record(rid: str, idx, df: pd.DataFrame, fc: FrameCache,
                 seg_yaml: dict, cb: Codebook, questions: list[dict]) -> dict:
    row = df.loc[idx]
    row_df = df.loc[[idx]]

    fr = respondent_frames(row, fc, seg_yaml)
    frames = fr["frames"]
    # 적용되는 프레임 키 (None 제외)
    frame_keys = {fslot: f["key"] for fslot, f in frames.items() if f}

    # 본인 집계
    me_agg = aggregate_segment(row_df, questions, cb)
    me_hl = extract_headline(compute_page_data(row_df))

    # 식별
    def gv(k):
        v = row.get(ID_COLS[k])
        return None if (v is None or (isinstance(v, float) and pd.isna(v))) else str(v).strip()

    div = pd.to_numeric(pd.Series([row.get(ID_COLS["div"])]), errors="coerce").iloc[0]
    identity = {
        "rid": rid,
        "company": gv("company"), "name": gv("name"), "position": gv("position"),
        "email": gv("email"),
        "div_label": DIV_LABEL.get(int(div)) if pd.notna(div) else None,
        "emp": _r(num(pd.Series([row.get(EMP_COL)])).iloc[0], 0),
        "size_label": size_label(row.get(EMP_COL), seg_yaml),
        "industry_label": industry_label(row.get(ID_COLS["cate"]), seg_yaml),
        "is_public": fr["is_public"],
    }

    # 입력 타당성 가드 (본인값만 보류; 프레임 중앙값은 이상치에 강건하므로 유지).
    #  (a) 매출 < 교육집행/예산 → 논리적 불가(입력 오류) → 매출대비 지표 보류. 예: (주)오스템 매출='1'원.
    #  (b) 1인당 교육비 > 1,000만원/명 → 분모(교육대상직원수) 입력 오류 의심. 예: 크나우프 교육대상='1'명.
    _rev = num(pd.Series([row.get("p1)R_1_1_2")])).iloc[0]
    _spend = num(pd.Series([row.get("p1)R_1_5_2")])).iloc[0]
    _bud = num(pd.Series([row.get("p1)R_1_4_2")])).iloc[0]
    _tgt = num(pd.Series([row.get("p1)R_1_3_2")])).iloc[0]
    rev_present = _rev is not None and not pd.isna(_rev) and _rev > 0
    floors = [x for x in (_spend, _bud) if x is not None and not pd.isna(x)]
    rev_bad = bool(rev_present and floors and _rev < max(floors))
    flags = {"rev_bad": rev_bad, "rev_raw": (None if not rev_present else float(_rev)),
             "peremp_bad": False, "peremp_raw": None,
             "tgt_raw": (None if (_tgt is None or pd.isna(_tgt)) else float(_tgt))}

    # 헤드라인 수치 (peremp·rev)
    headline = []
    for key, label, unit, polarity, fn in HEADLINE_NUMERIC:
        me_v = _r(fn(me_hl))
        if key == "rev" and rev_bad:        # 매출 입력 오류 → 본인값 보류(프레임은 유지)
            me_v = None
        if key == "peremp" and me_v is not None and me_v > PEREMP_CEIL:  # 1인당 교육비 비정상
            flags["peremp_bad"] = True
            flags["peremp_raw"] = me_v
            me_v = None
        fvals, dvals = {}, {}
        for fslot, fkey in frame_keys.items():
            fhl = fc.hl_for(fkey)
            fv = _r(fn(fhl)) if fhl else None
            fvals[fslot] = fv
            dvals[fslot] = _r(me_v - fv) if (me_v is not None and fv is not None) else None
        headline.append({"key": key, "label": label, "unit": unit, "polarity": polarity,
                         "me": me_v, "frames": fvals, "delta": dvals})

    # 문항별
    questions_out = {}
    for q in questions:
        qid = q["id"]
        me_q = me_agg[qid]
        agg = me_q["agg"]
        frame_qs = {fslot: (fc.agg_for(fkey) or {}).get(qid) for fslot, fkey in frame_keys.items()}
        base = {"title": me_q["title"], "page": me_q["page"], "agg": agg, "html": me_q.get("html")}
        if agg in NUMERIC_AGGS:
            base["kind"] = "numeric"
            base["items"] = _numeric_items(me_q, frame_qs)
            base["unit"] = me_q["data"].get("unit", "")
        elif agg in SELECTION_AGGS:
            base["kind"] = "selection"
            sel = _selection(me_q, frame_qs)
            base["me"] = sel["me"]
            base["peer"] = sel["peer"]
            if agg == "dist_multi":
                base["systems"] = _dist_multi_detail(me_q, frame_qs)
        else:
            base["kind"] = "other"
        questions_out[qid] = base

    return {"identity": identity, "frames": frames, "flags": flags,
            "headline": headline, "questions": questions_out}


# ─────────────────────────────────────────────
# 완료 응답자 → 레코드 일괄
# ─────────────────────────────────────────────

def assign_rids(df: pd.DataFrame) -> list[tuple[str, object]]:
    """안정적 식별자 R01.. — 이메일(없으면 인덱스) 정렬 순. (rid, df_index)."""
    key = df[ID_COLS["email"]].astype(str).fillna("")
    order = key.sort_values(kind="stable").index.tolist()
    return [(f"R{i + 1:02d}", idx) for i, idx in enumerate(order)]


def build_all(df: pd.DataFrame, seg_yaml: dict) -> dict:
    cb = Codebook()
    questions = load_questions()
    fc = FrameCache(df, seg_yaml, cb, questions)
    rids = assign_rids(df)
    records = {}
    for rid, idx in rids:
        records[rid] = build_record(rid, idx, df, fc, seg_yaml, cb, questions)
    return {"records": records, "order": [r for r, _ in rids],
            "n_total": len(df), "n_corp": fc.n_for("corp"), "n_public": fc.n_for("public")}


# ─────────────────────────────────────────────
# CLI (sanity)
# ─────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, default=DEFAULT_SRC)
    ap.add_argument("--src-sheet", default="Sheet1")
    ap.add_argument("--rid", default=None, help="한 응답자 레코드 덤프")
    ap.add_argument("--list", action="store_true", help="응답자 목록")
    ap.add_argument("--out", type=Path, default=None, help="전체 JSON 덤프")
    args = ap.parse_args()

    seg_yaml = yaml.safe_load(SEGMENTS_YAML.read_text(encoding="utf-8"))
    df = pd.read_excel(args.src, sheet_name=args.src_sheet, dtype=object)
    data = build_all(df, seg_yaml)

    print(f"완료 {data['n_total']} · 기업 {data['n_corp']} · 공공 {data['n_public']} · 응답자 {len(data['order'])}명")

    if args.list:
        for rid in data["order"]:
            it = data["records"][rid]["identity"]
            fr = data["records"][rid]["frames"]
            sz = fr["size"]["label"] if fr["size"] else "—"
            ind = fr["industry"]["label"] if fr["industry"] else "—"
            print(f"  {rid}  {it['company'][:16]:16s} {it.get('div_label') or '?':6s} 규모={sz:12s} 업종={ind}")

    if args.rid:
        rec = data["records"].get(args.rid)
        if not rec:
            print(f"⚠ {args.rid} 없음")
            return 1
        print(f"\n=== {args.rid} {rec['identity']['company']} ===")
        print("식별:", json.dumps(rec["identity"], ensure_ascii=False))
        print("프레임:", json.dumps(rec["frames"], ensure_ascii=False))
        print("\n헤드라인 수치:")
        for h in rec["headline"]:
            print(f"  {h['label']:14s} 본인={h['me']} 프레임={h['frames']} Δ={h['delta']}")
        print("\n핵심 분포 문항(본인 선택 + 또래 비중):")
        for qid in ("budget_chg", "ai_ratio", "ai_strategy", "ai_stage", "ai_target"):
            q = rec["questions"].get(qid)
            if not q:
                continue
            print(f"  [{qid}] {q['title']} ({q['agg']})")
            print(f"    내 선택: {q.get('me')}")
            for fk, pm in (q.get("peer") or {}).items():
                if pm is None:
                    continue
                shown = {lab: pm.get(lab) for lab in (q.get("me") or [])}
                print(f"    또래 {fk}: 내 선택의 비율={shown}")
        print("\n핵심 수치 문항:")
        for qid in ("edu_time", "satisfaction"):
            q = rec["questions"].get(qid)
            if not q:
                continue
            print(f"  [{qid}] {q['title']} ({q['agg']})")
            for it in q.get("items", []):
                print(f"    {it['label'][:18]:18s} 본인={it['me']} 프레임={it['frames']} Δ={it['delta']}")

    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"\nJSON 덤프: {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
