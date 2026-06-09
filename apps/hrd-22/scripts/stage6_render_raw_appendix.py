"""[단계 6-부록] 완료 응답자 원자료 응답 상세 부록 (HTML) — 22회.

상세 응답여부 확인용 내부 참고. 두 부분:
  ① 응답 커버리지 매트릭스 — 행=완료 응답자, 열=설문 섹션(Ⅰ~Ⅴ)+전체, 셀=응답률 히트맵.
     · 분모 = '해당(applicable) 칸'(미해당 제외). 누락·이상 칸수를 별도 열로 표기.
  ② 원본 응답 시트(드롭다운) — 선택 응답자의 전 문항을 4가지로 구분 표기:
       정상 / 이상(엉터리, stage2 이상치 규칙) / 누락(필수인데 패싱) / 미해당(자연 무응답, 분기/기타/0%).

빈칸 분류 모델(50명 실측 검증):
  · 미해당(생략)  : ①_etc 기타 미선택 ②연수시설 수용규모←보유=없음 ③아웃소싱 항목·비용←경험=없음
                   ④원격교육 6-2~6-5←실행=없음 ⑤자사 이러닝 주제←자체개발=없음
                   ⑥합계형 비율의 0% 칸 ⑦증/감 이유·증감율(변동 없음) ⑧매트릭스 '기타' 칸
  · 누락(강조)    : 전원 응답하는 필수 문항인데 공백(거시지표·경영층/제도/중요도·수행도 척도·단일선택·게이트 ON 조건문항)
  · 이상(강조)    : config/outlier_rules.yaml 규칙 적용(stage2_flag_outliers 재사용)

PII: 연락처(이메일·전화·사업자번호·주소)는 제외(분석가 결정). 행 라벨=회사·이름·직책.

데이터: 2_validated/raw_validated.xlsx + 코드북(segment_aggregate.Codebook). RID=stage7 assign_rids.
사용: python scripts/stage6_render_raw_appendix.py
"""
from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path

import pandas as pd
import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from design_tokens import TOKENS_CSS                       # noqa: E402
from segment_aggregate import Codebook                      # noqa: E402
from stage7_individual_data import assign_rids              # noqa: E402
import stage2_flag_outliers as s2                           # noqa: E402  (이상치 규칙 재사용)

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

DEFAULT_SRC = ROOT / "2_validated" / "raw_validated.xlsx"
DEFAULT_OUT = ROOT / "5_report" / "preview" / "raw_appendix_22th.html"
DEFAULT_RULES = ROOT / "config" / "outlier_rules.yaml"

SECTIONS = [("p1", "Ⅰ", "교육 관련"), ("p2", "Ⅱ", "HRD 현황"),
            ("p3", "Ⅲ", "HRD 활동"), ("p4", "Ⅳ", "HRD 이슈"), ("p5", "Ⅴ", "AI 도입·활용")]
DIV_LABEL = {1: "대기업", 2: "중기업", 3: "소기업", 4: "공공기관", 5: "학교"}


def _blank(v) -> bool:
    return v is None or (isinstance(v, float) and pd.isna(v)) or str(v).strip().lower() in ("", "nan")


def _fmt_val(v) -> str:
    if _blank(v):
        return ""
    s = str(v).strip()
    # 순수 정수면 천단위 구분(가독성). 그 외 원본 그대로.
    try:
        if s.lstrip("-").isdigit() and abs(int(s)) >= 10000:
            return f"{int(s):,}"
    except ValueError:
        pass
    return s


def _section_cols(df_cols) -> dict:
    return {p: [c for c in df_cols if c.startswith(p + ")")] for p, _, _ in SECTIONS}


def _heat(pct: float) -> str:
    """응답률 → 배경색(녹색 농도). 0=옅음, 100=진함."""
    return f"color-mix(in srgb, var(--exc-green) {round(pct * 0.6)}%, white)"


# ─────────────────────────────────────────────
# 빈칸 분류 모델 (50명 실측 검증)
# ─────────────────────────────────────────────

