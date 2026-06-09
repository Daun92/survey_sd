"""[단계 6] 종합 허브 + 퍼블리시 묶음 — 22회.

수집현황 대시보드 · 세그먼트별 요약 · 최종 덱 3종을 연결하는 랜딩 허브(index.html)를 만들고,
최신 산출물을 안정적 파일명으로 5_report/publish/ 에 모은다(= 외부 업로드 원본·원격 구조 미러).

  5_report/publish/
    index.html      ← 종합 허브 (랜딩, 상대링크)
    dashboard.html  ← 수집현황 대시보드 (최신 dashboard_collection_22th*.html)
    segment.html    ← 세그먼트별 요약   (최신 segment_report_22th_*.html)
    deck.html       ← 최종 발표 덱       (최신 deck_22th_*.html)

허브 링크는 상대경로 → 폴더 통째 업로드/복사 시 어디서나 동작
(예: https://apps.exc.co.kr/staff/45/files/hrd22/).

사용:
    python scripts/stage6_render_hub.py          # 3종 복사 + 허브 생성
    # run_pipeline 마지막 단계로 매일 자동 실행
"""
from __future__ import annotations

import argparse
import glob
import io
import re
import shutil
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from design_tokens import TOKENS_CSS                     # noqa: E402
from stage6_render_dashboard import compute_outliers     # noqa: E402  (검토 대상 노티스용)

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

PREVIEW = ROOT / "5_report" / "preview"
PUBLISH = ROOT / "5_report" / "publish"
RAW_DIR = ROOT / "1_raw"
VALIDATED = ROOT / "2_validated" / "raw_validated.xlsx"
# 업로드본 자기완결화: ECharts CDN(jsdelivr) → 로컬본 인라인(사내망 CDN 차단 대비). 로컬 preview 는 CDN 유지.
ECHARTS_LOCAL = ROOT / "assets" / "echarts.min.js"
_ECHARTS_CDN_RE = re.compile(r'<script[^>]*src="https://cdn\.jsdelivr\.net/npm/echarts@[^"]*"[^>]*>\s*</script>')

# 허브가 연결하는 3종 (사용자 지정 순서: 수집현황 → 세그먼트 → 덱)
DELIVERABLES = [
    {"key": "dashboard", "num": "01", "title": "수집현황 대시보드", "out": "dashboard.html",
     "src": "dashboard_collection_22th*.html", "icon": "📊", "accent": "green",
     "desc": "분석 가능(완료) 응답의 수집 추세·표본 구성·유입 경로와 데이터 품질(이상치) 모니터링.",
     "tag": "모니터링"},
    {"key": "segment", "num": "02", "title": "세그먼트별 요약 리포트", "out": "segment.html",
     "src": "segment_report_22th_*.html", "echarts": True, "icon": "📈", "accent": "dusk",
     "desc": "규모군·공공 등 세그먼트별 핵심지표와 전체 대비 ±%p 벤치마크. 부록에 전 문항 집계.",
     "tag": "분석"},
    {"key": "deck", "num": "03", "title": "최종 발표 덱", "out": "deck.html",
     "src": "deck_22th_*.html", "echarts": True, "icon": "🎞", "accent": "amber",
     "desc": "발표용 슬라이드(1920×1080) — 핵심 결과를 시각적으로 요약한 대외 보고본.",
     "tag": "보고"},
]

# 부록(보조) — 응답 상세 원자료
APPENDIX = {"key": "appendix", "title": "응답 상세 부록", "out": "appendix.html",
            "src": "raw_appendix_22th*.html", "icon": "📋", "tag": "내부 참고",
            "desc": "완료 응답자 원자료 — 섹션별 응답 커버리지 매트릭스 + 응답자별 원본값(상세 응답여부 확인)."}


