/**
 * BRIS 통합 페이지 (complain_reference_list.asp) HTML → 과정 레코드 배열 추출
 */

import { getDOMParser } from './dom.js';
import { normalizeDate, normalizeTeamName } from './utils.js';
import { extractLabelValues } from './label-values.js';

export function extractIntegratedData(html) {
  const DOMParser = getDOMParser();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const table = doc.querySelector('table.ntbl_list_c');
  if (!table) return [];

  const allRows = table.querySelectorAll('tr');
  const records = [];
  let i = 0;

  // 첫 번째 행(tfirst 헤더) 건너뛰기
  while (i < allRows.length && allRows[i].classList.contains('tfirst')) i++;

  function isInfoRow(tr) {
    if (tr.classList.contains('info-row')) return true;
    const firstTd = tr.querySelector('td');
    return firstTd && firstTd.classList.contains('info-row');
  }

  while (i < allRows.length) {
    const row = allRows[i];
    if (isInfoRow(row)) { i++; continue; }

    const tds = row.querySelectorAll('td');
    if (tds.length < 12) { i++; continue; }

    // 첫 번째 td에서 ID들 추출
    const idCell = tds[0].textContent;
    const bizMatch = idCell.match(/business_id\s*:\s*(\d+)/);
    const projMatch = idCell.match(/project_id\s*:\s*(\d+)/);
    const echoMatch = idCell.match(/echo_id\s*:\s*(\d+)/);
    const placeMatch = idCell.match(/place_id\s*:\s*(\d+)/);
    const custMatch = idCell.match(/customer_id\s*:\s*(\d+)/);

    const businessId = bizMatch ? bizMatch[1] : '';
    const projectId = projMatch ? projMatch[1] : '';
    const echoId = echoMatch ? echoMatch[1] : '';
    const placeId = placeMatch ? placeMatch[1] : '';
    const customerId = custMatch ? custMatch[1] : '';

    const courseName = tds[1].textContent.trim();
    const programName = tds[2].textContent.trim();
    const totalRevenue = tds[3].textContent.trim();
    const startDate = normalizeDate(tds[4].textContent.trim());
    const endDate = normalizeDate(tds[5].textContent.trim());
    const eduDelivery = tds[6].textContent.trim().replace(/\s+/g, '');
    const orderCode = tds[7].textContent.trim();
    const projectName = tds[8].textContent.trim();
    const registrationDate = tds[9].textContent.trim();
    const orderDate = tds[10].textContent.trim();

    // 마감일: 빨간색 span이 있으면 마감됨
    const closeDateTd = tds[11];
    const redSpan = closeDateTd.querySelector('span[style*="color:red"], span[style*="color: red"]');
    const projectClosed = (redSpan && redSpan.textContent.trim()) ? redSpan.textContent.trim() : '미적용';

    const record = {
      businessId, projectId, echoId, placeId, customerId,
      courseName, programName, totalRevenue, startDate, endDate,
      eduDelivery, orderCode, projectName, registrationDate, orderDate,
      projectClosed,
      echoStatus: '', echoExcludeReason: '',
      am: '', amTeam: '', performer: '', performerTeam: '',
      instructor: '', internalInstructors: '', externalInstructors: '',
      company: '', businessNumber: '', placeName: '',
      dmName: '', dmDept: '', dmEmail: '', dmPhone: '', dmMobile: ''
    };

    // info-row 들을 라벨 기반으로 파싱 (사내/외부 강사가 별도 행으로 존재할 수 있음)
    i++;
    while (i < allRows.length) {
      const infoRow = allRows[i];
      if (!isInfoRow(infoRow)) break;

      const infoText = infoRow.textContent;
      const lv = extractLabelValues(infoRow);

      if (infoText.includes('에코 상태')) {
        if (lv['에코 상태']) record.echoStatus = lv['에코 상태'];
        else {
          const statusMatch = infoText.match(/에코 상태\s*:\s*(.+?)$/m);
          if (statusMatch) record.echoStatus = statusMatch[1].trim();
        }
        const echoRedSpan = infoRow.querySelector('span[style*="color: red"], span[style*="color:red"]');
        if (echoRedSpan && echoRedSpan.textContent.includes('에코 제외')) {
          record.echoStatus = '에코 제외';
        }
        // 제외 사유 — 같은 info-row 내 별도 <b>에코 제외 사유 : </b> 라벨
        if (lv['에코 제외 사유']) {
          record.echoExcludeReason = lv['에코 제외 사유'];
        } else if (infoText.includes('에코 제외 사유')) {
          const reasonMatch = infoText.match(/에코 제외 사유\s*:\s*(.+?)(?:\n|$)/);
          if (reasonMatch) record.echoExcludeReason = reasonMatch[1].trim();
        }
      } else if (infoText.includes('수주 :') && infoText.includes('수주팀')) {
        // 1차: extractLabelValues 결과 우선 — 키가 있으면 빈 문자열이라도 존중
        if ('수주' in lv) record.am = lv['수주'];
        if ('수주팀' in lv) record.amTeam = lv['수주팀'].replace(/^\(|\)$/g, '');
        if ('수행' in lv) record.performer = lv['수행'];
        if ('수행팀' in lv) {
          const perfTeam = lv['수행팀'].replace(/^\(|\)$/g, '');
          if (perfTeam) record.performerTeam = normalizeTeamName(perfTeam);
        }
        // 2차: lv 에 키 자체가 없을 때만 정규식 fallback
        // (?!팀) 음성 전방탐색 — '수주팀' / '수행팀' 오매치 방지
        if (!('수주' in lv)) {
          const amMatch = infoText.match(/수주(?!팀)\s*:\s*(\S+)/);
          if (amMatch) record.am = amMatch[1].trim();
        }
        if (!('수주팀' in lv)) {
          const amTeamMatch = infoText.match(/수주팀\s*:\s*\(([^)]+)\)/);
          if (amTeamMatch) record.amTeam = amTeamMatch[1].trim();
        }
        if (!('수행' in lv)) {
          const perfMatch = infoText.match(/수행(?!팀)\s*:\s*(\S+)/);
          if (perfMatch) record.performer = perfMatch[1].trim();
        }
        if (!('수행팀' in lv)) {
          const perfTeamMatch = infoText.match(/수행팀\s*:\s*\(([^)]+)\)/);
          if (perfTeamMatch) record.performerTeam = normalizeTeamName(perfTeamMatch[1].trim());
        }
      } else if (infoText.includes('사내강사') && !infoText.includes('외부강사')) {
        record.internalInstructors = lv['사내강사'] || '';
        if (!record.internalInstructors) {
          const m = infoText.match(/사내강사\s*:\s*(.+?)$/m);
          if (m) record.internalInstructors = m[1].trim();
        }
      } else if (infoText.includes('외부강사') && !infoText.includes('사내강사')) {
        record.externalInstructors = lv['외부강사'] || '';
        if (!record.externalInstructors) {
          const m = infoText.match(/외부강사\s*:\s*(.+?)$/m);
          if (m) record.externalInstructors = m[1].trim();
        }
      } else if (infoText.includes('사내강사') && infoText.includes('외부강사')) {
        record.internalInstructors = lv['사내강사'] || '';
        record.externalInstructors = lv['외부강사'] || '';
        if (!record.internalInstructors) {
          const m = infoText.match(/사내강사\s*:\s*(.+?)(?=\s*외부강사|$)/);
          if (m) record.internalInstructors = m[1].trim();
        }
        if (!record.externalInstructors) {
          const m = infoText.match(/외부강사\s*:\s*(.+?)$/m);
          if (m) record.externalInstructors = m[1].trim();
        }
      } else if (infoText.includes('강사') && !infoText.includes('사내강사') && !infoText.includes('외부강사')) {
        // 구버전 호환: 단일 "강사" 라벨만 있는 경우
        const instrMatch = infoText.match(/강사\s*:\s*(.+?)$/m);
        if (instrMatch) record.instructor = instrMatch[1].trim();
      } else if (infoText.includes('회사명') && infoText.includes('사업자번호')) {
        record.company = lv['회사명'] || '';
        record.businessNumber = lv['사업자번호'] || '';
        record.placeName = lv['사업장명'] || '';
        if (!record.company) {
          const compMatch = infoText.match(/회사명\s*:\s*(.+?)(?=\s*사업자번호|$)/);
          if (compMatch) record.company = compMatch[1].trim();
        }
        if (!record.businessNumber) {
          const bizNumMatch = infoText.match(/사업자번호\s*:\s*(\S*)/);
          if (bizNumMatch) record.businessNumber = bizNumMatch[1].trim();
        }
        if (!record.placeName) {
          const placeMatch = infoText.match(/사업장명\s*:\s*(.+?)$/m);
          if (placeMatch) record.placeName = placeMatch[1].trim();
        }
      } else if (infoText.includes('담당자') && infoText.includes('이메일')) {
        record.dmName = lv['담당자'] || '';
        record.dmDept = lv['부서'] || '';
        record.dmEmail = lv['이메일'] || '';
        record.dmPhone = lv['전화'] || '';
        record.dmMobile = lv['휴대'] || '';
        if (!record.dmName) {
          const nameMatch = infoText.match(/담당자\s*:\s*(.+?)(?=\s*(?:부서|이메일|전화|휴대|$))/);
          if (nameMatch && nameMatch[1].trim()) record.dmName = nameMatch[1].trim();
        }
        if (!record.dmDept) {
          const deptMatch = infoText.match(/부서\s*:\s*(.+?)(?=\s*(?:이메일|전화|휴대|$))/);
          if (deptMatch && deptMatch[1].trim()) record.dmDept = deptMatch[1].trim();
        }
        if (!record.dmEmail) {
          const emailMatch = infoText.match(/이메일\s*:\s*(.+?)(?=\s*(?:전화|휴대|$))/);
          if (emailMatch && emailMatch[1].trim()) record.dmEmail = emailMatch[1].trim();
        }
        if (!record.dmPhone) {
          const phoneMatch = infoText.match(/전화\s*:\s*([\d\-\s]+)/);
          if (phoneMatch && phoneMatch[1].trim()) record.dmPhone = phoneMatch[1].trim();
        }
        if (!record.dmMobile) {
          const mobileMatch = infoText.match(/휴대\s*:\s*([\d\-\s]+)/);
          if (mobileMatch && mobileMatch[1].trim()) record.dmMobile = mobileMatch[1].trim();
        }
      }

      i++;
    }

    // 하위호환: instructor (단일 필드)에 사내+외부 합산
    const combinedInstr = [record.internalInstructors, record.externalInstructors]
      .filter(Boolean).join(', ');
    if (combinedInstr) record.instructor = combinedInstr;

    records.push(record);
  }

  return records;
}
