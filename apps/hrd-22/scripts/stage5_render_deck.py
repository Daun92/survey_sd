"""[단계 5 · 옵션] 22회 발표용 deck (1920×1080 풀-블리드) 렌더러.

산출:
  - 5_report/preview/deck_22th_20260528.html — 18 슬라이드, 키보드 네비, scale-to-fit, 인쇄 → PDF 가능

데이터·outline·takeaway 는 stage5_render_html.py 에서 import (단일 source of truth).

사용:
    python scripts/stage5_render_deck.py
    # 결과: 5_report/preview/deck_22th_20260528.html
    # 키보드: ← / → / Space (네비), Home / End, 1~9 (점프)
"""
from __future__ import annotations

import argparse
import io
import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from stage5_render_html import compute_page_data, PAGES, TAKEAWAYS, render_chart_body  # noqa: E402
from design_tokens import TOKENS_CSS  # noqa: E402  (디자인 토큰 단일 소스)

DEFAULT_SRC = ROOT / "2_validated/raw_validated.xlsx"
DEFAULT_RAW_DIR = ROOT / "1_raw"
DEFAULT_OUT = ROOT / "5_report/preview/deck_22th_20260528.html"
TOTAL_PAGES = 18

# 대외 발표용 부제 (헤드라인 아래 한 줄 — raw 변수/시각화 표기 대신 청중용 맥락).
# 분석가 수기 수정 영역. 비어 있으면 헤드라인 아래는 얇은 구분선만 표시.
SUBTITLES = {
    "p4": "응답에 참여한 기업의 규모·업종 분포",
    "p5": "표본의 매출·인원·교육예산 규모와 파생 지표",
    "p6": "직전 연도 대비 교육예산의 증감 방향",
    "p9": "교육 형태별 참가 인원과 지출의 비중 차이",
    "p10": "직책 계층별 교육비 배분 구조",
    "p11": "전체 교육비에서 AI 교육이 차지하는 비중",
    "p12": "교육 투자에 대한 현장의 체감 만족도",
    "p15": "AI 전사 전략 수립 정도와 CEO의 관심·지원",
    "p16": "AI 교육 도입 단계와 내년도(2027) 예산 방향",
}


def _load_stats(validated_df, raw_dir):
    """응답수 카드 자동 치환용 통계.
    n_complete = validated(완료) 응답 수, n_total = raw 전체 응답 수."""
    n_complete = len(validated_df)
    n_total = None
    raw_files = sorted(raw_dir.glob("*.xlsx"))
    if raw_files:
        try:
            n_total = len(pd.read_excel(raw_files[0], dtype=object))
        except Exception:
            n_total = None
    n_progress = (n_total - n_complete) if n_total is not None else None
    return {
        "n_complete": n_complete,
        "n_total": n_total,
        "n_progress": n_progress,
    }

# ────────────────────────────────────────────────
# CSS
# ────────────────────────────────────────────────

