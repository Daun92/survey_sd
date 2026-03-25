-- =============================================
-- 006: CS 만족도 설문 시드 데이터
-- 6개 부문 전체 문항 + 매핑 + 주의사항
-- 기준일: 2026.03.12 (research.exc.co.kr)
-- =============================================

-- ============================================
-- STEP 1: 부문 템플릿 등록
-- ============================================

INSERT INTO cs_survey_templates (division, division_label, name, description) VALUES
  ('classroom',      '집체',        'CS 만족도 조사 (집체)',        '집체교육 고객사 담당자 대상 CS 만족도. 1P(기본+담당자) + 2P(강사) + eco(에코시스템) 구조.'),
  ('remote',         '원격',        'CS 만족도 조사 (원격)',        '원격교육 고객사 담당자 대상. 1P(기본+과정평가) + 2P(담당자) 구조.'),
  ('content_dev',    '콘텐츠개발',  'CS 만족도 조사 (콘텐츠개발)',  '콘텐츠개발 고객사 대상. 1P(기본+담당자) + 2P(주관식) 구조.'),
  ('smart',          '스마트훈련',  'CS 만족도 조사 (스마트훈련)',  '스마트훈련 고객사 대상. 1P(기본+담당자) + 2P(과정/시스템+강사) + eco 구조.'),
  ('hrm',            'HRM채용대행', 'CS 만족도 조사 (HRM채용대행)', 'HRM채용대행 고객사 대상. 1P 단일페이지. ⚠ 문항-컬럼 번호 불일치 주의.'),
  ('hr_consulting',  'HR컨설팅',   'CS 만족도 조사 (HR컨설팅)',   'HR컨설팅 고객사 대상. 1P 단일페이지. ⚠ 주관식 컬럼명(q100~q102) 특수 체계.')
ON CONFLICT (division) DO UPDATE SET
  division_label = EXCLUDED.division_label,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = now();


