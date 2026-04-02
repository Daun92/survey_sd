import React from "react";

/**
 * 간단한 마크다운 파서 — 안내블록 전용
 *
 * 지원 문법:
 *   **굵게**  *기울임*  ~~취소선~~  `인라인 코드`  ---  줄바꿈
 *
 * HTML 태그는 이스케이프하여 XSS 방지.
 */

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 인라인 마크다운을 React 노드 배열로 변환 */
function parseInline(text: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  // 순서 중요: **bold** 를 *italic* 보다 먼저 매칭
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // 매칭 전 일반 텍스트
    if (match.index > lastIndex) {
      tokens.push(escapeHtml(text.slice(lastIndex, match.index)));
    }

    if (match[2] !== undefined) {
      // **bold**
      tokens.push(<strong key={match.index} className="font-semibold">{escapeHtml(match[2])}</strong>);
    } else if (match[3] !== undefined) {
      // *italic*
      tokens.push(<em key={match.index}>{escapeHtml(match[3])}</em>);
    } else if (match[4] !== undefined) {
      // ~~strikethrough~~
      tokens.push(<del key={match.index} className="text-current/60">{escapeHtml(match[4])}</del>);
    } else if (match[5] !== undefined) {
      // `code`
      tokens.push(
        <code key={match.index} className="rounded bg-black/5 px-1 py-0.5 text-[0.9em] font-mono">
          {escapeHtml(match[5])}
        </code>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // 나머지 텍스트
  if (lastIndex < text.length) {
    tokens.push(escapeHtml(text.slice(lastIndex)));
  }

  return tokens;
}

export function parseSimpleMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    // --- 수평선
    if (/^-{3,}$/.test(trimmed)) {
      nodes.push(<hr key={`hr-${i}`} className="my-2 border-current/20" />);
      return;
    }

    // 빈 줄 → 줄바꿈
    if (trimmed === "") {
      nodes.push(<br key={`br-${i}`} />);
      return;
    }

    // 인라인 마크다운 파싱
    const inline = parseInline(line);
    nodes.push(<React.Fragment key={`l-${i}`}>{inline}</React.Fragment>);

    // 마지막 줄이 아니면 줄바꿈 추가
    if (i < lines.length - 1) {
      nodes.push(<br key={`lbr-${i}`} />);
    }
  });

  return <>{nodes}</>;
}