CSS = """
@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css");

""" + TOKENS_CSS + """

* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0;
  background: #000;
  color: var(--exc-ink);
  font-family: var(--font-sans);
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
  word-break: keep-all; overflow-wrap: break-word;
  font-feature-settings: "ss06";
}

/* Stage container */
.deck-stage {
  position: fixed; inset: 0;
  display: flex; align-items: center; justify-content: center;
}
.canvas {
  position: relative;
  width: 1920px; height: 1080px;
  transform-origin: center center;
  background: #fff;
  box-shadow: 0 24px 96px rgba(0,0,0,.4);
}

section.slide {
  position: absolute; inset: 0;
  display: none;
  width: 1920px; height: 1080px;
  background: #fff;
  overflow: hidden;
}
section.slide.active { display: block; }
section.slide:not(.active) { display: none !important; }

/* Slide chrome */
.slide-header, .slide-footer {
  position: absolute;
  left: 80px; right: 80px;
  display: flex; align-items: center; justify-content: space-between;
  z-index: 5;
}
.slide-header { top: 56px; }
.slide-footer { bottom: 48px; }
.slide-header .logo {
  display: inline-flex; align-items: center; gap: 10px;
  font-size: 14px; font-weight: 800;
  letter-spacing: .14em; text-transform: uppercase;
  color: var(--exc-green);
}
.slide-header .logo .mark {
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--exc-green); position: relative;
}
.slide-header .logo .mark::before {
  content: ""; position: absolute; inset: 5px;
  background: #fff; border-radius: 50%;
}
.slide-header .eyebrow {
  font-size: 16px; font-weight: 700;
  letter-spacing: .12em; text-transform: uppercase;
  color: var(--exc-muted);
}
.slide-header .eyebrow .dot {
  display: inline-block; width: 8px; height: 8px;
  border-radius: 999px; background: var(--exc-green);
  margin: 0 14px 2px; vertical-align: middle;
}
.new-section .slide-header .eyebrow .dot { background: var(--ai-violet); }
.slide-footer .meta {
  font-size: 14px; font-weight: 700;
  letter-spacing: .14em; text-transform: uppercase;
  color: var(--exc-muted-2);
}
.slide-footer .page-no {
  font-variant-numeric: tabular-nums;
  font-weight: 800; font-size: 20px;
  letter-spacing: .06em;
  color: var(--exc-ink);
}
.slide-footer .page-no em {
  font-style: normal; color: var(--exc-muted-2); font-weight: 500;
}

/* Dark variant */
.slide--dark { background: var(--ai-dusk); color: #fff; }
.slide--dark .slide-header .logo { color: rgba(255,255,255,.85); }
.slide--dark .slide-header .logo .mark { background: var(--ai-cyan); }
.slide--dark .slide-header .logo .mark::before { background: var(--ai-dusk); }
.slide--dark .slide-header .eyebrow,
.slide--dark .slide-footer .meta { color: rgba(255,255,255,.55); }
.slide--dark .slide-footer .page-no { color: #fff; }
.slide--dark .slide-footer .page-no em { color: rgba(255,255,255,.4); }

/* Cover */
section.slide.cover {
  padding: 80px;
  background:
    radial-gradient(ellipse 1100px 700px at 70% 30%, color-mix(in srgb, var(--ai-violet) 38%, transparent) 0%, transparent 60%),
    radial-gradient(ellipse 700px 400px at 20% 80%, color-mix(in srgb, var(--ai-cyan) 22%, transparent) 0%, transparent 60%),
    var(--ai-dusk);
  display: grid; grid-template-rows: auto 1fr auto;
  gap: 32px;
}
section.cover::before {
  content: ""; position: absolute; inset: 0;
  background-image:
    linear-gradient(color-mix(in srgb, var(--ai-violet) 18%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--ai-violet) 18%, transparent) 1px, transparent 1px);
  background-size: 80px 80px;
  mask-image: radial-gradient(ellipse 1400px 800px at 50% 50%, black 30%, transparent 80%);
  -webkit-mask-image: radial-gradient(ellipse 1400px 800px at 50% 50%, black 30%, transparent 80%);
  opacity: .55; z-index: 0; pointer-events: none;
}
section.cover > * { position: relative; z-index: 2; }
section.cover .cover-top {
  display: flex; align-items: center; justify-content: space-between;
}
section.cover .cover-top .logo {
  display: inline-flex; align-items: center; gap: 14px;
  color: rgba(255,255,255,.95);
  font-size: 18px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase;
}
section.cover .cover-top .logo .mark {
  width: 40px; height: 40px; border-radius: 50%;
  background: var(--ai-cyan); position: relative;
}
section.cover .cover-top .logo .mark::before {
  content: ""; position: absolute; inset: 10px;
  background: var(--ai-dusk); border-radius: 50%;
}
section.cover .ai-tag {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 12px 20px;
  border: 1px solid rgba(255,255,255,.18);
  border-radius: 999px;
  font-size: 14px; letter-spacing: .14em; text-transform: uppercase;
  color: rgba(255,255,255,.85); font-weight: 700;
  backdrop-filter: blur(8px);
}
section.cover .ai-tag::before {
  content: ""; width: 8px; height: 8px; border-radius: 50%;
  background: var(--ai-cyan); box-shadow: 0 0 12px var(--ai-cyan);
  animation: pulse 1.8s cubic-bezier(.2,.8,.2,1) infinite;
}
@keyframes pulse {
  0%,100% { opacity:1; transform: scale(1); }
  50%     { opacity:.4; transform: scale(.8); }
}
section.cover .cover-center {
  display: flex; flex-direction: column; justify-content: center;
  gap: 32px; max-width: 1600px;
}
section.cover .cover-eyebrow {
  display: inline-flex; align-items: center; gap: 18px;
  color: var(--ai-cyan);
  font-size: 20px; font-weight: 800;
  letter-spacing: .22em; text-transform: uppercase;
}
section.cover .cover-eyebrow::before {
  content: ""; width: 80px; height: 2px; background: var(--ai-cyan);
}
section.cover h1.cover-title {
  font-size: 132px; font-weight: 900;
  line-height: 1.02; letter-spacing: -.035em;
  color: #fff; margin: 0; text-wrap: balance;
}
section.cover h1.cover-title .accent {
  background: linear-gradient(110deg, var(--ai-violet) 0%, var(--ai-cyan) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
section.cover .cover-sub {
  font-size: 28px; line-height: 1.5;
  color: rgba(255,255,255,.75); max-width: 1200px;
}
section.cover .cover-bottom {
  display: flex; justify-content: space-between; align-items: flex-end;
}
section.cover .meta-stack { display: flex; gap: 64px; }
section.cover .meta-stack .k {
  font-size: 13px; letter-spacing: .14em; text-transform: uppercase;
  color: rgba(255,255,255,.45); font-weight: 700; margin-bottom: 8px;
}
section.cover .meta-stack .v {
  font-size: 22px; font-weight: 700; color: #fff;
  letter-spacing: -.005em;
}
section.cover .corp {
  font-size: 14px; letter-spacing: .14em; text-transform: uppercase;
  color: rgba(255,255,255,.55); font-weight: 600;
}

/* ─── Chapter divider (AI 전환 act break) ─── */
section.slide.divider {
  display: flex; align-items: center;
  padding: 80px 120px;
  overflow: hidden;
  background:
    radial-gradient(ellipse 1100px 700px at 75% 35%, color-mix(in srgb, var(--ai-violet) 42%, transparent) 0%, transparent 60%),
    radial-gradient(ellipse 800px 500px at 15% 80%, color-mix(in srgb, var(--ai-cyan) 24%, transparent) 0%, transparent 60%),
    var(--ai-dusk);
}
section.slide.divider::before {
  content: ""; position: absolute; inset: 0;
  background-image:
    linear-gradient(color-mix(in srgb, var(--ai-violet) 16%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--ai-violet) 16%, transparent) 1px, transparent 1px);
  background-size: 80px 80px;
  mask-image: radial-gradient(ellipse 1400px 800px at 50% 50%, black 30%, transparent 80%);
  -webkit-mask-image: radial-gradient(ellipse 1400px 800px at 50% 50%, black 30%, transparent 80%);
  opacity: .5; z-index: 0; pointer-events: none;
}
section.slide.divider .div-inner { position: relative; z-index: 2; max-width: 1400px; }
section.slide.divider .div-kicker {
  display: inline-flex; align-items: center; gap: 14px;
  font-size: 16px; font-weight: 800; letter-spacing: .22em; text-transform: uppercase;
  color: var(--ai-cyan); margin-bottom: 28px;
}
section.slide.divider .div-kicker::before { content: ""; width: 56px; height: 2px; background: var(--ai-cyan); }
section.slide.divider .div-eyebrow {
  font-size: 22px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
  color: rgba(255,255,255,.6); margin-bottom: 20px;
}
section.slide.divider .div-title {
  font-size: 150px; font-weight: 900; line-height: 1.0; letter-spacing: -.035em;
  color: #fff; margin: 0 0 28px;
}
section.slide.divider .div-title .accent {
  background: linear-gradient(110deg, var(--ai-violet) 0%, var(--ai-cyan) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
section.slide.divider .div-sub {
  font-size: 28px; line-height: 1.5; color: rgba(255,255,255,.75); max-width: 1100px; margin: 0;
}

/* Content slide body */
section.slide.content, section.slide.intro, section.slide.summary {
  padding: 140px 80px 110px;
  display: flex; flex-direction: column; gap: 0;
}
.slide-eyebrow {
  display: inline-flex; align-items: center; gap: 14px;
  font-size: 18px; font-weight: 800;
  letter-spacing: .14em; text-transform: uppercase;
  color: var(--exc-green);
  margin-bottom: 20px;
}
.slide-eyebrow .num {
  display: inline-flex;
  width: 44px; height: 44px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--exc-green) 14%, white);
  align-items: center; justify-content: center;
  font-size: 16px; font-weight: 800;
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
  font-size: 76px; font-weight: 800;
  line-height: 1.08; letter-spacing: -.025em;
  color: var(--exc-ink);
  margin: 0 0 16px; text-wrap: balance;
}
.slide-headline .accent { color: var(--exc-green); }
.new-section .slide-headline .accent { color: var(--ai-violet); }
.new-badge {
  display: inline-flex; align-items: center;
  background: color-mix(in srgb, var(--ai-violet) 14%, white);
  color: var(--ai-violet);
  font-size: 18px; font-weight: 700;
  padding: 6px 18px;
  border-radius: 999px;
  margin-left: 20px;
  letter-spacing: .04em;
  vertical-align: middle;
}
.meta-line {
  font-size: 18px; color: var(--exc-muted);
  margin: 8px 0 32px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--exc-line);
  letter-spacing: -.005em;
}
.meta-line code {
  font-family: var(--font-mono); font-size: 15px;
  background: var(--exc-panel);
  padding: 4px 10px;
  border-radius: 4px;
  color: var(--exc-ink-2);
}

/* Intro / Summary */
section.slide.intro p { font-size: 26px; line-height: 1.7; color: var(--exc-muted); max-width: 1500px; }
section.slide.intro p strong { color: var(--exc-ink); font-weight: 700; }
section.slide.intro .letter-lead { margin: 0; }

/* Letter 미니 목차 ("이번 호에서 보는 것") */
.letter-toc {
  flex: 1; min-height: 0;
  display: flex; flex-direction: column; justify-content: center;
  margin-top: 36px;
}
.letter-toc .toc-head {
  font-size: 14px; font-weight: 800;
  letter-spacing: .16em; text-transform: uppercase;
  color: var(--exc-muted-2); margin-bottom: 24px;
}
.letter-toc .toc-cols {
  display: grid; grid-template-columns: 1fr 1fr; gap: 32px;
}
.letter-toc .toc-col {
  background: var(--exc-panel);
  border: 1px solid var(--exc-line);
  border-radius: 16px;
  padding: 32px 36px;
}
.letter-toc .toc-col.is-ai {
  background: color-mix(in srgb, var(--ai-violet) 6%, white);
  border-color: color-mix(in srgb, var(--ai-violet) 28%, white);
}
.letter-toc .toc-part {
  font-size: 18px; font-weight: 800;
  color: var(--exc-green); letter-spacing: -.01em;
  margin-bottom: 18px;
}
.letter-toc .toc-col.is-ai .toc-part { color: var(--ai-violet); }
.letter-toc .toc-star {
  font-size: 13px; font-weight: 700; margin-left: 8px;
  color: var(--ai-violet); letter-spacing: 0;
}
.letter-toc ul { list-style: none; margin: 0; padding: 0; }
.letter-toc li {
  font-size: 22px; font-weight: 600; color: var(--exc-ink-2);
  padding: 13px 0; border-bottom: 1px solid var(--exc-line);
  display: flex; align-items: baseline; gap: 12px;
}
.letter-toc li:last-child { border-bottom: none; }
.letter-toc li::before {
  content: ""; width: 7px; height: 7px; border-radius: 50%;
  background: var(--exc-green); flex-shrink: 0; transform: translateY(-3px);
}
.letter-toc .is-ai li::before { background: var(--ai-violet); }
.letter-toc li small {
  font-size: 15px; font-weight: 500; color: var(--exc-muted-2); letter-spacing: 0;
}
section.slide.summary ul.summary-list { list-style: none; padding: 0; margin: 24px 0 0; max-width: 1500px; }
section.slide.summary ul.summary-list li {
  padding: 18px 0; border-bottom: 1px solid var(--exc-line);
  font-size: 22px; line-height: 1.6;
  color: var(--exc-ink-2);
}
section.slide.summary ul.summary-list strong { color: var(--exc-green); font-weight: 700; }
section.slide.summary .contact {
  margin-top: 40px; padding-top: 24px;
  border-top: 1px solid var(--exc-line);
  font-size: 16px; color: var(--exc-muted);
  letter-spacing: .04em;
}

/* Chart / KPI / Table */
.chart-row {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 36px; flex: 1;
  min-height: 0;
}
.chart-box { width: 100%; flex: 1; min-height: 0; }

.placeholder {
  background: var(--exc-panel);
  border: 2px dashed var(--exc-line-2);
  border-radius: 12px;
  padding: 120px 32px;
  color: var(--exc-muted-2);
  text-align: center;
  font-size: 22px; line-height: 1.6;
}

.caveat {
  background: color-mix(in srgb, var(--exc-amber) 16%, white);
  border-left: 4px solid var(--exc-amber);
  padding: 18px 24px;
  font-size: 16px;
  color: var(--exc-ink-2);
  margin-top: 24px;
  border-radius: 4px;
  line-height: 1.5;
}

.slide-takeaway {
  margin-top: 32px;
  padding: 24px 32px;
  font-size: 22px;
  line-height: 1.55;
  font-weight: 500;
  color: var(--exc-ink-2);
  background: var(--exc-panel);
  border-left: 4px solid var(--exc-green);
  border-radius: 0 12px 12px 0;
}
.slide-takeaway strong { color: var(--exc-green); font-weight: 700; }
.slide-takeaway .label {
  display: block;
  font-size: 13px; font-weight: 800;
  letter-spacing: .14em; text-transform: uppercase;
  color: var(--exc-muted); margin-bottom: 10px;
}
.new-section .slide-takeaway { border-left-color: var(--ai-violet); }
.new-section .slide-takeaway strong { color: var(--ai-violet); }

table.metrics {
  width: 100%; border-collapse: collapse;
  margin-top: 16px;
  border-top: 2px solid var(--exc-line);
  font-size: 20px;
}
table.metrics th, table.metrics td {
  border-bottom: 1px solid var(--exc-line);
  padding: 10px 22px;
  text-align: left;
  line-height: 1.5;
}
table.metrics th {
  background: var(--exc-panel);
  font-weight: 700; font-size: 16px;
  color: var(--exc-muted-2); letter-spacing: .02em;
}
table.metrics th.num,
table.metrics td.num {
  text-align: right; font-variant-numeric: tabular-nums;
}

.kpi-row {
  display: grid; grid-template-columns: repeat(2, 1fr);
  gap: 24px; margin-top: 32px;
}
/* p5 거시지표: 좌(3) 표 · 우(1) KPI 스택 */
.p5-grid {
  display: grid; grid-template-columns: 3fr 1fr;
  gap: 32px;
  flex: 1; min-height: 0;
  align-items: start;
}
.p5-grid .metrics { margin-top: 0; }
.p5-kpi-stack {
  display: grid; grid-template-rows: 1fr 1fr;
  gap: 16px;
  height: 100%;
}
.p5-kpi-stack .kpi {
  margin: 0;
  padding: 24px 28px;
}
.p5-kpi-stack .kpi .value { font-size: 48px; }
.kpi {
  background: var(--exc-panel);
  border: 1px solid var(--exc-line);
  padding: 28px 32px;
  border-radius: 12px;
}
.kpi .label {
  font-size: 14px; font-weight: 800;
  letter-spacing: .14em; text-transform: uppercase;
  color: var(--exc-muted); margin-bottom: 10px;
}
.kpi .value {
  font-size: 56px; font-weight: 900;
  color: var(--exc-ink);
  letter-spacing: -.02em;
  font-variant-numeric: tabular-nums;
  line-height: 1.05;
}
.kpi.green .value { color: var(--exc-green); }
.kpi.violet .value { color: var(--ai-violet); }
.kpi .note {
  font-size: 14px; color: var(--exc-muted-2);
  margin-top: 8px; line-height: 1.4;
}

/* Overview tiles */
.ov-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 1fr;
  gap: 24px; margin-top: 24px;
}
.ov-tile {
  background: var(--exc-panel);
  border: 1px solid var(--exc-line);
  border-radius: 16px;
  padding: 32px;
  display: flex; flex-direction: column; gap: 12px;
  min-height: 280px;
}
.ov-tile .k { font-size: 13px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--exc-muted); }
.ov-tile .big { font-size: 80px; font-weight: 900; color: var(--exc-ink); letter-spacing: -.02em; line-height: 1; font-variant-numeric: tabular-nums; }
.ov-tile .big small { font-size: 28px; font-weight: 700; color: var(--exc-muted-2); margin-left: 6px; letter-spacing: 0; }
.ov-tile .v { font-size: 18px; color: var(--exc-ink-2); font-weight: 600; margin-top: auto; }
.ov-tile .v small { display: block; font-size: 14px; color: var(--exc-muted); font-weight: 500; margin-top: 4px; }
.ov-tile.is-hero {
  background: var(--ai-dusk); color: #fff; border-color: transparent;
}
.ov-tile.is-hero .k { color: var(--ai-cyan); }
.ov-tile.is-hero .topic-title {
  font-size: 36px; font-weight: 800; color: #fff;
  line-height: 1.25; letter-spacing: -.015em;
}
.ov-tile.is-hero .topic-title small {
  display: block; font-size: 16px; font-weight: 500;
  color: rgba(255,255,255,.65); margin-top: 12px; letter-spacing: 0;
}

/* ════════════════════════════════════════════
   Design-system components (catalog v1)
   ════════════════════════════════════════════ */

/* — Likert 발산 바 (T2 · 척도 응답) — */
.likert {
  display: flex; flex-direction: column; gap: 18px;
  flex: 0 0 auto;
  margin-top: 24px;
}
.likert-legend {
  display: flex; gap: 28px; flex-wrap: wrap;
  font-size: 16px; color: var(--exc-muted);
  margin-bottom: 8px;
}
.likert-legend .it { display: inline-flex; align-items: center; gap: 8px; }
.likert-legend .sw { width: 16px; height: 16px; border-radius: 3px; }
.likert .row {
  display: grid; grid-template-columns: 280px 1fr 120px; align-items: center;
  gap: 18px;
}
.likert .row .lbl {
  font-size: 26px; font-weight: 700; color: var(--exc-ink-2);
}
.likert .row .bar {
  display: flex; height: 64px;
  position: relative;
  background: var(--exc-panel-2);
  border-radius: 4px;
  overflow: hidden;
}
.likert .row .bar::before {
  content: ""; position: absolute; top: -4px; bottom: -4px;
  left: 50%; width: 2px; background: var(--exc-ink-2); opacity: .45; z-index: 2;
}
.likert .row .seg {
  height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; font-weight: 800; color: #fff;
  font-variant-numeric: tabular-nums; overflow: hidden; white-space: nowrap;
}
.likert .row .seg.neg-1, .likert .row .seg.neu, .likert .row .seg.pos-1 { color: var(--exc-ink-2); }
.likert .row .seg.neg-2 { background: var(--ds-rose); }
.likert .row .seg.neg-1 { background: color-mix(in srgb, var(--ds-rose) 55%, white); }
.likert .row .seg.neu   { background: var(--exc-line-2); }
.likert .row .seg.pos-1 { background: color-mix(in srgb, var(--ds-mint) 55%, white); }
.likert .row .seg.pos-2 { background: var(--ds-mint); }
.likert .row .neg-half, .likert .row .pos-half {
  display: flex; flex: 1; height: 100%;
}
.likert .row .neg-half { justify-content: flex-end; }
.likert .row .net {
  text-align: right; font-variant-numeric: tabular-nums;
  font-size: 34px; font-weight: 800; letter-spacing: -.01em;
}
.likert .row .net.is-pos { color: var(--ds-mint); }
.likert .row .net.is-neg { color: var(--ds-rose); }

/* — Likert 미니 (chart-row 셀 안에서 단일 차트로 사용) — */
.likert-mini {
  display: flex; flex-direction: column;
  height: 100%;
  background: var(--exc-panel);
  border: 1px solid var(--exc-line);
  border-radius: 16px;
  padding: 36px 36px 30px;
}
.likert-mini .plot {
  flex: 1; min-height: 0;
  display: flex; flex-direction: column; justify-content: center;
}
.likert-mini .title {
  font-size: 26px; font-weight: 800;
  color: var(--exc-ink); letter-spacing: -.01em;
  margin-bottom: 0;
  text-align: center;
}
.likert-mini .axis {
  display: grid;
  grid-template-columns: 1fr 1fr;
  font-size: 13px; font-weight: 800;
  letter-spacing: .14em; text-transform: uppercase;
  margin-bottom: 18px;
}
.likert-mini .axis .lh { text-align: right; color: var(--ds-rose); padding-right: 16px; }
.likert-mini .axis .rh { text-align: left; color: var(--exc-green); padding-left: 16px; }
.likert-mini .bar {
  display: flex; height: 60px;
  position: relative;
  background: var(--exc-panel-2);
  border-radius: 6px; overflow: hidden;
}
.likert-mini .bar::before {
  content: ""; position: absolute; top: -4px; bottom: -4px;
  left: 50%; width: 2px; background: var(--exc-ink-2); opacity: .45; z-index: 2;
}
.likert-mini .bar .seg {
  height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 800; color: #fff;
  font-variant-numeric: tabular-nums; overflow: hidden; white-space: nowrap;
}
.likert-mini .bar .seg.seg--light { color: var(--exc-ink-2); }
.likert-mini .legend {
  display: grid; gap: 10px 20px;
  grid-template-columns: 1fr 1fr;
  margin-top: 24px;
  font-size: 16px;
}
.likert-mini .legend .it {
  display: flex; align-items: center; gap: 8px;
  color: var(--exc-ink-2);
}
.likert-mini .legend .sw {
  width: 14px; height: 14px; border-radius: 3px;
  flex-shrink: 0;
}
.likert-mini .legend .vv {
  margin-left: auto; font-weight: 800; font-variant-numeric: tabular-nums;
  letter-spacing: -.01em;
}
.likert-mini .net-line {
  margin-top: 16px;
  display: flex; justify-content: center; align-items: baseline; gap: 12px;
  font-size: 13px; font-weight: 800;
  letter-spacing: .14em; text-transform: uppercase;
  color: var(--exc-muted);
}
.likert-mini .net-line .net {
  font-size: 28px; font-weight: 900; letter-spacing: -.02em;
  text-transform: none; font-variant-numeric: tabular-nums;
}
.likert-mini .net-line .net.is-pos { color: var(--ds-mint); }
.likert-mini .net-line .net.is-neg { color: var(--ds-rose); }

.likert-score-grid {
  display: grid; grid-template-columns: repeat(5, 1fr);
  gap: 20px; margin-top: 28px;
  flex: 1; min-height: 0;
}
.likert-score-grid .cell {
  background: var(--exc-panel);
  border: 1px solid var(--exc-line);
  border-radius: 16px;
  padding: 28px 24px;
  display: flex; flex-direction: column; gap: 10px;
  justify-content: center;
  border-top: 5px solid var(--exc-line-2);
}
.likert-score-grid .cell.neg-2 { border-top-color: var(--ds-rose); }
.likert-score-grid .cell.neg-1 { border-top-color: color-mix(in srgb, var(--ds-rose) 55%, white); }
.likert-score-grid .cell.pos-1 { border-top-color: color-mix(in srgb, var(--ds-mint) 55%, white); }
.likert-score-grid .cell.pos-2 { border-top-color: var(--ds-mint); }
.likert-score-grid .cell .lab {
  font-size: 17px; font-weight: 700; letter-spacing: .02em;
  color: var(--exc-muted-2);
}
.likert-score-grid .cell .val {
  font-size: 60px; font-weight: 900; color: var(--exc-ink);
  font-variant-numeric: tabular-nums; letter-spacing: -.02em; line-height: 1;
}
.likert-score-grid .cell .n {
  font-size: 16px; color: var(--exc-muted); font-weight: 500;
}

/* — 슬로프 차트 (T2 · 두 시점/두 변수 격차 시각화) — */
.slope-wrap {
  flex: 1; min-height: 0;
  display: flex; flex-direction: column;
  gap: 18px;
  margin-top: 16px;
}
.slope-wrap .axis-labels {
  display: grid; grid-template-columns: 240px 1fr 240px;
  align-items: center;
  font-size: 14px; font-weight: 800;
  letter-spacing: .14em; text-transform: uppercase;
  color: var(--exc-muted);
  padding: 0 16px;
}
.slope-wrap .axis-labels .lh,
.slope-wrap .axis-labels .rh {
  text-align: center;
}
.slope-wrap .axis-labels .lh strong,
.slope-wrap .axis-labels .rh strong {
  display: block; font-size: 24px; font-weight: 800;
  color: var(--exc-ink); letter-spacing: -.02em;
  text-transform: none; margin-bottom: 4px;
}
.slope-wrap svg.slope {
  flex: 1; min-height: 0;
  width: 100%; height: 100%;
}
.slope-wrap svg.slope .axis-line {
  stroke: var(--exc-line-2); stroke-width: 1; stroke-dasharray: 4 4;
}
.slope-wrap svg.slope .ln-up    { stroke: var(--exc-green); stroke-width: 3; }
.slope-wrap svg.slope .ln-down  { stroke: var(--ds-rose);   stroke-width: 3; }
.slope-wrap svg.slope .ln-flat  { stroke: var(--exc-muted-2); stroke-width: 2; opacity: .55; }
.slope-wrap svg.slope .dot-up   { fill: var(--exc-green); }
.slope-wrap svg.slope .dot-down { fill: var(--ds-rose); }
.slope-wrap svg.slope .dot-flat { fill: var(--exc-muted-2); }
.slope-wrap svg.slope text {
  font-family: var(--font-sans);
  font-variant-numeric: tabular-nums;
}
.slope-wrap svg.slope text.lbl-l {
  text-anchor: end; font-size: 18px; font-weight: 700; fill: var(--exc-ink-2);
}
.slope-wrap svg.slope text.lbl-r {
  text-anchor: start; font-size: 18px; font-weight: 700; fill: var(--exc-ink-2);
}
.slope-wrap svg.slope text.val-l {
  text-anchor: end; font-size: 18px; font-weight: 800; fill: var(--exc-ink);
}
.slope-wrap svg.slope text.val-r {
  text-anchor: start; font-size: 18px; font-weight: 800; fill: var(--exc-ink);
}
.slope-wrap svg text.hd-title {
  text-anchor: middle; font-size: 24px; font-weight: 800;
  fill: var(--exc-ink); letter-spacing: -.01em;
}
.slope-wrap svg text.hd-sub {
  text-anchor: middle; font-size: 13px; font-weight: 800;
  fill: var(--exc-muted-2); letter-spacing: .12em;
}

/* Sankey/알루비얼 (p9 — 참가→지출 구성 재배치) */
.slope-wrap svg.sankey { flex: 1; min-height: 0; width: 100%; height: 100%; }
.slope-wrap svg.sankey text {
  font-family: var(--font-sans); font-variant-numeric: tabular-nums;
}
.slope-wrap svg.sankey .sk-nm { fill: var(--exc-muted); font-weight: 600; }
.slope-wrap svg.sankey .sk-vl { font-weight: 800; }

/* — 누적 스택 + 잉여 (합 일관성 결함 시각화) — */
.stack-with-surplus {
  flex: 1; min-height: 0;
  display: flex; flex-direction: column;
  justify-content: center;
  gap: 36px;
  margin-top: 24px;
}
.stack-with-surplus .axis {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px; align-items: end;
  font-size: 16px; font-weight: 700; color: var(--exc-muted-2);
  letter-spacing: .08em; text-transform: uppercase;
}
.stack-with-surplus .axis .total {
  font-size: 24px; font-weight: 800;
  color: var(--exc-amber);
  letter-spacing: -.01em;
  text-transform: none; font-variant-numeric: tabular-nums;
}
.stack-with-surplus .stack {
  display: grid;
  height: 220px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,.05));
}
.stack-with-surplus .seg {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  color: #fff; font-weight: 800;
  padding: 0 12px; gap: 4px;
  position: relative;
}
.stack-with-surplus .seg .nm { font-size: 22px; opacity: .92; letter-spacing: -.005em; }
.stack-with-surplus .seg .vv { font-size: 42px; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.stack-with-surplus .seg.s1 { background: var(--exc-green-300); color: var(--exc-ink); }
.stack-with-surplus .seg.s2 { background: var(--exc-green); }
.stack-with-surplus .seg.s3 { background: var(--exc-green-600); }
.stack-with-surplus .seg.s4 { background: var(--ai-violet); }
.stack-with-surplus .seg.surplus {
  background: repeating-linear-gradient(45deg,
              var(--exc-amber) 0, var(--exc-amber) 8px,
              color-mix(in srgb, var(--exc-amber) 50%, white) 8px,
              color-mix(in srgb, var(--exc-amber) 50%, white) 16px);
  color: var(--exc-ink);
}
.stack-with-surplus .legend {
  display: flex; gap: 36px; flex-wrap: wrap;
  font-size: 18px; color: var(--exc-muted);
  margin-top: 4px;
}
.stack-with-surplus .legend .it { display: inline-flex; align-items: center; gap: 8px; }
.stack-with-surplus .legend .sw {
  width: 18px; height: 18px; border-radius: 4px;
}

/* — 발산 바 (T2 · 변동 방향성 표현) — */
/* 중앙 발산형: |감소값|감소바|구간(중앙 스파인)|증가바|증가값| */
.divergent {
  display: flex; flex-direction: column;
  justify-content: space-evenly;
  flex: 1; min-height: 0;
  margin-top: 16px;
}
.divergent .axis {
  display: grid;
  grid-template-columns: 96px 1fr 124px 1fr 96px;
  align-items: center; gap: 14px;
  font-size: 13px; font-weight: 800;
  letter-spacing: .14em; text-transform: uppercase;
  color: var(--exc-muted-2);
  padding-bottom: 10px;
  border-bottom: 1px solid var(--exc-line);
}
.divergent .axis .lh { grid-column: 1 / 3; text-align: right; color: var(--ds-rose); }
.divergent .axis .mh { grid-column: 3; text-align: center; }
.divergent .axis .rh { grid-column: 4 / 6; text-align: left; color: var(--exc-green); }
.divergent .row {
  display: grid;
  grid-template-columns: 96px 1fr 124px 1fr 96px;
  align-items: center; gap: 14px;
}
.divergent .row .dval { text-align: right; font-size: 19px; font-weight: 800; color: var(--ds-rose); font-variant-numeric: tabular-nums; }
.divergent .row .ival { text-align: left;  font-size: 19px; font-weight: 800; color: var(--exc-green); font-variant-numeric: tabular-nums; }
.divergent .row .dbar, .divergent .row .ibar {
  height: 40px; background: var(--exc-panel);
  display: flex; overflow: hidden;
}
.divergent .row .dbar { justify-content: flex-end; border-radius: 6px 0 0 6px; }
.divergent .row .ibar { justify-content: flex-start; border-radius: 0 6px 6px 0; }
.divergent .row .dbar .b { height: 100%; background: var(--ds-rose); border-radius: 6px 0 0 6px; }
.divergent .row .ibar .b { height: 100%; background: var(--exc-green); border-radius: 0 6px 6px 0; }
.divergent .row .mid {
  text-align: center; font-size: 21px; font-weight: 800; color: var(--exc-ink);
  font-variant-numeric: tabular-nums; letter-spacing: -.01em;
}

/* — 히트 스트립 (T3 · 분포 압축) — */
.heatstrip-wrap {
  flex: 1; min-height: 0;
  display: flex; flex-direction: column;
  justify-content: space-evenly;
  margin-top: 24px;
}
.heatstrip {
  display: grid;
  grid-template-columns: 320px 1fr 120px;
  align-items: center; gap: 28px;
}
.heatstrip .lbl {
  font-size: 26px; font-weight: 700; color: var(--exc-ink-2);
}
.heatstrip .strip {
  display: grid; grid-template-columns: repeat(10, 1fr);
  gap: 6px; height: 60px;
}
.heatstrip .cell {
  background: var(--exc-panel-2);
  border-radius: 3px;
}
.heatstrip .cell.on { background: var(--ai-violet); }
.heatstrip .cell.partial { background: var(--ai-violet); opacity: .35; }
.heatstrip .v {
  font-size: 34px; font-weight: 800;
  color: var(--ai-violet);
  font-variant-numeric: tabular-nums;
  text-align: right; letter-spacing: -.01em;
}

/* — 방사형 우선순위 (T3 · 핵심 KPI) — */
.radial-summary {
  flex: 1; min-height: 0;
  display: grid; grid-template-columns: 1.1fr 1fr;
  gap: 56px; align-items: center;
  margin-top: 24px;
}
.radial-summary .radial {
  position: relative;
  width: 520px; height: 520px;
  margin: 0 auto;
}
.radial-summary .radial svg { width: 100%; height: 100%; }
.radial-summary .radial .center {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  text-align: center;
}
.radial-summary .radial .center .v {
  font-size: 96px; font-weight: 900;
  color: var(--exc-ink); letter-spacing: -.03em;
  font-variant-numeric: tabular-nums; line-height: 1;
}
.radial-summary .radial .center .v small {
  font-size: 38px; font-weight: 700; color: var(--exc-muted-2); margin-left: 4px;
}
.radial-summary .radial .center .l {
  font-size: 16px; font-weight: 800;
  letter-spacing: .14em; text-transform: uppercase;
  color: var(--exc-muted); margin-top: 16px;
}
.radial-summary .kpi-stack {
  display: flex; flex-direction: column; gap: 12px;
}
.radial-summary .kpi-row-item {
  display: grid; grid-template-columns: 14px 1fr auto;
  gap: 18px; align-items: center;
  padding: 18px 22px;
  background: var(--exc-panel);
  border-radius: 12px;
  border: 1px solid var(--exc-line);
}
.radial-summary .kpi-row-item .sw {
  width: 14px; height: 44px; border-radius: 4px;
}
.radial-summary .kpi-row-item .nm {
  font-size: 20px; font-weight: 700; color: var(--exc-ink);
  letter-spacing: -.005em;
}
.radial-summary .kpi-row-item .nm small {
  display: block;
  font-size: 14px; font-weight: 500; color: var(--exc-muted);
  margin-top: 4px; letter-spacing: 0;
}
.radial-summary .kpi-row-item .vv {
  font-size: 32px; font-weight: 900;
  font-variant-numeric: tabular-nums; letter-spacing: -.01em;
}

/* — T1 KPI (cover / overview / intro — 기존 컴포넌트 유지, 표시는 가벼움) — */
section.slide.t1.content .slide-headline { font-size: 88px; }

/* — T3 풀-블리드: 차트 한 페이지 가득 (헤드라인 축소, meta 최소화) — */
section.slide.t3.content .slide-headline { font-size: 64px; }
section.slide.t3.content .meta-line { margin-bottom: 24px; padding-bottom: 14px; }

/* — T4 부록: 데이터 밀도 (헤드라인 작게, body 더 빽빽) — */
section.slide.t4.content { padding: 120px 64px 96px; }
section.slide.t4.content .slide-headline { font-size: 56px; }
section.slide.t4.content .meta-line { font-size: 14px; }

/* Overlay (slide count + hints) */
.deck-overlay {
  position: fixed; bottom: 24px;
  left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 16px;
  background: rgba(0,0,0,.75); color: #fff;
  padding: 10px 18px;
  border-radius: 999px;
  font-size: 12px; letter-spacing: .08em; text-transform: uppercase;
  font-weight: 700;
  z-index: 100;
  backdrop-filter: blur(8px);
  transition: opacity 240ms; opacity: 1;
}
.deck-overlay.idle { opacity: 0; }
.deck-overlay .count { font-variant-numeric: tabular-nums; }
.deck-overlay .hint { color: rgba(255,255,255,.6); font-weight: 500; letter-spacing: 0; text-transform: none; }
.deck-overlay kbd {
  display: inline-block;
  background: rgba(255,255,255,.1);
  border: 1px solid rgba(255,255,255,.2);
  border-radius: 4px;
  padding: 2px 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: rgba(255,255,255,.85);
  margin: 0 2px;
}

/* Print: each slide is its own page at 1920×1080 */
@media print {
  @page { size: 1920px 1080px; margin: 0; }
  body { background: #fff; overflow: visible; }
  .deck-stage { position: static; }
  .canvas { width: 1920px; height: auto; transform: none !important; box-shadow: none; }
  section.slide {
    display: block !important;
    position: relative;
    width: 1920px; height: 1080px;
    page-break-after: always;
    visibility: visible !important;
    opacity: 1 !important;
  }
  .deck-overlay { display: none; }
}
"""