-- ============================================
-- STEP 2: 집체 (classroom) 문항
-- ============================================
INSERT INTO cs_survey_questions (template_id, page_type, question_no, result_column, question_text, question_type, response_options, section_label, mapping_status, sort_order, notes)
SELECT t.id, v.page_type, v.question_no, v.result_column, v.question_text, v.question_type, v.response_options, v.section_label, v.mapping_status, v.sort_order, v.notes
FROM cs_survey_templates t,
(VALUES
  ('1P','Q1','q1','담당자님께서 엑스퍼트컨설팅과 함께 교육을 진행하신 기간은?','single_choice','처음/1년미만/1년이상/3년이상/5년이상',NULL,'matched',1,NULL),
  ('1P','Q2','q2','엑스퍼트컨설팅의 교육을 선정하신 계기는 무엇입니까?','single_choice','브랜드가치/교육의 품질/담당직원 만족도/거래이력/기타',NULL,'matched',2,NULL),
  ('1P','Q3','q3','엑스퍼트컨설팅의 교육 만족도는 어떠하십니까?','likert_5','매우만족~매우불만',NULL,'matched',3,'전반적 만족도'),
  ('1P','Q4','q4','교육 내용이 교육의 목적에 맞게 진행되었습니까?','likert_5','매우그렇다~전혀그렇지않다',NULL,'matched',4,'목적 부합도'),
  ('1P','Q5','q5','추후 교육 서비스를 다시 이용하실 의향이 있으십니까?','likert_5','매우그렇다~전혀그렇지않다',NULL,'matched',5,'재구매 의향도'),
  ('1P','Q6','q6','교육 서비스를 타인에게 추천할 의향이 있으십니까?','likert_5','매우그렇다~전혀그렇지않다',NULL,'matched',6,'추천 의향도'),
  ('1P','Q7-1','q7_1','[담당자] 고객사에 대한 사전정보파악을 잘 파악하여 준비하였습니까?','likert_5','매우만족~매우불만','담당자','matched',7,NULL),
  ('1P','Q7-2','q7_2','[담당자] 고객님의 요구사항을 납기를 지켜 처리하였습니까?','likert_5','매우만족~매우불만','담당자','matched',8,NULL),
  ('1P','Q7-3','q7_3','[담당자] 요구사항이 연계된 다른 부서에 잘 전달되었습니까?','likert_5','매우만족~매우불만','담당자','matched',9,NULL),
  ('1P','Q7-4','q7_4','[담당자] 교육 목적/니즈에 부합된 맞춤 교육준비가 진행되었습니까?','likert_5','매우만족~매우불만','담당자','matched',10,NULL),
  ('1P','Q7-5','q7_5','[담당자] 교육운영 관련 준비물이 누락 없이 준비되었습니까?','likert_5','매우만족~매우불만','담당자','matched',11,NULL),
  ('1P','Q7-6','q7_6','[담당자] 제안 솔루션에 적합한 강사가 섭외되었습니까?','likert_5','매우만족~매우불만','담당자','matched',12,NULL),
  ('1P','Q7-7','q7_7','[담당자] 직원이 각 역할에 맞는 업무 전문성을 지니고 있습니까?','likert_5','매우만족~매우불만','담당자','matched',13,NULL),
  ('1P','Q7-8','q7_8','[담당자] 교육과정 확정 후 지속적 관심을 가지고 노력하였습니까?','likert_5','매우만족~매우불만','담당자','matched',14,NULL),
  ('2P','Q8-1','q8_1','[강사] 제안 내용에 맞게 강의가 잘 이루어졌습니까?','likert_5','매우만족~매우불만','강사','matched',15,NULL),
  ('2P','Q8-2','q8_2','[강사] 강사가 고객사에 대한 충분한 이해를 가지고 진행하였습니까?','likert_5','매우만족~매우불만','강사','matched',16,NULL),
  ('2P','Q8-3','q8_3','[강사] 교육 목적/니즈에 부합된 맞춤 강의가 진행되었습니까?','likert_5','매우만족~매우불만','강사','matched',17,NULL),
  ('2P','Q8-4','q8_4','[강사] 강사의 강의 지식은 어떠했습니까?','likert_5','매우만족~매우불만','강사','matched',18,NULL),
  ('2P','Q8-5','q8_5','[강사] 강사의 강의 스킬은 어떠했습니까?','likert_5','매우만족~매우불만','강사','matched',19,NULL),
  ('2P','Q8-6','q8_6','[강사] 강의 슬라이드는 이해하기 쉽게 구성되어 있었습니까?','likert_5','매우만족~매우불만','강사','matched',20,NULL),
  ('2P','Q8-7','q8_7','[강사] 동영상/액티비티가 학습 목표에 잘 부합하였습니까?','likert_5','매우만족~매우불만','강사','matched',21,NULL),
  ('2P','Q8-8','q8_8','[강사] 강사가 교재내용을 누락없이 강의에 전달하였습니까?','likert_5','매우만족~매우불만','강사','matched',22,NULL),
  ('2P','Q9','q9','추가적인 의견이 있으시다면 적어주시기 바랍니다.','text','자유서술',NULL,'matched',23,NULL),
  ('eco','에코Q1','에코1번','이번 교육과정에 에코시스템을 사용하셨습니까? 얼마나 만족하십니까?','likert_6','매우만족~매우불만족/사용하지않음','에코시스템','matched',24,NULL),
  ('eco','에코Q1-1','에코1-1번','사용하지 않았다면 그 이유는 무엇입니까?','single_choice','설명부족/사외망불가/단기과정/기존방식편리/기타','에코시스템','matched',25,NULL),
  ('eco','에코기타','에코1-1기타','(에코Q1-1 기타 입력)','text','100자 이내','에코시스템','matched',26,NULL),
  ('eco','에코개선','에코개선사항','에코시스템 개선 의견','text','자유서술','에코시스템','matched',27,NULL)
) AS v(page_type, question_no, result_column, question_text, question_type, response_options, section_label, mapping_status, sort_order, notes)
WHERE t.division = 'classroom';