# 조건문항 게이트: target_col → (gate_col, {게이트 ON 코드}, 미해당 사유)
GATES = {
    "p2)R_7_multi":  ("p2)R_6_multi",  {"2"}, "연수시설 미보유"),
    "p2)R_13_multi": ("p2)R_12_multi", {"1"}, "아웃소싱 경험 없음"),
    "p2)R_14_1_2":   ("p2)R_12_multi", {"1"}, "아웃소싱 경험 없음"),
    "p3)R_8_multi":  ("p3)R_6_multi",  {"1"}, "원격교육 미실행"),
    "p3)R_9_multi":  ("p3)R_6_multi",  {"1"}, "원격교육 미실행"),
    "p3)R_10_multi": ("p3)R_6_multi",  {"1"}, "원격교육 미실행"),
    "p3)R_13_multi": ("p3)R_12_multi", {"1"}, "이러닝 자체개발 안 함"),
}
# prefix 기반 게이트(원격 위탁 형태 비율 6-2 = p3)R_7_*)
GATE_PREFIX = [
    ("p3)R_7_", "p3)R_6_multi", {"1"}, "원격교육 미실행"),
]
# 빈칸이 곧 응답(미해당/변동없음)인 의미형 — 강조하지 않음
COND_BLANK = {
    "p1)R_2_n_2":   "동일(변동 없음)",
    "p1)R_3_multi": "변동 없음 / 감소",   # 증가 이유 — 증가한 경우만 해당
    "p1)R_4_multi": "변동 없음 / 증가",   # 감소 이유 — 감소한 경우만 해당
}
# cross_column 이상치를 표시할 대표 셀
CROSS_REP = {
    "ratio_budget_vs_revenue": "p1)R_1_5_2",
    "budget_exceeds_revenue":  "p1)R_1_5_2",
    "emp_revenue_mismatch":    "p1)R_1_1_2",
    "peremp_per_target":       "p1)R_1_3_2",
}
# 이상치 규칙 → 셀에 표기할 짧은 사유
SHORT_NOTE = {
    "매출_단위의심_과소": "매출 단위 의심(과소)",
    "매출_단위의심_과대": "매출 단위 의심(과대)",
    "매출_무응답": "매출 0 입력",
    "교육예산_단위의심_과소": "교육비 단위 의심(과소)",
    "교육예산_단위의심_과대": "교육비 단위 의심(과대)",
    "교육예산_무응답": "교육비 0 입력",
    "인원수_비정상": "인원수 비정상",
    "ratio_budget_vs_revenue": "매출대비 교육비 과다",
    "budget_exceeds_revenue": "교육비>매출 (단위 오류)",
    "emp_revenue_mismatch": "인당 매출 범위 이탈",
    "peremp_per_target": "1인당 교육비 과다(교육대상 의심)",
    "many_zeros": "거시지표 다수 0",
}


def _codes(v) -> set:
    if _blank(v):
        return set()
    return set(str(v).replace(" ", "").split(","))


def _kita_code(fmt: str):
    """응답형식에서 '기타' 옵션 코드 추출 (예: '6=기타' → '6')."""
    for part in str(fmt).split(","):
        if "=" in part:
            k, val = part.split("=", 1)
            if "기타" in val:
                return k.strip()
    return None


def _kind(fmt: str) -> str:
    f = str(fmt).strip()
    if f == "숫자(%)":
        return "pct"
    if "척도" in f:
        return "scale"
    if f.startswith("숫자") or "년-월" in f:
        return "num"
    if "=" in f:                       # 코드 목록(단일/복수 선택)
        return "cat"
    return "text"                      # 텍스트·형식 등


def _is_kita_sub(sub: str) -> bool:
    return str(sub).strip().startswith("기타")


def _num0(v) -> bool:
    try:
        return float(str(v).strip().replace(",", "")) == 0
    except (ValueError, AttributeError):
        return False


