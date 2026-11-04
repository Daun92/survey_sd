// CSV/XLSX 파싱 유틸리티 — CS 설문대상 파일 → 배포용 구조화 데이터

export interface ParsedRow {
  rowNumber: number
  company: string
  project: string
  course: string
  name: string
  email: string
  phone: string
  am: string
  team: string
  emailValid: boolean
  phoneNormalized: string
}

const HEADER_MAP: Record<string, keyof Pick<ParsedRow, 'company' | 'project' | 'course' | 'name' | 'email' | 'am' | 'team'>> = {
  '회사': 'company',
  '프로젝트명': 'project',
  '과정(차수)': 'course',
  '담당자': 'name',
  '이메일': 'email',
  'AM': 'am',
  '수행팀': 'team',
}

// 전화번호 열 — 발송이 SMS 라 휴대전화 열을 먼저 보고, 그 행이 비어 있으면 일반 열로 채운다.
// T-073: 대상자관리 📥 대상자 CSV 의 번호 열 이름이 '휴대' 인데 '전화' 만 인식해서
// 2026-09-30·10-06 업로드 23건의 번호가 통째로 빠졌다 (→ 설문이력 판정 누락).
const MOBILE_PHONE_HEADERS = ['휴대', '휴대전화', '휴대폰', '핸드폰']
const OTHER_PHONE_HEADERS = ['전화', '전화번호', '연락처']

/** 경고 문구에 보여 줄 인식 가능한 전화번호 열 이름 */
export const PHONE_HEADER_NAMES = ['전화', '휴대', '휴대전화', '연락처']

export interface PhoneWarning {
  /** all: 모든 행에 번호 없음(열 이름 문제일 가능성) · some: 일부 행 · none: 없음 */
  level: 'all' | 'some' | 'none'
  missing: number
  total: number
}

/** 번호가 빠진 행 집계 — 번호 없이 만든 발송은 문자 발송이 안 되고 설문이력 판정에서 빠진다 */
export function getPhoneWarning(rows: ParsedRow[]): PhoneWarning {
  const missing = rows.filter((r) => !r.phoneNormalized).length
  const level = missing === 0 ? 'none' : missing === rows.length ? 'all' : 'some'
  return { level, missing, total: rows.length }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** "휴대 : 01012345678" 또는 "전화 : 0553201600" 패턴에서 번호만 추출 */
function normalizePhone(raw: string): string {
  const stripped = raw.replace(/^(휴대|전화)\s*:\s*/, '').trim()
  return stripped.replace(/[^\d-]/g, '')
}

/** 이메일 컬럼에 "전화 : XXX" 패턴이 들어있는지 체크 */
function isPhoneInEmailField(value: string): boolean {
  return /^전화\s*:/.test(value.trim())
}

/** CSV 텍스트 한 줄을 필드 배열로 분할 (쌍따옴표 인용 처리) */
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current.trim())
  return fields
}

/** UTF-8 깨짐 감지: 대체 문자(U+FFFD)가 포함되어 있으면 깨진 것으로 판단 */
function hasEncodingIssue(text: string): boolean {
  return text.includes('\uFFFD')
}

/** ArrayBuffer → 텍스트 (UTF-8 우선, EUC-KR fallback) */
export function decodeCSVBuffer(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8').decode(buffer)
  if (!hasEncodingIssue(utf8)) return utf8

  try {
    return new TextDecoder('euc-kr').decode(buffer)
  } catch {
    return utf8
  }
}

/** 2차원 문자열 배열(헤더 + 데이터 행)을 ParsedRow[]로 변환 — CSV/XLSX 공통 */
function parseRowsFromGrid(headerRow: string[], dataRows: string[][]): ParsedRow[] {
  const columnIndices: Record<string, number> = {}

  let mobilePhoneIdx: number | undefined
  let otherPhoneIdx: number | undefined

  headerRow.forEach((header, idx) => {
    const h = header.trim()
    const key = HEADER_MAP[h]
    if (key) columnIndices[key] = idx
    if (mobilePhoneIdx === undefined && MOBILE_PHONE_HEADERS.includes(h)) mobilePhoneIdx = idx
    if (otherPhoneIdx === undefined && OTHER_PHONE_HEADERS.includes(h)) otherPhoneIdx = idx
  })

  const rows: ParsedRow[] = []

  for (let i = 0; i < dataRows.length; i++) {
    const fields = dataRows[i]
    const get = (key: string) => {
      const idx = columnIndices[key]
      return idx !== undefined ? (fields[idx] ?? '').trim() : ''
    }

    const cell = (idx: number | undefined) => (idx !== undefined ? (fields[idx] ?? '').trim() : '')

    const name = get('name')
    const rawEmail = get('email')
    const rawPhone = cell(mobilePhoneIdx) || cell(otherPhoneIdx)

    if (!name && !rawEmail) continue

    const emailIsPhone = isPhoneInEmailField(rawEmail)
    const email = emailIsPhone ? '' : rawEmail
    const emailValid = email ? EMAIL_REGEX.test(email) : false

    const effectivePhone = rawPhone || (emailIsPhone ? rawEmail : '')
    const phoneNormalized = normalizePhone(effectivePhone)

    rows.push({
      rowNumber: i + 2, // 1-indexed, 헤더 제외
      company: get('company'),
      project: get('project'),
      course: get('course'),
      name,
      email,
      phone: effectivePhone,
      am: get('am'),
      team: get('team'),
      emailValid,
      phoneNormalized,
    })
  }

  return rows
}

/** XLSX ArrayBuffer를 파싱하여 배포용 구조화 데이터 배열로 반환 */
export async function parseDistributionXlsx(buffer: ArrayBuffer): Promise<ParsedRow[]> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []

  const sheet = workbook.Sheets[sheetName]
  const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' })
  if (jsonData.length < 2) return []

  const headerRow = jsonData[0].map((cell) => String(cell))
  const dataRows = jsonData.slice(1).map((row) =>
    row.map((cell) => String(cell ?? ''))
  )

  return parseRowsFromGrid(headerRow, dataRows)
}

/** CSV 텍스트를 파싱하여 배포용 구조화 데이터 배열로 반환 */
export function parseDistributionCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  const headerRow = parseCSVLine(lines[0])
  const dataRows = lines.slice(1).map((line) => parseCSVLine(line))

  return parseRowsFromGrid(headerRow, dataRows)
}
