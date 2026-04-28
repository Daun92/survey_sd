-- =============================================================================
-- Migration: 에코 제외 사유 기반 CS 대상자 자동 선정 강화
-- Date:      2026-04-15
-- Status:    DRAFT — 운영자 승인 + 기존 함수 본문 병합 후 실행
-- =============================================================================
--
-- Context (2026-04-15 파서 보강 + dry-run 검증 결과):
--  - BRIS 컴플레인참조 페이지(complain_reference_list.asp) 에서 추출되는
--    새 필드 2종이 파서 레벨에서 노출됨:
--        * place_id              (기존 컬럼 부재)
--        * echoExcludeReason     (cs_projects.echo_exclude_reason 컬럼은 이미 존재)
--  - cs_courses 레벨에서는 교육별 echo_status 만 저장되고 제외 사유는 유실됨.
--  - 2026-04-01~15 dry-run 으로 실제 사유 분포 확인:
--        18 고객사 외부망 차단 / 4 집체(2시간이내 특강) / 3 기타 /
--        2 집체(4시간이내 조직활성화(팀빌딩)) / 1 에코 제외(fallback)
--
-- 자동 처리 정책 (운영팀 합의, 2026-04-15):
--   [자동 배제]
--     - 짧은 집체 특강: '집체(2시간이내 특강)' (학습 효과 낮음, CS 가치 없음)
--     - 연락처 무: email AND mobile 모두 NULL (DM/SMS 발송 불가)
--   [정상 심사 흐름 (pending)]
--     - 그 외 모든 echo_exclude_reason (외부망 차단, 팀빌딩, 기타 등) — 사유는
--       echo_exclude_reason 컬럼에 보존되어 운영자 사후 참조용으로만 사용
--
-- 실행 전 체크리스트:
--   [ ] Supabase Studio → Database → Functions 에서 fn_cs_post_sync_auto_batch
--       현 본문을 추출하여 Section 3 의 템플릿과 병합
--   [ ] Staging 프로젝트에 먼저 적용하여 샘플 기간(2026-04-01~15) 으로 검증
--   [ ] fn_cs_post_sync_auto_batch 실행 전/후 cs_survey_targets 비교
-- =============================================================================


-- ------------------------------------------------------------------
-- Section 1: 스키마 변경 (ADD COLUMN IF NOT EXISTS)
-- ------------------------------------------------------------------

-- 1.1 cs_business_places — BRIS place_id (교차 검증 키로 활용)
ALTER TABLE IF EXISTS public.cs_business_places
    ADD COLUMN IF NOT EXISTS bris_place_id TEXT;

COMMENT ON COLUMN public.cs_business_places.bris_place_id IS
    'BRIS 사업장(플레이스) 고유 ID. complain_reference_list.asp 첫 td 의 place_id 값.';

CREATE INDEX IF NOT EXISTS idx_cs_business_places_bris_place_id
    ON public.cs_business_places (bris_place_id)
    WHERE bris_place_id IS NOT NULL;


-- 1.2 cs_courses — 에코 제외 사유 (과정별 제외 사유 보존)
ALTER TABLE IF EXISTS public.cs_courses
    ADD COLUMN IF NOT EXISTS echo_exclude_reason TEXT;

COMMENT ON COLUMN public.cs_courses.echo_exclude_reason IS
    'BRIS 컴플레인참조 페이지의 "에코 제외 사유" — '
    '"고객사 외부망 차단" | "집체(2시간이내 특강)" | "집체(4시간이내 조직활성화(팀빌딩))" | "기타" 등.';


-- ------------------------------------------------------------------
-- Section 2: 기존 데이터 백필 (선택)
-- ------------------------------------------------------------------
-- 기존 레코드에 대해 최근 sync 이후 새 필드가 비어 있을 수 있음.
-- 운영자가 필요시 별도 스크립트로 재-sync 하여 채우기를 권장 (여기서는 SKIP).


