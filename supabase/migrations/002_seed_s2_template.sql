-- Seed migration: S2 교육과정 만족도 (Education Satisfaction) survey template
-- Based on Korean National Tax Service (국세청) education survey structure

INSERT INTO survey_templates (survey_type, education_type, name, question_config, created_at)
VALUES (
  's2_edu_post',
  'classroom',
  '교육과정 만족도 조사 (집체교육)',
  '[
    {
      "section": "교육 내용",
      "question_code": "Q1-1",
      "question_text": "교육의 내용은 실시목적에 부합되게 구성되었다.",
      "question_type": "likert_5",
      "is_required": true,
      "options": [
        {"value": 1, "label": "매우 불만족"},
        {"value": 2, "label": "불만족"},
        {"value": 3, "label": "보통"},
        {"value": 4, "label": "만족"},
        {"value": 5, "label": "매우 만족"}
      ]
    },
    {
      "section": "교육 내용",
      "question_code": "Q1-2",
      "question_text": "교육의 내용은 우리 조직의 상황에 맞게 구성되었다.",
      "question_type": "likert_5",
      "is_required": true,
      "options": [
        {"value": 1, "label": "매우 불만족"},
        {"value": 2, "label": "불만족"},
        {"value": 3, "label": "보통"},
        {"value": 4, "label": "만족"},
        {"value": 5, "label": "매우 만족"}
      ]
    },
    {
      "section": "교육 내용",
      "question_code": "Q1-3",
      "question_text": "교육의 내용은 학습자가 이해하기 쉽도록 구성되었다.",
      "question_type": "likert_5",
      "is_required": true,
      "options": [
        {"value": 1, "label": "매우 불만족"},
        {"value": 2, "label": "불만족"},
        {"value": 3, "label": "보통"},
        {"value": 4, "label": "만족"},
        {"value": 5, "label": "매우 만족"}
      ]
    },
    {
      "section": "교육 내용",
      "question_code": "Q1-4",
      "question_text": "학습목표가 명확히 제시되고, 체계적으로 내용이 전달되었다.",
      "question_type": "likert_5",
      "is_required": true,
      "options": [
        {"value": 1, "label": "매우 불만족"},
        {"value": 2, "label": "불만족"},
        {"value": 3, "label": "보통"},
        {"value": 4, "label": "만족"},
        {"value": 5, "label": "매우 만족"}
      ]
    },
    {
      "section": "모듈 만족도",
      "question_code": "Q2-1",
      "question_text": "[모듈1] 교육 모듈에 만족한다.",
      "question_type": "likert_5",
      "is_required": true,
      "options": [
        {"value": 1, "label": "매우 불만족"},
        {"value": 2, "label": "불만족"},
        {"value": 3, "label": "보통"},
        {"value": 4, "label": "만족"},
        {"value": 5, "label": "매우 만족"}
      ]
    },
    {
      "section": "모듈 만족도",
      "question_code": "Q2-2",
      "question_text": "[모듈2] 교육 모듈에 만족한다.",
      "question_type": "likert_5",
      "is_required": true,
      "options": [
        {"value": 1, "label": "매우 불만족"},
        {"value": 2, "label": "불만족"},
        {"value": 3, "label": "보통"},
        {"value": 4, "label": "만족"},
        {"value": 5, "label": "매우 만족"}
      ]
    },
    {
      "section": "모듈 만족도",
      "question_code": "Q2-3",
      "question_text": "[모듈3] 교육 모듈에 만족한다.",
      "question_type": "likert_5",
      "is_required": true,
      "options": [
        {"value": 1, "label": "매우 불만족"},
        {"value": 2, "label": "불만족"},
        {"value": 3, "label": "보통"},
        {"value": 4, "label": "만족"},
        {"value": 5, "label": "매우 만족"}
      ]
    },
    {
      "section": "모듈 만족도",
      "question_code": "Q2-4",
      "question_text": "[모듈4] 교육 모듈에 만족한다.",
      "question_type": "likert_5",
      "is_required": true,
      "options": [
        {"value": 1, "label": "매우 불만족"},
        {"value": 2, "label": "불만족"},
        {"value": 3, "label": "보통"},
        {"value": 4, "label": "만족"},
        {"value": 5, "label": "매우 만족"}
      ]
    },
    {
      "section": "모듈 만족도",
      "question_code": "Q2-5",
      "question_text": "[모듈5] 교육 모듈에 만족한다.",
      "question_type": "likert_5",
      "is_required": true,
      "options": [
        {"value": 1, "label": "매우 불만족"},
        {"value": 2, "label": "불만족"},
        {"value": 3, "label": "보통"},
        {"value": 4, "label": "만족"},
        {"value": 5, "label": "매우 만족"}
      ]
    },
    {
      "section": "강사 만족도",
      "question_code": "Q3-1",
      "question_text": "[강사1]은(는) 해당분야 전문지식과 효과적인 강의스킬로 강의를 진행하였다.",
      "question_type": "likert_5",
      "is_required": true,
      "options": [
        {"value": 1, "label": "매우 불만족"},
        {"value": 2, "label": "불만족"},
        {"value": 3, "label": "보통"},
        {"value": 4, "label": "만족"},
        {"value": 5, "label": "매우 만족"}
      ]
    },
    {
      "section": "강사 만족도",
      "question_code": "Q3-2",
      "question_text": "[강사2]은(는) 해당분야 전문지식과 효과적인 강의스킬로 강의를 진행하였다.",
      "question_type": "likert_5",
      "is_required": true,
      "options": [
        {"value": 1, "label": "매우 불만족"},
        {"value": 2, "label": "불만족"},
        {"value": 3, "label": "보통"},
        {"value": 4, "label": "만족"},
        {"value": 5, "label": "매우 만족"}
      ]
    },
    {
      "section": "강사 만족도",
      "question_code": "Q3-3",
      "question_text": "[강사3]은(는) 해당분야 전문지식과 효과적인 강의스킬로 강의를 진행하였다.",
      "question_type": "likert_5",
      "is_required": true,
      "options": [
        {"value": 1, "label": "매우 불만족"},
        {"value": 2, "label": "불만족"},
        {"value": 3, "label": "보통"},
        {"value": 4, "label": "만족"},
        {"value": 5, "label": "매우 만족"}
      ]
    },
    {
      "section": "교육 운영",
      "question_code": "Q4-1",
      "question_text": "강의장 환경은 학습에 몰입할 수 있도록 잘 갖춰져 있었다.",
      "question_type": "likert_5",
      "is_required": true,
      "options": [
        {"value": 1, "label": "매우 불만족"},
        {"value": 2, "label": "불만족"},
        {"value": 3, "label": "보통"},
        {"value": 4, "label": "만족"},
        {"value": 5, "label": "매우 만족"}
      ]
    },
    {
      "section": "교육 운영",
      "question_code": "Q4-2",
      "question_text": "교육 진행자는 교육이 매끄럽게 진행될 수 있게 지원하였다.",
      "question_type": "likert_5",
      "is_required": true,
      "options": [
        {"value": 1, "label": "매우 불만족"},
        {"value": 2, "label": "불만족"},
        {"value": 3, "label": "보통"},
        {"value": 4, "label": "만족"},
        {"value": 5, "label": "매우 만족"}
      ]
    },
    {
      "section": "교육 성과",
      "question_code": "Q5-1",
      "question_text": "나는 교육에 적극적으로 참여하였다.",
      "question_type": "likert_5",
      "is_required": true,
      "options": [
        {"value": 1, "label": "매우 불만족"},
        {"value": 2, "label": "불만족"},
        {"value": 3, "label": "보통"},
        {"value": 4, "label": "만족"},
        {"value": 5, "label": "매우 만족"}
      ]
    },
    {
      "section": "교육 성과",
      "question_code": "Q5-2",
      "question_text": "나는 제시된 학습목표를 달성하였다.",
      "question_type": "likert_5",
      "is_required": true,
      "options": [
        {"value": 1, "label": "매우 불만족"},
        {"value": 2, "label": "불만족"},
        {"value": 3, "label": "보통"},
        {"value": 4, "label": "만족"},
        {"value": 5, "label": "매우 만족"}
      ]
    },
    {
      "section": "교육 성과",
      "question_code": "Q5-3",
      "question_text": "교육을 통해 현업에서 활용할 수 있는 유용한 정보와 스킬을 습득하였다.",
      "question_type": "likert_5",
      "is_required": true,
      "options": [
        {"value": 1, "label": "매우 불만족"},
        {"value": 2, "label": "불만족"},
        {"value": 3, "label": "보통"},
        {"value": 4, "label": "만족"},
        {"value": 5, "label": "매우 만족"}
      ]
    },
    {
      "section": "과정 전반",
      "question_code": "Q7",
      "question_text": "이번 교육에 전반적으로 만족한다.",
      "question_type": "likert_5",
      "is_required": true,
      "options": [
        {"value": 1, "label": "매우 불만족"},
        {"value": 2, "label": "불만족"},
        {"value": 3, "label": "보통"},
        {"value": 4, "label": "만족"},
        {"value": 5, "label": "매우 만족"}
      ]
    },
    {
      "section": "서술형",
      "question_code": "Q8-1",
      "question_text": "이번 교육에서 가장 좋았던 점은 무엇입니까?",
      "question_type": "text",
      "is_required": false
    },
    {
      "section": "서술형",
      "question_code": "Q8-2",
      "question_text": "이번 교육에서 아쉬웠던 점이나 개선할 점이 있다면 말씀해주세요.",
      "question_type": "text",
      "is_required": false
    },
    {
      "section": "서술형",
      "question_code": "Q8-3",
      "question_text": "기타 의견이 있으시면 자유롭게 작성해 주세요.",
      "question_type": "text",
      "is_required": false
    }
  ]'::jsonb,
  NOW()
);