-- ============================================
-- STEP 3: 원격 (remote) 문항
-- ============================================
INSERT INTO cs_survey_questions (template_id, page_type, question_no, result_column, question_text, question_type, response_options, section_label, mapping_status, sort_order, notes)
SELECT t.id, v.page_type, v.question_no, v.result_column, v.question_text, v.question_type, v.response_options, v.section_label, v.mapping_status, v.sort_order, v.notes
FROM cs_survey_templates t,
(VALUES
  ('1P','Q1','q1','담당자님께서 엑스퍼트컨설팅과 함께 교육을 진행하신 기간은?','single_choice','처음/1년미만/1년이상/3년이상/5년이상',NULL,'matched',1,NULL),
  ('1P','Q2','q2','본 교육에서 가장 만족스러웠던 부분은 무엇입니까?','single_choice','교육내용/담당자 지원/학습시스템/학습독려·관리/기타/없음',NULL,'matched',2,NULL),
  ('1P','(Q2기타)','q2_Etc','(Q2 기타 입력)','text','자유서술',NULL,'matched',3,NULL),
  ('1P','Q3','q3','본 교육에서 가장 불만족스러웠던 부분은 무엇입니까?','single_choice','교육내용/담당자 지원/학습시스템/학습독려·관리/기타/없음',NULL,'matched',4,NULL),
  ('1P','Q4','q4','엑스퍼트컨설팅의 교육을 선정하신 계기는 무엇입니까?','single_choice','브랜드가치/교육의 품질/담당직원 만족도/거래이력/기타',NULL,'matched',5,NULL),
  ('1P','Q5','q5','엑스퍼트컨설팅의 교육 만족도는 어떠하십니까?','likert_5','매우만족~매우불만',NULL,'matched',6,'전반적 만족도'),
  ('1P','Q6','q6','추후 교육 서비스를 다시 이용하실 의향이 있으십니까?','likert_5','매우그렇다~전혀그렇지않다',NULL,'matched',7,'재구매 의향도'),
  ('1P','Q7','q7','교육 서비스를 타인에게 추천할 의향이 있으십니까?','likert_5','매우그렇다~전혀그렇지않다',NULL,'matched',8,'추천 의향도'),
  ('1P','Q8','q8','제공 과정이 귀사 직원의 자기계발/업무수행에 도움이 되었습니까?','likert_5','매우도움~도움매우적다',NULL,'matched',9,NULL),
  ('1P','Q9','q9','E-mail, SMS, 전화 등 학습독려 서비스가 학습완료에 도움이 되었습니까?','likert_5','매우도움~도움매우적다',NULL,'matched',10,NULL),
  ('1P','Q10','q10','시험/과제 등의 평가가 과정 내용을 이해하는데 도움이 되셨습니까?','likert_5','매우도움~도움매우적다',NULL,'matched',11,NULL),
  ('1P','Q11','q11','학습시스템 및 모바일 서비스는 학습하는데 편리하게 구성되어 있습니까?','likert_5','매우그렇다~매우그렇지않다',NULL,'matched',12,NULL),
  ('2P','Q12-1','q12_1','[담당자] 고객사에 대한 사전정보파악을 잘 파악하여 준비하였습니까?','likert_5','매우만족~매우불만','담당자','matched',13,NULL),
  ('2P','Q12-2','q12_2','[담당자] 요구사항에 대해 납기를 지켜 처리하였습니까?','likert_5','매우만족~매우불만','담당자','matched',14,NULL),
  ('2P','Q12-3','q12_3','[담당자] 수주담당자의 상담 내용과 자료가 도움이 되었습니까?','likert_5','매우만족~매우불만','담당자','matched',15,NULL),
  ('2P','Q12-4','q12_4','[담당자] 요구사항이 연계된 다른 부서에 잘 전달되었습니까?','likert_5','매우만족~매우불만','담당자','matched',16,NULL),
  ('2P','Q12-5','q12_5','[담당자] 직원이 각 역할에 맞는 업무 전문성을 지니고 있습니까?','likert_5','매우만족~매우불만','담당자','matched',17,NULL),
  ('2P','Q12-6','q12_6','[담당자] 교육과정 확정 후 지속적 관심을 가지고 노력하였습니까?','likert_5','매우만족~매우불만','담당자','matched',18,NULL),
  ('2P','Q13','q13','추가적인 의견 및 추후에 필요한 교육과정이 있으시면 말씀해주세요.','text','자유서술',NULL,'matched',19,NULL)
) AS v(page_type, question_no, result_column, question_text, question_type, response_options, section_label, mapping_status, sort_order, notes)
WHERE t.division = 'remote';


