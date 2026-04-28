"""Sync 엔드포인트 — POST /v1/sync, /v1/sync/from-html"""

from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import verify_api_key
from ..deps import get_pipeline
from ..schemas import SyncRequest, SyncFromHtmlRequest, SyncResult

router = APIRouter(tags=['sync'])


@router.post(
    '/sync',
    response_model=SyncResult,
    summary='BRIS 날짜 범위 → fetch + Supabase upsert',
)
def sync_by_date(
    req: SyncRequest,
    _=Depends(verify_api_key),
    pipeline=Depends(get_pipeline),
):
    """
    BRIS에서 해당 기간 데이터를 가져와 Supabase에 동기화.

    환경변수 필요: BRIS_USER_ID/BRIS_PASSWORD 또는 BRIS_COOKIE_FILE,
                  SUPABASE_URL, SUPABASE_SERVICE_KEY
    """
    try:
        result = pipeline.sync(req.startDate, req.endDate, auto_batch=req.autoBatch)
        return SyncResult(**result)
    except Exception as e:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f'Sync failed: {type(e).__name__}: {e}',
        )


@router.post(
    '/sync/from-html',
    response_model=SyncResult,
    summary='로컬 HTML → 파싱 + Supabase upsert',
)
def sync_from_html(
    req: SyncFromHtmlRequest,
    _=Depends(verify_api_key),
    pipeline=Depends(get_pipeline),
):
    """BRIS fetch 없이 클라이언트가 제공한 HTML 로 동기화"""
    try:
        result = pipeline.sync_from_html(
            req.html,
            period_start=req.periodStart,
            period_end=req.periodEnd,
            auto_batch=req.autoBatch,
        )
        return SyncResult(**result)
    except Exception as e:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f'Sync from HTML failed: {type(e).__name__}: {e}',
        )
