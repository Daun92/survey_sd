/**
 * 골든 픽스처 기반 파서 회귀 테스트 (node:test 빌트인)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser } from 'linkedom';

import {
  setDOMParser,
  extractIntegratedData,
  extractEduDetailData,
  extractEchoviewData,
  extractEchoData,
  extractProjectDetailData,
  extractProjectBizList,
  extractDmData,
  normalizePhone, normalizeDate, parseBrisDate, normalizeTeamName, normalizeText
} from '../src/index.js';

setDOMParser(DOMParser);

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, 'fixtures');

const parsersByPrefix = {
  integrated: extractIntegratedData,
  edu_detail: extractEduDetailData,
  echo_view: extractEchoviewData,
  echo_data: extractEchoData,
  project_detail: extractProjectDetailData,
  project_biz: extractProjectBizList,
  dm: extractDmData,
};

function parserFor(filename) {
  for (const [prefix, fn] of Object.entries(parsersByPrefix)) {
    if (filename.startsWith(prefix)) return fn;
  }
  return null;
}

// ---- 합성 픽스처 골든 비교 ----
for (const f of readdirSync(FIX).filter(x => x.endsWith('.html'))) {
  const name = f.replace(/\.html$/, '');
  const expPath = join(FIX, `${name}.expected.json`);
  if (!existsSync(expPath)) continue;
  const fn = parserFor(name);
  if (!fn) continue;

  test(`fixtures/${f}`, () => {
    const html = readFileSync(join(FIX, f), 'utf8');
    const expected = JSON.parse(readFileSync(expPath, 'utf8'));
    const actual = fn(html);
    assert.deepEqual(actual, expected);
  });
}

// ---- 실 데이터 회귀 (fixtures/real/*.html + .expected.json 쌍) ----
const REAL = join(FIX, 'real');
if (existsSync(REAL)) {
  for (const f of readdirSync(REAL).filter(x => x.endsWith('.html'))) {
    const name = f.replace(/\.html$/, '');
    const expPath = join(REAL, `${name}.expected.json`);
    if (!existsSync(expPath)) continue;
    const fn = parserFor(name);
    if (!fn) continue;

    test(`real/${f}`, () => {
      const html = readFileSync(join(REAL, f), 'utf8');
      const expected = JSON.parse(readFileSync(expPath, 'utf8'));
      const actual = fn(html);
      assert.deepEqual(actual, expected);
    });
  }
}

// ---- 유틸 단위 테스트 ----
test('normalizeText removes NBSP/전각공백', () => {
  assert.equal(normalizeText('  hello\u00a0world\u3000!  '), 'hello world !');
  assert.equal(normalizeText(''), '');
  assert.equal(normalizeText(null), '');
});

test('normalizeDate YYYYMMDD → ISO', () => {
  assert.equal(normalizeDate('20260401'), '2026-04-01');
  assert.equal(normalizeDate('2026-04-01'), '2026-04-01');
  assert.equal(normalizeDate(''), '');
});

test('parseBrisDate arrow / single', () => {
  // 화살표 포맷은 MM/DD → MM/DD 둘 다 필요
  assert.deepEqual(parseBrisDate('2025/04/23~05/30'),
    { startDate: '2025-04-23', endDate: '2025-05-30' });
  assert.deepEqual(parseBrisDate('2025/11/17'),
    { startDate: '2025-11-17', endDate: '2025-11-17' });
  assert.deepEqual(parseBrisDate(''),
    { startDate: '', endDate: '' });
});

test('normalizePhone 다양한 포맷', () => {
  assert.equal(normalizePhone('전화: 0212345678'), '02-1234-5678');
  assert.equal(normalizePhone('휴대: 01012345678'), '010-1234-5678');
  assert.equal(normalizePhone(''), '');
});

test('normalizeTeamName 코드 prefix 제거', () => {
  assert.equal(normalizeTeamName('201205002 - 변화디자인팀'), '변화디자인팀');
  assert.equal(normalizeTeamName('서울1팀'), '서울1팀');
  assert.equal(normalizeTeamName(''), '');
});
