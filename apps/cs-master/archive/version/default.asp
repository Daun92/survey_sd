<%@ Language="VBScript" CodePage="65001" %>
<%
Response.Buffer = True

' =====================================================
' BRIS 프록시 처리 (bris_proxy 파라미터가 있으면 프록시 모드)
' =====================================================
If Request.QueryString("bris_proxy") <> "" Then
  Call HandleBrisProxy()
  Response.End
End If

' =====================================================
' 도메인 기반 리다이렉트
' Application 변수의 config 설정에 따라 해당 서비스로 리다이렉트
' =====================================================

Dim hostName, subDomain, sJSON
Dim redirectUrl

' 현재 호스트명 가져오기 (예: axlab.exc.co.kr)
hostName = LCase(Request.ServerVariables("HTTP_HOST"))

' 서브도메인 추출 (예: axlab.exc.co.kr -> axlab)
subDomain = ""
If InStr(hostName, ".exc.co.kr") > 0 Then
  subDomain = Replace(hostName, ".exc.co.kr", "")
  ' 포트 번호 제거
  If InStr(subDomain, ":") > 0 Then
    subDomain = Left(subDomain, InStr(subDomain, ":") - 1)
  End If
End If

' Application 변수에서 config 가져오기 (없으면 로드)
If Not Application("Config_Loaded") Then
  LoadApplicationConfig
End If

sJSON = Application("Config_JSON")

' 서브도메인에 맞는 서비스 찾기
If sJSON <> "" Then
  redirectUrl = FindServiceByDomain(sJSON, subDomain)
End If

If redirectUrl <> "" Then
  Response.Redirect redirectUrl
  Response.End
Else
  ' 매칭되는 서비스가 없으면 에러 페이지 표시
  ShowNotFoundPage
End If

' =====================================================
' Application 변수 로드 함수
' =====================================================
Sub LoadApplicationConfig()
  Dim fso, configPath, objStream, sConfigJSON

  configPath = Server.MapPath("/manager/config.json.expert")

  Set fso = Server.CreateObject("Scripting.FileSystemObject")

  If Not fso.FileExists(configPath) Then
    Set fso = Nothing
    Exit Sub
  End If

  ' ADODB.Stream으로 UTF-8 파일 읽기
  Set objStream = Server.CreateObject("ADODB.Stream")
  objStream.CharSet = "UTF-8"
  objStream.Open
  objStream.LoadFromFile configPath
  sConfigJSON = objStream.ReadText()
  objStream.Close
  Set objStream = Nothing
  Set fso = Nothing

  ' BOM 제거
  If Left(sConfigJSON, 1) = Chr(65279) Then
    sConfigJSON = Mid(sConfigJSON, 2)
  End If

  ' Application 변수에 저장
  Application.Lock
  Application("Config_JSON") = sConfigJSON
  Application("Config_MasterKey") = ExtractJSONValue(sConfigJSON, "masterKey")
  Application("Config_AllowedIPPrefix") = ExtractJSONValue(sConfigJSON, "allowedIPPrefix")
  Application("Config_Loaded") = True
  Application.Unlock
End Sub

' =====================================================
' 헬퍼 함수
' =====================================================

' 도메인으로 서비스 찾기
Function FindServiceByDomain(sJSON, sDomain)
  Dim nStart, nEnd, nObjStart, nObjEnd
  Dim sServicesBlock, sServiceObj
  Dim serviceDomain, folderName, startFile

  FindServiceByDomain = ""

  If sDomain = "" Then Exit Function

  ' "services" 배열 찾기
  nStart = InStr(1, sJSON, """services""", vbTextCompare)
  If nStart = 0 Then Exit Function

  nStart = InStr(nStart, sJSON, "[")
  If nStart = 0 Then Exit Function

  nEnd = InStr(nStart, sJSON, "]")
  If nEnd = 0 Then Exit Function

  sServicesBlock = Mid(sJSON, nStart, nEnd - nStart + 1)

  ' 각 서비스 객체 순회
  nObjStart = 1
  Do
    nObjStart = InStr(nObjStart, sServicesBlock, "{")
    If nObjStart = 0 Then Exit Do

    nObjEnd = InStr(nObjStart, sServicesBlock, "}")
    If nObjEnd = 0 Then Exit Do

    sServiceObj = Mid(sServicesBlock, nObjStart, nObjEnd - nObjStart + 1)

    ' domain 필드 추출
    serviceDomain = ExtractJSONValue(sServiceObj, "domain")

    ' 도메인이 일치하면 리다이렉트 URL 생성
    If LCase(serviceDomain) = LCase(sDomain) Then
      folderName = ExtractJSONValue(sServiceObj, "folderName")
      startFile = ExtractJSONValue(sServiceObj, "startFile")

      If folderName <> "" And startFile <> "" Then
        FindServiceByDomain = "/" & folderName & "/" & startFile
        Exit Function
      End If
    End If

    nObjStart = nObjEnd + 1
  Loop
