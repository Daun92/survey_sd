-- =============================================
-- 012: 템플릿 RLS 정책 추가 (INSERT/UPDATE/DELETE 허용)
-- =============================================

CREATE POLICY "Allow all operations on cs_survey_templates"
  ON cs_survey_templates FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on cs_survey_questions"
  ON cs_survey_questions FOR ALL USING (true) WITH CHECK (true);
