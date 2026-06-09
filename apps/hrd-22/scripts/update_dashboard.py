"""progress.yaml → docs/PROGRESS.md + dashboard/index.html 동기화.

사용:
    python scripts/update_dashboard.py
    python scripts/update_dashboard.py --open    # 갱신 후 브라우저로 대시보드 열기

다음을 자동 생성:
  - docs/PROGRESS.md       : 사람 읽기 좋은 markdown 진척표
  - dashboard/index.html   : GUI 대시보드 (단일 파일, file:// 로 직접 열기 가능)
  - dashboard/data.json    : 대시보드용 데이터 (HTML 이 fetch)
"""
from __future__ import annotations
import argparse
import json
import sys
import webbrowser
from datetime import datetime
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("pyyaml 미설치 — pip install pyyaml")

ROOT = Path(__file__).resolve().parents[1]
PROGRESS_YAML = ROOT / "progress.yaml"
WORKLOG_YAML = ROOT / "worklog.yaml"
DOCS_DIR = ROOT / "docs"
DASH_DIR = ROOT / "dashboard"
DASH_DIR.mkdir(exist_ok=True)

WORKLOG_TYPE_META = {
    "setup":       {"label": "세팅",      "icon": "⚙",  "color": "#6b7280"},
    "analysis":    {"label": "분석",      "icon": "🔍", "color": "#0ea5e9"},
    "decision":    {"label": "결정",      "icon": "▣",  "color": "#a855f7"},
    "deliverable": {"label": "산출물",    "icon": "▶",  "color": "#22c55e"},
    "finding":     {"label": "발견",      "icon": "✦",  "color": "#f59e0b"},
    "blocker":     {"label": "블로커",    "icon": "⚠",  "color": "#ef4444"},
}
STAGE_LABEL = {
    "setup": "골격",
    0: "단계 0", 1: "단계 1", 2: "단계 2",
    3: "단계 3", 4: "단계 4", 5: "단계 5",
}


# ---------- 진척 집계 ----------

STATUS_ORDER = {"completed": 0, "in_progress": 1, "blocked": 2, "not_started": 3}
STATUS_LABEL_KO = {
    "completed": "완료",
    "in_progress": "진행중",
    "blocked": "지연",
    "not_started": "대기",
    "pending": "대기",
}
STATUS_COLOR = {
    "completed": "#22c55e",
    "in_progress": "#3b82f6",
    "blocked": "#ef4444",
    "not_started": "#9ca3af",
    "pending": "#9ca3af",
}


def compute_stage_progress(stage: dict) -> int:
    """deliverable 기반 진척률 자동 계산 (명시 progress 보다 우선하지 않음 - 명시값 있으면 사용)."""
    if "progress" in stage and stage["progress"] is not None:
        return int(stage["progress"])
    delivs = stage.get("deliverables", [])
    if not delivs:
        return 0
    done = sum(1 for d in delivs if d.get("status") == "completed")
    return int(done / len(delivs) * 100)


def compute_overall(stages: list[dict]) -> int:
    if not stages:
        return 0
    return int(sum(compute_stage_progress(s) for s in stages) / len(stages))


def count_deliverables(stages: list[dict]) -> dict:
    counts = {"completed": 0, "in_progress": 0, "blocked": 0, "not_started": 0, "total": 0}
    for s in stages:
        for d in s.get("deliverables", []):
            st = d.get("status", "not_started")
            counts[st] = counts.get(st, 0) + 1
            counts["total"] += 1
    return counts


# ---------- MD 생성 ----------

