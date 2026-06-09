"""디자인 토큰 단일 소스 (docs/CHART_FONT_SPEC_22th.md).

색·타입·간격·반경·그림자·모션의 유일한 정의처. 값은 디자인 정본
`5_report/design-handoff/project/assets/exc-tokens.css` 와 동일 + 렌더러 확장
(AI 테마 · 발산(rose/mint) · Likert 5단계 · 순위 3단계 · --fs-micro).

사용:
    from design_tokens import TOKENS_CSS          # <style>{TOKENS_CSS}</style> 로 임베드
    from design_tokens import ECHARTS_PALETTE      # ECharts JS C 객체 기준 hex

deck·메인HTML·세그먼트 리포트가 각자 인라인 :root 를 두지 말고 이 TOKENS_CSS 를 임베드한다.
"""
from __future__ import annotations

# ─────────────────────────────────────────────
# 색 팔레트 (hex) — CSS 토큰과 ECharts JS 색의 공통 출처
# ─────────────────────────────────────────────
PALETTE = {
    # 브랜드 그린 램프
    "exc-green-50": "#E6F5EE", "exc-green-100": "#C2E6D3", "exc-green-200": "#8CD0AE",
    "exc-green-300": "#4DBE89", "exc-green-400": "#1FA76A", "exc-green": "#009858",
    "exc-green-600": "#007A46", "exc-green-700": "#005E36", "exc-green-800": "#003F24",
    # 중립
    "exc-ink": "#111111", "exc-ink-2": "#333333", "exc-muted": "#555555", "exc-muted-2": "#888888",
    "exc-line": "#E5E7EB", "exc-line-2": "#D1D5DB", "exc-panel": "#F7F8F9", "exc-panel-2": "#EFF1F3",
    "exc-bg": "#FFFFFF",
    # 의미 강조
    "exc-navy": "#0E2A47", "exc-amber": "#F4B740", "exc-red": "#E94B35", "exc-info": "#2A6FDB",
    # AI 테마 (Ⅴ AI·신규 영역)
    "ai-dusk": "#0E0E27", "ai-dusk-2": "#161636", "ai-violet": "#5B5BF0",
    "ai-violet-2": "#7C7CFF", "ai-cyan": "#00E5C8",
    # 발산 의미색
    "ds-mint": "#4DBE89", "ds-rose": "#E94B6E", "ds-rose-700": "#B3324B",
}

# ECharts JS 색 (C 객체) — CSS 토큰과 동일 hex. 차트별 손색 금지, 이 표만 사용.
ECHARTS_PALETTE = {
    "green": PALETTE["exc-green"], "green2": PALETTE["exc-green-300"], "green700": PALETTE["exc-green-700"],
    "ink": PALETTE["exc-ink"], "ink2": PALETTE["exc-ink-2"],
    "muted": PALETTE["exc-muted"], "muted2": PALETTE["exc-muted-2"],
    "line": PALETTE["exc-line"], "line2": PALETTE["exc-line-2"],
    "panel": PALETTE["exc-panel"], "bg": PALETTE["exc-bg"],
    "navy": PALETTE["exc-navy"], "amber": PALETTE["exc-amber"], "red": PALETTE["exc-red"], "info": PALETTE["exc-info"],
    "violet": PALETTE["ai-violet"], "cyan": PALETTE["ai-cyan"], "dusk": PALETTE["ai-dusk"],
    "rose": PALETTE["ds-rose"], "mint": PALETTE["ds-mint"],
}


def echarts_color_js(name: str = "C") -> str:
    """ECharts 색 객체 JS 1줄 생성 (const C = {...})."""
    body = ", ".join(f"{k}: '{v}'" for k, v in ECHARTS_PALETTE.items())
    return f"const {name} = {{ {body} }};"


