<%@ Language="VBScript" CodePage="65001" %>
<%
' bris_proxy.asp — BRIS 서버 프록시
' apps.exc.co.kr 에서 bris.exc.co.kr 의 HTML 페이지를 대신 요청하여 반환한다.
' 사용법: /bris_proxy.asp?path=/business/index.asp&SD=20260101&ED=20260331
'
' path 파라미터: BRIS 상대 경로 (필수)
' 나머지 QueryString은 그대로 BRIS에 전달

Option Explicit
Response.Buffer = True

Dim brisBase, targetPath, qs, fullUrl
Dim xmlHttp, key, pair, i

brisBase = "https://bris.exc.co.kr"
targetPath = Request.QueryString("path")

If targetPath = "" Then
  Response.Status = "400 Bad Request"
  Response.Write "{""error"":""path parameter is required""}"
  Response.End
End If

' path를 제외한 나머지 QueryString 조립
qs = ""
For Each key In Request.QueryString
  If LCase(key) <> "path" Then
    If qs <> "" Then qs = qs & "&"
    qs = qs & key & "=" & Request.QueryString(key)
  End If
Next

If qs <> "" Then
  fullUrl = brisBase & targetPath & "?" & qs
Else
  fullUrl = brisBase & targetPath
End If

Set xmlHttp = Server.CreateObject("MSXML2.ServerXMLHTTP.6.0")
xmlHttp.SetTimeouts 5000, 10000, 30000, 60000

On Error Resume Next

If UCase(Request.ServerVariables("REQUEST_METHOD")) = "POST" Then
  ' POST 요청 전달
  Dim postData
  postData = BinaryToString(Request.BinaryRead(Request.TotalBytes))
  xmlHttp.Open "POST", fullUrl, False
  xmlHttp.SetRequestHeader "Content-Type", Request.ServerVariables("CONTENT_TYPE")
  xmlHttp.Send postData
Else
  ' GET 요청
  xmlHttp.Open "GET", fullUrl, False
  xmlHttp.Send
End If

If Err.Number <> 0 Then
  Response.Status = "502 Bad Gateway"
  Response.Write "{""error"":""BRIS connection failed: " & Err.Description & """}"
  Response.End
End If

On Error GoTo 0

' 원본 Content-Type 전달
Dim ct
ct = xmlHttp.GetResponseHeader("Content-Type")
If ct <> "" Then
  Response.ContentType = ct
Else
  Response.ContentType = "text/html"
End If

' 바이너리 응답 그대로 전달 (EUC-KR 인코딩 보존)
Response.BinaryWrite xmlHttp.ResponseBody

Set xmlHttp = Nothing

Function BinaryToString(binData)
  Dim rs
  Set rs = Server.CreateObject("ADODB.Recordset")
  rs.Fields.Append "data", 200, LenB(binData)
  rs.Open
  rs.AddNew
  rs.Fields("data").AppendChunk binData
  rs.Update
  BinaryToString = rs.Fields("data").Value
  rs.Close
  Set rs = Nothing
End Function
%>