-- ------------------------------------------------------------------
-- Section 3: fn_cs_post_sync_auto_batch 강화 (DROP + CREATE OR REPLACE)
-- ------------------------------------------------------------------
-- ⚠ 이 섹션은 운영자가 현행 함수 본문을 Supabase Studio 에서 추출한 뒤
--    아래 규칙을 삽입하여 병합해야 실행 가능. 템플릿:
--
--    CREATE OR REPLACE FUNCTION public.fn_cs_post_sync_auto_batch(
--        p_sync_id uuid,
--        p_period_start date,
--        p_period_end   date
--    )
--    RETURNS TABLE(batch_id uuid, candidates int)
--    LANGUAGE plpgsql
--    AS $$
--    DECLARE
--        v_batch_id uuid;
--        v_candidates int;
--    BEGIN
--        -- (기존) 배치 생성 …
--        INSERT INTO cs_batches (sync_id, period_start, period_end)
--        VALUES (p_sync_id, p_period_start, p_period_end)
--        RETURNING id INTO v_batch_id;
--
--        -- (신규) 대상자 선정 — 운영팀 합의 (2026-04-15) 기반 최소 자동 처리
--        INSERT INTO cs_survey_targets (batch_id, course_id, contact_id, status, exclude_reason)
--        SELECT
--            v_batch_id,
--            c.id AS course_id,
--            ct.id AS contact_id,
--            CASE
--                /* ── 규칙 1: 짧은 집체 특강 (학습 효과 낮음 → CS 가치 없음) ── */
--                WHEN c.echo_exclude_reason ILIKE '%집체%특강%'
--                    THEN 'excluded'
--                /* ── 규칙 2: 연락처 무 (DM/SMS 발송 불가) ──────────────── */
--                WHEN (ct.email IS NULL OR ct.email = '')
--                 AND (ct.mobile IS NULL OR ct.mobile = '')
--                    THEN 'excluded'
--                /* ── 그 외: echo_exclude_reason 이 있더라도 정상 심사 ──── */
--                /*    (외부망 차단, 팀빌딩, 기타 등은 사유를 컬럼에 보존만   */
--                /*     하고 Step 2~4 자동 심사 흐름으로 진입)                */
--                ELSE 'pending'
--            END AS status,
--            CASE
--                WHEN c.echo_exclude_reason ILIKE '%집체%특강%'
--                    THEN '단기 특강 (자동)'
--                WHEN (ct.email IS NULL OR ct.email = '')
--                 AND (ct.mobile IS NULL OR ct.mobile = '')
--                    THEN '연락처 없음 (자동)'
--                ELSE NULL
--            END AS exclude_reason
--        FROM cs_courses c
--        JOIN cs_projects p  ON p.id = c.project_id
--        JOIN cs_contacts ct ON ct.id = c.contact_id
--        WHERE c.end_date >= p_period_start
--          AND c.end_date <= p_period_end
--          AND c.is_completed = TRUE;
--
--        -- (기존) Step 2~4 자동 심사 호출 (pending 레코드에 대해서만)
--        -- PERFORM fn_cs_run_auto_screening(v_batch_id);  -- 기존 로직 유지
--
--        SELECT COUNT(*) INTO v_candidates
--        FROM cs_survey_targets
--        WHERE batch_id = v_batch_id
--          AND status IN ('pending', 'manual_review');
--
--        RETURN QUERY SELECT v_batch_id, v_candidates;
--    END;
--    $$;
--
-- ------------------------------------------------------------------


-- ------------------------------------------------------------------
-- Section 4: 롤백 힌트 (비상시)
-- ------------------------------------------------------------------
-- -- ALTER TABLE public.cs_business_places DROP COLUMN IF EXISTS bris_place_id;
-- -- ALTER TABLE public.cs_courses DROP COLUMN IF EXISTS echo_exclude_reason;
-- -- (fn_cs_post_sync_auto_batch 는 이전 버전의 CREATE OR REPLACE 로 복구)


-- ------------------------------------------------------------------
-- END of migration draft
-- ------------------------------------------------------------------