# ─────────────────────────────────────────────
# 정본 :root — 모든 렌더러가 임베드
# ─────────────────────────────────────────────
TOKENS_CSS = """
:root {
  /* ───── Color · Brand green ramp ───── */
  --exc-green-50:  #E6F5EE; --exc-green-100: #C2E6D3; --exc-green-200: #8CD0AE;
  --exc-green-300: #4DBE89; --exc-green-400: #1FA76A; --exc-green:     #009858;
  --exc-green-600: #007A46; --exc-green-700: #005E36; --exc-green-800: #003F24;

  /* ───── Color · Neutral (warm-grey) ───── */
  --exc-ink: #111111; --exc-ink-2: #333333; --exc-muted: #555555; --exc-muted-2: #888888;
  --exc-line: #E5E7EB; --exc-line-2: #D1D5DB; --exc-panel: #F7F8F9; --exc-panel-2: #EFF1F3;
  --exc-bg: #FFFFFF;

  /* ───── Color · Semantic accent (절제 사용) ───── */
  --exc-navy: #0E2A47; --exc-amber: #F4B740; --exc-red: #E94B35; --exc-info: #2A6FDB;

  /* ───── Color · AI theme (Ⅴ AI·신규 영역) ───── */
  --ai-dusk: #0E0E27; --ai-dusk-2: #161636;
  --ai-violet: #5B5BF0; --ai-violet-2: #7C7CFF; --ai-cyan: #00E5C8;

  /* ───── Color · Diverging 의미색 ───── */
  --ds-mint: #4DBE89;       /* 약positive (= green-300) */
  --ds-rose: #E94B6E;       /* negative (막대) */
  --ds-rose-700: #B3324B;   /* negative 텍스트 (밝은 배경 대비) */

  /* ───── Color · Likert 5단계 발산 (부정→긍정 고정) ───── */
  --lk-1: var(--ds-rose);
  --lk-2: color-mix(in srgb, var(--ds-rose) 50%, white);
  --lk-3: var(--exc-line-2);
  --lk-4: var(--exc-green-200);
  --lk-5: var(--exc-green);

  /* ───── Color · 순위 3단계 (1순위 진함) ───── */
  --rank-1: var(--exc-green-700); --rank-2: var(--exc-green); --rank-3: var(--exc-green-200);

  /* ───── Typography · Families ───── */
  --font-sans: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Segoe UI", Roboto, sans-serif;
  --font-display: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, "Cascadia Code", Consolas, monospace;

  /* ───── Typography · Report scale (px) ───── */
  --fs-display: 64px; --fs-h1: 40px; --fs-h2: 28px; --fs-h3: 22px; --fs-h4: 18px;
  --fs-body-lg: 18px; --fs-body: 16px; --fs-body-sm: 14px; --fs-caption: 12px;
  --fs-micro: 11px;   /* 데이터 밀집 표·막대 라벨(세그먼트 컴팩트) */
  --fs-eyebrow: 12px;

  /* Line heights / weights / tracking */
  --lh-tight: 1.1; --lh-snug: 1.25; --lh-base: 1.6; --lh-loose: 1.75;
  --fw-regular: 400; --fw-medium: 500; --fw-semi: 600; --fw-bold: 700; --fw-xbold: 800; --fw-black: 900;
  --ls-tight: -0.02em; --ls-display: -0.03em; --ls-eyebrow: 0.08em;

  /* ───── Spacing · 4px grid ───── */
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-5: 20px;
  --space-6: 24px; --space-8: 32px; --space-10: 40px; --space-12: 48px; --space-16: 64px;
  --space-20: 80px; --space-24: 96px; --space-32: 128px;

  /* ───── Radii ───── */
  --radius-xs: 4px; --radius-sm: 8px; --radius-md: 12px; --radius-lg: 20px; --radius-pill: 999px;

  /* ───── Shadows ───── */
  --shadow-sm: 0 1px 2px rgba(17,17,17,.04), 0 1px 1px rgba(17,17,17,.04);
  --shadow-md: 0 4px 12px rgba(17,17,17,.06), 0 2px 4px rgba(17,17,17,.04);
  --shadow-lg: 0 16px 40px rgba(17,17,17,.10), 0 4px 12px rgba(17,17,17,.06);

  /* ───── Motion ───── */
  --ease-out: cubic-bezier(.2, .8, .2, 1); --dur-fast: 160ms; --dur-base: 240ms; --dur-slow: 320ms;
}
""".strip()


if __name__ == "__main__":
    import io
    import sys
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    print(f"PALETTE {len(PALETTE)}색 · ECHARTS_PALETTE {len(ECHARTS_PALETTE)}키")
    print(echarts_color_js())
    print(f"TOKENS_CSS {len(TOKENS_CSS)} chars")