-- ============================================
-- STEP 4: 콘텐츠개발 (content_dev) 문항
-- ============================================
INSERT INTO cs_survey_questions (template_id, page_type, question_no, result_column, question_text, question_type, response_options, section_label, mapping_status, sort_order, notes)
SELECT t.id, v.page_type, v.question_no, v.result_column, v.question_text, v.question_type, v.response_options, v.section_label, v.mapping_status, v.sort_order, v.notes
FROM cs_survey_templates t,
(VALUES
  ('1P','Q1','q1','담당자님께서 엑스퍼트컨설팅과 함께 교육을 진행하신 기간은?','single_choice','처음/1년미만/1년이상/3년이상/5년이상',NULL,'matched',1,NULL),
  ('1P','Q2','q2','엑스퍼트컨설팅의 교육을 선정하신 계기는 무엇입니까?','single_choice','브랜드가치/교육의 품질/담당직원 만족도/거래이력/기타',NULL,'matched',2,NULL),
  ('1P','Q3','q3','과정개발 품질에 대한 전반적인 만족도는 어떠하십니까?','likert_5','매우만족~매우불만',NULL,'matched',3,'전반적 만족도'),
  ('1P','Q4','q4','과정개발은 교육의 목적에 맞게 진행되었습니까?','likert_5','매우그렇다~전혀그렇지않다',NULL,'matched',4,NULL),
  ('1P','Q5','q5','추후 과정개발 니즈가 있다면 다시 의뢰할 의향이 있으십니까?','likert_5','매우그렇다~전혀그렇지않다',NULL,'matched',5,'재구매 의향도'),
  ('1P','Q6','q6','개발 서비스를 타인에게 추천할 의향이 있으십니까?','likert_5','매우그렇다~전혀그렇지않다',NULL,'matched',6,'추천 의향도'),
  ('1P','Q7-1','q7_1','[담당자] 귀사에 대한 사전정보를 잘 파악하여 준비하였습니까?','likert_5','매우만족~매우불만','담당자','matched',7,NULL),
  ('1P','Q7-2','q7_2','[담당자] 요구사항에 대해 납기를 지켜 처리하였습니까?','likert_5','매우만족~매우불만','담당자','matched',8,NULL),
  ('1P','Q7-3','q7_3','[담당자] 수행컨설턴트의 상담 내용과 자료가 도움이 되었습니까?','likert_5','매우만족~매우불만','담당자','matched',9,NULL),
  ('1P','Q7-4','q7_4','[담당자] 수행컨설턴트는 고객 니즈를 개발물에 정확히 반영하였습니까?','likert_5','매우만족~매우불만','담당자','matched',10,NULL),
  ('1P','Q7-5','q7_5','[담당자] 수행컨설턴트가 개발에 대하여 전문성을 지니고 있습니까?','likert_5','매우만족~매우불만','담당자','matched',11,NULL),
  ('1P','Q7-6','q7_6','[담당자] 직원들이 각 역할에 맞는 업무 전문성을 지니고 있습니까?','likert_5','매우만족~매우불만','담당자','matched',12,NULL),
  ('1P','Q7-7','q7_7','[담당자] 개발 확정 후 지속적 관심을 가지고 개발에 임하였습니까?','likert_5','매우만족~매우불만','담당자','matched',13,NULL),
  ('2P','Q8','q8','엑스퍼트컨설팅과 개발과정을 진행하신 전반적인 소감은 어떠하십니까?','text','자유서술',NULL,'matched',14,NULL),
  ('2P','Q9','q9','엑스퍼트컨설팅의 장점과 개선되어야 할 점은 무엇입니까?','text','자유서술',NULL,'matched',15,NULL),
  ('2P','Q10','q10','더 나은 개발물을 위해 추가 요청사항이 있으시다면?','text','자유서술',NULL,'matched',16,NULL),
  ('2P','(Q11)','q11','(설문 내용 외 추가 의견)','text','자유서술',NULL,'unknown',17,'2P에서 "설문 내용 외 추가 의견" 란에 해당 추정. IT실 확인 필요.')
) AS v(page_type, question_no, result_column, question_text, question_type, response_options, section_label, mapping_status, sort_order, notes)
WHERE t.division = 'content_dev';