End Function

' JSON에서 값 추출
Function ExtractJSONValue(sJSON, sKey)
  Dim nPos, nEnd, sSearch
  ExtractJSONValue = ""

  sSearch = """" & sKey & """"
  nPos = InStr(1, sJSON, sSearch, vbTextCompare)
  If nPos = 0 Then Exit Function

  nPos = InStr(nPos, sJSON, ":")
  If nPos = 0 Then Exit Function

  nPos = InStr(nPos, sJSON, """")
  If nPos = 0 Then Exit Function
  nPos = nPos + 1

  nEnd = InStr(nPos, sJSON, """")
  If nEnd = 0 Then Exit Function

  ExtractJSONValue = Mid(sJSON, nPos, nEnd - nPos)
End Function

' 404 페이지 표시
Sub ShowNotFoundPage()
    server.execute "noservice.html"
End Sub

' =====================================================
' BRIS 프록시 함수 (자동 로그인 포함)
' default.asp?bris_proxy=list_salesAct_person&teamcode=201300001
' → https://bris.exc.co.kr/my_page/list_salesAct_person.asp?teamcode=201300001
' =====================================================
Sub HandleBrisProxy()
  Dim sPath, sTargetUrl
  Dim objHTTP, nStatus, sContentType
  Dim BRIS_HOST, BRIS_COOKIES

  BRIS_HOST = "https://bris.exc.co.kr"

  ' Application 변수에서 쿠키 가져오기 (없으면 기본값)
  BRIS_COOKIES = Application("BRIS_Session_Cookie")
  If BRIS_COOKIES = "" Then
    BRIS_COOKIES = "ASPSESSIONIDQWBTSSTA=CGILONEAKEEJKIHGHDNBBKNJ"
  End If

  ' CORS 헤더
  Response.AddHeader "Access-Control-Allow-Origin", "*"
  Response.AddHeader "Access-Control-Allow-Methods", "GET, POST"

  ' path 파라미터
  sPath = Trim(Request.QueryString("bris_proxy"))
  If sPath = "" Or sPath = "1" Then
    Response.Status = "400 Bad Request"
    Response.Write "Error: bris_proxy parameter must be the page name"
    Exit Sub
  End If

  ' ── 진단 엔드포인트: ?bris_proxy=_diag ──
  If sPath = "_diag" Then
    Call HandleBrisDiag(BRIS_HOST, BRIS_COOKIES)
    Exit Sub
  End If

  ' ── 세션 강제 갱신: ?bris_proxy=_refresh ──
  If sPath = "_refresh" Then
    Call HandleBrisRefresh(BRIS_HOST)
    Exit Sub
  End If

  ' 보안: .. 방지
  If InStr(sPath, "..") > 0 Then
    Response.Status = "403 Forbidden"
    Response.Write "Error: Invalid path"
    Exit Sub
  End If

  ' 대상 URL 구성: /로 시작하면 전체 경로, 아니면 기존 /my_page/ 하위
  If Left(sPath, 1) = "/" Then
    sTargetUrl = BRIS_HOST & sPath
  Else
    sTargetUrl = BRIS_HOST & "/my_page/" & sPath & ".asp"
  End If

  Dim sKey, sQS
  sQS = ""
  For Each sKey In Request.QueryString
    If LCase(sKey) <> "bris_proxy" Then
      If sQS <> "" Then sQS = sQS & "&"
      sQS = sQS & sKey & "=" & Request.QueryString(sKey)
    End If
  Next
  If sQS <> "" Then sTargetUrl = sTargetUrl & "?" & sQS

  ' HTTP 객체 생성
  Set objHTTP = CreateBrisHTTP()
  If objHTTP Is Nothing Then
    Response.Status = "500 Internal Server Error"
    Response.Write "Error: Cannot create HTTP object"
    Exit Sub
  End If

  ' ── GET/POST 판별 ──
  Dim sMethod, sPostData
  sMethod = UCase(Request.ServerVariables("REQUEST_METHOD"))

  ' POST body 읽기 (BinaryRead → 그대로 전달)
  sPostData = ""
  If sMethod = "POST" And Request.TotalBytes > 0 Then
    Dim binData
    binData = Request.BinaryRead(Request.TotalBytes)
    ' 바이너리를 문자열로 변환
    Dim oStream
    Set oStream = Server.CreateObject("ADODB.Stream")
    oStream.Type = 1 ' adTypeBinary
    oStream.Open
    oStream.Write binData
    oStream.Position = 0
    oStream.Type = 2 ' adTypeText
    oStream.Charset = "ascii"
    sPostData = oStream.ReadText()
    oStream.Close
    Set oStream = Nothing
  End If

  ' ── 1차 요청 ──
  Dim bOK
  If sMethod = "POST" And sPostData <> "" Then
    bOK = SendBrisPostRequest(objHTTP, sTargetUrl, BRIS_COOKIES, sPostData)
  Else
    bOK = SendBrisRequest(objHTTP, sTargetUrl, BRIS_COOKIES)
  End If

  If Not bOK Then
    Response.Status = "502 Bad Gateway"
    Response.Write "BRIS Proxy Error: request failed"
    Set objHTTP = Nothing
    Exit Sub
  End If

  ' ── 세션 만료 감지 → 자동 로그인 → 재요청 ──
  Dim sRespText
  sRespText = objHTTP.ResponseText

  If InStr(sRespText, "window.top.location.href") > 0 Then
    ' 로그: 세션 만료 감지
    Application.Lock
    Application("BRIS_LastExpiry") = Now()
    Application.Unlock

    ' 동시 다중 로그인 시도 방지 (마지막 시도 후 10초 이내면 건너뜀)
    Dim lastAttempt, secSince
    lastAttempt = Application("BRIS_LastLoginAttempt")
    If IsDate(lastAttempt) Then
      secSince = DateDiff("s", CDate(lastAttempt), Now())
      If secSince < 10 Then
        ' 최근 10초 이내에 이미 시도함 → 건너뜀
        nStatus = objHTTP.Status
        sContentType = ""
        On Error Resume Next
        sContentType = objHTTP.GetResponseHeader("Content-Type")
        On Error GoTo 0
        If sContentType = "" Then sContentType = "text/html; charset=euc-kr"
        Response.ContentType = sContentType
        Response.BinaryWrite objHTTP.ResponseBody
        Set objHTTP = Nothing
        Exit Sub
      End If
    End If

    Application.Lock
    Application("BRIS_LastLoginAttempt") = Now()
    Application.Unlock

    Dim newCookie
    newCookie = BrisAutoLogin(BRIS_HOST)

    If newCookie <> "" Then
      ' 새 쿠키를 Application 변수에 저장 (모든 요청에서 재사용)
      Application.Lock
      Application("BRIS_Session_Cookie") = newCookie
      Application("BRIS_LastLogin") = Now()
      Application.Unlock

      ' 재요청
      Set objHTTP = Nothing
      Set objHTTP = CreateBrisHTTP()
      If Not objHTTP Is Nothing Then
        If sMethod = "POST" And sPostData <> "" Then
          bOK = SendBrisPostRequest(objHTTP, sTargetUrl, newCookie, sPostData)
        Else
          bOK = SendBrisRequest(objHTTP, sTargetUrl, newCookie)
        End If

        ' 재요청 후에도 여전히 세션 만료인지 확인
        If bOK Then
          sRespText = objHTTP.ResponseText
          If InStr(sRespText, "window.top.location.href") > 0 Then
            ' 자동 로그인 실패 — 쿠키 무효화
            Application.Lock
            Application("BRIS_Session_Cookie") = ""
            Application("BRIS_LoginError") = "Auto-login cookie invalid after retry at " & Now()
            Application.Unlock
          End If
        End If
      End If
    Else
      ' 자동 로그인 함수 자체가 실패
      Application.Lock
      Application("BRIS_LoginError") = "BrisAutoLogin returned empty at " & Now()
      Application.Unlock
    End If
  End If

  ' ── 응답 출력 ──
  nStatus = objHTTP.Status
  If nStatus >= 400 Then
    Response.Status = CStr(nStatus) & " Error"
    Response.Write "BRIS Proxy Error: HTTP " & nStatus & " for " & sTargetUrl
  Else
    sContentType = ""
    On Error Resume Next
    sContentType = objHTTP.GetResponseHeader("Content-Type")
    On Error GoTo 0
    If sContentType = "" Then sContentType = "text/html; charset=euc-kr"
    Response.ContentType = sContentType
    Response.BinaryWrite objHTTP.ResponseBody
  End If

  Set objHTTP = Nothing
End Sub

' =====================================================
' HTTP 객체 생성 헬퍼
' =====================================================
Function CreateBrisHTTP()
  Set CreateBrisHTTP = Nothing
  On Error Resume Next
  Set CreateBrisHTTP = Server.CreateObject("MSXML2.ServerXMLHTTP.6.0")
  If Err.Number <> 0 Then
    Err.Clear
    Set CreateBrisHTTP = Server.CreateObject("MSXML2.ServerXMLHTTP")
    If Err.Number <> 0 Then
      Err.Clear
      Set CreateBrisHTTP = Server.CreateObject("Microsoft.XMLHTTP")
    End If
  End If
  If Not CreateBrisHTTP Is Nothing Then
    CreateBrisHTTP.SetOption 2, 13056  ' SSL 인증서 검증 무시
  End If
  On Error GoTo 0
End Function

' =====================================================
' BRIS GET 요청 전송
' =====================================================
Function SendBrisRequest(objHTTP, sUrl, sCookie)
  SendBrisRequest = False
  On Error Resume Next
  objHTTP.Open "GET", sUrl, False
  objHTTP.SetRequestHeader "User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120"
  objHTTP.SetRequestHeader "Accept", "text/html,application/xhtml+xml,*/*"
  objHTTP.SetRequestHeader "Accept-Language", "ko-KR,ko;q=0.9"
  If sCookie <> "" Then
    objHTTP.SetRequestHeader "Cookie", sCookie
  End If
  objHTTP.SetTimeouts 10000, 10000, 15000, 15000
  objHTTP.Send
  If Err.Number = 0 Then SendBrisRequest = True
  On Error GoTo 0
End Function

' =====================================================
' BRIS POST 요청 전송
' =====================================================
Function SendBrisPostRequest(objHTTP, sUrl, sCookie, sPostBody)
  SendBrisPostRequest = False
  On Error Resume Next
  objHTTP.Open "POST", sUrl, False
  objHTTP.SetRequestHeader "User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120"
  objHTTP.SetRequestHeader "Accept", "text/html,application/xhtml+xml,*/*"
  objHTTP.SetRequestHeader "Accept-Language", "ko-KR,ko;q=0.9"
  objHTTP.SetRequestHeader "Content-Type", "application/x-www-form-urlencoded"
  objHTTP.SetRequestHeader "Content-Length", CStr(Len(sPostBody))
  If sCookie <> "" Then
    objHTTP.SetRequestHeader "Cookie", sCookie
  End If
  objHTTP.SetTimeouts 10000, 10000, 30000, 30000
  objHTTP.Send sPostBody
  If Err.Number = 0 Then SendBrisPostRequest = True
  On Error GoTo 0
End Function

' =====================================================
' BRIS 자동 로그인: 세션 쿠키 만료 시 자동으로 재인증
' 1) GET login.asp → 새 세션 쿠키 수신
' 2) POST login.asp (id/pw) → 세션 인증 완료
' 3) 인증된 쿠키 반환
' =====================================================
Function BrisAutoLogin(sBrisHost)
  Dim objLogin, sLoginUrl
  Dim sHeaders, sSessionCookie

  BrisAutoLogin = ""
  sLoginUrl = sBrisHost & "/login.asp"

  ' ── Step 1: GET login.asp → 세션 쿠키 획득 ──
  Set objLogin = CreateBrisHTTP()
  If objLogin Is Nothing Then
    LogAutoLogin "FAIL: Cannot create HTTP object for GET"
    Exit Function
  End If

  On Error Resume Next
  objLogin.Open "GET", sLoginUrl, False
  objLogin.SetRequestHeader "User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120"
  objLogin.SetRequestHeader "Accept", "text/html,application/xhtml+xml,*/*"
  objLogin.SetRequestHeader "Referer", sBrisHost & "/"
  objLogin.Send

  If Err.Number <> 0 Then
    LogAutoLogin "FAIL: GET login.asp error - " & Err.Description
    Set objLogin = Nothing
    Exit Function
  End If
  On Error GoTo 0

  ' HTTP 상태 확인
  If objLogin.Status <> 200 Then
    LogAutoLogin "FAIL: GET login.asp HTTP " & objLogin.Status
    Set objLogin = Nothing
    Exit Function
  End If

  ' 로그인 폼 HTML 분석 (필드명 확인용)
  Dim sLoginHTML
  sLoginHTML = ""
  On Error Resume Next
  sLoginHTML = objLogin.ResponseText
  On Error GoTo 0
  LogAutoLogin "Step1 GET login.asp (" & Len(sLoginHTML) & " bytes)"

  ' form action 추출
  Dim nFormPos, nFormEnd, sFormTag
  nFormPos = InStr(1, sLoginHTML, "<form", vbTextCompare)
  If nFormPos > 0 Then
    nFormEnd = InStr(nFormPos, sLoginHTML, ">")
    If nFormEnd > 0 Then
      sFormTag = Mid(sLoginHTML, nFormPos, nFormEnd - nFormPos + 1)
      LogAutoLogin "Form tag: " & sFormTag
    End If
  End If

  ' doSubmit 함수 전체 추출 (실제 POST 대상 확인)
  Dim nSubmitPos, nSubmitEnd, sSubmitFunc
  nSubmitPos = InStr(1, sLoginHTML, "doSubmit", vbTextCompare)
  If nSubmitPos > 0 Then
    nSubmitEnd = nSubmitPos + 1500
    If nSubmitEnd > Len(sLoginHTML) Then nSubmitEnd = Len(sLoginHTML)
    sSubmitFunc = Mid(sLoginHTML, nSubmitPos, nSubmitEnd - nSubmitPos)
    ' 함수 끝 찾기 (마지막 닫는 중괄호)
    LogAutoLogin "doSubmit FULL: " & Left(Replace(Replace(sSubmitFunc, vbCr, ""), vbLf, " "), 1000)
  End If

  ' action/submit 키워드 검색 (페이지 전체에서)
  Dim nActPos, sActSnippet
  nActPos = InStr(1, sLoginHTML, ".action", vbTextCompare)
  If nActPos > 0 Then
    sActSnippet = Mid(sLoginHTML, nActPos, 100)
    LogAutoLogin "Found .action: " & Replace(Replace(sActSnippet, vbCr, ""), vbLf, " ")
  End If

  ' input 필드명 추출하여 로그
  Dim sInputInfo, nInputPos, nInputEnd, sInputTag
  sInputInfo = ""
  nInputPos = 1
  Do
    nInputPos = InStr(nInputPos, LCase(sLoginHTML), "<input", vbTextCompare)
    If nInputPos = 0 Then Exit Do
    nInputEnd = InStr(nInputPos, sLoginHTML, ">")
    If nInputEnd = 0 Then Exit Do
    sInputTag = Mid(sLoginHTML, nInputPos, nInputEnd - nInputPos + 1)
    sInputInfo = sInputInfo & " | " & sInputTag
    nInputPos = nInputEnd + 1
  Loop
  If sInputInfo <> "" Then
    LogAutoLogin "Form inputs:" & Left(sInputInfo, 500)
  End If

  ' Set-Cookie 헤더에서 ASPSESSIONID 추출
  sHeaders = objLogin.GetAllResponseHeaders()
  sSessionCookie = ExtractASPCookie(sHeaders)
  Set objLogin = Nothing

  If sSessionCookie = "" Then
    LogAutoLogin "FAIL: No ASPSESSIONID cookie in GET response"
    Exit Function
  End If

  LogAutoLogin "Step1 OK: cookie=" & Left(sSessionCookie, 40) & "..."

  ' ── Step 2: POST login.asp → 로그인 인증 ──
  ' WinHttpRequest 우선 시도 (POST body 전송이 더 안정적)
  Dim objPost, sPostData, bUseWinHttp
  sPostData = "userid=glfy0703&passwd=123"
  bUseWinHttp = False

  On Error Resume Next
  Set objPost = Server.CreateObject("WinHttp.WinHttpRequest.5.1")
  If Err.Number = 0 Then
    bUseWinHttp = True
    LogAutoLogin "Step2: Using WinHttp.WinHttpRequest.5.1"
  Else
    Err.Clear
    Set objPost = CreateBrisHTTP()
    LogAutoLogin "Step2: Using MSXML2.ServerXMLHTTP (WinHttp unavailable)"
  End If
  On Error GoTo 0

  If objPost Is Nothing Then
    LogAutoLogin "FAIL: Cannot create HTTP object for POST"
    Exit Function
  End If

  On Error Resume Next
  If bUseWinHttp Then
    objPost.Option(4) = 13056  ' WinHttpRequestOption_SslErrorIgnoreFlags
    objPost.Open "POST", sLoginUrl, False
    objPost.SetRequestHeader "Content-Type", "application/x-www-form-urlencoded"
    objPost.SetRequestHeader "User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120"
    objPost.SetRequestHeader "Accept", "text/html,application/xhtml+xml,*/*"
    objPost.SetRequestHeader "Referer", sLoginUrl
    objPost.SetRequestHeader "Cookie", sSessionCookie
    objPost.SetRequestHeader "Content-Length", CStr(Len(sPostData))
    objPost.Send sPostData
  Else
    objPost.Open "POST", sLoginUrl, False
    objPost.SetRequestHeader "Content-Type", "application/x-www-form-urlencoded"
    objPost.SetRequestHeader "User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120"
    objPost.SetRequestHeader "Accept", "text/html,application/xhtml+xml,*/*"
    objPost.SetRequestHeader "Referer", sLoginUrl
    objPost.SetRequestHeader "Cookie", sSessionCookie
    objPost.SetRequestHeader "Content-Length", CStr(Len(sPostData))
    objPost.Send sPostData
  End If

  If Err.Number <> 0 Then
    LogAutoLogin "FAIL: POST login.asp error - " & Err.Description
    Set objPost = Nothing
    Exit Function
  End If
  On Error GoTo 0

  Set objLogin = objPost

  LogAutoLogin "Step2 POST status=" & objLogin.Status

  ' POST 응답 헤더 전체 로그
  sHeaders = objLogin.GetAllResponseHeaders()
  LogAutoLogin "Step2 response headers: " & Left(Replace(Replace(sHeaders, vbCr, ""), vbLf, " | "), 500)

  ' POST 응답에 새 쿠키가 있으면 갱신
  Dim sNewCookie
  sNewCookie = ExtractASPCookie(sHeaders)
  If sNewCookie <> "" Then
    sSessionCookie = sNewCookie
    LogAutoLogin "Step2 new cookie: " & Left(sNewCookie, 40) & "..."
  End If

  ' ── Step 3: 로그인 성공 검증 ──
  Dim sPostBody
  sPostBody = ""
  On Error Resume Next
  sPostBody = objLogin.ResponseText
  On Error GoTo 0

  LogAutoLogin "Step2 response body (" & Len(sPostBody) & " bytes): " & Left(Replace(Replace(sPostBody, vbCr, ""), vbLf, " "), 400)

  Set objLogin = Nothing

  ' 302 리다이렉트 = 로그인 성공 (일반적인 ASP 로그인 패턴)
  ' 200 + 로그인 페이지와 같은 크기 = 실패 (폼 재표시)
  ' 200 + 다른 내용 = 성공 가능성
  If Len(sPostBody) = Len(sLoginHTML) Then
    LogAutoLogin "WARN: POST response same size as login page (" & Len(sPostBody) & "=" & Len(sLoginHTML) & ") - likely failed"
    ' 그래도 Step 4 테스트로 최종 확인 (혹시 세션이 설정되었을 수 있음)
  ElseIf Len(sPostBody) > 0 Then
    LogAutoLogin "Step3: POST response differs from login page (" & Len(sPostBody) & " vs " & Len(sLoginHTML) & ")"
  End If

  ' ── Step 4: 인증된 쿠키로 테스트 요청 ──
  Dim objTest, sTestUrl, sTestResp, bTestOK
  sTestUrl = sBrisHost & "/my_page/main_suju_team.asp?teamcode=201300001"

  Set objTest = CreateBrisHTTP()
  If Not objTest Is Nothing Then
    On Error Resume Next
    bTestOK = SendBrisRequest(objTest, sTestUrl, sSessionCookie)
    If bTestOK Then
      sTestResp = objTest.ResponseText
      If InStr(sTestResp, "window.top.location.href") > 0 Then
        LogAutoLogin "FAIL: Test request still redirects after login"
        Set objTest = Nothing
        BrisAutoLogin = ""
        Exit Function
      Else
        LogAutoLogin "OK: Test request succeeded (" & Len(sTestResp) & " bytes)"
      End If
    Else
      LogAutoLogin "WARN: Test request failed, returning cookie anyway"
    End If
    On Error GoTo 0
    Set objTest = Nothing
  End If

  LogAutoLogin "SUCCESS: Returning authenticated cookie"
  BrisAutoLogin = sSessionCookie
End Function

' =====================================================
' Set-Cookie 헤더에서 ASPSESSIONID 쿠키 추출
' =====================================================
' =====================================================
' 자동 로그인 로그 기록 (Application 변수에 최근 로그 저장)
' =====================================================
Sub LogAutoLogin(sMsg)
  Dim sLog
  sLog = Application("BRIS_AutoLoginLog")
  sLog = "[" & Now() & "] " & sMsg & vbCrLf & sLog
  ' 최근 2000자만 보관
  If Len(sLog) > 5000 Then sLog = Left(sLog, 5000)
  Application.Lock
  Application("BRIS_AutoLoginLog") = sLog
  Application.Unlock
End Sub

' =====================================================
' 진단 엔드포인트: ?bris_proxy=_diag
' 현재 세션 상태와 자동 로그인 로그를 표시
' =====================================================
Sub HandleBrisDiag(sBrisHost, sCurCookie)
  Response.ContentType = "text/html; charset=utf-8"
  Response.Write "<html><head><title>BRIS Proxy Diag</title>"
  Response.Write "<style>body{font-family:monospace;padding:20px;background:#1a1a2e;color:#eee}"
  Response.Write "h2{color:#e94560} .ok{color:#0f3} .fail{color:#f33}"
  Response.Write "pre{background:#16213e;padding:15px;border-radius:8px;overflow-x:auto;white-space:pre-wrap}</style></head><body>"

  Response.Write "<h2>BRIS Proxy Diagnostics <small style='color:#888'>v7</small></h2>"
  Response.Write "<p><b>Time:</b> " & Now() & "</p>"
  Response.Write "<p><b>BRIS Host:</b> " & sBrisHost & "</p>"

  ' 현재 저장된 쿠키
  Response.Write "<h3>Stored Session Cookie</h3>"
  If sCurCookie <> "" Then
    Response.Write "<pre>" & Server.HTMLEncode(sCurCookie) & "</pre>"
  Else
    Response.Write "<p class='fail'>No cookie stored (empty)</p>"
  End If

  ' 마지막 이벤트 기록
  Response.Write "<h3>Last Events</h3>"
  Response.Write "<p><b>Last Expiry Detected:</b> " & Application("BRIS_LastExpiry") & "</p>"
  Response.Write "<p><b>Last Login Attempt:</b> " & Application("BRIS_LastLogin") & "</p>"
  Response.Write "<p><b>Last Error:</b> " & Application("BRIS_LoginError") & "</p>"

  ' 자동 로그인 로그
  Response.Write "<h3>Auto-Login Log</h3>"
  Dim sLog
  sLog = Application("BRIS_AutoLoginLog")
  If sLog <> "" Then
    Response.Write "<pre>" & Server.HTMLEncode(sLog) & "</pre>"
  Else
    Response.Write "<p>No log entries yet</p>"
  End If

  ' 현재 쿠키로 테스트 요청
  Response.Write "<h3>Live Test (current cookie)</h3>"
  If sCurCookie <> "" Then
    Dim objTest, sTestUrl, bTestOK
    sTestUrl = sBrisHost & "/my_page/main_suju_team.asp?teamcode=201300001"
    Set objTest = CreateBrisHTTP()
    If Not objTest Is Nothing Then
      bTestOK = SendBrisRequest(objTest, sTestUrl, sCurCookie)
      If bTestOK Then
        Dim sTestResp
        sTestResp = objTest.ResponseText
        If InStr(sTestResp, "window.top.location.href") > 0 Then
          Response.Write "<p class='fail'>FAILED: Session expired (redirect detected)</p>"
          Response.Write "<pre>" & Server.HTMLEncode(Left(sTestResp, 200)) & "</pre>"
        Else
          Response.Write "<p class='ok'>OK: Valid session (" & Len(sTestResp) & " bytes)</p>"
        End If
      Else
        Response.Write "<p class='fail'>FAILED: Request error</p>"
      End If
      Set objTest = Nothing
    Else
      Response.Write "<p class='fail'>FAILED: Cannot create HTTP object</p>"
    End If
  Else
    Response.Write "<p class='fail'>Skipped: No cookie to test</p>"
  End If

  Response.Write "<hr><p><a href='?bris_proxy=_refresh' style='color:#e94560;font-size:16px'>▶ Force Re-Login Now</a></p>"
  Response.Write "</body></html>"
End Sub

' =====================================================
' 세션 강제 갱신: ?bris_proxy=_refresh
' 자동 로그인을 강제 실행하고 결과를 보여줌
' =====================================================
Sub HandleBrisRefresh(sBrisHost)
  Response.ContentType = "text/html; charset=utf-8"
  Response.Write "<html><head><title>BRIS Session Refresh</title>"
  Response.Write "<style>body{font-family:monospace;padding:20px;background:#1a1a2e;color:#eee}"
  Response.Write ".ok{color:#0f3;font-size:20px} .fail{color:#f33;font-size:20px}</style></head><body>"

  Response.Write "<h2>BRIS Session Force Refresh</h2>"
  Response.Write "<p>Attempting auto-login at " & Now() & " ...</p>"

  Dim newCookie
  newCookie = BrisAutoLogin(sBrisHost)

  If newCookie <> "" Then
    Application.Lock
    Application("BRIS_Session_Cookie") = newCookie
    Application("BRIS_LastLogin") = Now()
    Application("BRIS_LoginError") = ""
    Application.Unlock

    Response.Write "<p class='ok'>SUCCESS: New session cookie obtained!</p>"
    Response.Write "<p>Cookie: " & Server.HTMLEncode(Left(newCookie, 50)) & "...</p>"
    Response.Write "<p>Dashboard should work now. <a href='?bris_proxy=_diag' style='color:#e94560'>View Diagnostics</a></p>"
  Else
    Application.Lock
    Application("BRIS_LoginError") = "Manual refresh failed at " & Now()
    Application.Unlock

    Response.Write "<p class='fail'>FAILED: Auto-login did not return a valid cookie.</p>"
    Response.Write "<p>Check the <a href='?bris_proxy=_diag' style='color:#e94560'>diagnostics page</a> for details.</p>"
  End If

  Response.Write "</body></html>"
End Sub

Function ExtractASPCookie(sHeaders)
  Dim nPos, nEnd
  ExtractASPCookie = ""

  nPos = InStr(1, sHeaders, "ASPSESSIONID", vbTextCompare)
  If nPos = 0 Then Exit Function

  nEnd = InStr(nPos, sHeaders, ";")
  If nEnd = 0 Then nEnd = InStr(nPos, sHeaders, vbCrLf)
  If nEnd = 0 Then nEnd = Len(sHeaders) + 1

  ExtractASPCookie = Trim(Mid(sHeaders, nPos, nEnd - nPos))
End Function
%>
