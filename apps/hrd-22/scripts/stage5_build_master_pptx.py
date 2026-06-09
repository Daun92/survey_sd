"""[단계 5 준비] 22회 master PPTX 18p placeholder 골격 생성.

outline (5_report/preview/report_outline_22th_*.md) 18p 구조에 맞춰 빈 슬라이드를 생성.
디자이너가 이 파일에 시각 디자인을 입히고, stage5_render_pptx.py 가 chart_data JSON 으로
placeholder 를 채운다.

각 슬라이드:
  - 제목 (top)
  - 메타: 21회 매칭 / 22회 변경 / 분석 raw 컬럼 / 세그먼트 (좌하단 작게)
  - 본문 placeholder (가운데 큰 빈 공간 → 디자이너가 차트 배치)

사용:
    python scripts/stage5_build_master_pptx.py \\
        --out 5_report/preview/master_22th_20260528.pptx
"""
from __future__ import annotations

import argparse
import io
import sys
from datetime import datetime
from pathlib import Path

from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "5_report/preview/master_22th_20260528.pptx"

# ── 18p outline (report_outline_22th_20260528.md 와 동기화) ──
SLIDES = [
    {"kind": "cover", "title": "제22회 인재개발 실태조사",
     "subtitle": "2027년 임직원 교육, 어떻게 준비하고 계십니까?"},
    {"kind": "intro", "title": "조사 취지",
     "body": "엑스퍼트컨설팅이 데이터에 기반한 경영 인사이트를 제공하고자 실시한 Survey 의 결과를 바탕으로 작성되었습니다.\n\n* 본 서베이에 참여해주신 모든 분들께 감사드립니다."},
    {"kind": "overview", "title": "Survey Overview",
     "items": ["SURVEY 주제: 2027년 교육계획",
               "SURVEY 목적: 구체적 컨설팅 니즈 발굴, 최적의 컨설팅 방안 모색",
               "SURVEY 기간: 2026-05 ~ 2026-07 (가)",
               "SURVEY 방법: 모바일·PC 온라인 설문",
               "SURVEY 응답수: TBD"]},
    {"num": 4, "title": "응답기업 특성 (업종·규모)",
     "match_21th": "Q00", "change_22th": "—",
     "raw_cols": "R_Div, R_Cate, p1)R_1_2_2",
     "segment": "전체",
     "viz": "도넛/막대 2장 (업종·규모)"},
    {"num": 5, "title": "거시지표 — 매출·인원·예산·집행",
     "match_21th": "—(신규 강조)", "change_22th": "—",
     "raw_cols": "p1)R_1_1_2 ~ p1)R_1_5_2",
     "segment": "size_tier 5구간 + 공공",
     "viz": "지표 표 + 1인당 교육비·매출대비 비율 막대"},
    {"num": 6, "title": "24→25년 교육예산 변동",
     "match_21th": "Q01·Q02", "change_22th": "연도 shift",
     "raw_cols": "p1)R_2_n_2",
     "segment": "전체 + 업종 + 규모",
     "viz": "가로 100% 누적막대 (확대/유사/축소)"},
    {"num": 7, "title": "교육비 증가 이유",
     "match_21th": "Q02-1", "change_22th": "옵션 6개 (22회 \"시스템도입\" 신규)",
     "raw_cols": "p1)R_3_multi, p1)R_3_etc",
     "segment": "전체",
     "viz": "가로 막대 + 기타 입력 리스트"},
    {"num": 8, "title": "교육비 감소 이유",
     "match_21th": "Q02-2", "change_22th": "—",
     "raw_cols": "p1)R_4_multi, p1)R_4_etc",
     "segment": "전체",
     "viz": "가로 막대 + 기타 입력 리스트"},
    {"num": 9, "title": "교육 형태별 참가인원·지출 비율",
     "match_21th": "(PDF 미수록)", "change_22th": "표·차트 통합",
     "raw_cols": "p1)R_6_1_*, p1)R_7_1_*",
     "segment": "size_tier",
     "viz": "더블 막대 (인원 vs 지출) + 100% 누적"},
    {"num": 10, "title": "직책별 교육비 지출 비율",
     "match_21th": "(PDF 미수록)", "change_22th": "—",
     "raw_cols": "p1)R_8_1_*",
     "segment": "size_tier",
     "viz": "100% 가로 누적 (신입/비직책자/직책자/임원)"},
    {"num": 11, "title": "교육비 중 AI 교육 비율 ⭐ 22회 신규",
     "match_21th": "—", "change_22th": "Part I 신규 1도표",
     "raw_cols": "p1)R_9_multi",
     "segment": "전체 + 규모",
     "viz": "가로 100% 누적 (6구간)"},
    {"num": 12, "title": "교육비 투자 효과 (만족도)",
     "match_21th": "(PDF 미수록)", "change_22th": "—",
     "raw_cols": "p1)R_10_multi",
     "segment": "전체",
     "viz": "5점 Likert 가로 100%"},
    {"num": 13, "title": "내년도 신규 추진 내용 (HRD 운영)",
     "match_21th": "Q03", "change_22th": "—",
     "raw_cols": "p2)R_2_multi (외 HRD 운영)",
     "segment": "전체 + 규모",
     "viz": "가로 막대 (상위 10, 복수응답)"},
    {"num": 14, "title": "리더십·비직책자·조직개발 교육 테마",
     "match_21th": "Q05·Q06·Q07", "change_22th": "—",
     "raw_cols": "p3)R_* (영역별 multi)",
     "segment": "전체 + 규모",
     "viz": "3개 세트 막대"},
    {"num": 15, "title": "AI 도입과 활용 — 전사 전략·CEO 지원 ⭐ 22회 신규",
     "match_21th": "—", "change_22th": "Part V 11도표 중 핵심 2",
     "raw_cols": "p5)R_1_multi, p5)R_2_multi",
     "segment": "전체 + 규모",
     "viz": "가로 100% 누적 × 2"},
    {"num": 16, "title": "AI 교육 — 도입 단계·27년 예산 전망 ⭐ 22회 신규",
     "match_21th": "—", "change_22th": "Part V 핵심 2",
     "raw_cols": "p5)R_4_multi, p5)R_10_multi",
     "segment": "전체 + 규모",
     "viz": "가로 100% 누적 × 2 + 인사이트 텍스트"},
    {"num": 17, "title": "도움 필요 사항 (주관식)",
     "match_21th": "Q08", "change_22th": "—",
     "raw_cols": "p5)R_11_etc 외 etc 종합",
     "segment": "—",
     "viz": "키워드 카테고리 표"},
    {"kind": "summary", "title": "Summary + Contact",
     "items": ["[키워드 1] TBD",
               "[키워드 2] TBD",
               "[키워드 3] TBD",
               "[키워드 4] TBD",
               "[키워드 5] AI 교육 — 22회 부각 영역"]},
]


