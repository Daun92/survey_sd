"""bris_api.BrisClient — 4페이지 fetcher (T2 트랙) 단위 테스트.

requests.Session 을 MagicMock 으로 주입해 HTTP 호출을 차단한다.
파서는 실제 함수를 호출 — 짧은 HTML 만 넘기면 빈 dict 반환하므로 OK.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from bris_api import BrisClient, BrisSessionExpired


def _fake_response(status: int, text: str) -> MagicMock:
    r = MagicMock()
    r.status_code = status
    r.text = text
    r.encoding = 'utf-8'
    return r


@pytest.fixture
def client():
    session = MagicMock()
    return BrisClient(session=session)


# ----------------------------------------------------------------------------
# _check_session_html — 만료 판별 false positive 방지
# ----------------------------------------------------------------------------

def test_check_session_long_html_never_raises(client):
    # 5KB 짜리 정상 페이지
    long_html = '<html>' + ('x' * 5000) + '</html>'
    # 만료 marker 가 있어도 길이가 길면 정상 페이지로 간주
    long_html_with_marker = long_html + 'login.asp'
    client._check_session_html(long_html_with_marker, 'project_view')  # no raise


def test_check_session_short_html_without_marker_passes(client):
    """짧은 응답이라도 login redirect marker 없으면 만료 아님."""
    client._check_session_html('<html><body>empty</body></html>', 'project_view')


def test_check_session_short_html_with_login_redirect_raises(client):
    short_redirect = '<html><head><meta http-equiv="refresh" content="0;url=/login.asp"></head></html>'
    with pytest.raises(BrisSessionExpired):
        client._check_session_html(short_redirect, 'project_view')


def test_check_session_short_html_with_top_location_raises(client):
    short_redirect = '<html><script>top.location="/login.asp"</script></html>'
    with pytest.raises(BrisSessionExpired):
        client._check_session_html(short_redirect, 'project_view')


# ----------------------------------------------------------------------------
# get_project_view_with_raw
# ----------------------------------------------------------------------------

def test_project_view_calls_correct_url_and_returns_tuple(client):
    sample_html = '<html>' + ('x' * 5000) + '</html>'
    client.session.get.return_value = _fake_response(200, sample_html)

    html, parsed = client.get_project_view_with_raw('PID-001')

    assert html == sample_html
    assert isinstance(parsed, dict)
    client.session.get.assert_called_once()
    args, kwargs = client.session.get.call_args
    assert args[0] == BrisClient.PROJECT_VIEW_URL
    assert kwargs['params'] == {'PROJECT_ID': 'PID-001'}


def test_project_view_http_error_raises(client):
    client.session.get.return_value = _fake_response(500, 'oops')
    with pytest.raises(Exception, match='HTTP 500'):
        client.get_project_view_with_raw('PID-001')


def test_project_view_session_expired(client):
    client.session.get.return_value = _fake_response(
        200, '<script>location.href="/login.asp"</script>'
    )
    with pytest.raises(BrisSessionExpired):
        client.get_project_view_with_raw('PID-001')


# ----------------------------------------------------------------------------
# get_project_biz_list_with_raw — success_code 필수 전달
# ----------------------------------------------------------------------------

def test_project_biz_list_passes_success_code(client):
    """successCode 미전달 시 BRIS 가 PROJECT_ID 필터를 무시하는 사고 — 둘 다 전송."""
    sample_html = '<html>' + ('x' * 5000) + '</html>'
    client.session.get.return_value = _fake_response(200, sample_html)

    client.get_project_biz_list_with_raw('PID-001', success_code='2604-100')

    _, kwargs = client.session.get.call_args
    assert kwargs['params'] == {'successCode': '2604-100', 'PROJECT_ID': 'PID-001'}


def test_project_biz_list_default_success_code_empty(client):
    sample_html = '<html>' + ('x' * 5000) + '</html>'
    client.session.get.return_value = _fake_response(200, sample_html)

    client.get_project_biz_list_with_raw('PID-001')

    _, kwargs = client.session.get.call_args
    assert kwargs['params'] == {'successCode': '', 'PROJECT_ID': 'PID-001'}


def test_project_biz_list_returns_tuple_with_dict(client):
    client.session.get.return_value = _fake_response(200, '<html>' + ('x' * 5000) + '</html>')
    html, parsed = client.get_project_biz_list_with_raw('PID-001', '2604-100')
    assert isinstance(parsed, dict)
    assert 'sessions' in parsed  # extract_project_biz_list 기본 키


# ----------------------------------------------------------------------------
# get_dm_view_with_raw
# ----------------------------------------------------------------------------

def test_dm_view_calls_with_customer_id(client):
    client.session.get.return_value = _fake_response(200, '<html>' + ('x' * 5000) + '</html>')
    client.get_dm_view_with_raw('CID-100')
    _, kwargs = client.session.get.call_args
    assert kwargs['params'] == {'CUSTOMER_ID': 'CID-100'}


def test_dm_view_http_error(client):
    client.session.get.return_value = _fake_response(404, 'not found')
    with pytest.raises(Exception, match='HTTP 404'):
        client.get_dm_view_with_raw('CID-100')


# ----------------------------------------------------------------------------
# get_echo_operate_with_raw
# ----------------------------------------------------------------------------

def test_echo_operate_lowercase_project_id_param(client):
    """echo 쪽 URL 은 project_id (소문자) 파라미터. 표기 보존 검증."""
    client.session.get.return_value = _fake_response(200, '<html>' + ('x' * 5000) + '</html>')
    client.get_echo_operate_with_raw('PID-001')
    _, kwargs = client.session.get.call_args
    assert kwargs['params'] == {'project_id': 'PID-001'}


def test_echo_operate_session_expired(client):
    client.session.get.return_value = _fake_response(
        200, '<html><body>top.location="/login.asp"</body></html>'
    )
    with pytest.raises(BrisSessionExpired):
        client.get_echo_operate_with_raw('PID-001')


# ----------------------------------------------------------------------------
# 공통 — 4 fetcher 모두 BrisSessionExpired 라벨에 페이지명 포함
# ----------------------------------------------------------------------------

@pytest.mark.parametrize('method,kwargs,label', [
    ('get_project_view_with_raw',     {'project_id': 'PID'}, 'project_view'),
    ('get_project_biz_list_with_raw', {'project_id': 'PID', 'success_code': 'X'}, 'project_biz_list'),
    ('get_dm_view_with_raw',          {'customer_id': 'CID'}, 'dm_view'),
    ('get_echo_operate_with_raw',     {'project_id': 'PID'}, 'echo_operate'),
])
def test_each_fetcher_labels_page_in_session_expired(client, method, kwargs, label):
    client.session.get.return_value = _fake_response(
        200, '<script>location.href="/login.asp"</script>'
    )
    with pytest.raises(BrisSessionExpired) as exc:
        getattr(client, method)(**kwargs)
    assert label in str(exc.value)
