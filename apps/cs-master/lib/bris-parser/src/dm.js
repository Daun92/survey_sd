/**
 * DM 상세 (dm/dm_view.asp) HTML → 고객 담당자 정보 추출
 */

import { getDOMParser } from './dom.js';
import { normalizePhone } from './utils.js';

export function extractDmData(html) {
  const DOMParser = getDOMParser();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  let customerId = '';
  const custInput = doc.querySelector('input[name="CUSTOMER_ID"]');
  if (custInput) customerId = custInput.value;

  let company = '', companyGrade = '';
  const placeLink = doc.querySelector('a[href*="place_view.asp"]');
  if (placeLink) company = placeLink.textContent.trim();

  const tdHeaders = doc.querySelectorAll('td[bgcolor="#DDECB4"]');
  for (const td of tdHeaders) {
    if (td.textContent.includes('사업장등급')) {
      const next = td.nextElementSibling;
      if (next) companyGrade = next.textContent.trim();
    }
  }

  let name = '', position = '';
  for (const td of tdHeaders) {
    if (td.textContent.trim() === '성명') {
      const next = td.nextElementSibling;
      if (next) {
        const parts = next.textContent.trim().split(/\s+/);
        name = parts[0] || '';
        position = parts[1] || '';
      }
      break;
    }
  }

  let phone = '', mobile = '';
  for (const td of tdHeaders) {
    if (td.textContent.includes('전화') && td.textContent.includes('휴대')) {
      const next = td.nextElementSibling;
      if (next) {
        const smsMatch = next.innerHTML.match(/goSMS\s*\(\s*'(\d+)'/);
        const parts = next.innerHTML.split(/<br\s*\/?>/i);
        const phonePart = (parts[0] || '').replace(/<[^>]*>/g, '').trim();
        const mobilePart = (parts[1] || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, '').trim();
        const phoneNums = phonePart.match(/[\d\-]+/g) || [];
        const mobileNums = mobilePart.match(/[\d\-]+/g) || [];
        phone = phoneNums[0] || '';
        mobile = smsMatch ? smsMatch[1] : (mobileNums[0] || '');
      }
      break;
    }
  }

  let department = '';
  for (const td of tdHeaders) {
    if (td.textContent.trim() === '부서') {
      const next = td.nextElementSibling;
      if (next) department = next.textContent.trim();
      break;
    }
  }

  let email = '';
  const mailLink = doc.querySelector('a[href^="mailto:"]');
  if (mailLink) email = mailLink.textContent.trim();

  let dmSubscription = '';
  for (const td of tdHeaders) {
    if (td.textContent.includes('DM수신여부')) {
      const next = td.nextElementSibling;
      if (next) dmSubscription = next.textContent.trim();
      break;
    }
  }

  let customerLevel = '';
  for (const td of tdHeaders) {
    if (td.textContent.includes('고객레벨')) {
      const next = td.nextElementSibling;
      if (next) customerLevel = next.textContent.trim();
      break;
    }
  }

  return {
    customerId, company, companyGrade, name, position, department,
    phone: normalizePhone(phone), mobile: normalizePhone(mobile),
    email, dmSubscription, customerLevel
  };
}