def _add_textbox(slide, left, top, width, height, text, size=18, bold=False, color=None):
    tb = slide.shapes.add_textbox(left, top, width, height)
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    r = p.add_run()
    r.text = text
    r.font.size = Pt(size)
    r.font.bold = bold
    if color:
        r.font.color.rgb = RGBColor(*color)
    return tb


def _add_placeholder_box(slide, left, top, width, height, label="[ 차트 영역 ]"):
    sh = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
    sh.fill.solid()
    sh.fill.fore_color.rgb = RGBColor(245, 245, 245)
    sh.line.color.rgb = RGBColor(200, 200, 200)
    tf = sh.text_frame
    tf.text = label
    for p in tf.paragraphs:
        for r in p.runs:
            r.font.size = Pt(16)
            r.font.color.rgb = RGBColor(170, 170, 170)
    return sh


def build_slide_cover(prs, item):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    _add_textbox(slide, Inches(1), Inches(2.6), Inches(11.3), Inches(1.2),
                 item["title"], size=44, bold=True, color=(30, 50, 100))
    _add_textbox(slide, Inches(1), Inches(4), Inches(11.3), Inches(0.6),
                 item["subtitle"], size=20, color=(80, 80, 80))
    _add_textbox(slide, Inches(1), Inches(6.6), Inches(11.3), Inches(0.4),
                 "엑스퍼트컨설팅 · Survey Report", size=12, color=(120, 120, 120))


