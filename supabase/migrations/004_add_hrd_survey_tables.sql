-- =============================================
-- 004: HRD 실태조사 테이블 추가
-- 22회 인적자원개발 실태조사를 위한 스키마
-- =============================================

-- 1. 실태조사 회차 관리
CREATE TABLE IF NOT EXISTS hrd_survey_rounds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  round_number INTEGER NOT NULL UNIQUE,           -- 회차 (22)
  title TEXT NOT NULL,                             -- '제22회 인적자원개발 실태조사'
  description TEXT,
  year INTEGER NOT NULL,                           -- 2026
  status TEXT NOT NULL DEFAULT 'draft'             -- draft, collecting, closed, analyzing, published
    CHECK (status IN ('draft', 'collecting', 'closed', 'analyzing', 'published')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  target_count INTEGER DEFAULT 300,                -- 목표 응답 수
  settings JSONB DEFAULT '{}'::jsonb,              -- 추가 설정
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 실태조사 파트(영역) 관리
CREATE TABLE IF NOT EXISTS hrd_survey_parts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID NOT NULL REFERENCES hrd_survey_rounds(id) ON DELETE CASCADE,
  part_code TEXT NOT NULL,                         -- 'basic_info', 'p1', 'p2', 'p3', 'p4', 'p5'
  part_name TEXT NOT NULL,                         -- '기본정보', 'I. 교육관련 지표' 등
  sort_order INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(round_id, part_code)
);

-- 3. 실태조사 문항 관리 (유연한 설문 설계)
CREATE TABLE IF NOT EXISTS hrd_survey_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  part_id UUID NOT NULL REFERENCES hrd_survey_parts(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES hrd_survey_rounds(id) ON DELETE CASCADE,
  item_code TEXT NOT NULL,                         -- 'p1)R_1_1_2' 형태의 코드
  question_text TEXT NOT NULL,                     -- 설문 문항 텍스트
  sub_item_text TEXT,                              -- 하위 항목 텍스트
  question_group TEXT,                             -- 그룹핑 (예: '1. 거시지표')

  -- 응답 유형 설정
  answer_type TEXT NOT NULL DEFAULT 'text'
    CHECK (answer_type IN (
      'text', 'number', 'percent', 'currency',    -- 직접 입력
      'single_choice', 'multiple_choice',          -- 선택형
      'likert_5', 'likert_importance_performance', -- 척도형
      'rank_order', 'comma_separated',             -- 순위/복수
      'year_month', 'email', 'phone', 'date'       -- 특수 형식
    )),

  -- 선택지 옵션 (JSON 배열)
  answer_options JSONB,                            -- [{"value": 1, "label": "대기업"}, ...]

  -- 메타 설정
  is_required BOOLEAN DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  validation_rules JSONB,                          -- {"min": 0, "max": 100, "sum_group": "edu_ratio"}
  conditional_logic JSONB,                         -- {"show_if": {"item_code": "p1)R_2_n_2", "value": [1,2,3,4,5]}}
  placeholder TEXT,                                -- 입력 힌트
  unit TEXT,                                       -- '원', '명', '%', '시간' 등
  help_text TEXT,                                  -- 도움말

  -- 분석 설정
  analysis_group TEXT,                             -- 벤치마크 분석 그룹 ('macro_indicators', 'edu_budget' 등)
  is_benchmark_item BOOLEAN DEFAULT false,         -- 벤치마크 보고서에 포함 여부
  benchmark_comparison TEXT,                       -- 'mean', 'median', 'distribution'

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(round_id, item_code)
);

-- 4. 실태조사 응답자 (기업 단위)
CREATE TABLE IF NOT EXISTS hrd_respondents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID NOT NULL REFERENCES hrd_survey_rounds(id) ON DELETE CASCADE,

  -- 응답자 정보
  respondent_name TEXT,                            -- 응답자 성명
  respondent_position TEXT,                        -- 직급
  respondent_email TEXT,
  respondent_phone TEXT,
  respondent_mobile TEXT,
  respondent_gender TEXT CHECK (respondent_gender IN ('M', 'F')),

  -- 조직 정보
  org_type TEXT,                                   -- '대기업', '중기업', '소기업', '공공기관', '학교'
  org_type_code INTEGER,                           -- 1~5
  company_name TEXT NOT NULL,
  department_name TEXT,
  industry_code TEXT,                              -- 업종 코드
  industry_name TEXT,                              -- 업종명
  biz_reg_no TEXT,                                 -- 사업자등록번호
  address_road TEXT,
  address_detail TEXT,
  zipcode TEXT,
  recommender TEXT,                                -- 추천인

  -- 응답 토큰 및 상태
  url_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'in_progress', 'completed', 'verified')),
  invited_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,

  -- 메타
  source TEXT DEFAULT 'online',                    -- 'online', 'phone', 'paper', 'import'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. 실태조사 응답 데이터