class Classifier:
    """응답자×문항 셀을 정상/이상/누락/미해당으로 분류."""

    def __init__(self, df: pd.DataFrame, cb: Codebook, rules: dict):
        self.df = df
        self.cb = cb
        self.rows = cb.rows
        self.cols = set(df.columns)
        self._cache: dict = {}
        # 합계형(%) 그룹: (question, layer) → [cols]
        self.col_group: dict = {}
        groups: dict = {}
        for c in df.columns:
            meta = self.rows.get(c)
            if not meta or _kind(meta.get("fmt", "")) != "pct":
                continue
            # 현재/향후 매트릭스만 layer 분리(끝자리 _3/_4 는 항목 인덱스일 수 있어 sub_item 으로 판정).
            sub = meta.get("sub", "")
            layer = "현재" if "현재" in sub else ("향후" if "향후" in sub else "")
            gk = (meta.get("q", ""), layer)
            groups.setdefault(gk, []).append(c)
            self.col_group[c] = gk
        self.group_cols = groups
        self.outliers = self._build_outliers(rules)

    def _build_outliers(self, rules: dict) -> dict:
        flags = []
        flags += s2.apply_single_column_rules(self.df, rules.get("single_column_rules", []))
        flags += s2.apply_cross_column_rules(self.df, rules.get("cross_column_rules", []))
        flags += s2.apply_respondent_rules(self.df, rules.get("respondent_rules", []))
        out: dict = {}
        for f in flags:
            idx = f["row_idx"]
            rt = f["rule_type"]
            rid = f.get("rule_id", "")
            sev = f.get("severity", "medium")
            if rt == "single_column":
                cols = [f["column"]]
            elif rt == "cross_column":
                cols = [CROSS_REP.get(rid, f["column"].split("/")[0].strip())]
            else:  # respondent — 실제 0 인 거시지표 칸에만 부착
                cols = [c.strip() for c in str(f["column"]).split(",")
                        if c.strip() in self.df.columns and _num0(self.df.at[idx, c.strip()])]
            note = SHORT_NOTE.get(rid, f.get("note", "")[:24])
            for c in cols:
                out.setdefault((idx, c), []).append((sev, note))
        return out

    def _etc_parent(self, col: str):
        base = col[:-4]                       # '_etc' 제거
        if col == "p4)R_4_6_etc":
            return ("p4)R_4_n_3_rad", "multi")
        if base + "_multi" in self.cols:
            return (base + "_multi", "multi")
        if base + "_3" in self.cols:          # 매트릭스 '기타' 항목
            return (base + "_3", "sibling")
        return (None, None)

    def classify(self, idx, col):
        """→ (status, sev, note). status ∈ {ok, outlier, missing, na}."""
        key = (idx, col)
        if key in self._cache:
            return self._cache[key]
        res = self._classify(idx, col)
        self._cache[key] = res
        return res

    def _classify(self, idx, col):
        meta = self.rows.get(col, {})
        fmt = meta.get("fmt", "")
        sub = meta.get("sub", "")
        v = self.df.at[idx, col] if col in self.cols else None

        # ── 값 있음 ──
        if not _blank(v):
            ol = self.outliers.get((idx, col))
            if ol:
                sev = "crit" if any(s in ("critical", "high") for s, _ in ol) else "warn"
                note = " · ".join(dict.fromkeys(n for _, n in ol))
                return ("outlier", sev, note)
            return ("ok", "", "")

        # ── 빈칸 ──
        if col in COND_BLANK:
            return ("na", "", COND_BLANK[col])

        if col.endswith("_etc"):
            parent, mode = self._etc_parent(col)
            if parent is None:
                return ("na", "", "자유입력 미작성")
            pv = self.df.at[idx, parent] if parent in self.cols else None
            if mode == "multi":
                kc = _kita_code(self.rows.get(parent, {}).get("fmt", ""))
                if kc and kc in _codes(pv):
                    return ("missing", "", "'기타' 선택 후 미입력")
                return ("na", "", "기타 미선택")
            if not _blank(pv):                # sibling 매트릭스 '기타' 항목에 값 있음
                return ("missing", "", "기타 항목 입력했으나 설명 누락")
            return ("na", "", "기타 미사용")

        gate = GATES.get(col)
        if gate is None:
            for pre, gcol, allowed, note in GATE_PREFIX:
                if col.startswith(pre):
                    gate = (gcol, allowed, note)
                    break
        if gate:
            gcol, allowed, note = gate
            gv = str(self.df.at[idx, gcol]).strip() if gcol in self.cols else ""
            if gv not in allowed:
                return ("na", "", note)
            # 게이트 ON → 아래 kind 판정으로 진행(빈칸이면 누락)

        if _is_kita_sub(sub):
            return ("na", "", "기타 항목 미사용")

        k = _kind(fmt)
        if k == "pct":
            gk = self.col_group.get(col)
            if gk and any(not _blank(self.df.at[idx, c]) for c in self.group_cols[gk]):
                return ("na", "", "0% / 해당 없음")
            return ("missing", "", "비율 미입력")
        if k == "scale":
            return ("missing", "", "척도 미응답")
        if k == "num":
            return ("missing", "", "수치 미입력")
        if k == "cat":
            return ("missing", "", "미선택")
        if "_che" in col:                  # 이슈 A/B그룹 — 다른 그룹에서 선택 시 자연 공백
            return ("na", "", "해당 그룹 미선택")
        return ("na", "", "미입력")