# ────────────────────────────────────────────────
# JS (deck nav + scale-to-fit + ECharts inits)
# ────────────────────────────────────────────────

JS = """
const TOTAL = __TOTAL__;
const PAGE_DATA = __PAGE_DATA__;

// EXC + AI 팔레트 (스크롤 페이지와 동일)
const C = {
  green:'#009858', green2:'#4DBE89', green3:'#8CD0AE', green4:'#C2E6D3',
  navy:'#0E2A47', amber:'#F4B740', red:'#E94B35', info:'#2A6FDB',
  ink:'#111111', ink2:'#333333', muted:'#888888', line:'#E5E7EB',
  panel:'#F7F8F9', violet:'#5B5BF0', cyan:'#00E5C8',
};
const LIKERT_5 = [C.green, C.green2, C.muted, C.amber, C.red];
const PIE_BASE = [C.green, C.navy, C.amber, C.green2, C.info, C.red, C.green3, C.muted];
const AI_COLOR = C.violet;
const BASE_TEXT = { fontFamily: '"Pretendard Variable", Pretendard, sans-serif', color: C.ink2 };

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
function chartTitle(text) {
  return { text, left: 'center', textStyle: { fontSize: 22, fontWeight: 700, color: C.ink, ...BASE_TEXT } };
}
function commonGrid() { return { left: 200, right: 120, top: 80, bottom: 50 }; }
function valueAxis() {
  return { type:'value', max:100,
    axisLabel:{ formatter:'{value}%', color:C.muted, fontFamily:BASE_TEXT.fontFamily, fontSize:18 },
    axisLine:{ lineStyle:{ color:C.line }},
    splitLine:{ lineStyle:{ color:C.line, type:'dashed' }} };
}
function categoryAxis(data) {
  return { type:'category', data,
    axisLabel:{ color:C.ink2, fontFamily:BASE_TEXT.fontFamily, fontSize:18 },
    axisLine:{ lineStyle:{ color:C.line }},
    axisTick:{ show:false } };
}
function renderLikertMini(elId, opts) {
  const el = document.getElementById(elId);
  if (!el) return;
  // items: [{ label, pct, polarity: 'neg'|'neu'|'pos', color }]
  const segs = opts.items.map(item =>
    `<div class="seg${item.light ? ' seg--light' : ''}" style="width:${item.pct}%; background:${item.color};" title="${item.label} ${item.pct}%">${item.pct >= 9 ? item.pct + '%' : ''}</div>`
  ).join('');
  const legendItems = opts.items.map(item => `
    <div class="it">
      <span class="sw" style="background:${item.color}"></span>
      <span>${item.label}</span>
      <span class="vv">${item.pct}%</span>
    </div>`).join('');
  const negSum = opts.items.filter(x=>x.polarity==='neg').reduce((a,b)=>a+b.pct, 0);
  const posSum = opts.items.filter(x=>x.polarity==='pos').reduce((a,b)=>a+b.pct, 0);
  const net = Math.round(posSum - negSum);
  const netSign = net >= 0 ? '+' : '';
  const netCls = net >= 0 ? 'is-pos' : 'is-neg';
  el.innerHTML = `
    <div class="title">${opts.title}</div>
    <div class="plot">
      <div class="axis">
        <div class="lh">← ${opts.negLabel || '부정'}</div>
        <div class="rh">${opts.posLabel || '긍정'} →</div>
      </div>
      <div class="bar">${segs}</div>
    </div>
    <div class="legend">${legendItems}</div>
    <div class="net-line">
      <span>${opts.netLabel || 'Net'}</span>
      <span class="net ${netCls}">${netSign}${net}</span>
    </div>`;
}

function horizontalBar100(elId, items, title, color) {
  color = color || C.green;
  echarts.init(document.getElementById(elId)).setOption({
    title: chartTitle(title), grid: commonGrid(),
    tooltip:{ trigger:'axis', axisPointer:{ type:'shadow' }, textStyle: BASE_TEXT },
    xAxis: valueAxis(),
    yAxis: categoryAxis(items.map(x=>x.label)),
    series:[{ type:'bar', data: items.map(x=>x.pct),
      barWidth:'58%',
      label:{ show:true, position:'right', formatter:'{c}%', color:C.ink2, fontSize:18, fontFamily:BASE_TEXT.fontFamily, fontWeight:600 },
      itemStyle:{ color, borderRadius:[0,6,6,0] }
    }]
  });
}

function initP4() {
  const d = PAGE_DATA.p4; if (!d) return;
  const total = d.n;
  echarts.init(document.getElementById('p4-div')).setOption({
    title: { ...chartTitle('조직 구분'), top: 6 },
    tooltip:{ trigger:'item', formatter:'{b}: {c} ({d}%)', textStyle:BASE_TEXT },
    color: PIE_BASE,
    series:[{ type:'pie', radius:['46%','70%'], center:['50%','58%'],
      minAngle: 6, avoidLabelOverlap: true,
      data: d.div.map(x=>({ name:x.label, value:x.count })),
      label:{ formatter:'{b}\\n{c}건 · {d}%', fontFamily:BASE_TEXT.fontFamily, fontSize:16, color:C.ink2, lineHeight:20 },
      labelLine:{ length:16, length2:18 },
      itemStyle:{ borderWidth:3, borderColor:'#fff' },
    }]
  });
  echarts.init(document.getElementById('p4-cate')).setOption({
    title: chartTitle('업종 분포 (상위 10)'),
    grid: { left: 200, right: 120, top: 70, bottom: 30 },
    tooltip:{ trigger:'axis', axisPointer:{ type:'shadow' }, textStyle:BASE_TEXT,
              formatter: (p) => `${p[0].name}: ${p[0].value}건` },
    xAxis:{ type:'value',
      axisLabel:{ formatter:'{value}건', color:C.muted, fontFamily:BASE_TEXT.fontFamily, fontSize:16 },
      axisLine:{ lineStyle:{ color:C.line }},
      splitLine:{ lineStyle:{ color:C.line, type:'dashed' }} },
    yAxis:{ type:'category', data: d.cate_top.map(x=>x.label), inverse:true,
      axisLabel:{ color:C.ink2, fontFamily:BASE_TEXT.fontFamily, fontSize:18 },
      axisLine:{ lineStyle:{ color:C.line }}, axisTick:{ show:false } },
    series:[{ type:'bar',
      data: d.cate_top.map((x,i)=>({ value:x.count,
        itemStyle:{ color: i === 0 ? C.green : (i < 3 ? C.green2 : C.green3),
                    borderRadius:[0,6,6,0] }})),
      barWidth:'62%',
      label:{ show:true, position:'right',
              formatter: (p) => `${p.value}건 · ${(p.value / total * 100).toFixed(1).replace(/\\.0$/,'')}%`,
              color:C.ink2, fontSize:16, fontFamily:BASE_TEXT.fontFamily, fontWeight:600 },
    }]
  });
}

function initP5() {
  const d = PAGE_DATA.p5; if (!d) return;
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
  const d = PAGE_DATA.p6; if (!d) return;
  const summaryColors = [C.green, C.muted, C.red];
  echarts.init(document.getElementById('p6-summary')).setOption({
    title: chartTitle('예산 변동 요약 (확대 / 유사 / 축소)'),
    grid: commonGrid(),
    tooltip:{ trigger:'axis', axisPointer:{ type:'shadow' }, textStyle:BASE_TEXT },
    xAxis: valueAxis(), yAxis: categoryAxis(d.summary.map(x=>x.label)),
    series:[{ type:'bar',
      data: d.summary.map((x,i)=>({ value:x.pct, itemStyle:{ color: summaryColors[i] || C.green, borderRadius:[0,6,6,0] }})),
      barWidth:'58%',
      label:{ show:true, position:'right', formatter:'{c}%', color:C.ink2, fontSize:18, fontFamily:BASE_TEXT.fontFamily, fontWeight:600 },
    }]
  });
  // 발산 바 — 5개 구간, 좌측 감소 · 우측 증가
  const buckets = [
    { lab: '1~5%',   dec: '감소 1~5%',   inc: '증가 1~5%' },
    { lab: '6~15%',  dec: '감소 6~15%',  inc: '증가 6~15%' },
    { lab: '16~25%', dec: '감소 16~25%', inc: '증가 16~25%' },
    { lab: '26~50%', dec: '감소 26~50%', inc: '증가 26~50%' },
    { lab: '51%+',   dec: '감소 51%+',   inc: '증가 51%+' },
  ];
  const detailBy = Object.fromEntries(d.detail.map(x => [x.label, x.pct]));
  const allVals = buckets.flatMap(b => [detailBy[b.dec]||0, detailBy[b.inc]||0]);
  const maxPct = Math.max(...allVals, 1);
  const wrap = document.getElementById('p6-detail');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="axis">
      <div class="lh">← 감소</div>
      <div class="mh">증감 규모</div>
      <div class="rh">증가 →</div>
    </div>
    ${buckets.map(b => {
      const dPct = detailBy[b.dec] || 0;
      const iPct = detailBy[b.inc] || 0;
      return `
        <div class="row">
          <div class="dval">${dPct > 0 ? '−' + dPct + '%' : ''}</div>
          <div class="dbar"><div class="b" style="width:${dPct/maxPct*100}%"></div></div>
          <div class="mid">${b.lab}</div>
          <div class="ibar"><div class="b" style="width:${iPct/maxPct*100}%"></div></div>
          <div class="ival">${iPct > 0 ? '+' + iPct + '%' : ''}</div>
        </div>`;
    }).join('')}`;
}

function initP9() {
  // 2단 알루비얼(Sankey): 좌=참가순 / 우=지출순(독립 정렬) → 순위 역전 시 리본 교차.
  // 라벨은 한 줄(좌 "이름 값%" / 우 "값% 이름"), 밴드 중앙 정렬. 값 크기에 따라 폰트·색 차등.
  const d = PAGE_DATA.p9; if (!d) return;
  const wrap = document.getElementById('p9-sankey'); if (!wrap) return;
  const VBW = 1760, VBH = 440;
  const LX = 380, RX = 1380, BW = 26;
  const TOP = 122, BOT = 412, GAP = 10, MINH = 16;   // MINH: 최소 밴드 높이(가독성)
  const COLORS = [C.green, C.navy, C.violet, C.green2, C.amber, C.info];
  const cats = d.categories;
  const n = cats.length;
  const headOrder = cats.map((_, i) => i).sort((a, b) => d.headcount_pct[b] - d.headcount_pct[a]);
  const spendOrder = cats.map((_, i) => i).sort((a, b) => d.spend_pct[b] - d.spend_pct[a]);
  const colorOf = {}; headOrder.forEach((i, k) => { colorOf[i] = COLORS[k % COLORS.length]; }); // 색은 참가순 고정
  const usableH = (BOT - TOP) - GAP * (n - 1);
  // 최소 높이 보장: 각 밴드 = MINH + (잔여 높이 × 비중)
  const heights = (valFn) => {
    const vs = cats.map((_, i) => valFn(i));
    const vSum = vs.reduce((a, b) => a + b, 0) || 1;
    const free = Math.max(0, usableH - MINH * n);
    return vs.map(v => MINH + free * (v / vSum));
  };
  const lh = heights(i => d.headcount_pct[i]);
  const rh = heights(i => d.spend_pct[i]);
  const pos = {};
  let ly = TOP; headOrder.forEach(i => { pos[i] = { lTop: ly, lBot: ly + lh[i] }; ly += lh[i] + GAP; });
  let ry = TOP; spendOrder.forEach(i => { pos[i].rTop = ry; pos[i].rBot = ry + rh[i]; ry += rh[i] + GAP; });
  const ribbons = headOrder.map(i => {   // 큰 것부터 → 작은 리본이 위에
    const b = pos[i], x1 = LX + BW, x2 = RX - BW, mx = (x1 + x2) / 2;
    return `<path d="M${x1},${b.lTop} C${mx},${b.lTop} ${mx},${b.rTop} ${x2},${b.rTop} L${x2},${b.rBot} C${mx},${b.rBot} ${mx},${b.lBot} ${x1},${b.lBot} Z" fill="${colorOf[i]}" fill-opacity=".3"/>`;
  }).join('');
  const bars = cats.map((_, i) => { const b = pos[i]; return `
    <rect x="${LX}" y="${b.lTop}" width="${BW}" height="${b.lBot - b.lTop}" rx="3" fill="${colorOf[i]}"/>
    <rect x="${RX - BW}" y="${b.rTop}" width="${BW}" height="${b.rBot - b.rTop}" rx="3" fill="${colorOf[i]}"/>`; }).join('');
  // 값별 폰트 크기·색 (선명성)
  const fsOf = (v) => Math.round(15 + Math.min(v, 55) * 0.26);   // 3%→16, 30%→23, 50%→28
  const colOf = (v) => v >= 25 ? 'var(--exc-ink)' : (v >= 10 ? 'var(--exc-ink-2)' : 'var(--exc-muted)');
  const MIN = 30;
  const stagger = (orderArr, midFn) => {
    let prev = -1e9; const m = {};
    orderArr.forEach(i => { let y = midFn(i); if (y - prev < MIN) y = prev + MIN; prev = y; m[i] = y; });
    const over = m[orderArr[orderArr.length - 1]] - (BOT - 2);
    if (over > 0) orderArr.forEach(i => { m[i] -= over; });
    return m;
  };
  const lY = stagger(headOrder, i => (pos[i].lTop + pos[i].lBot) / 2);
  const rY = stagger(spendOrder, i => (pos[i].rTop + pos[i].rBot) / 2);
  const label = (i, side) => {
    const v = side === 'l' ? d.headcount_pct[i] : d.spend_pct[i];
    const fs = fsOf(v), col = colOf(v);
    const x = side === 'l' ? LX - 20 : RX + 20;
    const y = side === 'l' ? lY[i] : rY[i];
    const anchor = side === 'l' ? 'end' : 'start';
    const nm = `<tspan class="sk-nm">${cats[i]}</tspan>`;
    const vl = `<tspan class="sk-vl" style="fill:${col}">${v}%</tspan>`;
    const inner = side === 'l' ? `${nm} ${vl}` : `${vl} ${nm}`;
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle" style="font-size:${fs}px">${inner}</text>`;
  };
  const labels = cats.map((_, i) => label(i, 'l') + label(i, 'r')).join('');
  wrap.innerHTML = `
    <svg class="sankey" viewBox="0 0 ${VBW} ${VBH}" preserveAspectRatio="xMidYMid meet">
      <text x="${LX + BW / 2}" y="40" class="hd-title">참가 인원 비율</text>
      <text x="${LX + BW / 2}" y="66" class="hd-sub">응답 평균</text>
      <text x="${RX - BW / 2}" y="40" class="hd-title">지출 비율</text>
      <text x="${RX - BW / 2}" y="66" class="hd-sub">응답 평균</text>
      ${ribbons}${bars}${labels}
    </svg>`;
}

// (이전) 슬로프 버전 — 원복용 보존, 현재 미사용
function initP9Slope() {
  const d = PAGE_DATA.p9; if (!d) return;
  const wrap = document.getElementById('p9-slope'); if (!wrap) return;
  // viewBox 비율(≈4.0)을 슬라이드 본문 셀(약 1760×440)에 맞춰 letterbox 최소화 → 가로 가득.
  // 두 축 헤더를 SVG 안에 두어 축 x좌표와 항상 정렬되게 함.
  const VBW = 1760, VBH = 440;
  const LX = 300, RX = 1460;           // 축을 가장자리 가까이 → 가로 활용 + 라벨 여백 확보
  const HEAD_Y = 36, SUB_Y = 64;
  const TOP = 116, BOT = 410;          // 헤더 아래 플롯 영역
  const MIN_SEP = 40;                  // 두 줄(label+value) 호흡 분리
  const allVals = [...d.headcount_pct, ...d.spend_pct];
  const maxVal = Math.max(...allVals, 10);
  const scaleY = (v) => BOT - (v / maxVal) * (BOT - TOP);
  const DELTA_THRESH = 1.5;
  const items = d.categories.map((cat, i) => ({
    label: cat, head: d.headcount_pct[i], spend: d.spend_pct[i],
    delta: d.spend_pct[i] - d.headcount_pct[i],
  }));
  // 라벨 y 위치 분리(가까운 라벨 stagger) + 하단 초과 시 그룹 전체를 위로 클램프
  function staggerLabels(items, side) {
    const key = side === 'l' ? 'head' : 'spend';
    const sorted = [...items].sort((a,b) => b[key] - a[key]);
    const labelY = new Map();
    let prevY = -Infinity;
    for (const it of sorted) {
      let y = scaleY(it[key]);
      if (y - prevY < MIN_SEP) y = prevY + MIN_SEP;
      labelY.set(it.label, y);
      prevY = y;
    }
    const over = prevY - (BOT + 8);
    if (over > 0) for (const k of labelY.keys()) labelY.set(k, labelY.get(k) - over);
    return labelY;
  }
  const leftLY = staggerLabels(items, 'l');
  const rightLY = staggerLabels(items, 'r');
  const lines = items.map(item => {
    const dir = Math.abs(item.delta) <= DELTA_THRESH ? 'flat'
              : (item.delta > 0 ? 'up' : 'down');
    const y1 = scaleY(item.head);
    const y2 = scaleY(item.spend);
    const lY = leftLY.get(item.label);
    const rY = rightLY.get(item.label);
    return `
      <line x1="${LX}" y1="${y1}" x2="${RX}" y2="${y2}" class="ln-${dir}"/>
      <circle cx="${LX}" cy="${y1}" r="7" class="dot-${dir}"/>
      <circle cx="${RX}" cy="${y2}" r="7" class="dot-${dir}"/>
      <text x="${LX-22}" y="${lY - 4}" class="lbl-l">${item.label}</text>
      <text x="${LX-22}" y="${lY + 18}" class="val-l">${item.head}%</text>
      <text x="${RX+22}" y="${rY - 4}" class="lbl-r">${item.label}</text>
      <text x="${RX+22}" y="${rY + 18}" class="val-r">${item.spend}%</text>`;
  }).join('');
  wrap.innerHTML = `
    <svg class="slope" viewBox="0 0 ${VBW} ${VBH}" preserveAspectRatio="xMidYMid meet">
      <text x="${LX}" y="${HEAD_Y}" class="hd-title">참가 인원 비율</text>
      <text x="${LX}" y="${SUB_Y}" class="hd-sub">응답 평균</text>
      <text x="${RX}" y="${HEAD_Y}" class="hd-title">지출 비율</text>
      <text x="${RX}" y="${SUB_Y}" class="hd-sub">응답 평균</text>
      <line x1="${LX}" y1="${TOP}" x2="${LX}" y2="${BOT}" class="axis-line"/>
      <line x1="${RX}" y1="${TOP}" x2="${RX}" y2="${BOT}" class="axis-line"/>
      ${lines}
    </svg>`;
}

function initP10() {
  const d = PAGE_DATA.p10; if (!d) return;
  const wrap = document.getElementById('p10-stack'); if (!wrap) return;
  // 합 109% → 100%까지가 실제 응답, 초과분(잉여)을 별도 seg
  const sum = d.values.reduce((a,b)=>a+b, 0);
  const surplus = Math.max(0, sum - 100);
  const fr = d.values.map(v => v.toFixed(2)).concat([surplus.toFixed(2)]).join('fr ') + 'fr';
  const classes = ['s1','s2','s3','s4'];
  const segs = d.categories.map((c,i) => `
    <div class="seg ${classes[i] || ''}">
      <div class="nm">${c}</div>
      <div class="vv">${d.values[i].toFixed(1)}%</div>
    </div>`).join('') + `
    <div class="seg surplus">
      <div class="nm">잉여</div>
      <div class="vv">+${surplus.toFixed(1)}%</div>
    </div>`;
  wrap.innerHTML = `
    <div class="axis">
      <div>직책별 교육비 지출 비율 (응답 평균)</div>
      <div class="total">합계 ${sum.toFixed(1)}% <span style="color:var(--exc-muted);font-weight:600;letter-spacing:0;">(정상 100% 대비 +${surplus.toFixed(1)}p)</span></div>
    </div>
    <div class="stack" style="grid-template-columns: ${fr}">${segs}</div>
    <div class="legend">
      <span class="it"><span class="sw" style="background:var(--exc-green-300)"></span>신입</span>
      <span class="it"><span class="sw" style="background:var(--exc-green)"></span>비직책자</span>
      <span class="it"><span class="sw" style="background:var(--exc-green-600)"></span>직책자</span>
      <span class="it"><span class="sw" style="background:var(--ai-violet)"></span>임원</span>
      <span class="it"><span class="sw" style="background:repeating-linear-gradient(45deg, var(--exc-amber) 0, var(--exc-amber) 4px, color-mix(in srgb, var(--exc-amber) 50%, white) 4px, color-mix(in srgb, var(--exc-amber) 50%, white) 8px);"></span>잉여 (합 일관성 결함)</span>
    </div>`;
}

function initP11() {
  const d = PAGE_DATA.p11; if (!d) return;
  const wrap = document.getElementById('p11-heatstrip');
  if (!wrap) return;
  // 10칸 스트립: 각 구간의 pct를 10으로 나눈 만큼 채움 (반올림). 50% 이상 0건이면 라벨도 0으로 표시
  // 절대값(%) 기준이 아니라 max 대비 비율로 정규화 (구간 간 상대 강도)
  const maxPct = Math.max(...d.dist.map(x => x.pct), 1);
  wrap.innerHTML = d.dist.map(item => {
    const intensity = item.pct / maxPct;
    const filledCells = Math.round(intensity * 10);
    const cells = Array.from({ length: 10 }, (_, i) => {
      if (i < filledCells) return '<div class="cell on"></div>';
      if (i === filledCells && intensity * 10 - filledCells > 0.2) return '<div class="cell partial"></div>';
      return '<div class="cell"></div>';
    }).join('');
    return `
      <div class="heatstrip">
        <div class="lbl">${item.label}</div>
        <div class="strip">${cells}</div>
        <div class="v">${item.pct}%</div>
      </div>`;
  }).join('');
}
function initP12() {
  const d = PAGE_DATA.p12; if (!d) return;
  // 5점 척도 dict — 응답 없는 라벨은 0으로
  const by = Object.fromEntries(d.dist.map(x => [x.label, x]));
  const get = (lab) => by[lab] || { count: 0, pct: 0 };
  const sNeg2 = get('매우불만족'), sNeg1 = get('불만족'),
        sNeu  = get('보통'),
        sPos1 = get('만족'),     sPos2 = get('매우만족');
  const net = Math.round((sPos1.pct + sPos2.pct) - (sNeg1.pct + sNeg2.pct));
  const netSign = net >= 0 ? '+' : '';
  const netCls  = net >= 0 ? 'is-pos' : 'is-neg';
  const bar = document.getElementById('p12-likert');
  const seg12 = (cls, s) => `<div class="seg ${cls}" style="width:${s.pct}%">${s.pct >= 4 ? s.pct + '%' : ''}</div>`;
  if (bar) bar.innerHTML = `
    <div class="row">
      <div class="lbl">교육 투자 만족도</div>
      <div class="bar">
        ${seg12('neg-2', sNeg2)}
        ${seg12('neg-1', sNeg1)}
        ${seg12('neu', sNeu)}
        ${seg12('pos-1', sPos1)}
        ${seg12('pos-2', sPos2)}
      </div>
      <div class="net ${netCls}">${netSign}${net}</div>
    </div>`;
  const grid = document.getElementById('p12-score-grid');
  if (grid) {
    const cells = [
      ['neg-2', '매우불만족', sNeg2],
      ['neg-1', '불만족',     sNeg1],
      ['neu',   '보통',       sNeu],
      ['pos-1', '만족',       sPos1],
      ['pos-2', '매우만족',   sPos2],
    ];
    grid.innerHTML = cells.map(([cls, lab, s]) => `
      <div class="cell ${cls}">
        <div class="lab">${lab}</div>
        <div class="val">${s.pct}%</div>
        <div class="n">${s.count}건 / ${d.n}건</div>
      </div>`).join('');
  }
}
function initP15() {
  const d = PAGE_DATA.p15; if (!d) return;
  // strategy: 미검토(neg) / 검토중(neu) / 수립중(pos-mild) / 전략 있음(pos)
  const sBy = Object.fromEntries(d.strategy.map(x=>[x.label, x]));
  const sGet = (lab) => (sBy[lab] || { pct: 0 });
  renderLikertMini('p15-strategy', {
    title: 'AI 전사 전략 실행 여부',
    negLabel: '미수립', posLabel: '전략화',
    items: [
      { label: '미검토',     pct: sGet('미검토').pct,     polarity: 'neg', color: 'var(--ds-rose)' },
      { label: '검토중',     pct: sGet('검토중').pct,     polarity: 'neu', color: 'var(--exc-line-2)', light: true },
      { label: '수립중',     pct: sGet('수립중').pct,     polarity: 'pos', color: 'color-mix(in srgb, var(--ds-mint) 55%, white)', light: true },
      { label: '전략 있음',  pct: sGet('전략 있음').pct,  polarity: 'pos', color: 'var(--ds-mint)' },
    ],
  });
  // ceo: 매우낮음·낮음(neg) / 보통(neu) / 높음·매우높음(pos)
  const cBy = Object.fromEntries(d.ceo.map(x=>[x.label, x]));
  const cGet = (lab) => (cBy[lab] || { pct: 0 });
  renderLikertMini('p15-ceo', {
    title: 'CEO 관심·지원 수준',
    negLabel: '저관심', posLabel: '고관심',
    items: [
      { label: '매우낮음', pct: cGet('매우낮음').pct, polarity: 'neg', color: 'var(--ds-rose)' },
      { label: '낮음',     pct: cGet('낮음').pct,     polarity: 'neg', color: 'color-mix(in srgb, var(--ds-rose) 55%, white)', light: true },
      { label: '보통',     pct: cGet('보통').pct,     polarity: 'neu', color: 'var(--exc-line-2)', light: true },
      { label: '높음',     pct: cGet('높음').pct,     polarity: 'pos', color: 'color-mix(in srgb, var(--ds-mint) 55%, white)', light: true },
      { label: '매우높음', pct: cGet('매우높음').pct, polarity: 'pos', color: 'var(--ds-mint)' },
    ],
  });
}
function initP16() {
  const d = PAGE_DATA.p16; if (!d) return;
  // stage: 미도입·검토중(neg, "아직 안 됨") / 초기·확대·정착화(pos, "이미 실행")
  const stBy = Object.fromEntries(d.stage.map(x=>[x.label, x]));
  const stGet = (lab) => (stBy[lab] || { pct: 0 });
  renderLikertMini('p16-stage', {
    title: 'AI 교육 도입 단계',
    negLabel: '미진입', posLabel: '실행기',
    items: [
      { label: '미도입',     pct: stGet('미도입').pct,     polarity: 'neg', color: 'var(--ds-rose)' },
      { label: '검토중',     pct: stGet('검토중').pct,     polarity: 'neu', color: 'var(--exc-line-2)', light: true },
      { label: '초기 도입',  pct: stGet('초기 도입').pct,  polarity: 'pos', color: 'color-mix(in srgb, var(--ds-mint) 70%, white)', light: true },
      { label: '확대 단계',  pct: stGet('확대 단계').pct,  polarity: 'pos', color: 'var(--ds-mint)' },
      { label: '정착화',     pct: stGet('정착화').pct,     polarity: 'pos', color: 'var(--exc-green-600)' },
    ],
  });
  // budget_27: 감소(neg) / 유사(neu) / 일부·대폭 확대(pos)
  const bBy = Object.fromEntries(d.budget_27.map(x=>[x.label, x]));
  const bGet = (lab) => (bBy[lab] || { pct: 0 });
  renderLikertMini('p16-budget', {
    title: '27년 AI 교육예산 전망',
    negLabel: '감소', posLabel: '확대',
    items: [
      { label: '감소',              pct: bGet('감소').pct,              polarity: 'neg', color: 'var(--ds-rose)' },
      { label: '유사',              pct: bGet('유사').pct,              polarity: 'neu', color: 'var(--exc-line-2)', light: true },
      { label: '일부 확대(10%↓)',   pct: bGet('일부 확대(10%↓)').pct,   polarity: 'pos', color: 'color-mix(in srgb, var(--ds-mint) 55%, white)', light: true },
      { label: '대폭 확대(20%↑)',   pct: bGet('대폭 확대(20%↑)').pct,   polarity: 'pos', color: 'var(--ds-mint)' },
    ],
  });
}

// ───── Deck navigation ─────
let cur = 0;
const slides = () => document.querySelectorAll('section.slide');
function show(i) {
  const ss = slides();
  if (i < 0) i = 0;
  if (i >= ss.length) i = ss.length - 1;
  ss.forEach((s, idx) => s.classList.toggle('active', idx === i));
  cur = i;
  document.getElementById('count').textContent = `${i+1} / ${ss.length}`;
  // hash sync
  history.replaceState(null, '', '#' + (i+1));
  showOverlay();
  // 활성 슬라이드의 ECharts는 display:none 상태에서 0×0 으로 init 되므로 resize 필수
  const active = ss[i];
  if (active) {
    active.querySelectorAll('.chart-box').forEach(el => {
      const inst = echarts.getInstanceByDom(el);
      if (inst) inst.resize();
    });
  }
}
function next() { show(cur + 1); }
function prev() { show(cur - 1); }
function home() { show(0); }
function end() { show(slides().length - 1); }

let overlayT = null;
function showOverlay() {
  const o = document.querySelector('.deck-overlay');
  if (!o) return;
  o.classList.remove('idle');
  clearTimeout(overlayT);
  overlayT = setTimeout(() => o.classList.add('idle'), 1800);
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); next(); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
  else if (e.key === 'Home') { e.preventDefault(); home(); }
  else if (e.key === 'End') { e.preventDefault(); end(); }
  else if (/^[1-9]$/.test(e.key)) { e.preventDefault(); show(parseInt(e.key) - 1); }
});
window.addEventListener('mousemove', showOverlay);

// ───── Scale-to-fit ─────
function fit() {
  const canvas = document.querySelector('.canvas');
  const sx = window.innerWidth / 1920;
  const sy = window.innerHeight / 1080;
  const s = Math.min(sx, sy);
  canvas.style.transform = `scale(${s})`;
}
window.addEventListener('resize', fit);

window.addEventListener('DOMContentLoaded', () => {
  initP4(); initP5(); initP6(); initP9(); initP10(); initP11(); initP12(); initP15(); initP16();
  fit();
  // 초기 슬라이드 from hash
  const m = location.hash.match(/^#(\\d+)$/);
  show(m ? parseInt(m[1]) - 1 : 0);
});
"""


