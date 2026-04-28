/**
 * 에코현황 (project_echoview.asp) HTML → 에코 프로젝트 정보 추출
 */

import { getDOMParser } from './dom.js';
import { normalizeTeamName } from './utils.js';

export function extractEchoviewData(html) {
  const DOMParser = getDOMParser();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // e_id: var e_id = "4137"
  let eId = '';
  const eidMatch = html.match(/(?:var|let|const)\s+e_id\s*=\s*"(\d+)"/);
  if (eidMatch) eId = eidMatch[1];

  // projectId: project_view.asp?project_id=34048
  let projectId = '';
  const projLink = doc.querySelector('a[href*="project_view.asp"], button[onclick*="project_view.asp"]');
  if (projLink) {
    const href = projLink.getAttribute('href') || projLink.getAttribute('onclick') || '';
    const pidMatch = href.match(/project_id=(\d+)/i);
    if (pidMatch) projectId = pidMatch[1];
  }

  // td.title 기반 필드 추출
  const titleTds = doc.querySelectorAll('td.title');
  let orderCode = '', echoProjectName = '', company = '', team = '';
  let echoPeriod = '', amRaw = '', clientContactRaw = '';

  for (const td of titleTds) {
    const label = td.textContent.replace(/\s+/g, ' ').trim();
    const nextTd = td.nextElementSibling;
    if (!nextTd) continue;

    if (label.includes('수주코드')) {
      const codeMatch = nextTd.textContent.match(/\d{4}-\d{3}/);
      if (codeMatch) orderCode = codeMatch[0];
    } else if (label.includes('에코프로젝트명')) {
      const b = nextTd.querySelector('b');
      echoProjectName = (b ? b.textContent.trim() : nextTd.textContent.trim()).replace(/\s*과정개요.*$/, '').trim();
    } else if (label.includes('고객사') && !label.includes('담당')) {
      const b = nextTd.querySelector('b');
      company = b ? b.textContent.trim() : nextTd.textContent.trim();
    } else if (label.includes('수행팀')) {
      const b = nextTd.querySelector('b');
      team = normalizeTeamName(b ? b.textContent.trim() : nextTd.textContent.trim());
    } else if (label.includes('에코 운영기간') || label.includes('운영기간')) {
      echoPeriod = nextTd.textContent.trim();
    } else if (label.includes('AM') && label.includes('운영')) {
      amRaw = nextTd.textContent.trim();
    } else if (label.includes('고객사 담당')) {
      clientContactRaw = nextTd.textContent.trim();
    }
  }

  // AM / 운영 파싱
  let am = '', operationManager = '', amTeam = '';
  if (amRaw) {
    const bTags = [];
    for (const td of titleTds) {
      if (td.textContent.includes('AM') && td.textContent.includes('운영')) {
        const nextTd = td.nextElementSibling;
        if (nextTd) {
          nextTd.querySelectorAll('b').forEach(b => bTags.push(b.textContent.trim()));
          const silverSpan = nextTd.querySelector('span[style*="color:silver"], span[style*="color: silver"]');
          if (silverSpan) amTeam = silverSpan.textContent.trim();
        }
        break;
      }
    }
    am = bTags[0] || '';
    operationManager = bTags[1] || '';
    if (!am && amRaw.includes('/')) {
      const parts = amRaw.split('/');
      am = parts[0].trim().split(/\s+/)[0];
      operationManager = parts[1].trim();
    }
  }

  // 구성내역: 교육내역 건수
  let eduCount = '';
  const contTds = doc.querySelectorAll('td.cont');
  for (const td of contTds) {
    const prev = td.previousElementSibling;
    if (prev && prev.textContent.includes('교육내역')) {
      const m = td.textContent.match(/(\d+)건/);
      eduCount = m ? m[1] : td.textContent.trim();
      break;
    }
  }

  // 구성내역: 고객사 담당자 수, 강사 수
  let clientContactCount = '', instructorCount = '';
  for (const td of contTds) {
    const prev = td.previousElementSibling;
    if (prev && prev.textContent.includes('담당인원')) {
      const memSpans = td.querySelectorAll('span.memCount');
      if (memSpans.length >= 1) {
        const custMatch = memSpans[0].textContent.match(/(\d+)/);
        if (custMatch) clientContactCount = custMatch[1];
      }
      if (memSpans.length >= 2) {
        instructorCount = memSpans[1].textContent.trim();
      }
      if (!instructorCount) {
        const instrMatch = td.textContent.match(/강사\((\d+)/);
        if (instrMatch) instructorCount = instrMatch[1];
      }
      break;
    }
  }

  return {
    eId, projectId, orderCode, echoProjectName, company, team,
    echoPeriod, am, operationManager, amTeam, clientContactRaw,
    eduCount, clientContactCount, instructorCount
  };
}
