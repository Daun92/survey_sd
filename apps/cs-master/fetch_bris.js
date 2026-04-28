#!/usr/bin/env node
/**
 * fetch_bris.js — BRIS 통합 데이터 수집 스크립트
 *
 * 사용법:
 *   npm install cheerio iconv-lite
 *   node fetch_bris.js --start 2026-02-01 --end 2026-03-31
 *
 * 출력: bris_data.json (index.html의 restoreData()로 바로 임포트 가능)
 */

const fs = require('fs');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

const BRIS_BASE = 'https://bris.exc.co.kr';

// ── 유틸 ──────────────────────────────────────────────

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function normalizeDate(str) {
  if (!str) return '';
  str = str.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const m = str.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return str;
}

function normalizeTeamName(raw) {
  if (!raw) return '';
  const m = raw.match(/^\d+\s*-\s*(.+)$/);
  return m ? m[1].trim() : raw.trim();
}

function normalizeText(str) {
  if (!str) return '';
  return str.replace(/[\u00a0\u3000\u200b]/g, ' ').trim();
}

// ── BRIS HTML 가져오기 (EUC-KR → UTF-8) ──────────────

async function fetchBrisHtml(path) {
  const url = BRIS_BASE + path;
  console.log(`  → GET ${url}`);

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);

  const buf = Buffer.from(await resp.arrayBuffer());

  // charset 감지
  let charset = '';
  const ct = resp.headers.get('content-type') || '';
  const hm = ct.match(/charset=([^\s;]+)/i);
  if (hm) charset = hm[1].replace(/['"]/g, '');

  if (!charset) {
    const preview = buf.slice(0, 2048).toString('ascii');
    const mm = preview.match(/charset=["']?([^\s"';>]+)/i);
    if (mm) charset = mm[1];
  }

  if (!charset) charset = 'euc-kr';

  if (charset.toLowerCase() === 'utf-8') {
    return buf.toString('utf-8');
  }
  return iconv.decode(buf, charset);
}

// ── 통합 페이지 파싱 (extractIntegratedData 이식) ─────

function extractIntegratedData(html) {
  const $ = cheerio.load(html);
  const table = $('table.ntbl_list_c');
  if (!table.length) return [];

  const allRows = table.find('tr').toArray();
  const records = [];
  let i = 0;

  // 헤더 행(tfirst) 건너뛰기
  while (i < allRows.length && $(allRows[i]).hasClass('tfirst')) i++;

  function isInfoRow(tr) {
    const $tr = $(tr);
    if ($tr.hasClass('info-row')) return true;
    const firstTd = $tr.find('td').first();
    return firstTd.hasClass('info-row');
  }

  while (i < allRows.length) {
    const row = allRows[i];
    if (isInfoRow(row)) { i++; continue; }

    const tds = $(row).find('td').toArray();
    if (tds.length < 12) { i++; continue; }

    const idCell = $(tds[0]).text();
    const bizMatch = idCell.match(/business_id\s*:\s*(\d+)/);
    const projMatch = idCell.match(/project_id\s*:\s*(\d+)/);
    const echoMatch = idCell.match(/echo_id\s*:\s*(\d+)/);
    const custMatch = idCell.match(/customer_id\s*:\s*(\d+)/);

    const businessId = bizMatch ? bizMatch[1] : '';
    const projectId = projMatch ? projMatch[1] : '';
    const echoId = echoMatch ? echoMatch[1] : '';
    const customerId = custMatch ? custMatch[1] : '';

    const courseName = normalizeText($(tds[1]).text());
    const programName = normalizeText($(tds[2]).text());
    const totalRevenue = normalizeText($(tds[3]).text());
    const startDate = normalizeDate($(tds[4]).text().trim());
    const endDate = normalizeDate($(tds[5]).text().trim());
    const eduDelivery = $(tds[6]).text().trim().replace(/\s+/g, '');
    const orderCode = normalizeText($(tds[7]).text());
    const projectName = normalizeText($(tds[8]).text());

    // 마감일: 빨간색 span이 있으면 마감됨
    const closeDateTd = $(tds[11]);
    const redSpan = closeDateTd.find('span[style*="color:red"], span[style*="color: red"]');
    const projectClosed = (redSpan.length && redSpan.text().trim()) ? redSpan.text().trim() : '미적용';

    const record = {
      businessId, projectId, echoId, customerId,
      courseName, programName, totalRevenue, startDate, endDate,
      eduDelivery, orderCode, projectName, projectClosed,
      echoStatus: '', am: '', amTeam: '', performer: '', performerTeam: '',
      instructor: '', company: '', businessNumber: '', placeName: '',
      dmName: '', dmDept: '', dmEmail: '', dmPhone: '', dmMobile: ''
    };

    // info-row 5개 파싱
    i++;
    let infoCount = 0;
    while (i < allRows.length && infoCount < 5) {
      const infoRow = allRows[i];
      if (!isInfoRow(infoRow)) break;

      const infoText = $(infoRow).text();

      if (infoCount === 0) {
        const statusMatch = infoText.match(/에코 상태\s*:\s*(.+?)$/m);
        if (statusMatch) record.echoStatus = statusMatch[1].trim();
        const echoRedSpan = $(infoRow).find('span[style*="color: red"], span[style*="color:red"]');
        if (echoRedSpan.length && echoRedSpan.text().includes('에코 제외')) {
          record.echoStatus = '에코 제외';
        }
      } else if (infoCount === 1) {
        const amMatch = infoText.match(/수주\s*:\s*(\S+)/);
        if (amMatch) record.am = amMatch[1].trim();
        const amTeamMatch = infoText.match(/수주팀\s*:\s*\(([^)]+)\)/);
        if (amTeamMatch) record.amTeam = amTeamMatch[1].trim();
        const perfMatch = infoText.match(/수행\s*:\s*(\S+)/);
        if (perfMatch) record.performer = perfMatch[1].trim();
        const perfTeamMatch = infoText.match(/수행팀\s*:\s*\(([^)]+)\)/);
        if (perfTeamMatch) record.performerTeam = normalizeTeamName(perfTeamMatch[1].trim());
      } else if (infoCount === 2) {
        const instrMatch = infoText.match(/강사\s*:\s*(.+?)$/m);
        if (instrMatch) record.instructor = instrMatch[1].trim();
      } else if (infoCount === 3) {
        const compMatch = infoText.match(/회사명\s*:\s*(.+?)(?=\s*사업자번호|$)/);
        if (compMatch) record.company = compMatch[1].trim();
        const bizNumMatch = infoText.match(/사업자번호\s*:\s*(\S*)/);
        if (bizNumMatch) record.businessNumber = bizNumMatch[1].trim();
        const placeMatch = infoText.match(/사업장명\s*:\s*(.+?)$/m);
        if (placeMatch) record.placeName = placeMatch[1].trim();
      } else if (infoCount === 4) {
        const nameMatch = infoText.match(/담당자\s*:\s*(.+?)(?=\s*(?:부서|이메일|전화|휴대|$))/);
        if (nameMatch && nameMatch[1].trim()) record.dmName = nameMatch[1].trim();
        const deptMatch = infoText.match(/부서\s*:\s*(.+?)(?=\s*(?:이메일|전화|휴대|$))/);
        if (deptMatch && deptMatch[1].trim()) record.dmDept = deptMatch[1].trim();
        const emailMatch = infoText.match(/이메일\s*:\s*(.+?)(?=\s*(?:전화|휴대|$))/);
        if (emailMatch && emailMatch[1].trim()) record.dmEmail = emailMatch[1].trim();
        const phoneMatch = infoText.match(/전화\s*:\s*(.+?)(?=\s*(?:휴대|$))/);
        if (phoneMatch && phoneMatch[1].trim()) record.dmPhone = phoneMatch[1].trim();
        const mobileMatch = infoText.match(/휴대\s*:\s*(.*?)$/);
        if (mobileMatch && mobileMatch[1].trim()) record.dmMobile = mobileMatch[1].trim();
      }

      infoCount++;
      i++;
    }

    records.push(record);
  }

  return records;
}

// ── 추출 레코드 → backup JSON 구조 변환 ──────────────

function buildBackupData(records) {
  const courses = [];
  const managers = [];
  const operations = [];
  const today = new Date().toISOString().split('T')[0];

  for (const r of records) {
    // 1) 과정 생성
    const courseId = genId();
    const course = {
      id: courseId,
      businessId: r.businessId,
      type: '사내',
      courseName: r.courseName,
      programName: r.programName,
      company: r.company,
      startDate: r.startDate,
      endDate: r.endDate,
      hours: '',
      participants: '',
      am: r.am,
      internalManager: '',
      customerId: r.customerId,
      customerName: r.dmName,
      projectName: r.projectName,
      projectClosed: r.projectClosed,
      team: r.performerTeam,
      orderCode: r.orderCode,
      projectId: r.projectId,
      eId: r.echoId,
      echoProjectName: '',
      echoActive: '',
      instructors: r.instructor ? [r.instructor] : [],
      facilitators: [],
      eduDelivery: r.eduDelivery,
      excludeReason: '',
      _fetchedEdu: true,
      _fetchedEcho: false,
      _fetchedProject: true,
      _fetchedDm: !!r.dmName
    };

    // 에코 상태 매핑
    if (r.echoStatus.includes('에코 현황') || r.echoStatus.includes('에코 등록 됨')) {
      course.echoActive = '현황';
    } else if (r.echoStatus.includes('에코 등록 필요') || r.echoStatus.includes('에코 등록')) {
      course.echoActive = '등록';
    } else if (r.echoStatus.includes('에코 제외')) {
      course.echoActive = '제외';
    }

    courses.push(course);

    // 2) DM/Manager
    if (r.customerId && r.dmName) {
      const existingIdx = managers.findIndex(m => m.customerId === r.customerId);
      const mgr = {
        id: existingIdx >= 0 ? managers[existingIdx].id : genId(),
        customerId: r.customerId,
        company: r.company,
        companyGrade: '',
        name: r.dmName,
        position: '',
        department: r.dmDept,
        phone: r.dmPhone,
        mobile: r.dmMobile,
        email: r.dmEmail,
        dmSubscription: '',
        responsibilityArea: '',
        customerLevel: ''
      };
      if (existingIdx >= 0) managers[existingIdx] = mgr;
      else managers.push(mgr);
    }

    // 3) Operation
    if (r.projectId) {
      const existingOp = operations.find(o => o.projectId === r.projectId);
      if (!existingOp) {
        operations.push({
          id: genId(),
          courseId: courseId,
          orderCode: r.orderCode,
          projectId: r.projectId,
          company: r.company,
          educationType: r.eduDelivery === '비대면' ? '비대면교육' : r.eduDelivery === '대면' ? '대면교육' : '',
          totalParticipants: '',
          venue: '',
          venueAddress: '',
          operationIM: '',
          amName: r.am || '',
          amPhone: '',
          clientContact: r.dmName || '',
          clientContactId: r.customerId || '',
          clientContactPosition: '',
          clientContactDept: r.dmDept || '',
          clientContactPhone: r.dmPhone || '',
          clientContactMobile: r.dmMobile || '',
          echoStatus: r.echoStatus || '',
          sheetState: '',
          surveyUsed: '',
          createdDate: today
        });
      }
    }
  }

  // 중복 제거
  const seen = new Set();
  const dedupedCourses = courses.filter(c => {
    const key = c.businessId || ((c.courseName || '') + '||' + (c.company || ''));
    if (!key || key === '||') return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    courses: dedupedCourses,
    schedules: [],
    operations,
    managers,
    history: [],
    exportDate: new Date().toISOString()
  };
}

// ── CLI 인자 파싱 ─────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  let start = '', end = '';

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--start' || args[i] === '-s') && args[i + 1]) start = args[++i];
    if ((args[i] === '--end' || args[i] === '-e') && args[i + 1]) end = args[++i];
  }

  if (!start || !end) {
    // 기본값: 이번 달 1일 ~ 오늘
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    start = start || `${y}-${m}-01`;
    end = end || `${y}-${m}-${d}`;
  }

  return { start, end };
}