CREATE TABLE IF NOT EXISTS hrd_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  respondent_id UUID NOT NULL REFERENCES hrd_respondents(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES hrd_survey_items(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES hrd_survey_rounds(id) ON DELETE CASCADE,

  -- 응답 값 (다양한 형태 지원)
  value_text TEXT,                                 -- 텍스트 응답
  value_number NUMERIC,                            -- 숫자 응답
  value_json JSONB,                                -- 복합 응답 (복수 선택 등)

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(respondent_id, item_id)
);

-- 6. 실태조사 벤치마크 분석 결과 (캐시)
CREATE TABLE IF NOT EXISTS hrd_benchmark_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID NOT NULL REFERENCES hrd_survey_rounds(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES hrd_survey_items(id) ON DELETE CASCADE,

  -- 분석 그룹별 통계
  group_type TEXT NOT NULL,                        -- 'all', 'large', 'medium', 'small', 'public', 'school'

  -- 기본 통계
  response_count INTEGER DEFAULT 0,
  mean_value NUMERIC,
  median_value NUMERIC,
  std_dev NUMERIC,
  min_value NUMERIC,
  max_value NUMERIC,
  q1_value NUMERIC,                                -- 1사분위
  q3_value NUMERIC,                                -- 3사분위

  -- 분포 데이터
  distribution JSONB,                              -- {"1": 10, "2": 25, "3": 50, ...}
  percentiles JSONB,                               -- {"10": 1.2, "25": 2.1, "50": 3.0, ...}

  calculated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(round_id, item_id, group_type)
);

-- 7. 개별 기업 컨설팅 보고서
CREATE TABLE IF NOT EXISTS hrd_consulting_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  respondent_id UUID NOT NULL REFERENCES hrd_respondents(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES hrd_survey_rounds(id) ON DELETE CASCADE,

  -- 보고서 내용
  report_data JSONB NOT NULL DEFAULT '{}'::jsonb,  -- 분석 결과 JSON
  ai_summary TEXT,                                 -- AI 생성 요약
  ai_recommendations JSONB,                        -- AI 개선 권고 사항

  -- 상태
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'generating', 'generated', 'reviewed', 'published')),
  generated_at TIMESTAMPTZ,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(respondent_id, round_id)
);

-- =============================================
-- 인덱스
-- =============================================

CREATE INDEX IF NOT EXISTS idx_hrd_parts_round ON hrd_survey_parts(round_id);
CREATE INDEX IF NOT EXISTS idx_hrd_items_part ON hrd_survey_items(part_id);
CREATE INDEX IF NOT EXISTS idx_hrd_items_round ON hrd_survey_items(round_id);
CREATE INDEX IF NOT EXISTS idx_hrd_items_code ON hrd_survey_items(item_code);
CREATE INDEX IF NOT EXISTS idx_hrd_items_analysis ON hrd_survey_items(analysis_group) WHERE is_benchmark_item = true;
CREATE INDEX IF NOT EXISTS idx_hrd_respondents_round ON hrd_respondents(round_id);
CREATE INDEX IF NOT EXISTS idx_hrd_respondents_token ON hrd_respondents(url_token);
CREATE INDEX IF NOT EXISTS idx_hrd_respondents_org ON hrd_respondents(org_type_code);
CREATE INDEX IF NOT EXISTS idx_hrd_respondents_status ON hrd_respondents(status);
CREATE INDEX IF NOT EXISTS idx_hrd_responses_respondent ON hrd_responses(respondent_id);
CREATE INDEX IF NOT EXISTS idx_hrd_responses_item ON hrd_responses(item_id);
CREATE INDEX IF NOT EXISTS idx_hrd_responses_round ON hrd_responses(round_id);
CREATE INDEX IF NOT EXISTS idx_hrd_benchmark_round ON hrd_benchmark_cache(round_id);
CREATE INDEX IF NOT EXISTS idx_hrd_benchmark_group ON hrd_benchmark_cache(group_type);
CREATE INDEX IF NOT EXISTS idx_hrd_reports_respondent ON hrd_consulting_reports(respondent_id);

-- =============================================
-- 뷰: 실태조사 응답 현황 요약
-- =============================================

CREATE OR REPLACE VIEW v_hrd_response_summary AS
SELECT
  r.id AS round_id,
  r.round_number,
  r.title,
  r.status AS round_status,
  r.target_count,
  COUNT(DISTINCT resp.id) AS total_respondents,
  COUNT(DISTINCT resp.id) FILTER (WHERE resp.status = 'completed') AS completed_count,
  COUNT(DISTINCT resp.id) FILTER (WHERE resp.status = 'in_progress') AS in_progress_count,
  COUNT(DISTINCT resp.id) FILTER (WHERE resp.status = 'invited') AS invited_count,
  ROUND(
    COUNT(DISTINCT resp.id) FILTER (WHERE resp.status = 'completed')::numeric /
    NULLIF(r.target_count, 0) * 100, 1
  ) AS completion_rate,
  -- 조직 구분별
  COUNT(DISTINCT resp.id) FILTER (WHERE resp.org_type_code = 1) AS large_enterprise_count,
  COUNT(DISTINCT resp.id) FILTER (WHERE resp.org_type_code = 2) AS medium_enterprise_count,
  COUNT(DISTINCT resp.id) FILTER (WHERE resp.org_type_code = 3) AS small_enterprise_count,
  COUNT(DISTINCT resp.id) FILTER (WHERE resp.org_type_code = 4) AS public_institution_count,
  COUNT(DISTINCT resp.id) FILTER (WHERE resp.org_type_code = 5) AS school_count
FROM hrd_survey_rounds r
LEFT JOIN hrd_respondents resp ON resp.round_id = r.id
GROUP BY r.id, r.round_number, r.title, r.status, r.target_count;