# ────────────────────────────────────────────────
# HTML rendering
# ────────────────────────────────────────────────

def _slide_header(num: str, eyebrow_text: str) -> str:
    return f"""    <header class="slide-header">
      <div class="logo"><span class="mark"></span>EXPERT · HRD</div>
      <div class="eyebrow">{num}<span class="dot"></span>{eyebrow_text}</div>
    </header>"""


def _slide_footer(page_num: str, total: int = TOTAL_PAGES) -> str:
    try:
        n = int(page_num)
        pageno_html = f'{n:02d}<em> / {total}</em>'
    except (ValueError, TypeError):
        pageno_html = f'{page_num}'
    return f"""    <footer class="slide-footer">
      <div class="meta">EXPERT SURVEY · 2027 EDUCATION PLAN</div>
      <div class="page-no">{pageno_html}</div>
    </footer>"""


def render_slide(no: int, total: int, page: dict, stats: dict) -> str:
    kind = page.get("kind", "content")
    pid = page["id"]
    num2 = f"{no:02d}"
    n_c = stats["n_complete"]
    n_t = stats["n_total"]
    n_p = stats["n_progress"]
    resp_short = f"완료 {n_c}건" + (f" / 진행 {n_p}건" if n_p is not None else "")
    resp_big = f"{n_c}" + (f"<small>/ {n_t}</small>" if n_t is not None else "")
    resp_detail = f"완료 {n_c}" + (f" · 진행 {n_p}" if n_p is not None else "")

    if kind == "cover":
        return f"""
  <section class="slide cover slide--dark" id="{pid}" data-label="{no:02d} Cover">
    <div class="cover-top">
      <div class="logo"><span class="mark"></span>Expert Consulting</div>
      <div class="ai-tag">AI × HR Transformation</div>
    </div>
    <div class="cover-center">
      <div class="cover-eyebrow">EXC Survey Report · 결과 미리보기</div>
      <h1 class="cover-title">제22회 인재개발<br><span class="accent">실태조사</span></h1>
      <p class="cover-sub">2027년 임직원 교육, 어떻게 준비하고 계십니까?<br>데이터에 기반한 HR 트렌드 인사이트.</p>
    </div>
    <div class="cover-bottom">
      <div class="meta-stack">
        <div><div class="k">Survey Period</div><div class="v">2026.05 ~ 07 (예정)</div></div>
        <div><div class="k">Responses</div><div class="v">{resp_short}</div></div>
        <div><div class="k">Issued</div><div class="v">2026.05.28 Preview</div></div>
      </div>
      <div class="corp">㈜엑스퍼트컨설팅 · exc.co.kr</div>
    </div>
  </section>"""

    if kind == "intro":
        return f"""
  <section class="slide intro" id="{pid}" data-label="{num2} Letter">
{_slide_header(num2, "Letter · 조사 취지")}
{_slide_footer(num2, total)}
    <div class="slide-eyebrow"><span class="num">{num2}</span>Introduction</div>
    <h1 class="slide-headline">HR의 미래를,<br><span class="accent">데이터로 그리다</span>.</h1>
    <div class="meta-line">제22회 인재개발 실태조사 · 결과 미리보기</div>
    <p class="letter-lead">엑스퍼트컨설팅이 <strong>데이터에 기반한 경영 인사이트</strong>를 제공하고자 실시한 Survey 결과입니다. 참여해주신 모든 분들께 감사드립니다.</p>
    <div class="letter-toc">
      <div class="toc-head">이번 호에서 보는 것</div>
      <div class="toc-cols">
        <div class="toc-col">
          <div class="toc-part">PART 1 · 교육 현황과 투자</div>
          <ul>
            <li>응답 기업 프로필 <small>업종 · 규모</small></li>
            <li>거시지표와 교육예산 변동</li>
            <li>교육 형태 · 직책별 배분</li>
            <li>교육 투자 효과 (만족도)</li>
          </ul>
        </div>
        <div class="toc-col is-ai">
          <div class="toc-part">PART 2 · AI 전환 <span class="toc-star">⭐ 22회 신규</span></div>
          <ul>
            <li>전체 교육비 중 AI 교육 비중</li>
            <li>전사 전략 · CEO 관심·지원</li>
            <li>도입 단계 · 2027 예산 전망</li>
          </ul>
        </div>
      </div>
    </div>
  </section>"""

    if kind == "overview":
        return f"""
  <section class="slide content" id="{pid}" data-label="{num2} Overview">
{_slide_header(num2, "Overview · Survey Profile")}
{_slide_footer(num2, total)}
    <div class="slide-eyebrow"><span class="num">{num2}</span>Survey Snapshot</div>
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
        <div class="big">{resp_big}</div>
        <div class="v">{resp_detail}<small>2026-05-28 기준</small></div>
      </div>
    </div>
    <div class="caveat">⚠ 표본 {n_c}건 기준 미리보기 · 비율·평균은 수집 종료 후 재계산 필수</div>
  </section>"""

    if kind == "summary":
        # 방사형 우선순위 — 3축 (AI 예산 확대 74 · 교육예산 확대 81 · AI 전략 검토중 36) 동심원
        # circumference = 2πr ≈ 6.283 * r → dasharray로 % 환산
        # r=72 → 452, r=58 → 364, r=44 → 276
        return f"""
  <section class="slide summary t3" id="{pid}" data-label="{num2} Summary">
{_slide_header(num2, "Summary · Key Signals")}
{_slide_footer(num2, total)}
    <div class="slide-eyebrow"><span class="num">{num2}</span>Summary</div>
    <h1 class="slide-headline">핵심 <span class="accent">시그널</span> — 22회 응답 {n_c}건</h1>
    <div class="meta-line">데이터 메시지를 우선순위 동심원으로 — 외곽일수록 강한 시그널. 좌측 합산값은 3축 중심값.</div>
    <div class="radial-summary">
      <div class="radial">
        <svg viewBox="0 0 200 200">
          <!-- outer: AI 예산 확대 74% (가장 강한 시그널) -->
          <circle cx="100" cy="100" r="72" fill="none" stroke="var(--exc-line)" stroke-width="10"/>
          <circle cx="100" cy="100" r="72" fill="none" stroke="var(--ai-violet)" stroke-width="10"
                  stroke-dasharray="335 452" stroke-linecap="butt"
                  transform="rotate(-90 100 100)"/>
          <!-- middle: 교육예산 확대 81% -->
          <circle cx="100" cy="100" r="58" fill="none" stroke="var(--exc-line)" stroke-width="10"/>
          <circle cx="100" cy="100" r="58" fill="none" stroke="var(--ai-cyan)" stroke-width="10"
                  stroke-dasharray="295 364" stroke-linecap="butt"
                  transform="rotate(-90 100 100)"/>
          <!-- inner: 만족 이상 47.6% -->
          <circle cx="100" cy="100" r="44" fill="none" stroke="var(--exc-line)" stroke-width="10"/>
          <circle cx="100" cy="100" r="44" fill="none" stroke="var(--exc-green)" stroke-width="10"
                  stroke-dasharray="132 276" stroke-linecap="butt"
                  transform="rotate(-90 100 100)"/>
        </svg>
        <div class="center">
          <div class="v">74<small>%</small></div>
          <div class="l">27년 AI 예산 확대</div>
        </div>
      </div>
      <div class="kpi-stack">
        <div class="kpi-row-item">
          <div class="sw" style="background:var(--ai-violet)"></div>
          <div class="nm">27년 AI 예산 확대<small>대폭 21% + 일부 52% · 22회 최강 시그널</small></div>
          <div class="vv" style="color:var(--ai-violet)">74%</div>
        </div>
        <div class="kpi-row-item">
          <div class="sw" style="background:var(--ai-cyan)"></div>
          <div class="nm">교육예산 확대 (24→25)<small>34/42 · 21회 추세 유지·강화</small></div>
          <div class="vv" style="color:var(--exc-navy)">81%</div>
        </div>
        <div class="kpi-row-item">
          <div class="sw" style="background:var(--exc-green)"></div>
          <div class="nm">교육 투자 만족 이상<small>매우만족 7.1% + 만족 40.5% · 매우불만족 0건</small></div>
          <div class="vv" style="color:var(--exc-green)">47.6%</div>
        </div>
        <div class="kpi-row-item">
          <div class="sw" style="background:var(--exc-amber)"></div>
          <div class="nm">AI 교육 "10% 미만"<small>45.2% · 도입 초기 단계 진입</small></div>
          <div class="vv" style="color:var(--exc-amber)">45.2%</div>
        </div>
        <div class="kpi-row-item">
          <div class="sw" style="background:var(--exc-muted)"></div>
          <div class="nm">AI 전사 전략 "검토중"<small>있음 31 / 수립중 21 / 검토중 36 — 실행기 직전</small></div>
          <div class="vv" style="color:var(--exc-muted)">36%</div>
        </div>
      </div>
    </div>
    <div class="contact">Tel. 02-538-2221 · help@exc.co.kr · expertconsulting.co.kr</div>
  </section>"""

    if kind == "divider":
        return f"""
  <section class="slide divider slide--dark new-section" id="{pid}" data-label="{num2} Part 2">
{_slide_footer(num2, total)}
    <div class="div-inner">
      <div class="div-kicker">{page.get('kicker','CHAPTER')} · {num2}</div>
      <div class="div-eyebrow">{page.get('eyebrow','')}</div>
      <h1 class="div-title">{page.get('title_html','')}</h1>
      <p class="div-sub">{page.get('sub','')}</p>
    </div>
  </section>"""

    # content
    is_new = '⭐' in page['title']
    sec_cls = " new-section" if is_new else ""
    weight_cls = f" {page.get('weight', 't2')}" if page.get("weight") else ""
    new_badge = ' <span class="new-badge">22회 신규</span>' if is_new else ''
    title_clean = page['title'].replace('  ⭐ 22회 신규', '').replace(' ⭐ 22회 신규', '')
    subtitle = SUBTITLES.get(pid, "")
    meta_cls = "meta-line" if subtitle else "meta-line meta-line--rule"
    if page.get("has_data"):
        body = render_chart_body(pid)
        takeaway = TAKEAWAYS.get(pid)
        if takeaway:
            body += f'\n    <div class="slide-takeaway"><div class="label">Takeaway · 핵심 요약</div>{takeaway}</div>'
    else:
        body = f'<div class="placeholder">[ 차트 영역 — 실데이터는 수집 누적 후 자동 생성 ]<br><br>현 표본({n_c}건)에서는 응답 수 부족으로 의미 있는 시각화 불가. placeholder 로 유지.</div>'
    return f"""
  <section class="slide content{sec_cls}{weight_cls}" id="{pid}" data-label="{num2} {title_clean[:24]}">
{_slide_header(num2, "Body · " + title_clean)}
{_slide_footer(num2, total)}
    <div class="slide-eyebrow"><span class="num">{num2}</span>{title_clean[:24]}</div>
    <h1 class="slide-headline">{title_clean}{new_badge}</h1>
    <div class="{meta_cls}">{subtitle}</div>
    {body}
  </section>"""


