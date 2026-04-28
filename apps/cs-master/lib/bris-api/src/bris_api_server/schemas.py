"""Pydantic 입출력 스키마"""

from typing import Optional
from pydantic import BaseModel, Field


# ==================== 입력 ====================

class HtmlInput(BaseModel):
    """파서 엔드포인트에서 application/json 으로 호출 시"""
    html: str = Field(..., description='파싱할 BRIS HTML 문자열')


class SyncRequest(BaseModel):
    """POST /v1/sync 요청"""
    startDate: str = Field(..., description='시작일 YYYY-MM-DD', examples=['2026-04-01'])
    endDate: str = Field(..., description='종료일 YYYY-MM-DD', examples=['2026-04-30'])
    autoBatch: bool = Field(default=True, description='동기화 후 자동 배치 생성')


class SyncFromHtmlRequest(BaseModel):
    """POST /v1/sync/from-html 요청"""
    html: str = Field(..., description='BRIS 통합 페이지 HTML')
    periodStart: Optional[str] = Field(default=None, description='기간 시작(로그용)')
    periodEnd: Optional[str] = Field(default=None, description='기간 종료(로그용)')
    autoBatch: bool = Field(default=False)


# ==================== 출력 ====================

class SyncResult(BaseModel):
    """Sync 응답 — bris_to_supabase.BrisSyncPipeline.sync() 결과 매핑"""
    sync_id: Optional[str] = None
    total_records: int = 0
    companies: int = 0
    places: int = 0
    contacts: int = 0
    projects: int = 0
    courses: int = 0
    members: int = 0
    batch_id: Optional[str] = None
    auto_candidates: int = 0
    errors: list[str] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str = 'ok'
    version: str


class ServiceInfo(BaseModel):
    name: str
    version: str
    parsers: list[str]
