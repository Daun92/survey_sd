"""메타 엔드포인트 — 인증 불필요"""

from fastapi import APIRouter

from ..schemas import HealthResponse, ServiceInfo

router = APIRouter()

VERSION = '0.1.0'

PARSERS = [
    'integrated', 'integrated/camelcase',
    'edu-detail', 'echo-view', 'echo-data',
    'project-detail', 'project-biz', 'dm',
]


@router.get('/', response_model=ServiceInfo, tags=['meta'])
def root():
    """서비스 정보"""
    return ServiceInfo(
        name='BRIS Parser & Sync API',
        version=VERSION,
        parsers=PARSERS,
    )


@router.get('/v1/health', response_model=HealthResponse, tags=['meta'])
def health():
    """헬스체크"""
    return HealthResponse(status='ok', version=VERSION)