# AI 전환 챕터 디바이더 (덱 전용 구성 — PAGES/스크롤 보고서에는 없음)
DIVIDER_AI = {
    "id": "div-ai", "kind": "divider",
    "kicker": "CHAPTER",
    "eyebrow": "PART 2 · AI TRANSFORMATION",
    "title_html": 'AI <span class="accent">전환</span>',
    "sub": "전사 전략부터 도입 단계·2027 예산 전망까지 — 22회 신규 영역",
}

# 대외 덱 구성 순서: 현황·효과(04~만족도) → [AI 디바이더] → AI 전환 3장.
# 만족도(p12)를 AI 비율(p11) 앞으로 옮겨 Part 1을 '효과'로 마무리한다.
_DECK_ORDER = ["p1", "p2", "p3", "p4", "p5", "p6", "p9", "p10", "p12",
               "div-ai", "p11", "p15", "p16", "p18"]


def _arrange_deck(pages: list) -> list:
    """placeholder 제외 후, _DECK_ORDER 기준으로 재배치 + AI 디바이더 삽입."""
    by = {p["id"]: p for p in pages}
    out = []
    for oid in _DECK_ORDER:
        if oid == "div-ai":
            out.append(DIVIDER_AI)
        elif oid in by:
            out.append(by[oid])
    # 순서에 없는 잔여 페이지는 뒤에 보존(안전장치)
    listed = set(_DECK_ORDER)
    out.extend(p for p in pages if p["id"] not in listed)
    return out