-- ============================================
-- STEP 5: 스마트훈련 (smart) 문항
-- ============================================
INSERT INTO cs_survey_questions (template_id, page_type, question_no, result_column, question_text, question_type, response_options, section_label, mapping_status, sort_order, notes)
SELECT t.id, v.page_type, v.question_no, v.result_column, v.question_text, v.question_type, v.response_options, v.section_label, v.mapping_status, v.sort_order, v.notes
FROM cs_survey_templates t,
(VALUES
  ('1P','Q1','q1','담당자님께서 엑스퍼트컨설팅과 함께 교육을 진행하신 기간은?','single_choice','처음/1년미만/1년이상/3년이상/5년이상',NULL,'matched',1,NULL),
  ('1P','Q2','q2','본 스마트훈련에 대한 정보는 어떠한 경로를 통해 받으셨습니까?','single_choice','수주직원 제안/홍보자료/주변의 권유/기타',NULL,'matched',2,NULL),
  ('1P','Q3','q3','엑스퍼트컨설팅의 교육을 선정하신 계기는 무엇입니까?','single_choice','브랜드가치/교육의 품질/담당직원 만족도/거래이력/기타',NULL,'matched',3,NULL),
  ('1P','Q4','q4','본 스마트훈련에서 가장 만족도가 높았던 영역은 무엇입니까?','single_choice','이러닝/집체교육/사후관리/시스템/기타',NULL,'matched',4,NULL),
  ('1P','Q5','q5','엑스퍼트컨설팅의 교육 만족도는 어떠하십니까?','likert_5','매우만족~매우불만',NULL,'matched',5,'전반적 만족도'),
  ('1P','Q6','q6','교육 내용이 교육의 목적에 맞게 진행되었습니까?','likert_5','매우그렇다~전혀그렇지않다',NULL,'matched',6,NULL),
  ('1P','Q7','q7','추후 교육 서비스를 다시 이용하실 의향이 있으십니까?','likert_5','매우그렇다~전혀그렇지않다',NULL,'matched',7,'재구매 의향도'),
  ('1P','Q8','q8','교육 서비스를 타인에게 추천할 의향이 있으십니까?','likert_5','매우그렇다~전혀그렇지않다',NULL,'matched',8,'추천 의향도'),
  ('1P','Q9-1','q9_1','[담당자] 고객사에 대한 사전정보를 잘 파악하여 준비하였습니까?','likert_5','매우만족~매우불만','담당자','matched',9,NULL),
  ('1P','Q9-2','q9_2','[담당자] 요구사항에 대해 납기를 지켜 처리하였습니까?','likert_5','매우만족~매우불만','담당자','matched',10,NULL),
  ('1P','Q9-3','q9_3','[담당자] 요구사항이 연계 부서에 잘 전달되었습니까?','likert_5','매우만족~매우불만','담당자','matched',11,NULL),
  ('1P','Q9-4','q9_4','[담당자] 교육 목적/니즈에 맞는 맞춤 교육준비가 진행되었습니까?','likert_5','매우만족~매우불만','담당자','matched',12,NULL),
  ('1P','Q9-5','q9_5','[담당자] 교육 운영 준비물(교보재)이 누락 없이 준비되었습니까?','likert_5','매우만족~매우불만','담당자','matched',13,NULL),
  ('1P','Q9-6','q9_6','[담당자] 제안 솔루션에 적합한 강사가 섭외되었습니까?','likert_5','매우만족~매우불만','담당자','matched',14,NULL),
  ('1P','Q9-7','q9_7','[담당자] 직원이 각 역할에 맞는 업무 전문성을 지니고 있습니까?','likert_5','매우만족~매우불만','담당자','matched',15,NULL),
  ('1P','Q9-8','q9_8','[담당자] 교육과정 확정 후 지속적 관심과 노력을 하였습니까?','likert_5','매우만족~매우불만','담당자','matched',16,NULL),
  ('2P','Q10-1','q10_1','[과정/시스템] 제공 과정이 자기계발/업무수행에 도움이 되었습니까?','likert_5','매우만족~매우불만','과정/시스템','matched',17,NULL),
  ('2P','Q10-2','q10_2','[과정/시스템] 온라인 사전학습이 집체교육과 잘 연계되었습니까?','likert_5','매우만족~매우불만','과정/시스템','matched',18,NULL),
  ('2P','Q10-3','q10_3','[과정/시스템] 플립러닝이 "원격교육"만보다 교육효과성 측면에서 도움?','likert_5','매우만족~매우불만','과정/시스템','matched',19,NULL),
  ('2P','Q10-4','q10_4','[과정/시스템] 플립러닝이 "집체교육"만보다 교육효과성 측면에서 도움?','likert_5','매우만족~매우불만','과정/시스템','matched',20,NULL),
  ('2P','Q10-5','q10_5','[과정/시스템] 학습독려 서비스가 학습완료에 도움이 되었습니까?','likert_5','매우만족~매우불만','과정/시스템','matched',21,NULL),
  ('2P','Q10-6','q10_6','[과정/시스템] 시험/과제 등 평가가 과정이해에 도움이 되셨습니까?','likert_5','매우만족~매우불만','과정/시스템','matched',22,NULL),
  ('2P','Q10-7','q10_7','[과정/시스템] 학습시스템은 학습하는데 편리하게 구성되어 있습니까?','likert_5','매우만족~매우불만','과정/시스템','matched',23,NULL),
  ('2P','Q11-1','q11_1','[강사] 제안 내용에 맞게 강의가 잘 이루어졌습니까?','likert_5','매우만족~매우불만','강사','matched',24,NULL),
  ('2P','Q11-2','q11_2','[강사] 강사가 고객사에 대한 충분한 이해를 가지고 진행하였습니까?','likert_5','매우만족~매우불만','강사','matched',25,NULL),
  ('2P','Q11-3','q11_3','[강사] 교육 목적/니즈에 부합된 맞춤 강의가 진행되었습니까?','likert_5','매우만족~매우불만','강사','matched',26,NULL),
  ('2P','Q11-4','q11_4','[강사] 강사의 강의 지식은 어떠했습니까?','likert_5','매우만족~매우불만','강사','matched',27,NULL),
  ('2P','Q11-5','q11_5','[강사] 강사의 강의 스킬은 어떠했습니까?','likert_5','매우만족~매우불만','강사','matched',28,NULL),
  ('2P','Q11-6','q11_6','[강사] 강의 슬라이드는 이해하기 쉽게 구성되어 있었습니까?','likert_5','매우만족~매우불만','강사','matched',29,NULL),
  ('2P','Q11-7','q11_7','[강사] 동영상/액티비티가 학습목표에 잘 부합하였습니까?','likert_5','매우만족~매우불만','강사','matched',30,NULL),
  ('2P','Q11-8','q11_8','[강사] 강사가 교재내용을 누락 없이 강의에 전달하였습니까?','likert_5','매우만족~매우불만','강사','matched',31,NULL),
  ('eco','에코Q1','에코1번','이번 교육과정에 에코시스템을 사용하셨습니까? 얼마나 만족하십니까?','likert_6','매우만족~매우불만족/사용하지않음','에코시스템','matched',32,NULL),
  ('eco','에코Q1-1','에코1-1번','사용하지 않았다면 그 이유는 무엇입니까?','single_choice','설명부족/사외망불가/단기과정/기존방식편리/기타','에코시스템','matched',33,NULL),
  ('eco','에코기타','에코1-1기타','(에코Q1-1 기타 입력)','text','100자 이내','에코시스템','matched',34,NULL),
  ('eco','에코개선','에코개선사항','에코시스템 개선 의견','text','자유서술','에코시스템','matched',35,NULL)
) AS v(page_type, question_no, result_column, question_text, question_type, response_options, section_label, mapping_status, sort_order, notes)
WHERE t.division = 'smart';