def build_slide_intro(prs, item):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    _add_textbox(slide, Inches(0.5), Inches(0.4), Inches(12), Inches(0.7),
                 item["title"], size=28, bold=True, color=(30, 50, 100))
    _add_textbox(slide, Inches(0.7), Inches(1.5), Inches(11.7), Inches(5),
                 item["body"], size=16, color=(60, 60, 60))


def build_slide_overview(prs, item):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    _add_textbox(slide, Inches(0.5), Inches(0.4), Inches(12), Inches(0.7),
                 item["title"], size=28, bold=True, color=(30, 50, 100))
    tb = slide.shapes.add_textbox(Inches(0.7), Inches(1.5), Inches(11.7), Inches(5))
    tf = tb.text_frame
    tf.word_wrap = True
    for i, line in enumerate(item["items"]):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = "• " + line
        for r in p.runs:
            r.font.size = Pt(18)


def build_slide_summary(prs, item):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    _add_textbox(slide, Inches(0.5), Inches(0.4), Inches(12), Inches(0.7),
                 item["title"], size=28, bold=True, color=(30, 50, 100))
    tb = slide.shapes.add_textbox(Inches(0.7), Inches(1.5), Inches(11.7), Inches(5))
    tf = tb.text_frame
    tf.word_wrap = True
    for i, line in enumerate(item["items"]):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = "• " + line
        for r in p.runs:
            r.font.size = Pt(18)
    _add_textbox(slide, Inches(0.7), Inches(6.7), Inches(12), Inches(0.4),
                 "Tel. 02-538-2221 / help@exc.co.kr", size=12, color=(120, 120, 120))


def build_slide_content(prs, item):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    # 제목 (좌상단)
    _add_textbox(slide, Inches(0.5), Inches(0.4), Inches(10), Inches(0.7),
                 f"{item['num']:02d}.  {item['title']}",
                 size=22, bold=True, color=(30, 50, 100))
    # 메타 (우상단 작게)
    meta = (
        f"21회 매칭: {item.get('match_21th','—')}   |   "
        f"22회 변경: {item.get('change_22th','—')}\n"
        f"raw: {item.get('raw_cols','—')}\n"
        f"세그먼트: {item.get('segment','—')}   |   "
        f"시각화: {item.get('viz','—')}"
    )
    _add_textbox(slide, Inches(0.5), Inches(1.2), Inches(12.3), Inches(0.9),
                 meta, size=11, color=(110, 110, 110))
    # 차트 placeholder (큰 영역)
    _add_placeholder_box(slide, Inches(0.5), Inches(2.3), Inches(12.3), Inches(4.5),
                         "[ 차트 영역 — chart_data JSON 으로 stage5_render_pptx 가 채움 ]")
    # footer
    _add_textbox(slide, Inches(0.5), Inches(7.0), Inches(12.3), Inches(0.3),
                 f"제22회 인재개발 실태조사  ·  {item['num']:02d}",
                 size=10, color=(160, 160, 160))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()

    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    for item in SLIDES:
        kind = item.get("kind", "content")
        if kind == "cover":
            build_slide_cover(prs, item)
        elif kind == "intro":
            build_slide_intro(prs, item)
        elif kind == "overview":
            build_slide_overview(prs, item)
        elif kind == "summary":
            build_slide_summary(prs, item)
        else:
            build_slide_content(prs, item)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    prs.save(args.out)
    print(f"[save] {args.out.relative_to(ROOT)}  ({args.out.stat().st_size:,} bytes)")
    print(f"슬라이드 {len(SLIDES)}장 생성")
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
