-- respondent_cs_history: 컬럼 sent_month → responded_month 리네임.
-- 의미 명확화: "언제 발송됐는가" 가 아니라 "언제 응답(해당 월의 설문)을 했는가" 를 기록.

ALTER TABLE respondent_cs_history RENAME COLUMN sent_month TO responded_month;

ALTER INDEX uq_respondent_cs_history RENAME TO uq_respondent_cs_history_resp_course_month;
ALTER INDEX idx_respondent_cs_history_respondent RENAME TO idx_resp_cs_history_respondent_month;
ALTER INDEX idx_respondent_cs_history_customer RENAME TO idx_resp_cs_history_customer_month;
