# 가짜 구글을 끼운 시험 페이지를 만들고 http://localhost:8765/ 에 띄운다.
# 만든 페이지는 임시 폴더에 두므로 저장소에 섞이지 않는다. 끝내려면 Ctrl+C.
$여기 = $PSScriptRoot
$출력 = Join-Path $env:TEMP 'pronote-시험'
New-Item -ItemType Directory -Force $출력 | Out-Null

$앱 = [IO.File]::ReadAllText((Join-Path $여기 '..\index.html'))
$가짜 = [IO.File]::ReadAllText((Join-Path $여기 '가짜구글.js'))
$구글자리 = '<script src="https://accounts.google.com/gsi/client" async defer onload="initGoogle()"></script>'
if (-not $앱.Contains($구글자리)) { throw 'index.html 에서 구글 스크립트 자리를 못 찾았습니다.' }
$페이지 = $앱.Replace($구글자리, "<script>`n$가짜`ninitGoogle();</script>")
[IO.File]::WriteAllText((Join-Path $출력 'index.html'), $페이지, (New-Object Text.UTF8Encoding $false))

$l = New-Object Net.HttpListener
$l.Prefixes.Add('http://localhost:8765/')
$l.Start()
Write-Output '시험 페이지: http://localhost:8765/'
while ($l.IsListening) {
  $c = $l.GetContext()
  $b = [IO.File]::ReadAllBytes((Join-Path $출력 'index.html'))
  $c.Response.ContentType = 'text/html; charset=utf-8'
  $c.Response.OutputStream.Write($b, 0, $b.Length)
  $c.Response.Close()
}
