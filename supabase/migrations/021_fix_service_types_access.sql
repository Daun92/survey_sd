-- ============================================
-- 021: service_types 테이블 접근 권한 + 시드 데이터
-- Prisma migration으로 생성된 테이블이라 PostgREST 권한 누락
-- Supabase SQL Editor에서 수동 실행 완료 (2026-03-30)
-- ============================================

GRANT ALL ON public.service_types TO anon, authenticated, service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

INSERT INTO public.service_types (id, name, name_en, is_active, created_at) VALUES (1, '집체', 'in_person', true, NOW()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.service_types (id, name, name_en, is_active, created_at) VALUES (2, '원격교육', 'remote', true, NOW()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.service_types (id, name, name_en, is_active, created_at) VALUES (3, 'HRM', 'hrm', true, NOW()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.service_types (id, name, name_en, is_active, created_at) VALUES (4, '스마트훈련', 'smart_training', true, NOW()) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.service_types (id, name, name_en, is_active, created_at) VALUES (5, 'HR컨설팅', 'hr_consulting', true, NOW()) ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('service_types', 'id'), COALESCE(MAX(id), 1)) FROM service_types;

NOTIFY pgrst, 'reload schema';