-- ============================================
-- STEP 6: HRM채용대행 (hrm) 문항
-- ============================================
INSERT INTO cs_survey_questions (template_id, page_type, question_no, result_column, question_text, question_type, response_options, section_label, mapping_status, sort_order, notes)
SELECT t.id, v.page_type, v.question_no, v.result_column, v.question_text, v.question_type, v.response_options, v.section_label, v.mapping_status, v.sort_order, v.notes
FROM cs_survey_templates t,
(VALUES
  ('1P','Q1','q1','담당자님께서 엑스퍼트컨설팅과 함께한 기간은 얼마나 되십니까?','single_choice','처음/1년미만/1년이상/3년이상/5년이상',NULL,'matched',1,NULL),
  ('1P','Q2','q3','채용 관련 프로젝트에 대한 전반적인 만족도는 어떠하십니까?','likert_5','매우만족~매우불만',NULL,'mismatched',2,'⚠ 설문Q2 → 결과q3 번호 불일치'),
  ('1P','Q3','q5','추후 채용 프로젝트 니즈가 있다면 다시 의뢰할 의향이 있으십니까?','likert_5','매우그렇다~전혀그렇지않다',NULL,'mismatched',3,'⚠ 설문Q3 → 결과q5 번호 불일치'),
  ('1P','Q4','q6','채용관련 서비스를 타인에게 추천할 의향이 있으십니까?','likert_5','매우그렇다~전혀그렇지않다',NULL,'mismatched',4,'⚠ 설문Q4 → 결과q6 번호 불일치'),
  ('1P','Q5-1','q7_1','[서비스] 채용시스템은 채용목적에 맞게 설계되었습니까?','likert_5_na','매우만족~매우불만/해당없음','서비스','mismatched',5,'설문Q5.1 → 결과q7_1'),
  ('1P','Q5-2','q7_2','[서비스] 서류전형의 운영은 원활하게 운영되었습니까?','likert_5_na','매우만족~매우불만/해당없음','서비스','mismatched',6,NULL),
  ('1P','Q5-3','q7_3','[서비스] 필기전형의 운영은 원활하게 운영되었습니까?','likert_5_na','매우만족~매우불만/해당없음','서비스','mismatched',7,NULL),
  ('1P','Q5-4','q7_4','[서비스] 면접전형의 운영은 원활하게 운영되었습니까?','likert_5_na','매우만족~매우불만/해당없음','서비스','mismatched',8,NULL),
  ('1P','Q5-5','q7_5','[서비스] 서류전형 평가설계/평가도구는 목적에 맞게 개발되었습니까?','likert_5_na','매우만족~매우불만/해당없음','서비스','mismatched',9,NULL),
  ('1P','Q5-6','q7_6','[서비스] 필기전형 난이도와 변별력은 적절하였습니까?','likert_5_na','매우만족~매우불만/해당없음','서비스','mismatched',10,NULL),
  ('1P','Q5-7','q7_7','[서비스] 면접전형 평가설계/평가도구는 목적에 맞게 개발되었습니까?','likert_5_na','매우만족~매우불만/해당없음','서비스','mismatched',11,NULL),
  ('1P','Q5-8','q7_8','[서비스] 프로젝트 확정 후 지속적 관심을 갖고 수행에 임하였습니까?','likert_5_na','매우만족~매우불만/해당없음','서비스','mismatched',12,NULL),
  ('1P','Q6','q8','프로젝트를 진행하신 전반적인 소감은 어떠하십니까?','text','자유서술',NULL,'mismatched',13,'설문Q6 → 결과q8'),
  ('1P','Q7','q9','가장 만족했던 부분이나 장점은 무엇입니까?','text','자유서술',NULL,'mismatched',14,'설문Q7 → 결과q9'),
  ('1P','Q8','q10','개선해야 할 점이나 추가 요청사항은?','text','자유서술',NULL,'mismatched',15,'설문Q8 → 결과q10'),
  ('1P','(없음)','q11','(결과페이지에만 존재하는 컬럼)','text','-',NULL,'unknown',16,'⚠ IT실 확인 필요. 현재 설문에 대응 문항 없음.')
) AS v(page_type, question_no, result_column, question_text, question_type, response_options, section_label, mapping_status, sort_order, notes)
WHERE t.division = 'hrm';