# ─────────────────────────────────────────────
# ① 커버리지 매트릭스
# ─────────────────────────────────────────────

def render_matrix(df, rids, seccols, clf) -> str:
    head = "".join(f'<th>{rom}<small>{name}</small></th>' for _, rom, name in SECTIONS)
    rows = []
    for rid, idx in rids:
        r = df.loc[idx]
        co = "" if _blank(r.get("R_Company_Name")) else str(r.get("R_Company_Name")).strip()
        cells = []
        tot_resp = tot_app = tot_miss = tot_out = 0
        for p, _, _ in SECTIONS:
            resp = app = 0
            for c in seccols[p]:
                st, _, _ = clf.classify(idx, c)
                if st in ("ok", "outlier"):
                    resp += 1
                    app += 1
                elif st == "missing":
                    app += 1
                if st == "missing":
                    tot_miss += 1
                if st == "outlier":
                    tot_out += 1
            tot_resp += resp
            tot_app += app
            if app:
                pct = round(100 * resp / app)
                cells.append(f'<td style="background:{_heat(pct)}" title="{resp}/{app} 해당">{pct}<small>%</small></td>')
            else:
                cells.append('<td class="mx-none" title="해당 문항 없음">—</td>')
        opct = round(100 * tot_resp / tot_app) if tot_app else 0
        cells.append(f'<td class="mx-tot" title="{tot_resp}/{tot_app} 해당">{opct}<small>%</small></td>')
        cells.append(f'<td class="mx-cnt {"mx-miss" if tot_miss else ""}">{tot_miss or "·"}</td>')
        cells.append(f'<td class="mx-cnt {"mx-out" if tot_out else ""}">{tot_out or "·"}</td>')
        rows.append(
            f'<tr><td class="mx-co"><a href="#" data-rid="{rid}" class="mx-link">{co or "(미상)"}</a>'
            f'<span class="mx-rid">{rid}</span></td>{"".join(cells)}</tr>')
    return (
        '<table class="mx"><thead><tr><th class="mx-co">회사 <small>RID</small></th>'
        f'{head}<th class="mx-tot">전체</th>'
        '<th class="mx-cnt">누락</th><th class="mx-cnt">이상</th></tr></thead>'
        f'<tbody>{"".join(rows)}</tbody></table>')


# ─────────────────────────────────────────────
# ② 원본 응답 시트 (응답자별)
# ─────────────────────────────────────────────