// ── 메인 ──────────────────────────────────────────────

async function main() {
  const { start, end } = parseArgs();
  console.log(`\n[BRIS 데이터 수집] 기간: ${start} ~ ${end}\n`);

  // 1) 통합 페이지 수집
  console.log('[1/2] 통합 페이지 수집...');
  const sDate = start.replace(/-/g, '');
  const eDate = end.replace(/-/g, '');
  const html = await fetchBrisHtml(
    `/business/complain_reference_list.asp?sDate=${sDate}&eDate=${eDate}`
  );

  const records = extractIntegratedData(html);
  console.log(`  → ${records.length}건 추출 완료`);

  if (records.length === 0) {
    console.log('\n데이터가 없습니다. 기간을 확인하세요.');
    process.exit(1);
  }

  // 2) 결과 변환 및 저장
  console.log('[2/2] JSON 변환 및 저장...');
  const backupData = buildBackupData(records);

  const outFile = 'bris_data.json';
  fs.writeFileSync(outFile, JSON.stringify(backupData, null, 2), 'utf-8');

  console.log(`\n완료! ${outFile} 저장됨`);
  console.log(`  - 과정: ${backupData.courses.length}건`);
  console.log(`  - 담당자(DM): ${backupData.managers.length}건`);
  console.log(`  - 운영: ${backupData.operations.length}건`);
  console.log(`\nindex.html → Tab5 "내보내기/백업" → "데이터 복원" 또는`);
  console.log(`Tab1 "JSON 데이터 불러오기"로 임포트하세요.\n`);
}

main().catch(err => {
  console.error('\n오류:', err.message);
  process.exit(1);
});
