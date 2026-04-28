"""
bris-parser — BRIS HTML 파서 (Python)

JS lib/bris-parser 와 동등한 파싱 로직 제공.

사용법:
    from bris_parser import (
        parse,                          # 통합 페이지 (한글 키)
        parse_as_camelcase,             # 통합 페이지 (camelCase)
        extract_edu_detail_data,
        extract_echoview_data,
        extract_echo_data,
        extract_project_detail_data,
        extract_project_biz_list,
        extract_dm_data,
    )
"""

from .integrated import BrisParser
from .mapping import FIELD_MAP, to_camelcase
from .edu_detail import extract_edu_detail_data
from .echo_view import extract_echoview_data
from .echo_data import extract_echo_data
from .project import extract_project_detail_data, extract_project_biz_list
from .dm import extract_dm_data
from .label_values import extract_label_values
from . import utils

__version__ = '0.2.0'


def parse(html: str) -> list:
    """통합 페이지 HTML → 한글 키 dict 리스트"""
    return BrisParser.parse(html)


def parse_as_camelcase(html: str) -> list:
    """통합 페이지 HTML → camelCase 키 dict 리스트 (JS 파서와 스키마 일치)"""
    return [to_camelcase(r) for r in BrisParser.parse(html)]


__all__ = [
    'BrisParser', 'FIELD_MAP', 'to_camelcase',
    'parse', 'parse_as_camelcase',
    'extract_edu_detail_data',
    'extract_echoview_data',
    'extract_echo_data',
    'extract_project_detail_data',
    'extract_project_biz_list',
    'extract_dm_data',
    'extract_label_values',
    'utils',
    '__version__',
]