-- ============================================
-- STEP 7: HR컨설팅 (hr_consulting) 문항
-- ============================================
INSERT INTO cs_survey_questions (template_id, page_type, question_no, result_column, question_text, question_type, response_options, section_label, mapping_status, sort_order, notes)
SELECT t.id, v.page_type, v.question_no, v.result_column, v.question_text, v.question_type, v.response_options, v.section_label, v.mapping_status, v.sort_order, v.notes
FROM cs_survey_templates t,
(VALUES
  ('1P','Q1','q1','프로젝트에 대한 전반적인 만족도는 어떠십니까?','likert_5','매우만족~매우불만',NULL,'matched',1,'전반적 만족도'),
  ('1P','Q2','q2','전체적인 일정이 추진 계획에 따라 원활하게 진행되었습니까?','likert_5','매우그렇다~전혀그렇지않다',NULL,'matched',2,NULL),
  ('1P','Q3','q3','프로젝트 진행 시 컨설턴트와 커뮤니케이션은 원활하였습니까?','likert_5','매우그렇다~전혀그렇지않다',NULL,'matched',3,NULL),
  ('1P','Q4','q4','컨설턴트가 해당 분야의 전문성을 보유하고 있습니까?','likert_5','매우그렇다~전혀그렇지않다',NULL,'matched',4,NULL),
  ('1P','Q5','q5','컨설턴트가 지속적인 관심을 갖고 프로젝트를 수행하였습니까?','likert_5','매우그렇다~전혀그렇지않다',NULL,'matched',5,NULL),
  ('1P','Q6','q6','기업의 니즈를 잘 반영하여 컨설팅이 진행되었습니까?','likert_5','매우그렇다~전혀그렇지않다',NULL,'matched',6,NULL),
  ('1P','Q7','q7','컨설팅 산출물의 완성도는 적절하였습니까?','likert_5','매우그렇다~전혀그렇지않다',NULL,'matched',7,NULL),
  ('1P','Q8','q8','컨설팅 결과가 실행 가능한 실효성 있는 결과라고 생각하십니까?','likert_5','매우그렇다~전혀그렇지않다',NULL,'matched',8,NULL),
  ('1P','Q9','q9','추후 HR 프로젝트가 있다면 다시 의뢰할 의향이 있으십니까?','likert_5','매우그렇다~전혀그렇지않다',NULL,'matched',9,'재구매 의향도'),
  ('1P','Q10','q10','HR서비스를 타인에게 추천할 의향이 있으십니까?','likert_5','매우그렇다~전혀그렇지않다',NULL,'matched',10,'추천 의향도'),
  ('1P','Q11','q100','프로젝트를 진행하신 전반적인 소감은 어떠십니까?','text','자유서술',NULL,'mismatched',11,'⚠ 설문Q11 → 결과q100 컬럼명 불일치'),
  ('1P','Q12','q101','가장 만족했던 부분이나 장점은 무엇입니까?','text','자유서술',NULL,'mismatched',12,'⚠ 설문Q12 → 결과q101 컬럼명 불일치'),
  ('1P','Q13','q102','개선해야 할 점이나 추가 요청사항은?','text','자유서술',NULL,'mismatched',13,'⚠ 설문Q13 → 결과q102 컬럼명 불일치'),
  ('1P','(없음)','q103','(설문 외 추가 의견 — 결과페이지에만 존재)','text','자유서술',NULL,'unknown',14,'⚠ IT실 확인 필요'),
  ('1P','이름','uName','이름 (기프티콘 수령용)','text','-','응답자정보','matched',15,'타 부문과 컬럼 구조 다름'),
  ('1P','휴대폰','hp','휴대폰번호 (기프티콘 수령용)','text','-','응답자정보','matched',16,NULL),
  ('1P','기업명','company','기업명','text','-','응답자정보','matched',17,NULL)
) AS v(page_type, question_no, result_column, question_text, question_type, response_options, section_label, mapping_status, sort_order, notes)
WHERE t.division = 'hr_consulting';


