/**
 * 교육세부 (education_view.asp) HTML → 과정 상세 추출
 */

import { getDOMParser } from './dom.js';
import { normalizeText } from './utils.js';

export function extractEduDetailData(html) {
  const DOMParser = getDOMParser();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const bizInput = doc.querySelector('input[id="businessId"], input[name="businessId"], input[name="business_id"]');
  const businessId = bizInput ? bizInput.value : '';

  let orderCode = '', projectId = '';
  const projectLink = doc.querySelector('a[href*="project_view.asp"]');
  if (projectLink) {
    orderCode = projectLink.textContent.trim();
    const pidMatch = (projectLink.getAttribute('href') || '').match(/PROJECT_ID=(\d+)/);
    projectId = pidMatch ? pidMatch[1] : '';
  }

  const tdHeaders = doc.querySelectorAll('td[bgcolor="#DDECB4"]');
  let company = '', internalManager = '', courseName = '', programName = '';
  let customerId = '', customerName = '';

  for (const th of tdHeaders) {
    const text = normalizeText(th.textContent).replace(/\*/g, '');
    const nextTd = th.nextElementSibling;
    if (!nextTd) continue;
    const val = normalizeText(nextTd.textContent);
    if (text === '회사명') company = val;
    else if (text === '담당자') {
      internalManager = val;
      customerId = nextTd.getAttribute('data-customer-id') || '';
      customerName = nextTd.getAttribute('data-customer-name') || '';
      if (!customerId) {
        const dmLink = nextTd.querySelector('a[href*="dm_view.asp"], a[href*="CUSTOMER_ID"]');
        if (dmLink) {
          const cidMatch = (dmLink.getAttribute('href') || '').match(/CUSTOMER_ID=(\d+)/);
          if (cidMatch) customerId = cidMatch[1];
          if (!customerName) customerName = dmLink.textContent.trim();
        }
      }
    }
    else if (text === '과정명') courseName = val;
    else if (text === '프로그램명') programName = val;
  }

  // fallback: 페이지 전체에서 dm_view.asp 링크 탐색
  if (!customerId) {
    const dmLinkFallback = doc.querySelector('a[href*="dm_view.asp"]');
    if (dmLinkFallback) {
      const cidMatch = (dmLinkFallback.getAttribute('href') || '').match(/CUSTOMER_ID=(\d+)/);
      if (cidMatch) customerId = cidMatch[1];
      if (!customerName) customerName = dmLinkFallback.textContent.trim();
    }
  }

  // 강사: inst_fee_edit 링크의 텍스트
  const instructorLinks = doc.querySelectorAll('a[href*="inst_fee_edit.asp"]');
  const instructors = [...instructorLinks].map(a => a.textContent.trim()).filter(Boolean);

  // 진행자(LF): al_person 배열에서 name 추출 (raw HTML에서 직접 매칭)
  let facilitators = [];
  const alMatch = html.match(/al_person\s*:\s*\[([\s\S]*?)\]/);
  if (alMatch && alMatch[1].trim()) {
    try {
      const fixed = alMatch[1].replace(/(\w+)\s*:/g, '"$1":').replace(/'/g, '"');
      const arr = JSON.parse('[' + fixed + ']');
      facilitators = [...new Set(arr.map(p => p.name).filter(Boolean))];
    } catch(e) {
      const nameMatches = alMatch[1].match(/name\s*:\s*['"]([^'"]+)['"]/g);
      if (nameMatches) {
        facilitators = [...new Set(nameMatches.map(m => {
          const v = m.match(/['"]([^'"]+)['"]\s*$/);
          return v ? v[1] : '';
        }).filter(Boolean))];
      }
    }
  }

  // 대면/비대면
  let eduDelivery = '';
  for (const th of tdHeaders) {
    const text = th.textContent.trim();
    if (text.includes('비대면')) {
      const nextTd = th.nextElementSibling;
      if (nextTd) {
        const val = nextTd.textContent.trim();
        eduDelivery = val.includes('비대면') ? '비대면' : val.includes('대면') ? '대면' : val;
      }
      break;
    }
  }

  return {
    businessId, orderCode, projectId, company, internalManager,
    courseName, programName, customerId, customerName,
    instructors, facilitators, eduDelivery
  };
}
