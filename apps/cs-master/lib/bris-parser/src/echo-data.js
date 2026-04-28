/**
 * 에코 운영 (echo/operate/main_2024.asp) HTML → 운영 상세 + 다차수 일정 추출
 */

import { getDOMParser } from './dom.js';

export function extractEchoData(html) {
  const DOMParser = getDOMParser();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  let projectId = '';
  const pidInput = doc.querySelector('input[name="project_id"]');
  if (pidInput) projectId = pidInput.value;
  if (!projectId) {
    const scriptMatch = html.match(/const\s+project_id\s*=\s*"(\d+)"/);
    if (scriptMatch) projectId = scriptMatch[1];
  }

  let orderCode = '';
  const codeSpans = doc.querySelectorAll('.cont span');
  for (const s of codeSpans) {
    const txt = s.textContent.trim();
    if (/^\d{4}-\d{3}$/.test(txt)) { orderCode = txt; break; }
  }

  let company = '';
  const titleTds = doc.querySelectorAll('td.title');
  for (const td of titleTds) {
    if (td.textContent.includes('고객사')) {
      const next = td.nextElementSibling;
      if (next) company = next.textContent.trim().replace(/\s+/g, ' ');
      break;
    }
  }

  let educationType = '';
  const valSpans = doc.querySelectorAll('span.val');
  for (const s of valSpans) {
    const t = s.textContent.trim();
    if (t.includes('대면') || t.includes('비대면') || t.includes('혼합')) { educationType = t; break; }
  }

  let totalParticipants = '';
  for (const s of valSpans) {
    const parent = s.parentElement;
    if (parent && parent.textContent.includes('총') && parent.textContent.includes('명')) {
      totalParticipants = s.textContent.trim(); break;
    }
  }

  let venue = '', venueAddress = '';
  for (const td of titleTds) {
    if (td.textContent.includes('연수원명')) {
      const next = td.nextElementSibling;
      if (next) { const v = next.querySelector('span.val'); venue = v ? v.textContent.trim() : next.textContent.trim(); }
    }
    if (td.textContent.includes('주소')) {
      const next = td.nextElementSibling;
      if (next) { const v = next.querySelector('span.val'); venueAddress = v ? v.textContent.trim() : next.textContent.trim(); }
    }
  }

  let operationIM = '';
  const imSelect = doc.querySelector('select[name="im_no"]');
  if (imSelect) {
    const selected = imSelect.querySelector('option[selected]');
    if (selected) operationIM = selected.textContent.trim().replace(/\u00a0/g, ' ');
  }

  let amName = '', amPhone = '';
  for (const td of titleTds) {
    if (td.textContent.includes('담당AM')) {
      const next = td.nextElementSibling;
      if (next) {
        const b = next.querySelector('b');
        amName = b ? b.textContent.trim() : '';
        const tel = next.querySelector('span.contactTel');
        amPhone = tel ? tel.textContent.trim() : '';
      }
      break;
    }
  }

  let clientContact = '', clientContactId = '', clientContactPosition = '', clientContactDept = '';
  const contactSelect = doc.querySelector('select[name="im_contactor"]');
  if (contactSelect) {
    const selected = contactSelect.querySelector('option[selected]');
    if (selected) {
      clientContactId = selected.value;
      const raw = selected.textContent.trim().replace(/\u00a0/g, ' ');
      const contactMatch = raw.match(/^(.+?)\s+(.*?)\((.*?)\)$/);
      if (contactMatch) {
        clientContact = contactMatch[1];
        clientContactPosition = contactMatch[2];
        clientContactDept = contactMatch[3];
      } else {
        clientContact = raw;
      }
    }
  }

  let clientContactPhone = '', clientContactMobile = '';
  const contactTels = doc.querySelectorAll('span.contactTel');
  const telArr = Array.from(contactTels).map(t => t.textContent.trim());
  if (telArr.length >= 3) {
    clientContactPhone = telArr[1] || '';
    clientContactMobile = telArr[2] || '';
  }

  let echoStatus = '';
  const alertSpans = doc.querySelectorAll('span.alert');
  for (const s of alertSpans) {
    if (s.textContent.includes('에코 제외')) { echoStatus = '에코 제외'; break; }
  }

  let sheetState = '';
  const sheetMatch = html.match(/const\s+sheetState\s*=\s*"([^"]+)"/);
  if (sheetMatch) sheetState = sheetMatch[1];

  let surveyUsed = '';
  const surveyChecks = doc.querySelectorAll('input[name="survey"]');
  for (const chk of surveyChecks) {
    if (chk.checked || chk.hasAttribute('checked')) { surveyUsed = chk.value; break; }
  }
  if (!surveyUsed) {
    for (const td of titleTds) {
      if (td.textContent.includes('설문지')) {
        const next = td.nextElementSibling;
        if (next) {
          const v = next.querySelector('span.val');
          const raw = v ? v.textContent.trim() : '';
          if (raw && !raw.includes('기존 설문문항') && !raw.includes('고객사제공')) surveyUsed = raw;
        }
        break;
      }
    }
  }

  // 다차수 교육일정: querySelector의 attribute selector가 환경별로 case-sensitivity 차이
  // 있어 hasAttribute로 직접 필터링 (linkedom/jsdom 공통 동작 보장)
  const schedules = [];
  const allDivs = doc.querySelectorAll('div');
  let sessionIdx = 0;
  allDivs.forEach(div => {
    if (!(div.hasAttribute('sDate') || div.hasAttribute('sdate'))) return;
    const getAttr = (name) =>
      div.getAttribute(name) || div.getAttribute(name.toLowerCase()) || '';
    const d1 = getAttr('courseDay_d1');
    sessionIdx++;
    schedules.push({
      sessionIndex: sessionIdx,
      startDate: getAttr('sDate'),
      endDate: getAttr('eDate'),
      days: d1,
      nights: getAttr('courseDay_d2'),
      participants: getAttr('courseDay_person') || '0',
      isOvernight: parseInt(d1 || '0') > 0
    });
  });

  return {
    projectId, orderCode, company, educationType, totalParticipants,
    venue, venueAddress, operationIM, amName, amPhone,
    clientContact, clientContactId, clientContactPosition, clientContactDept,
    clientContactPhone, clientContactMobile,
    echoStatus, sheetState, surveyUsed, schedules
  };
}