def _cell_html(status, sev, note, v) -> tuple:
    """(row_class, value_html) 반환."""
    if status == "ok":
        return ("", _fmt_val(v))
    if status == "outlier":
        cls = "bad" if sev == "crit" else "warn-val"
        return (cls, f'{_fmt_val(v)} <span class="rs-warn">⚠ {note}</span>')
    if status == "missing":
        return ("miss", f'<span class="rs-miss">미응답</span>'
                        f'<span class="rs-note-in">{note}</span>')
    # na
    return ("na", f'<span class="rs-na-dot">·</span>'
                  f'<span class="rs-note-in">({note})</span>')


def render_sheets(df, rids, seccols, clf) -> str:
    secs = []
    for i, (rid, idx) in enumerate(rids):
        r = df.loc[idx]
        ident = [str(r.get(k)).strip() for k in ("R_Company_Name", "R_Position", "R_Name")
                 if not _blank(r.get(k))]
        div = pd.to_numeric(pd.Series([r.get("R_Div")]), errors="coerce").iloc[0]
        divl = DIV_LABEL.get(int(div)) if pd.notna(div) else ""
        blocks = []
        for p, rom, name in SECTIONS:
            n_resp = n_miss = n_out = n_na = 0
            trs = []
            for c in seccols[p]:
                v = r.get(c)
                status, sev, note = clf.classify(idx, c)
                if status == "ok":
                    n_resp += 1
                elif status == "outlier":
                    n_resp += 1
                    n_out += 1
                elif status == "missing":
                    n_miss += 1
                else:
                    n_na += 1
                rowcls, vhtml = _cell_html(status, sev, note, v)
                lab = clf.cb.sub(c)
                lab = lab if lab and lab != c else c
                trs.append(
                    f'<tr class="{rowcls}"><td class="rs-q">{lab}<small>{c}</small></td>'
                    f'<td class="rs-v">{vhtml}</td></tr>')
            chip = (f'<span class="cnt-resp">응답 {n_resp}</span>'
                    f'<span class="cnt-miss">누락 {n_miss}</span>'
                    f'<span class="cnt-out">이상 {n_out}</span>'
                    f'<span class="cnt-na">미해당 {n_na}</span>')
            blocks.append(
                f'<div class="rs-sec"><div class="rs-sec-h"><span class="rs-rom">{rom}</span>{name}'
                f'<span class="rs-chip">{chip}</span></div>'
                f'<table class="rs"><tbody>{"".join(trs)}</tbody></table></div>')
        secs.append(
            f'<section class="resp{" active" if i == 0 else ""}" data-rid="{rid}">'
            f'<div class="rs-head"><span class="rs-co">{" · ".join(ident) or "(미상)"}</span>'
            f'<span class="rs-meta">{divl} · {rid}</span></div>'
            f'{"".join(blocks)}</section>')
    options = "".join(
        f'<option value="{rid}">{rid} · '
        f'{("" if _blank(df.loc[idx].get("R_Company_Name")) else str(df.loc[idx].get("R_Company_Name")).strip())[:24]}</option>'
        for rid, idx in rids)
    return (f'<div class="rs-ctrl"><label>응답자 <select id="rs-sel">{options}</select></label>'
            f'<label class="rs-toggle"><input type="checkbox" id="rs-hide-na"> 미해당 칸 숨기기</label>'
            f'<span class="rs-note">🟠 누락 · 🔴 이상 · <span class="rs-na-dot">·</span> 미해당(흐리게)</span></div>'
            f'<div class="rs-wrap" id="rs-wrap">{"".join(secs)}</div>')


# ─────────────────────────────────────────────
# 조립
# ─────────────────────────────────────────────