def _latest(pattern: str) -> Path | None:
    hits = sorted(PREVIEW.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
    return hits[0] if hits else None


def _fmt_mtime(p: Path) -> str:
    return pd.Timestamp(p.stat().st_mtime, unit="s", tz="UTC").tz_convert("Asia/Seoul").strftime("%Y-%m-%d %H:%M")


def _survey_summary() -> dict:
    """허브 상단 요약 — 완료/전체/최신 응답일 (가볍게 직접 읽기)."""
    out = {"n_done": None, "n_total": None, "updated": None}
    try:
        if VALIDATED.exists():
            out["n_done"] = int(len(pd.read_excel(VALIDATED, dtype=object)))
        raws = sorted(RAW_DIR.glob("*.xlsx"), key=lambda p: p.stat().st_mtime, reverse=True)
        if raws:
            rawall = pd.read_excel(raws[0], dtype=object)
            out["n_total"] = int(len(rawall))
            reg = pd.to_datetime(rawall.get("tesmi_regdate"), errors="coerce").max()
            out["updated"] = reg.strftime("%Y-%m-%d") if pd.notna(reg) else None
    except Exception as e:                       # 허브는 요약 없어도 동작
        print(f"  ⚠ 요약 계산 생략: {e}")
    return out


def _bundle_echarts(out_path: Path) -> str:
    """업로드본의 ECharts CDN <script src> 를 로컬 echarts.min.js 인라인으로 치환(자기완결)."""
    if not ECHARTS_LOCAL.exists():
        return "ECharts 로컬본 없음 → CDN 유지"
    js = ECHARTS_LOCAL.read_text(encoding="utf-8")
    html = out_path.read_text(encoding="utf-8")
    # 함수 치환(replacement 문자열의 백슬래시 오해석 방지)
    new, n = _ECHARTS_CDN_RE.subn(lambda m: "<script>" + js + "</script>", html)
    if n:
        out_path.write_text(new, encoding="utf-8")
        return f"ECharts 인라인({n}건, +{len(js) // 1024}KB)"
    return "ECharts CDN 참조 없음(치환 0)"


def publish() -> list[dict]:
    """최신 3종을 publish/ 에 안정적 이름으로 복사 + 업로드본 자기완결화(ECharts 인라인)."""
    PUBLISH.mkdir(parents=True, exist_ok=True)
    items = []
    for d in DELIVERABLES + [APPENDIX]:
        src = _latest(d["src"])
        rec = dict(d)
        if src is None:
            rec["ok"] = False
            rec["updated"] = None
            print(f"  ⚠ {d['title']}: 원본 없음 (pattern {d['src']})")
        else:
            out = PUBLISH / d["out"]
            shutil.copy2(src, out)
            rec["ok"] = True
            rec["updated"] = _fmt_mtime(src)
            rec["src_name"] = src.name
            extra = f"  [{_bundle_echarts(out)}]" if d.get("echarts") else ""
            print(f"  · {d['title']}: {src.name} → publish/{d['out']}  (갱신 {rec['updated']}){extra}")
        items.append(rec)
    return items


# ─────────────────────────────────────────────
# 허브 HTML
# ─────────────────────────────────────────────

def _card(it: dict) -> str:
    avail = it.get("ok")
    accent = it.get("accent", "dusk")
    open_t = (f'<a class="hub-card a-{accent}" href="./{it["out"]}">' if avail
              else f'<div class="hub-card a-{accent} off">')
    end = "</a>" if avail else "</div>"
    upd = (f'<span class="hc-upd">갱신 {it["updated"]}</span>' if it.get("updated")
           else '<span class="hc-upd off">준비 중</span>')
    num = f'<span class="hc-num">{it["num"]}</span>' if it.get("num") else ""
    return (
        f'{open_t}'
        f'<div class="hc-icon">{it.get("icon", "•")}</div>'
        f'<div class="hc-body">'
        f'<div class="hc-top">{num}<span class="hc-tag">{it["tag"]}</span>{upd}</div>'
        f'<div class="hc-title">{it["title"]}{"" if avail else " <small>(미생성)</small>"}</div>'
        f'<div class="hc-desc">{it["desc"]}</div>'
        f'</div>'
        f'<div class="hc-go">{"→" if avail else "—"}</div>'
        f'{end}')


def render_hub(items: list[dict], summary: dict, generated: str, review: dict | None = None) -> str:
    nd, nt = summary.get("n_done"), summary.get("n_total")
    rate = round(100 * nd / nt) if (nd and nt) else None

    def _kpi(label, val, unit, cls, small=False):
        v = "—" if val in (None, "") else f'{val}<span class="hk-u">{unit}</span>'
        return (f'<div class="hk hk-{cls}{" sm" if small else ""}">'
                f'<div class="hk-lab">{label}</div><div class="hk-v">{v}</div></div>')

    kpis = (
        _kpi("응답완료 (분석대상)", nd, "건", "done")
        + _kpi("완료율", rate, "%", "rate")
        + _kpi("전체 응답 (작성 중 포함)", nt, "건", "all")
        + _kpi("최신 응답일", summary.get("updated"), "", "upd", small=True))

    # 검토 대상 노티스 (거시지표 입력 이상치 — 분석 적합성)
    notice = ""
    if review and review.get("n_affected"):
        na, crit, ncomp = review["n_affected"], review.get("n_crit_resp", 0), review.get("n_complete")
        crit_txt = f' · 긴급 <b>{crit}</b>명' if crit else ""
        notice = (
            '<a class="hub-notice" href="./dashboard.html">'
            '<span class="hn-icon">⚠</span>'
            f'<div class="hn-body"><div class="hn-title">검토 대상 <b>{na}</b>명{crit_txt}</div>'
            f'<div class="hn-desc">분석대상(완료 {ncomp}건) 중 거시지표 입력 이상치 — 정정 검토 필요. '
            '수집현황 대시보드 ‹분석 적합성›에서 회사별 확인.</div></div>'
            '<span class="hn-go">→</span></a>')

    main_items = [it for it in items if it.get("key") != "appendix"]
    appx = next((it for it in items if it.get("key") == "appendix"), None)
    cards = "".join(_card(it) for it in main_items)
    appendix_block = ""
    if appx:
        appx = {**appx, "accent": "neutral"}
        appendix_block = (
            '<div class="hub-sub-label">부록 · 참고</div>'
            f'<div class="hub-grid">{_card(appx)}</div>')

    return f"""<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>제22회 인재개발 실태조사 — 종합 허브</title>
<style>{TOKENS_CSS}</style>
<style>{HUB_CSS}</style>
</head><body>
<div class="wrap">
  <header class="hub-head">
    <div class="eyebrow">HRD Survey · 제22회 인재개발 실태조사</div>
    <h1>종합 허브</h1>
    <p class="sub">수집현황 · 세그먼트 분석 · 최종 보고를 한곳에서. <b>매일 07:00 자동 갱신</b>.</p>
  </header>

  <section class="hub-kpis">{kpis}</section>
  {notice}

  <div class="hub-grid">
    {cards}
  </div>
  {appendix_block}

  <div class="hub-note">
    ⚠ <b>prelim(잠정) 스냅샷</b> — 수집 종료(9월) 전까지 매일 자동 재생성됩니다(잠정 raw 기준).
    최종 보고는 분석가 큐레이션(중복제거·재분류) 후 별도 확정.
  </div>

  <footer class="hub-foot">생성 {generated} · EXC · HRD Survey 2027 · 자동 갱신 파이프라인(run_pipeline)</footer>
</div>
</body></html>"""


HUB_CSS = """
* { box-sizing: border-box; }
html, body { background: var(--exc-panel); }
body { margin: 0; font-family: var(--font-sans); color: var(--exc-ink); }
.wrap { max-width: 1000px; margin: 0 auto; padding: var(--space-10) var(--space-6) var(--space-12); }

/* 히어로 헤더 */
.hub-head { position: relative; margin-bottom: var(--space-6); padding-left: var(--space-4); }
.hub-head::before { content: ""; position: absolute; left: 0; top: 4px; bottom: 4px; width: 5px;
  border-radius: var(--radius-pill); background: linear-gradient(var(--exc-green), var(--ai-dusk)); }
.hub-head .eyebrow { font-size: var(--fs-micro); font-weight: var(--fw-bold); letter-spacing: .08em;
  text-transform: uppercase; color: var(--ai-dusk); margin-bottom: var(--space-2); }
.hub-head h1 { font-size: var(--fs-display); font-weight: var(--fw-xbold); margin: 0; letter-spacing: var(--ls-tight); }
.hub-head .sub { font-size: var(--fs-body); color: var(--exc-muted); margin: var(--space-3) 0 0; }
.hub-head .sub b { color: var(--exc-green-700); }

/* KPI 타일 (대시보드 룩) */
.hub-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-3); margin-bottom: var(--space-6); }
.hk { background: var(--exc-bg); border: 1px solid var(--exc-line); border-radius: var(--radius-lg);
  padding: var(--space-4) var(--space-5); box-shadow: var(--shadow-sm); border-top: 3px solid var(--exc-line-2); }
.hk-lab { font-size: var(--fs-caption); color: var(--exc-muted); font-weight: var(--fw-semi); margin-bottom: var(--space-2); }
.hk-v { font-size: var(--fs-h1); font-weight: var(--fw-xbold); font-variant-numeric: tabular-nums; line-height: 1; }
.hk.sm .hk-v { font-size: var(--fs-h3); }
.hk-u { font-size: var(--fs-body-sm); font-weight: var(--fw-semi); color: var(--exc-muted); margin-left: 3px; }
.hk-done { border-top-color: var(--exc-green); } .hk-done .hk-v { color: var(--exc-green-700); }
.hk-rate { border-top-color: var(--ai-violet); } .hk-rate .hk-v { color: var(--ai-violet); }
.hk-all  { border-top-color: var(--exc-ink-2); }
.hk-upd  { border-top-color: var(--exc-info); } .hk-upd .hk-v { color: var(--exc-ink-2); }

/* 검토 대상 노티스 (이상치 → 분석 적합성) */
.hub-notice { display: flex; align-items: center; gap: var(--space-4); text-decoration: none; color: inherit;
  background: color-mix(in srgb, var(--exc-amber) 12%, white); border: 1px solid color-mix(in srgb, var(--exc-amber) 45%, white);
  border-left: 4px solid var(--exc-amber); border-radius: var(--radius-lg); padding: var(--space-4) var(--space-5);
  margin-bottom: var(--space-5); box-shadow: var(--shadow-sm); transition: box-shadow .15s, transform .15s; }
.hub-notice:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
.hn-icon { flex: none; font-size: 26px; }
.hn-body { flex: 1; min-width: 0; }
.hn-title { font-size: var(--fs-h4); font-weight: var(--fw-xbold); color: color-mix(in srgb, var(--exc-amber) 55%, var(--exc-ink)); }
.hn-title b { color: var(--exc-red); }
.hn-desc { font-size: var(--fs-caption); color: var(--exc-ink-2); margin-top: 2px; line-height: 1.5; }
.hn-go { flex: none; font-size: var(--fs-h3); font-weight: var(--fw-bold); color: color-mix(in srgb, var(--exc-amber) 55%, var(--exc-ink)); }

/* 부록 구분 라벨 + neutral 카드 */
.hub-sub-label { font-size: var(--fs-caption); font-weight: var(--fw-bold); letter-spacing: .04em;
  text-transform: uppercase; color: var(--exc-muted-2); margin: var(--space-5) 0 var(--space-3); }
.hub-card.a-neutral { border-left-color: var(--exc-muted-2); }
.hub-card:hover.a-neutral { border-color: var(--exc-muted-2); }
.a-neutral .hc-icon { background: var(--exc-panel-2); }
.a-neutral .hc-tag { color: var(--exc-muted); background: var(--exc-panel-2); }
.a-neutral:hover .hc-go { color: var(--exc-ink-2); }

/* 네비 카드 (아이콘 + 본문 + 화살표, 강조색·호버) */
.hub-grid { display: grid; grid-template-columns: 1fr; gap: var(--space-4); }
.hub-card { display: flex; align-items: center; gap: var(--space-4); text-decoration: none; color: inherit;
  background: var(--exc-bg); border: 1px solid var(--exc-line); border-left: 4px solid var(--exc-line-2);
  border-radius: var(--radius-lg); padding: var(--space-5) var(--space-6); box-shadow: var(--shadow-sm);
  transition: box-shadow .15s, border-color .15s, transform .15s; }
.hub-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
.hub-card.off { opacity: .6; cursor: default; transform: none; }
.hub-card.a-green { border-left-color: var(--exc-green); }
.hub-card.a-dusk  { border-left-color: var(--ai-dusk); }
.hub-card.a-amber { border-left-color: var(--exc-amber); }
.hub-card:hover.a-green { border-color: var(--exc-green); }
.hub-card:hover.a-dusk  { border-color: var(--ai-dusk); }
.hub-card:hover.a-amber { border-color: var(--exc-amber); }
.hc-icon { flex: none; width: 56px; height: 56px; border-radius: var(--radius-lg); display: flex;
  align-items: center; justify-content: center; font-size: 28px; line-height: 1; }
.a-green .hc-icon { background: color-mix(in srgb, var(--exc-green) 12%, white); }
.a-dusk  .hc-icon { background: color-mix(in srgb, var(--ai-dusk) 12%, white); }
.a-amber .hc-icon { background: color-mix(in srgb, var(--exc-amber) 16%, white); }
.hc-body { flex: 1; min-width: 0; }
.hc-top { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-1); }
.hc-num { font-size: var(--fs-micro); font-weight: var(--fw-xbold); color: var(--exc-bg);
  background: var(--exc-ink-2); border-radius: var(--radius-pill); padding: 1px 8px; }
.hc-tag { font-size: var(--fs-micro); font-weight: var(--fw-bold); border-radius: var(--radius-pill); padding: 1px 9px; }
.a-green .hc-tag { color: var(--exc-green-700); background: color-mix(in srgb, var(--exc-green) 12%, white); }
.a-dusk  .hc-tag { color: var(--ai-dusk); background: color-mix(in srgb, var(--ai-dusk) 12%, white); }
.a-amber .hc-tag { color: color-mix(in srgb, var(--exc-amber) 55%, var(--exc-ink)); background: color-mix(in srgb, var(--exc-amber) 18%, white); }
.hc-upd { margin-left: auto; font-size: var(--fs-caption); color: var(--exc-muted-2); font-variant-numeric: tabular-nums; }
.hc-upd.off { color: var(--exc-amber); }
.hc-title { font-size: var(--fs-h3); font-weight: var(--fw-xbold); margin: 2px 0 var(--space-1); letter-spacing: var(--ls-tight); }
.hc-title small { font-size: var(--fs-body-sm); color: var(--exc-amber); font-weight: var(--fw-semi); }
.hc-desc { font-size: var(--fs-body-sm); color: var(--exc-muted); line-height: 1.55; }
.hc-go { flex: none; font-size: var(--fs-h3); font-weight: var(--fw-bold); color: var(--exc-muted-2); }
.hub-card:hover .hc-go { color: var(--exc-ink); transform: translateX(2px); }
.a-green:hover .hc-go { color: var(--exc-green-700); }
.a-dusk:hover  .hc-go { color: var(--ai-dusk); }
.a-amber:hover .hc-go { color: color-mix(in srgb, var(--exc-amber) 55%, var(--exc-ink)); }

.hub-note { margin-top: var(--space-6); padding: var(--space-4) var(--space-5);
  background: color-mix(in srgb, var(--exc-amber) 12%, white);
  border: 1px solid color-mix(in srgb, var(--exc-amber) 42%, white); border-radius: var(--radius-md);
  font-size: var(--fs-body-sm); color: var(--exc-ink-2); line-height: 1.6; }
.hub-note b { color: var(--exc-ink); }
.hub-foot { margin-top: var(--space-6); text-align: center; font-size: var(--fs-micro); color: var(--exc-muted-2); }
@media (max-width: 820px) { .hub-kpis { grid-template-columns: repeat(2, 1fr); }
  .hub-card { flex-wrap: wrap; } .hc-icon { width: 44px; height: 44px; font-size: 22px; } }
"""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--generated", default=None, help="생성 시각 라벨(미지정 시 최신 산출물 기준)")
    args = ap.parse_args()

    print(f"퍼블리시 → {PUBLISH.relative_to(ROOT)}")
    items = publish()
    summary = _survey_summary()
    review = compute_outliers()      # 검토 대상(이상치) 노티스용 — 없으면 None
    # 생성 시각: 인자 우선, 없으면 복사된 산출물 중 최신 갱신시각
    generated = args.generated or next((it["updated"] for it in items if it.get("updated")), "—")
    html = render_hub(items, summary, generated, review)
    (PUBLISH / "index.html").write_text(html, encoding="utf-8")
    ok = sum(1 for it in items if it.get("ok"))
    print(f"허브: publish/index.html  ({len(html):,} bytes · 연결 {ok}/{len(items)}종)")
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
