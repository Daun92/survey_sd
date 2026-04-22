-- ============================================
-- respondent_cs_history: 외부/과거 발송이력 축적 테이블
-- ============================================
-- distributions 는 실제 시스템을 통해 뿌린 발송만 기록. 외부 도구나 과거 엑셀로
-- 이미 집행된 발송이력(6개월 발송이력 CSV 등)을 대상자별 타임라인으로 누적하기 위한 저장소.
--
-- respondents 마스터와 1:N 연결. 동일 대상자가 여러 달/여러 과정으로 수신한 경우
-- 각 (respondent_id, course_name, sent_month) 조합을 1건으로 저장.

CREATE TABLE IF NOT EXISTS respondent_cs_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  respondent_id UUID NOT NULL REFERENCES respondents(id) ON DELETE CASCADE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  course_name TEXT,
  -- 발송이 집행된 월. CSV 업로드 시 YYYY-MM-01 로 정규화.
  sent_month DATE NOT NULL,
  -- 데이터 출처 태그 ('csv_import', 'manual' 등). 향후 재업로드 구분용.
  source VARCHAR(32) NOT NULL DEFAULT 'csv_import',
  -- 업로드된 원본 고객사 이름 (정규화 매칭 실패 시에도 원문 보존)
  raw_company_name TEXT,
  -- 원본 직급 (정규화 전 값)
  raw_position TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 동일 인물 × 동일 과정 × 동일 월 중복 방지. course_name 이 null 이면 uniqueness 해제.
CREATE UNIQUE INDEX IF NOT EXISTS uq_respondent_cs_history
  ON respondent_cs_history (respondent_id, course_name, sent_month)
  WHERE course_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_respondent_cs_history_respondent
  ON respondent_cs_history (respondent_id, sent_month DESC);

CREATE INDEX IF NOT EXISTS idx_respondent_cs_history_customer
  ON respondent_cs_history (customer_id, sent_month DESC);

-- ============================================
-- RLS: 인증 사용자 전체 접근 (다른 respondents/distributions 테이블 정책과 동일)
-- ============================================
ALTER TABLE respondent_cs_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_manage_respondent_cs_history" ON respondent_cs_history
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
