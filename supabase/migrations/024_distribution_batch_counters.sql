-- edu_submissions에 distribution_id 컬럼 추가
ALTER TABLE edu_submissions
  ADD COLUMN IF NOT EXISTS distribution_id UUID REFERENCES distributions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_edu_submissions_distribution
  ON edu_submissions(distribution_id);

-- distribution_batches 카운터 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_batch_counters()
RETURNS TRIGGER AS $$
DECLARE
  v_batch_id UUID;
BEGIN
  -- batch_id 결정
  IF TG_OP = 'DELETE' THEN
    v_batch_id := OLD.batch_id;
  ELSE
    v_batch_id := NEW.batch_id;
  END IF;

  IF v_batch_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- 실제 distributions 상태를 집계하여 배치 카운터 갱신
  UPDATE distribution_batches SET
    sent_count = (
      SELECT COUNT(*) FROM distributions
      WHERE batch_id = v_batch_id AND status IN ('sent', 'opened', 'started', 'completed')
    ),
    opened_count = (
      SELECT COUNT(*) FROM distributions
      WHERE batch_id = v_batch_id AND status IN ('opened', 'started', 'completed')
    ),
    completed_count = (
      SELECT COUNT(*) FROM distributions
      WHERE batch_id = v_batch_id AND status = 'completed'
    )
  WHERE id = v_batch_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- distributions 상태 변경 시 트리거
DROP TRIGGER IF EXISTS trg_update_batch_counters ON distributions;
CREATE TRIGGER trg_update_batch_counters
  AFTER INSERT OR UPDATE OF status OR DELETE
  ON distributions
  FOR EACH ROW
  EXECUTE FUNCTION update_batch_counters();

-- 기존 데이터 보정: 현재 distributions 상태를 기반으로 카운터 재계산
UPDATE distribution_batches SET
  sent_count = sub.sent_count,
  opened_count = sub.opened_count,
  completed_count = sub.completed_count
FROM (
  SELECT
    batch_id,
    COUNT(*) FILTER (WHERE status IN ('sent', 'opened', 'started', 'completed')) AS sent_count,
    COUNT(*) FILTER (WHERE status IN ('opened', 'started', 'completed')) AS opened_count,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_count
  FROM distributions
  GROUP BY batch_id
) sub
WHERE distribution_batches.id = sub.batch_id;