def build(df, generated: str, rules: dict) -> str:
    cb = Codebook()
    clf = Classifier(df, cb, rules)
    rids = assign_rids(df)
    seccols = _section_cols(df.columns)
    matrix = render_matrix(df, rids, seccols, clf)
    sheets = render_sheets(df, rids, seccols, clf)
    js = """
(function(){
  const sel=document.getElementById('rs-sel');
  const wrap=document.getElementById('rs-wrap');
  const hide=document.getElementById('rs-hide-na');
  function show(rid){document.querySelectorAll('.resp').forEach(s=>s.classList.toggle('active',s.dataset.rid===rid));sel.value=rid;}
  sel.addEventListener('change',e=>show(e.target.value));
  hide.addEventListener('change',e=>wrap.classList.toggle('hide-na',e.target.checked));
  document.querySelectorAll('.mx-link').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();show(a.dataset.rid);document.getElementById('sheets').scrollIntoView({behavior:'smooth'});}));
  show(sel.value);
})();
"""
    return f"""<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>제22회 인재개발 실태조사 — 응답 상세 부록</title>
<style>{TOKENS_CSS}</style>
<style>{APP_CSS}</style>
</head><body>
<div class="wrap">
  <header class="ap-head">
    <div class="eyebrow">HRD Survey · 제22회 · 부록 (내부 참고)</div>
    <h1>응답 상세 부록</h1>
    <p class="sub">완료 {len(df)}명 원자료 · 상세 응답여부 확인용. <a href="./index.html">← 종합 허브</a></p>
  </header>
  <div class="ap-caveat">각 칸을 <b>정상 / <span class="lg-miss">누락(패싱)</span> / <span class="lg-out">이상(엉터리)</span> /
    <span class="lg-na">미해당(자연 무응답)</span></b> 로 구분합니다. <b>미해당</b>은 분기·조건·기타·0% 등 비우는 것이 자연스러운 칸이며,
    <b>누락</b>은 전원 응답하는 필수 문항인데 비어 있는 칸, <b>이상</b>은 이상치 규칙에 걸린 값입니다.
    <b>내부 참고용</b> · 연락처(이메일·전화·사업자번호·주소) 제외.</div>

  <section class="ap-sec"><h2 class="ap-h"><span class="ap-n">①</span> 응답 커버리지 매트릭스
    <small>셀=섹션 응답률(분모=해당 칸, 미해당 제외) · 회사명 클릭 시 원본 시트로</small></h2>
    <div class="mx-scroll">{matrix}</div></section>

  <section class="ap-sec" id="sheets"><h2 class="ap-h"><span class="ap-n">②</span> 원본 응답 시트
    <small>응답자 선택 → 전 문항 원본값 (누락·이상 강조, 미해당 생략)</small></h2>
    {sheets}</section>

  <footer class="ap-foot">생성 {generated} · EXC · HRD Survey 2027 · 내부 참고용 원자료 부록</footer>
</div>
<script>{js}</script>
</body></html>"""


