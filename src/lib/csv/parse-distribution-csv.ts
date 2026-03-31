// CSV 파싱 유틸리티 — CS 설문대상 CSV → 배포용 구조화 데이터

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

const HEADER_MAP: Record<string, keyof Pick<ParsedRow, 'company' | 'project' | 'course' | 'name' | 'email' | 'phone' | 'am' | 'team'>> = {
  '회사': 'company',
  '프로젝트명': 'project',
  '과정(차수)': 'course',
  '담당자': 'name',
  '이메일': 'email',
  '전화': 'phone',
  'AM': 'am',
  '수행팀': 'team',
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

/** CSV 텍스트를 파싱하여 배포용 구조화 데이터 배열로 반환 */
export function parseDistributionCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  const headerFields = parseCSVLine(lines[0])
  const columnIndices: Record<string, number> = {}

  headerFields.forEach((header, idx) => {
    const key = HEADER_MAP[header.trim()]
    if (key) columnIndices[key] = idx
  })

  const rows: ParsedRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i])
    const get = (key: string) => {
      const idx = columnIndices[key]
      return idx !== undefined ? (fields[idx] ?? '').trim() : ''
    }

    const name = get('name')
    const rawEmail = get('email')
    const rawPhone = get('phone')

    // 담당자와 이메일 모두 없으면 스킵
    if (!name && !rawEmail) continue

    const emailIsPhone = isPhoneInEmailField(rawEmail)
    const email = emailIsPhone ? '' : rawEmail
    const emailValid = email ? EMAIL_REGEX.test(email) : false

    // 이메일 컬럼에 전화번호가 있으면 phone에 병합
    const effectivePhone = rawPhone || (emailIsPhone ? rawEmail : '')
    const phoneNormalized = normalizePhone(effectivePhone)

    rows.push({
      rowNumber: i + 1,
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