-- ============================================
-- STEP 8: 주의사항 데이터
-- ============================================

-- 원격
INSERT INTO cs_survey_warnings (template_id, warning_type, description, affected_questions, affected_columns, action_required, severity)
SELECT t.id, 'data_order',
  '인수인계 문서에 "원격/컨설팅은 질문과 대조하여 입력(데이터 순서 다름)" 명시. 결과페이지에서 데이터 추출 시 문항과 1:1 대조 필수.',
  '전체', '전체', '4.매핑표 참조하여 반드시 문항별 대조', 'warning'
FROM cs_survey_templates t WHERE t.division = 'remote';

-- HRM채용대행 - 번호 불일치
INSERT INTO cs_survey_warnings (template_id, warning_type, description, affected_questions, affected_columns, action_required, severity)
SELECT t.id, 'numbering_mismatch',
  '설문 문항 번호와 결과 컬럼 번호가 일치하지 않음. 설문 Q2→결과q3, Q3→결과q5, Q4→결과q6, Q5→결과q7 등. JS에서 q2, q4가 비활성(skip).',
  'Q2~Q8', 'q3, q5, q6, q7_1~q7_8, q8~q10', '4.매핑표 참조 필수', 'critical'
FROM cs_survey_templates t WHERE t.division = 'hrm';

-- HRM채용대행 - 미확인 컬럼
INSERT INTO cs_survey_warnings (template_id, warning_type, description, affected_questions, affected_columns, action_required, severity)
SELECT t.id, 'unknown_column',
  '결과페이지에 q11 컬럼이 존재하나 현재 설문에 대응하는 문항 없음.',
  '없음', 'q11', 'IT실 확인 필요', 'warning'
FROM cs_survey_templates t WHERE t.division = 'hrm';

-- HR컨설팅 - 컬럼명 불일치
INSERT INTO cs_survey_warnings (template_id, warning_type, description, affected_questions, affected_columns, action_required, severity)
SELECT t.id, 'column_naming',
  '주관식 Q11~Q13이 결과에서 q100, q101, q102로 저장됨. 일반적 번호 체계(q11~q13)가 아닌 별도 체계 사용.',
  'Q11~Q13', 'q100~q102', '데이터 추출 시 컬럼명 매핑 주의', 'critical'
FROM cs_survey_templates t WHERE t.division = 'hr_consulting';

-- HR컨설팅 - 미확인 컬럼
INSERT INTO cs_survey_warnings (template_id, warning_type, description, affected_questions, affected_columns, action_required, severity)
SELECT t.id, 'unknown_column',
  '결과에 q103 컬럼 존재 — "설문 외 추가 의견" 란으로 추정.',
  '없음', 'q103', '확인 후 활용 판단', 'warning'
FROM cs_survey_templates t WHERE t.division = 'hr_consulting';

-- HR컨설팅 - 응답자 컬럼 구조
INSERT INTO cs_survey_warnings (template_id, warning_type, description, affected_questions, affected_columns, action_required, severity)
SELECT t.id, 'respondent_structure',
  '다른 부문은 "소속/이름" 구조이나, HR컨설팅은 uName/hp/company. 기프티콘 발송 시 이 컬럼에서 직접 연락처 추출 가능.',
  '이름/폰/기업', 'uName/hp/company', '데이터 통합 시 컬럼 매핑 필요', 'info'
FROM cs_survey_templates t WHERE t.division = 'hr_consulting';

-- 콘텐츠개발 - 미확인 컬럼
INSERT INTO cs_survey_warnings (template_id, warning_type, description, affected_questions, affected_columns, action_required, severity)
SELECT t.id, 'unknown_column',
  '결과에 q11 존재 — 2페이지의 "설문 외 추가 의견" 란으로 추정되나 확실하지 않음.',
  '(Q11)', 'q11', '확인 후 활용 판단', 'info'
FROM cs_survey_templates t WHERE t.division = 'content_dev';
