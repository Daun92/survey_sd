/**
 * 프로젝트세부 (project_view.asp) + 교육내역 목록 (project_biz_list.asp) 파싱
 */

import { getDOMParser } from './dom.js';

export function extractProjectDetailData(html) {
  const DOMParser = getDOMParser();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  let projectId = '';
  const pidInput = doc.querySelector('input[name="PROJECT_ID"]');
  if (pidInput) projectId = pidInput.value;
  if (!projectId) {
    const scriptMatch = html.match(/var\s+project_id\s*=\s*"(\d+)"/);
    if (scriptMatch) projectId = scriptMatch[1];
  }

  let orderCode = '';
  const codeInput = doc.querySelector('input[name="successCode"]');
  if (codeInput) orderCode = codeInput.value;
  if (!orderCode) {
    const tdHeaders = doc.querySelectorAll('td.bris_tb_title, td[bgcolor="#dee8ef"]');
    for (const td of tdHeaders) {
      if (td.textContent.includes('수주코드')) {
        const next = td.nextElementSibling;
        if (next) { const match = next.textContent.trim().match(/\d{4}-\d{3}/); if (match) orderCode = match[0]; }
        break;
      }
    }
  }

  let projectClosed = '미적용';
  const allTds = doc.querySelectorAll('td');
  for (let i = 0; i < allTds.length; i++) {
    const td = allTds[i];
    if (td.textContent.includes('프로젝트 마감') && td.querySelector('b')) {
      const next = td.nextElementSibling;
      if (next) { const val = next.textContent.trim(); projectClosed = val || '미적용'; }
      break;
    }
  }

  let projectName = '', company = '', am = '', team = '';
  const infoTds = doc.querySelectorAll('td.bris_tb_title, td[bgcolor="#dee8ef"]');
  for (const td of infoTds) {
    const text = td.textContent.trim().replace(/\*/g, '');
    const next = td.nextElementSibling;
    if (!next) continue;
    const val = next.textContent.trim();
    if (text.includes('프로젝트명')) projectName = val.replace(/\s*과정개요.*$/, '').trim();
    else if (text.includes('고객사')) company = val;
    else if (text.includes('AM') && text.includes('Account')) am = val.split(/\s/)[0];
    else if (text.includes('수행팀')) team = val;
  }

  let echoActive = false;
  const btnEcho = doc.querySelector('button.btnEcho');
  if (btnEcho) {
    const btnText = btnEcho.textContent.trim();
    if (btnText.includes('에코 현황')) echoActive = '현황';
    else if (btnText.includes('에코 등록')) echoActive = '등록';
    else if (btnText.includes('에코 제외')) echoActive = '제외';
  }

  return { projectId, orderCode, projectClosed, projectName, company, am, team, echoActive };
}

/** 프로젝트 교육내역 목록 → 전체 차수 추출 */
export function extractProjectBizList(html) {
  const DOMParser = getDOMParser();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const sessions = [];

  const allLinks = doc.querySelectorAll('a[href*="go_page"]');
  for (const link of allLinks) {
    const row = link.closest('tr');
    if (!row) continue;
    const tds = row.querySelectorAll('td');
    if (tds.length < 4) continue;

    const sessionIndex = parseInt((tds[0].textContent || '').trim()) || 0;

    const href = link.getAttribute('href') || '';
    const bidMatch = href.match(/go_page\s*\(\s*'[^']*'\s*,\s*'(\d+)'/);
    const businessId = bidMatch ? bidMatch[1] : '';

    const dateText = (link.textContent || '').trim();
    let startDate = '', endDate = '';
    const dateMatch = dateText.match(/(\d{4})\.(\d{2})\.(\d{2})(?:~(\d{2}))?/);
    if (dateMatch) {
      const [, y, m, d, d2] = dateMatch;
      startDate = `${y}-${m}-${d}`;
      endDate = d2 ? `${y}-${m}-${d2.padStart(2, '0')}` : startDate;
    }

    const courseName = (tds[3].textContent || '').trim();
    const revenue = (tds.length > 4 ? tds[4].textContent || '' : '').replace(/[^\d]/g, '');

    if (!businessId && !startDate) continue;

    sessions.push({
      businessId, sessionIndex, startDate, endDate,
      courseName, nonFaceToFace: !!(tds[1].textContent || '').trim(), revenue
    });
  }

  return { sessions, totalCount: sessions.length };
}