def build_html(page_data: dict, stats: dict) -> str:
    # 대외 완성본: 실데이터 없는 placeholder 본문(p7·8·13·14·17)은 덱에서 제외.
    base = [
        p for p in PAGES
        if p.get("kind", "content") != "content" or p.get("has_data")
    ]
    deck_pages = _arrange_deck(base)
    total = len(deck_pages)
    slides = "\n".join(render_slide(i + 1, total, p, stats) for i, p in enumerate(deck_pages))
    js = JS.replace("__PAGE_DATA__", json.dumps(page_data, ensure_ascii=False)).replace("__TOTAL__", str(total))
    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>제22회 인재개발 실태조사 — 발표용 Deck (2026-05-28)</title>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
<style>{CSS}</style>
</head>
<body>
<div class="deck-stage">
  <div class="canvas">
{slides}
  </div>
</div>
<div class="deck-overlay">
  <span class="count" id="count">1 / {len(PAGES)}</span>
  <span class="hint"><kbd>←</kbd> <kbd>→</kbd> nav · <kbd>1-9</kbd> jump · <kbd>Home</kbd>/<kbd>End</kbd></span>
</div>
<script>{js}</script>
</body>
</html>"""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--src", type=Path, default=DEFAULT_SRC)
    ap.add_argument("--raw-dir", type=Path, default=DEFAULT_RAW_DIR,
                    help="raw xlsx 폴더 (응답수 카드의 전체 총합 산출용)")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()

    df = pd.read_excel(args.src, dtype=object)
    print(f"[load] {args.src.relative_to(ROOT)}  ({df.shape})")
    page_data = compute_page_data(df)
    print(f"[compute] {len(page_data)} 페이지 데이터 산출")

    stats = _load_stats(df, args.raw_dir)
    print(f"[stats] 완료={stats['n_complete']} 전체={stats['n_total']} 진행={stats['n_progress']}")

    html = build_html(page_data, stats)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(html, encoding="utf-8")
    print(f"[save] {args.out.relative_to(ROOT)}  ({args.out.stat().st_size:,} bytes)")
    print(f"열기: file:///{args.out}  또는 로컬 서버")
    print(f"키보드: ← → Space (네비), Home/End, 1~9 (점프)")
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