def render_md(data: dict, worklog: list[dict] | None = None) -> str:
    project = data["project"]
    stages = data["stages"]
    overall = compute_overall(stages)
    counts = count_deliverables(stages)

    lines = []
    lines.append(f"# {project['name']} — 진척 관리")
    lines.append("")
    lines.append(f"> 자동 생성: {datetime.now().strftime('%Y-%m-%d %H:%M')} (`scripts/update_dashboard.py` 출력)")
    lines.append(f"> 단일 데이터 소스: `progress.yaml` — 직접 수정 후 스크립트 재실행")
    lines.append("")

    # 전체 요약
    lines.append("## 전체 요약")
    lines.append("")
    lines.append(f"- 상태: **{STATUS_LABEL_KO.get(project.get('status', 'in_progress'), project.get('status', '-'))}**")
    lines.append(f"- 시작: {project.get('started_at', '-')} / 발간 목표: {project.get('target_publish', '-')}")
    lines.append(f"- **전체 진척률: {overall}%**")
    lines.append(f"- 산출물 진척: 완료 {counts['completed']} / 진행 {counts['in_progress']} / 지연 {counts['blocked']} / 대기 {counts['not_started']} (총 {counts['total']})")
    if project.get("notes"):
        lines.append("")
        lines.append(f"**비고**: {project['notes'].strip()}")
    lines.append("")

    # 마일스톤
    if data.get("milestones"):
        lines.append("## 마일스톤")
        lines.append("")
        lines.append("| 일자 | 내용 | 상태 |")
        lines.append("|---|---|---|")
        for m in data["milestones"]:
            lines.append(f"| {m.get('date', '-')} | {m.get('label', '-')} | {STATUS_LABEL_KO.get(m.get('status', 'pending'), m.get('status', '-'))} |")
        lines.append("")

    # 단계별
    lines.append("## 단계별 진척")
    lines.append("")
    for s in stages:
        sid = s.get("id", "?")
        prog = compute_stage_progress(s)
        bar = "█" * (prog // 5) + "░" * (20 - prog // 5)
        lines.append(f"### 단계 {sid} — {s.get('name', '-')}")
        lines.append("")
        lines.append(f"- 역할: {s.get('role', '-')}")
        lines.append(f"- 상태: **{STATUS_LABEL_KO.get(s.get('status', 'not_started'), s.get('status', '-'))}**")
        lines.append(f"- 진척: `{bar}` **{prog}%**")
        lines.append(f"- ETA: {s.get('eta', '-')}")
        lines.append(f"- 설명: {s.get('description', '-')}")
        lines.append("")

        if s.get("deliverables"):
            lines.append("| 산출물 | 경로 | 상태 |")
            lines.append("|---|---|---|")
            for d in s["deliverables"]:
                st = STATUS_LABEL_KO.get(d.get("status", "not_started"), d.get("status", "-"))
                lines.append(f"| {d.get('name', '-')} | `{d.get('path', '-')}` | {st} |")
            lines.append("")

        if s.get("blockers"):
            lines.append("**블로커**:")
            for b in s["blockers"]:
                lines.append(f"- {b}")
            lines.append("")

    # Worklog
    if worklog:
        lines.append("## 작업 이력 (Worklog)")
        lines.append("")
        wl_sorted = sorted(worklog, key=lambda e: e.get("timestamp", ""), reverse=True)
        for e in wl_sorted:
            ts = e.get("timestamp", "")[:16].replace("T", " ")
            stage = e.get("stage", "")
            stage_lbl = STAGE_LABEL.get(stage, str(stage))
            type_ = e.get("type", "setup")
            type_lbl = WORKLOG_TYPE_META.get(type_, {}).get("label", type_)
            lines.append(f"### [{ts}] {stage_lbl} · {type_lbl} — {e.get('title', '-')}")
            lines.append("")
            desc = (e.get("description") or "").strip()
            if desc:
                lines.append(desc)
                lines.append("")
            artifacts = e.get("artifacts", [])
            if artifacts:
                lines.append("**산출물**:")
                for a in artifacts:
                    lines.append(f"- `{a}`")
                lines.append("")

    return "\n".join(lines)


# ---------- HTML 대시보드 ----------

HTML_TEMPLATE = """<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>{title} — 진척 대시보드</title>
  <style>
    :root {{
      --bg: #f5f7fa;
      --card: #ffffff;
      --text: #1f2937;
      --muted: #6b7280;
      --border: #e5e7eb;
      --completed: #22c55e;
      --in_progress: #3b82f6;
      --blocked: #ef4444;
      --not_started: #9ca3af;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', '맑은 고딕', Malgun Gothic, system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 24px;
      min-height: 100vh;
    }}
    .wrap {{ max-width: 1280px; margin: 0 auto; }}
    header {{
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px 28px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }}
    h1 {{ font-size: 22px; font-weight: 700; margin-bottom: 4px; }}
    .meta {{ color: var(--muted); font-size: 13px; }}
    .updated {{ float: right; font-size: 12px; color: var(--muted); }}

    .summary {{
      display: grid;
      grid-template-columns: 1.4fr 1fr 1fr 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }}
    .card {{
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }}
    .card h2 {{ font-size: 12px; font-weight: 500; color: var(--muted); margin-bottom: 8px; letter-spacing: 0.02em; }}
    .card .big {{ font-size: 32px; font-weight: 700; color: var(--text); }}
    .card .sub {{ font-size: 12px; color: var(--muted); margin-top: 4px; }}

    .progress-circle {{
      position: relative;
      width: 100px; height: 100px;
      margin: 0 auto 8px;
    }}
    .progress-circle svg {{ width: 100%; height: 100%; transform: rotate(-90deg); }}
    .progress-circle .text {{
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; font-weight: 700;
    }}

    .stages {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 16px;
    }}
    .stage {{
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      display: flex;
      flex-direction: column;
    }}
    .stage-head {{
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 6px;
    }}
    .stage-id {{
      display: inline-block;
      background: var(--bg);
      border-radius: 6px;
      padding: 2px 8px;
      font-size: 12px;
      color: var(--muted);
      font-weight: 600;
      margin-right: 8px;
    }}
    .stage-name {{ font-size: 16px; font-weight: 600; }}
    .badge {{
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 12px;
      color: white;
      font-weight: 500;
    }}
    .badge.completed {{ background: var(--completed); }}
    .badge.in_progress {{ background: var(--in_progress); }}
    .badge.blocked {{ background: var(--blocked); }}
    .badge.not_started {{ background: var(--not_started); }}

    .stage-desc {{ font-size: 13px; color: var(--muted); margin-bottom: 12px; }}
    .stage-role {{ font-size: 12px; color: var(--muted); margin-bottom: 12px; }}

    .progress-bar {{
      height: 8px;
      background: var(--bg);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 4px;
    }}
    .progress-bar > div {{
      height: 100%;
      transition: width 0.3s;
    }}
    .progress-text {{
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 14px;
    }}

    .deliverables {{
      border-top: 1px solid var(--border);
      padding-top: 12px;
    }}
    .deliverables h4 {{ font-size: 11px; color: var(--muted); font-weight: 500; margin-bottom: 8px; letter-spacing: 0.04em; }}
    .deliv {{
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      padding: 4px 0;
    }}
    .deliv .dot {{
      width: 8px; height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }}
    .deliv .dot.completed {{ background: var(--completed); }}
    .deliv .dot.in_progress {{ background: var(--in_progress); }}
    .deliv .dot.blocked {{ background: var(--blocked); }}
    .deliv .dot.not_started {{ background: var(--not_started); }}
    .deliv .name {{ flex: 1; }}
    .deliv .path {{
      font-family: 'SF Mono', Consolas, Monaco, monospace;
      font-size: 11px;
      color: var(--muted);
      flex-shrink: 0;
    }}
    .deliv.completed .name {{ color: var(--muted); text-decoration: line-through; }}

    .milestones, .worklog {{
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      margin-top: 20px;
    }}
    .milestones h2, .worklog h2 {{ font-size: 16px; font-weight: 600; margin-bottom: 16px; }}

    .worklog-filters {{
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }}
    .filter-btn {{
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 4px 12px;
      font-size: 12px;
      cursor: pointer;
      color: var(--text);
      transition: all 0.15s;
    }}
    .filter-btn:hover {{ background: #e5e7eb; }}
    .filter-btn.active {{ background: var(--text); color: white; border-color: var(--text); }}

    .worklog-list {{ position: relative; padding-left: 32px; }}
    .worklog-list::before {{
      content: '';
      position: absolute;
      left: 11px; top: 4px; bottom: 4px;
      width: 2px;
      background: var(--border);
    }}
    .wl-entry {{ position: relative; padding-bottom: 16px; }}
    .wl-entry::before {{
      content: '';
      position: absolute;
      left: -27px;
      top: 4px;
      width: 14px; height: 14px;
      border-radius: 50%;
      background: var(--type-color, #6b7280);
      border: 3px solid var(--card);
      box-shadow: 0 0 0 1px var(--border);
    }}
    .wl-head {{
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 4px;
    }}
    .wl-time {{ font-size: 12px; color: var(--muted); }}
    .wl-stage {{
      font-size: 11px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 1px 6px;
      color: var(--muted);
      font-weight: 500;
    }}
    .wl-type {{
      font-size: 11px;
      background: var(--type-color, #6b7280);
      color: white;
      border-radius: 4px;
      padding: 1px 8px;
      font-weight: 500;
    }}
    .wl-title {{ font-size: 14px; font-weight: 600; flex: 1; }}
    .wl-desc {{ font-size: 13px; color: var(--muted); white-space: pre-line; margin-bottom: 6px; }}
    .wl-artifacts {{ font-size: 12px; }}
    .wl-artifacts .art {{
      display: inline-block;
      font-family: 'SF Mono', Consolas, Monaco, monospace;
      background: var(--bg);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 1px 6px;
      margin-right: 4px;
      margin-top: 4px;
      font-size: 11px;
    }}
    .wl-empty {{ color: var(--muted); font-size: 13px; padding: 20px; text-align: center; }}
    .timeline {{ position: relative; padding-left: 24px; }}
    .timeline::before {{
      content: '';
      position: absolute;
      left: 6px; top: 0; bottom: 0;
      width: 2px;
      background: var(--border);
    }}
    .ms {{ position: relative; padding-bottom: 12px; }}
    .ms::before {{
      content: '';
      position: absolute;
      left: -22px;
      top: 5px;
      width: 12px; height: 12px;
      border-radius: 50%;
      background: var(--not_started);
      border: 2px solid var(--card);
    }}
    .ms.completed::before {{ background: var(--completed); }}
    .ms .date {{ font-size: 12px; color: var(--muted); }}
    .ms .label {{ font-size: 14px; }}

    footer {{ text-align: center; padding: 24px; color: var(--muted); font-size: 12px; }}

    @media (max-width: 900px) {{
      .summary {{ grid-template-columns: 1fr 1fr; }}
    }}
  </style>
</head>
<body>
<div class="wrap">

<header>
  <span class="updated">갱신: {updated}</span>
  <h1>{title}</h1>
  <div class="meta">발간 목표 <strong>{target}</strong> · 시작 {started} · 상태 <strong>{status_ko}</strong></div>
  {notes_html}
</header>

<section class="summary">
  <div class="card">
    <h2>전체 진척</h2>
    <div class="progress-circle">
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" stroke-width="8"/>
        <circle cx="50" cy="50" r="42" fill="none" stroke="#3b82f6" stroke-width="8"
                stroke-dasharray="{circle_full}" stroke-dashoffset="{circle_offset}" stroke-linecap="round"/>
      </svg>
      <div class="text">{overall}%</div>
    </div>
  </div>
  <div class="card">
    <h2>완료 산출물</h2>
    <div class="big" style="color:var(--completed)">{c_completed}</div>
    <div class="sub">/ 전체 {c_total}</div>
  </div>
  <div class="card">
    <h2>진행 중</h2>
    <div class="big" style="color:var(--in_progress)">{c_in_progress}</div>
    <div class="sub">단계별 active</div>
  </div>
  <div class="card">
    <h2>대기</h2>
    <div class="big" style="color:var(--not_started)">{c_not_started}</div>
    <div class="sub">착수 전</div>
  </div>
  <div class="card">
    <h2>지연</h2>
    <div class="big" style="color:var(--blocked)">{c_blocked}</div>
    <div class="sub">블로커 있음</div>
  </div>
</section>

<section class="stages">
  {stage_cards}
</section>

<section class="milestones">
  <h2>마일스톤</h2>
  <div class="timeline">
    {milestones_html}
  </div>
</section>

<section class="worklog">
  <h2>작업 이력 (Worklog) · {worklog_count}건</h2>
  <div class="worklog-filters" id="wl-filters">
    <button class="filter-btn active" data-filter="all">전체</button>
    <button class="filter-btn" data-filter="stage-setup">골격</button>
    <button class="filter-btn" data-filter="stage-0">단계 0</button>
    <button class="filter-btn" data-filter="stage-1">단계 1</button>
    <button class="filter-btn" data-filter="stage-2">단계 2</button>
    <button class="filter-btn" data-filter="stage-3">단계 3</button>
    <button class="filter-btn" data-filter="stage-4">단계 4</button>
    <button class="filter-btn" data-filter="stage-5">단계 5</button>
    <button class="filter-btn" data-filter="type-decision">결정</button>
    <button class="filter-btn" data-filter="type-finding">발견</button>
    <button class="filter-btn" data-filter="type-deliverable">산출물</button>
    <button class="filter-btn" data-filter="type-blocker">블로커</button>
  </div>
  <div class="worklog-list" id="wl-list">
    {worklog_html}
  </div>
</section>

<footer>
  자동 생성 by <code>scripts/update_dashboard.py</code> · 단일 소스 <code>progress.yaml</code>, <code>worklog.yaml</code>
</footer>

<script>
  // worklog 필터링
  document.querySelectorAll('.filter-btn').forEach(btn => {{
    btn.addEventListener('click', () => {{
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const f = btn.dataset.filter;
      document.querySelectorAll('.wl-entry').forEach(e => {{
        if (f === 'all') {{
          e.style.display = '';
        }} else {{
          e.style.display = e.classList.contains(f) ? '' : 'none';
        }}
      }});
    }});
  }});
</script>

</div>
</body>
</html>
"""


def render_stage_card(stage: dict) -> str:
    prog = compute_stage_progress(stage)
    st = stage.get("status", "not_started")
    delivs_html = ""
    for d in stage.get("deliverables", []):
        ds = d.get("status", "not_started")
        delivs_html += f"""
        <div class="deliv {ds}">
          <span class="dot {ds}"></span>
          <span class="name">{d.get('name', '-')}</span>
          <span class="path">{d.get('path', '')}</span>
        </div>
        """
    return f"""
    <div class="stage">
      <div class="stage-head">
        <div>
          <span class="stage-id">단계 {stage.get('id', '?')}</span>
          <span class="stage-name">{stage.get('name', '-')}</span>
        </div>
        <span class="badge {st}">{STATUS_LABEL_KO.get(st, st)}</span>
      </div>
      <div class="stage-role">{stage.get('role', '-')} · ETA {stage.get('eta', '-')}</div>
      <div class="stage-desc">{stage.get('description', '')}</div>
      <div class="progress-bar"><div style="width:{prog}%; background: var(--{st})"></div></div>
      <div class="progress-text"><span>{prog}%</span><span>{sum(1 for d in stage.get('deliverables', []) if d.get('status')=='completed')} / {len(stage.get('deliverables', []))} 산출물</span></div>
      <div class="deliverables">
        <h4>산출물</h4>
        {delivs_html}
      </div>
    </div>
    """


def render_milestone(m: dict) -> str:
    st = m.get("status", "pending")
    cls = "completed" if st == "completed" else ""
    return f"""
    <div class="ms {cls}">
      <div class="date">{m.get('date', '-')}</div>
      <div class="label">{m.get('label', '-')}</div>
    </div>
    """


def _format_artifacts(artifacts: list) -> str:
    if not artifacts:
        return ""
    items = " ".join(f'<span class="art">{a}</span>' for a in artifacts)
    return f'<div class="wl-artifacts">{items}</div>'


def render_worklog_entry(e: dict) -> str:
    stage = e.get("stage", "")
    stage_key = f"stage-{stage}"
    stage_label = STAGE_LABEL.get(stage, str(stage))
    type_ = e.get("type", "setup")
    meta = WORKLOG_TYPE_META.get(type_, WORKLOG_TYPE_META["setup"])
    ts = e.get("timestamp", "")
    # 시각 표시 — YYYY-MM-DD HH:MM 만
    if "T" in ts:
        date_part, time_part = ts.split("T", 1)
        time_part = time_part[:5]
        ts_display = f"{date_part} {time_part}"
    else:
        ts_display = ts

    desc = (e.get("description") or "").strip()
    return f"""
    <div class="wl-entry {stage_key} type-{type_}" style="--type-color: {meta['color']}">
      <div class="wl-head">
        <span class="wl-time">{ts_display}</span>
        <span class="wl-stage">{stage_label}</span>
        <span class="wl-type">{meta['icon']} {meta['label']}</span>
        <span class="wl-title">{e.get('title', '-')}</span>
      </div>
      <div class="wl-desc">{desc}</div>
      {_format_artifacts(e.get('artifacts', []))}
    </div>
    """


def render_html(data: dict, worklog: list[dict]) -> str:
    project = data["project"]
    stages = data["stages"]
    overall = compute_overall(stages)
    counts = count_deliverables(stages)

    # 원형 진척 SVG 계산 (둘레 = 2πr = 2π × 42 ≈ 263.89)
    circle_full = 263.89
    circle_offset = circle_full * (1 - overall / 100)

    notes_html = ""
    if project.get("notes"):
        notes_html = f'<div class="meta" style="margin-top:8px">{project["notes"].strip().replace(chr(10), "<br>")}</div>'

    # worklog: 최신순 정렬
    wl_sorted = sorted(worklog, key=lambda e: e.get("timestamp", ""), reverse=True)
    wl_html = "\n".join(render_worklog_entry(e) for e in wl_sorted) if wl_sorted \
              else '<div class="wl-empty">아직 기록된 작업 이력이 없습니다.</div>'

    return HTML_TEMPLATE.format(
        title=project["name"],
        updated=datetime.now().strftime("%Y-%m-%d %H:%M"),
        target=project.get("target_publish", "-"),
        started=project.get("started_at", "-"),
        status_ko=STATUS_LABEL_KO.get(project.get("status", "in_progress"), project.get("status", "-")),
        notes_html=notes_html,
        overall=overall,
        circle_full=f"{circle_full:.2f}",
        circle_offset=f"{circle_offset:.2f}",
        c_completed=counts["completed"],
        c_in_progress=counts["in_progress"],
        c_not_started=counts["not_started"],
        c_blocked=counts["blocked"],
        c_total=counts["total"],
        stage_cards="\n".join(render_stage_card(s) for s in stages),
        milestones_html="\n".join(render_milestone(m) for m in data.get("milestones", [])),
        worklog_count=len(worklog),
        worklog_html=wl_html,
    )


# ---------- main ----------

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--open", action="store_true", help="갱신 후 브라우저로 대시보드 열기")
    args = parser.parse_args()

    # Windows cp949 회피
    if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

    if not PROGRESS_YAML.exists():
        sys.exit(f"progress.yaml 없음: {PROGRESS_YAML}")

    data = yaml.safe_load(PROGRESS_YAML.read_text(encoding="utf-8"))
    stages = data.get("stages", [])

    # worklog
    worklog = []
    if WORKLOG_YAML.exists():
        wl_data = yaml.safe_load(WORKLOG_YAML.read_text(encoding="utf-8")) or {}
        worklog = wl_data.get("entries", [])

    # 1) MD
    md = render_md(data, worklog)
    md_path = DOCS_DIR / "PROGRESS.md"
    md_path.write_text(md, encoding="utf-8")
    print(f"✓ {md_path.relative_to(ROOT)}")

    # 2) JSON (대시보드 또는 외부 도구용)
    overall = compute_overall(stages)
    counts = count_deliverables(stages)
    json_data = {
        "project": data["project"],
        "milestones": data.get("milestones", []),
        "stages": [{**s, "computed_progress": compute_stage_progress(s)} for s in stages],
        "summary": {"overall_progress": overall, "deliverable_counts": counts},
        "updated_at": datetime.now().isoformat(timespec="seconds"),
    }
    json_path = DASH_DIR / "data.json"
    json_path.write_text(json.dumps(json_data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"✓ {json_path.relative_to(ROOT)}")

    # 3) HTML
    html = render_html(data, worklog)
    html_path = DASH_DIR / "index.html"
    html_path.write_text(html, encoding="utf-8")
    print(f"✓ {html_path.relative_to(ROOT)}")

    print(f"\n전체 진척률: {overall}%")
    print(f"산출물: 완료 {counts['completed']} / 진행 {counts['in_progress']} / 대기 {counts['not_started']} / 지연 {counts['blocked']} (총 {counts['total']})")
    print(f"작업 이력: {len(worklog)}건")

    if args.open:
        webbrowser.open(html_path.as_uri())


if __name__ == "__main__":
    main()
