-- ============================================
-- S2 교육과정 만족도 기본 템플릿 (집체교육)
-- 국세청 PDF 기반 범용화
-- ============================================

INSERT INTO edu_survey_templates (survey_type, education_type, name, description, question_config)
VALUES (
  's2_edu_post',
  'classroom',
  '교육과정 만족도 조사 (집체교육)',
  '집체교육 종료 후 수강생 대상 만족도 조사 기본 템플릿. 교육내용, 모듈만족도, 강사만족도, 교육운영, 교육성과, 과정전반, 서술형 7개 섹션.',
  '[
    {
      "section": "교육 내용",
      "questions": [
        {"code": "Q1-1", "text": "교육의 내용은 실시목적에 부합되게 구성되었다.", "type": "likert_5", "required": true},
        {"code": "Q1-2", "text": "교육의 내용은 우리 조직의 상황에 맞게 구성되었다.", "type": "likert_5", "required": true},
        {"code": "Q1-3", "text": "교육의 내용은 학습자가 이해하기 쉽도록 구성되었다.", "type": "likert_5", "required": true},
        {"code": "Q1-4", "text": "학습목표가 명확히 제시되고, 체계적으로 내용이 전달되었다.", "type": "likert_5", "required": true}
      ]
    },
    {
      "section": "모듈 만족도",
      "dynamic": true,
      "description": "과정 내 모듈(세션)에 따라 문항이 자동 생성됩니다.",
      "questions": [
        {"code": "Q2-{n}", "text": "[{module_name}] 모듈의 교육 내용 및 진행에 만족한다.", "type": "likert_5", "required": true}
      ]
    },
    {
      "section": "강사 만족도",
      "dynamic": true,
      "description": "배정 강사에 따라 문항이 자동 생성됩니다.",
      "questions": [
        {"code": "Q3-{n}", "text": "{instructor_name} 강사는 해당분야 전문지식과 효과적인 강의스킬로 강의를 진행하였다.", "type": "likert_5", "required": true}
      ]
    },
    {
      "section": "교육 운영",
      "questions": [
        {"code": "Q4-1", "text": "강의장 환경은 학습에 몰입할 수 있도록 잘 갖춰져 있었다.", "type": "likert_5", "required": true},
        {"code": "Q4-2", "text": "교육 진행자는 교육이 매끄럽게 진행될 수 있게 지원하였다.", "type": "likert_5", "required": true}
      ]
    },
    {
      "section": "교육 성과",
      "questions": [
        {"code": "Q5-1", "text": "나는 교육에 적극적으로 참여하였다.", "type": "likert_5", "required": true},
        {"code": "Q5-2", "text": "나는 제시된 학습목표를 달성하였다.", "type": "likert_5", "required": true},
        {"code": "Q5-3", "text": "교육을 통해 현업에서 활용할 수 있는 유용한 정보와 스킬을 습득하였다.", "type": "likert_5", "required": true}
      ]
    },
    {
      "section": "과정 전반",
      "questions": [
        {"code": "Q7", "text": "이번 교육에 전반적으로 만족한다.", "type": "likert_5", "required": true}
      ]
    },
    {
      "section": "서술형",
      "questions": [
        {"code": "OPEN-1", "text": "이번 교육에서 가장 좋았던 점은 무엇입니까?", "type": "text", "required": false},
        {"code": "OPEN-2", "text": "개선이 필요한 점이나 건의사항을 자유롭게 작성해 주세요.", "type": "text", "required": false},
        {"code": "OPEN-3", "text": "기타 의견이 있으시면 자유롭게 작성해 주세요.", "type": "text", "required": false}
      ]
    }
  ]'::JSONB
)
ON CONFLICT (survey_type, education_type) DO UPDATE
SET question_config = EXCLUDED.question_config,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = NOW();

-- 원격교육 템플릿
INSERT INTO edu_survey_templates (survey_type, education_type, name, description, question_config)
VALUES (
  's2_edu_post',
  'remote',
  '교육과정 만족도 조사 (원격교육)',
  '원격교육 종료 후 수강생 대상 만족도 조사 템플릿. 교육운영 섹션이 온라인 학습 환경 문항으로 대체.',
  '[
    {
      "section": "교육 내용",
      "questions": [
        {"code": "Q1-1", "text": "교육의 내용은 실시목적에 부합되게 구성되었다.", "type": "likert_5", "required": true},
        {"code": "Q1-2", "text": "교육의 내용은 우리 조직의 상황에 맞게 구성되었다.", "type": "likert_5", "required": true},
        {"code": "Q1-3", "text": "교육의 내용은 학습자가 이해하기 쉽도록 구성되었다.", "type": "likert_5", "required": true},
        {"code": "Q1-4", "text": "학습목표가 명확히 제시되고, 체계적으로 내용이 전달되었다.", "type": "likert_5", "required": true}
      ]
    },
    {
      "section": "모듈 만족도",
      "dynamic": true,
      "questions": [
        {"code": "Q2-{n}", "text": "[{module_name}] 모듈의 교육 내용 및 진행에 만족한다.", "type": "likert_5", "required": true}
      ]
    },
    {
      "section": "강사 만족도",
      "dynamic": true,
      "questions": [
        {"code": "Q3-{n}", "text": "{instructor_name} 강사는 해당분야 전문지식과 효과적인 강의스킬로 강의를 진행하였다.", "type": "likert_5", "required": true}
      ]
    },
    {
      "section": "온라인 학습 환경",
      "questions": [
        {"code": "Q4-1", "text": "온라인 학습 플랫폼은 접속 및 이용이 원활하였다.", "type": "likert_5", "required": true},
        {"code": "Q4-2", "text": "온라인 학습 환경에서 강사와의 상호작용이 충분하였다.", "type": "likert_5", "required": true},
        {"code": "Q4-3", "text": "교육 진행자의 기술적 지원이 적절하였다.", "type": "likert_5", "required": true}
      ]
    },
    {
      "section": "교육 성과",
      "questions": [
        {"code": "Q5-1", "text": "나는 교육에 적극적으로 참여하였다.", "type": "likert_5", "required": true},
        {"code": "Q5-2", "text": "나는 제시된 학습목표를 달성하였다.", "type": "likert_5", "required": true},
        {"code": "Q5-3", "text": "교육을 통해 현업에서 활용할 수 있는 유용한 정보와 스킬을 습득하였다.", "type": "likert_5", "required": true}
      ]
    },
    {
      "section": "과정 전반",
      "questions": [
        {"code": "Q7", "text": "이번 교육에 전반적으로 만족한다.", "type": "likert_5", "required": true}
      ]
    },
    {
      "section": "서술형",
      "questions": [
        {"code": "OPEN-1", "text": "이번 교육에서 가장 좋았던 점은 무엇입니까?", "type": "text", "required": false},
        {"code": "OPEN-2", "text": "개선이 필요한 점이나 건의사항을 자유롭게 작성해 주세요.", "type": "text", "required": false}
      ]
    }
  ]'::JSONB
)
ON CONFLICT (survey_type, education_type) DO UPDATE
SET question_config = EXCLUDED.question_config,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = NOW();
