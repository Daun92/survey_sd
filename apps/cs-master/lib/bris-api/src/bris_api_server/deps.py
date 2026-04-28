"""의존성 팩토리 — BrisClient, BrisSyncPipeline lazy 생성"""

import os
import sys
from functools import lru_cache

# bris_api / bris_to_supabase 모듈은 프로젝트 루트에 위치
# lib/bris-api/src/bris_api_server/deps.py → ../../../../
_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', '..', '..', '..')
)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)


@lru_cache(maxsize=1)
def get_bris_client():
    """BrisClient 인스턴스 (cookie file → env login 순으로 시도)"""
    from bris_api import BrisClient
    cookie_file = os.environ.get('BRIS_COOKIE_FILE')
    if cookie_file and os.path.exists(cookie_file):
        return BrisClient.from_cookie_file(cookie_file)
    return BrisClient.from_env()


@lru_cache(maxsize=1)
def get_pipeline():
    """BrisSyncPipeline 인스턴스 (Supabase + BRIS)"""
    from bris_to_supabase import BrisSyncPipeline
    return BrisSyncPipeline(bris_client=get_bris_client())


def reset_caches():
    """테스트용: 캐시된 클라이언트/파이프라인 초기화"""
    get_bris_client.cache_clear()
    get_pipeline.cache_clear()
