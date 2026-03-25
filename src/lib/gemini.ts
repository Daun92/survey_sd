/**
 * Gemini AI 서버사이드 유틸리티
 * - 리포트 코멘트 생성
 * - 설문 문항 자동 생성
 * - 서술형 응답 분석
 */

const GEMINI_MODEL = 'gemini-2.0-flash-lite'

interface GeminiOptions {
  temperature?: number
  maxTokens?: number
}

interface InlinePart {
  inlineData: { mimeType: string; data: string }
}

interface TextPart {
  text: string
}

type Part = TextPart | InlinePart

/**
 * Gemini API 호출 (서버사이드 전용)
 */
export async function callGemini(
  apiKey: string,
  systemPrompt: string,
  parts: Part[],
  options: GeminiOptions = {}
): Promise<string> {
  const { temperature = 0.4, maxTokens = 8192 } = options

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      responseMimeType: 'application/json',
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error (${res.status}): ${err}`)
  }

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) {
    throw new Error('Gemini returned empty response')
  }

  return text
}

// ============================================================
//  1. 리포트 코멘트 생성
// ============================================================

const REPORT_COMMENT_SYSTEM = `당신은 B2B 교육 컨설팅 기업의 CS/품질관리 분석가입니다.
교육과정 만족도 조사 결과를 분석하여 리포트 코멘트를 생성하세요.
JSON 형식으로 응답:
{
  "executiveSummary": "경영진용 요약 (2~3문장)",
  "strengths": ["강점1", "강점2"],
  "improvements": ["개선점1", "개선점2"],
  "moduleAnalysis": "모듈별 분석 코멘트 (3~4문장)",
  "instructorAnalysis": "강사별 분석 코멘트 (2~3문장)",
  "recommendation": "향후 권고사항 (2~3문장)"
}
5점 척도 기준: 4.5+ 매우우수, 4.0~4.4 우수, 3.5~3.9 양호, 3.0~3.4 보통, 3.0 미만 개선필요`

export interface ReportData {
  courseName: string
  sessionName: string
  overallAvg: number
  responseRate: number
  totalResponses: number
  sectionScores: { name: string; avg: number }[]
  questionScores: { code: string; text: string; section: string; avg: number }[]
}

export interface ReportComment {
  executiveSummary: string
  strengths: string[]
  improvements: string[]
  moduleAnalysis: string
  instructorAnalysis: string
  recommendation: string
}

export async function generateReportComment(
  apiKey: string,
  data: ReportData
): Promise<ReportComment> {
  const userPrompt = `과정: ${data.courseName}
차수: ${data.sessionName}
전체 평균: ${data.overallAvg.toFixed(2)}점
응답률: ${data.responseRate}% (${data.totalResponses}명)
영역별 점수:
${data.sectionScores.map((s) => `- ${s.name}: ${s.avg.toFixed(2)}점`).join('\n')}
문항별 점수:
${data.questionScores.map((q) => `- [${q.section}] ${q.text}: ${q.avg.toFixed(2)}점`).join('\n')}`

  const result = await callGemini(apiKey, REPORT_COMMENT_SYSTEM, [{ text: userPrompt }], {
    temperature: 0.4,
  })
  return JSON.parse(result)
}

// ============================================================
//  2. 서술형 응답 분석
// ============================================================

const OPEN_RESPONSE_SYSTEM = `당신은 교육과정 만족도 조사의 정성 응답을 분석하는 전문가입니다.
수강생들의 자유 응답을 분석하여 다음 JSON 형식으로 요약하세요:
{
  "summary": "전체 요약 (2~3문장)",
  "keywords": ["키워드1", "키워드2"],
  "positive": ["긍정 의견 요약1", "긍정 의견 요약2"],
  "negative": ["부정/개선 의견 요약1", "부정/개선 의견 요약2"],
  "actionItems": ["개선 권고사항1", "개선 권고사항2"]
}`

export interface OpenResponseAnalysis {
  summary: string
  keywords: string[]
  positive: string[]
  negative: string[]
  actionItems: string[]
}

export async function analyzeOpenResponses(
  apiKey: string,
  questionText: string,
  responses: string[]
): Promise<OpenResponseAnalysis> {
  const userPrompt = `문항: ${questionText}

응답 목록 (${responses.length}건):
${responses.map((r, i) => `${i + 1}. ${r}`).join('\n')}`

  const result = await callGemini(apiKey, OPEN_RESPONSE_SYSTEM, [{ text: userPrompt }], {
    temperature: 0.5,
  })
  return JSON.parse(result)
}

// ============================================================
//  3. 설문 문항 자동 생성 (기획서 첨부)
// ============================================================

function getQuestionGenSystem(educationType: string, instructors: string[]) {
  return `당신은 B2B HRD/L&D 교육과정 만족도 설문 문항을 설계하는 전문가입니다.
사용자가 제공하는 교육 기획서/시간표/과정개요서를 분석하여 설문 문항을 생성하세요.
이미지, PDF, 엑셀 파일이 첨부될 수 있으며, 모든 첨부 파일의 내용을 꼼꼼히 분석하세요.

교육유형: ${educationType === 'classroom' ? '집체교육' : educationType === 'remote' ? '원격교육' : educationType}
강사: ${instructors.join(', ') || '(첨부파일에서 확인)'}

반드시 아래 JSON 형식으로만 응답하세요:
{
  "modules": [
    {
      "name": "모듈명 (예: 나의 직장생활 적응기)",
      "questions": [
        {
          "section": "module",
          "sectionLabel": "모듈: 모듈명",
          "code": "MOD_01_01",
          "text": "문항 내용",
          "type": "likert5",
          "required": true
        }
      ]
    }
  ],
  "instructorQuestions": [
    {
      "section": "instructor",
      "sectionLabel": "강사 평가",
      "code": "INS_01",
      "text": "문항 내용",
      "type": "likert5",
      "required": true
    }
  ],
  "overallQuestions": [
    {
      "section": "overall",
      "sectionLabel": "전반적 만족도",
      "code": "OVR_01",
      "text": "문항 내용",
      "type": "likert5",
      "required": true
    }
  ],
  "openQuestions": [
    {
      "section": "open",
      "sectionLabel": "자유 의견",
      "code": "OPEN_01",
      "text": "문항 내용",
      "type": "text",
      "required": false
    }
  ]
}

설계 원칙:
- 모듈별 만족도: 첨부 자료의 각 모듈/세션별 핵심 학습목표 기반 1~2문항씩
- 강사 만족도: 전문성, 전달력, 상호 소통 등 3~4문항
- 전반적 만족도: 전반만족, 교육시간 적절성, 추천의향 등 3~4문항
- 운영 만족도: 교육 운영/진행 관련 1~2문항
- 자유의견: 개선사항, 기대 사항 등 2~3문항 (text 타입)
- 정량 문항은 likert5, 서술 문항은 text 타입
- 첨부 자료에 기존 설문 문항이 있으면 그 구조를 최대한 참고하되 개선 제안도 포함`
}

export interface GeneratedQuestion {
  section: string
  sectionLabel: string
  code: string
  text: string
  type: 'likert5' | 'text'
  required: boolean
}

export interface GeneratedSurvey {
  modules: { name: string; questions: GeneratedQuestion[] }[]
  instructorQuestions: GeneratedQuestion[]
  overallQuestions: GeneratedQuestion[]
  openQuestions: GeneratedQuestion[]
}

export async function generateSurveyQuestions(
  apiKey: string,
  educationType: string,
  instructors: string[],
  files: { base64: string; mimeType: string; fileName: string }[],
  additionalPrompt?: string
): Promise<GeneratedSurvey> {
  const systemPrompt = getQuestionGenSystem(educationType, instructors)

  const parts: Part[] = []

  // 첨부파일을 inline data로 추가
  for (const file of files) {
    parts.push({
      inlineData: { mimeType: file.mimeType, data: file.base64 },
    })
  }

  // 사용자 요청 텍스트
  parts.push({
    text: additionalPrompt || '위 첨부 파일을 분석하여 교육과정 만족도 설문 문항을 생성해주세요.',
  })

  const result = await callGemini(apiKey, systemPrompt, parts, {
    temperature: 0.5,
    maxTokens: 8192,
  })
  return JSON.parse(result)
}
