"""API Key 인증 dependency"""

import os
from fastapi import Header, HTTPException, status


def verify_api_key(x_api_key: str | None = Header(default=None, alias='X-API-Key')):
    """X-API-Key 헤더 ↔ env BRIS_API_KEY 비교"""
    expected = os.environ.get('BRIS_API_KEY')
    if not expected:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            'BRIS_API_KEY env not configured on server',
        )
    if not x_api_key or x_api_key != expected:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            'Invalid or missing X-API-Key header',
        )