APP_CSS = """
* { box-sizing: border-box; }
html, body { background: var(--exc-panel); }
body { margin: 0; font-family: var(--font-sans); color: var(--exc-ink); }
.wrap { max-width: 1100px; margin: 0 auto; padding: var(--space-9) var(--space-6) var(--space-12); }
.ap-head { margin-bottom: var(--space-4); }
.ap-head .eyebrow { font-size: var(--fs-micro); font-weight: var(--fw-bold); letter-spacing: .08em;
  text-transform: uppercase; color: var(--ai-dusk); margin-bottom: var(--space-2); }
.ap-head h1 { font-size: var(--fs-h1); font-weight: var(--fw-xbold); margin: 0; letter-spacing: var(--ls-tight); }
.ap-head .sub { font-size: var(--fs-body-sm); color: var(--exc-muted); margin: var(--space-2) 0 0; }
.ap-head .sub a { color: var(--ai-dusk); text-decoration: none; font-weight: var(--fw-semi); }
.ap-caveat { background: var(--exc-bg);
  border: 1px solid var(--exc-line); border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4); font-size: var(--fs-caption); color: var(--exc-ink-2);
  line-height: 1.7; margin-bottom: var(--space-6); }
.ap-caveat b { color: var(--exc-ink); }
.lg-miss { color: #9a6a00; }
.lg-out { color: var(--exc-red); }
.lg-na { color: var(--exc-muted-2); }
.ap-sec { margin-bottom: var(--space-8); }
.ap-h { font-size: var(--fs-h3); font-weight: var(--fw-xbold); margin: 0 0 var(--space-4);
  display: flex; align-items: baseline; gap: var(--space-3); padding-bottom: var(--space-2);
  border-bottom: 2px solid var(--exc-ink); }
.ap-h small { font-size: var(--fs-caption); color: var(--exc-muted-2); font-weight: var(--fw-regular); }
.ap-n { font-size: var(--fs-body-sm); color: var(--exc-bg); background: var(--ai-dusk);
  border-radius: var(--radius-pill); padding: 1px 9px; }

/* ① 매트릭스 */
.mx-scroll { overflow-x: auto; border: 1px solid var(--exc-line); border-radius: var(--radius-md); }
table.mx { border-collapse: collapse; width: 100%; font-size: var(--fs-caption); }
table.mx th, table.mx td { padding: 6px 10px; text-align: center; border-bottom: 1px solid var(--exc-line);
  font-variant-numeric: tabular-nums; white-space: nowrap; }
table.mx thead th { background: var(--exc-panel); font-weight: var(--fw-bold); color: var(--exc-ink-2); position: sticky; top: 0; }
table.mx th small { display: block; font-size: var(--fs-micro); font-weight: var(--fw-regular); color: var(--exc-muted-2); }
table.mx td small { font-size: var(--fs-micro); color: var(--exc-muted); }
table.mx td.mx-co, table.mx th.mx-co { text-align: left; position: sticky; left: 0; background: var(--exc-bg); z-index: 1; }
table.mx thead th.mx-co { z-index: 2; background: var(--exc-panel); }
.mx-link { color: var(--exc-green-700); font-weight: var(--fw-bold); text-decoration: none; }
.mx-link:hover { text-decoration: underline; }
.mx-rid { display: block; font-size: var(--fs-micro); color: var(--exc-muted-2); }
table.mx td.mx-tot { font-weight: var(--fw-bold); background: var(--exc-panel); }
table.mx td.mx-none { color: var(--exc-muted-2); }
table.mx td.mx-cnt { color: var(--exc-muted-2); font-weight: var(--fw-regular); }
table.mx td.mx-cnt.mx-miss { color: #9a6a00; font-weight: var(--fw-bold); background: color-mix(in srgb, var(--exc-amber) 14%, white); }
table.mx td.mx-cnt.mx-out { color: var(--exc-red); font-weight: var(--fw-bold); background: color-mix(in srgb, var(--exc-red) 10%, white); }

/* ② 원본 시트 */
.rs-ctrl { display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap; margin-bottom: var(--space-4);
  padding: var(--space-3) var(--space-4); background: var(--exc-bg); border: 1px solid var(--exc-line); border-radius: var(--radius-md); }
.rs-ctrl label { font-size: var(--fs-body-sm); font-weight: var(--fw-bold); }
.rs-ctrl select { font-family: inherit; font-size: var(--fs-body-sm); padding: 6px 10px; border-radius: var(--radius-sm);
  border: 1px solid var(--exc-line-2); min-width: 280px; }
.rs-toggle { display: inline-flex; align-items: center; gap: 6px; font-weight: var(--fw-semi) !important; cursor: pointer; }
.rs-note { font-size: var(--fs-caption); color: var(--exc-muted-2); margin-left: auto; }
.resp { display: none; }
.resp.active { display: block; }
.rs-head { display: flex; align-items: baseline; gap: var(--space-3); flex-wrap: wrap; margin-bottom: var(--space-4);
  padding: var(--space-3) var(--space-4); background: var(--ai-dusk); color: var(--exc-bg); border-radius: var(--radius-md); }
.rs-co { font-size: var(--fs-h4); font-weight: var(--fw-xbold); }
.rs-meta { font-size: var(--fs-caption); color: rgba(255,255,255,.7); }
.rs-sec { margin-bottom: var(--space-5); }
.rs-sec-h { display: flex; align-items: baseline; gap: var(--space-2); font-size: var(--fs-body); font-weight: var(--fw-bold);
  color: var(--exc-ink); margin-bottom: var(--space-2); }
.rs-rom { font-size: var(--fs-micro); color: var(--exc-bg); background: var(--exc-ink-2); border-radius: var(--radius-pill); padding: 1px 8px; }
.rs-chip { margin-left: auto; display: inline-flex; gap: var(--space-3); font-size: var(--fs-caption);
  font-weight: var(--fw-semi); font-variant-numeric: tabular-nums; }
.cnt-resp { color: var(--exc-green-700); }
.cnt-miss { color: #9a6a00; }
.cnt-out { color: var(--exc-red); }
.cnt-na { color: var(--exc-muted-2); }
table.rs { border-collapse: collapse; width: 100%; font-size: var(--fs-body-sm); }
table.rs td { padding: 5px 12px; border-bottom: 1px solid var(--exc-line); vertical-align: top; }
table.rs .rs-q { width: 46%; color: var(--exc-ink-2); }
table.rs .rs-q small { color: var(--exc-muted-2); font-size: var(--fs-micro); margin-left: 6px; font-variant-numeric: tabular-nums; }
table.rs .rs-v { font-weight: var(--fw-semi); color: var(--exc-ink); font-variant-numeric: tabular-nums; word-break: break-word; }
/* 누락(패싱) — 주황 강조 */
table.rs tr.miss td { background: color-mix(in srgb, var(--exc-amber) 12%, white); }
.rs-miss { color: #9a6a00; font-weight: var(--fw-bold); background: color-mix(in srgb, var(--exc-amber) 30%, white);
  padding: 0 7px; border-radius: var(--radius-sm); }
/* 이상(엉터리) — 적색 강조 */
table.rs tr.bad td { background: color-mix(in srgb, var(--exc-red) 12%, white); }
table.rs tr.warn-val td { background: color-mix(in srgb, var(--exc-amber) 10%, white); }
table.rs tr.bad .rs-v, table.rs tr.warn-val .rs-v { color: var(--ds-rose-700); }
.rs-warn { font-size: var(--fs-micro); color: var(--exc-red); font-weight: var(--fw-bold); margin-left: 8px; }
/* 미해당 — 흐리게(생략), 토글로 숨김 */
table.rs tr.na td { background: var(--exc-panel); }
table.rs tr.na .rs-q, table.rs tr.na .rs-v { color: var(--exc-muted-2); font-weight: var(--fw-regular); }
.rs-na-dot { color: var(--exc-muted-2); font-weight: var(--fw-bold); }
.rs-note-in { font-size: var(--fs-micro); color: var(--exc-muted-2); margin-left: 8px; }
.rs-wrap.hide-na tr.na { display: none; }
.ap-foot { margin-top: var(--space-6); text-align: center; font-size: var(--fs-micro); color: var(--exc-muted-2); }
@media (max-width: 760px) { table.rs .rs-q { width: auto; } .rs-note { margin-left: 0; } }
"""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--src", type=Path, default=DEFAULT_SRC)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--rules", type=Path, default=DEFAULT_RULES)
    ap.add_argument("--generated", default=None)
    args = ap.parse_args()

    df = pd.read_excel(args.src, sheet_name=0, dtype=object)
    rules = yaml.safe_load(args.rules.read_text(encoding="utf-8")) if args.rules.exists() else {}
    updated = pd.to_datetime(df.get("tesmi_status_date"), errors="coerce").max()
    generated = args.generated or (updated.strftime("%Y-%m-%d %H:%M") if pd.notna(updated) else "—")
    html = build(df, generated, rules)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(html, encoding="utf-8")
    try:
        shown = args.out.resolve().relative_to(ROOT)
    except ValueError:
        shown = args.out
    print(f"출력: {shown}  ({len(html):,} bytes · 완료 {len(df)}명)")
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
