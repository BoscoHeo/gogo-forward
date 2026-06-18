$port = 8080

# Get local IP address
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -ne '127.0.0.1' } | Select-Object -First 1).IPAddress

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:${port}/")
if ($ip) {
    try { $listener.Prefixes.Add("http://${ip}:${port}/") } catch {}
}
try { $listener.Prefixes.Add("http://+:${port}/") } catch {}
$listener.Start()

Write-Host ""
Write-Host "============================================"
Write-Host "   GO GO FORWARD - Game Server Started!"
Write-Host "============================================"
Write-Host ""
Write-Host "  Teacher PC:  http://127.0.0.1:${port}"
if ($ip) {
    Write-Host "  Tablets:     http://${ip}:${port}"
}
Write-Host ""
Write-Host "  Press Ctrl+C to stop the server"
Write-Host "============================================"
Write-Host ""

$root = Join-Path $PSScriptRoot "public"

$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".json" = "application/json; charset=utf-8"
}

try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $path = $ctx.Request.Url.LocalPath
        if ($path -eq "/") { $path = "/index.html" }
        $file = Join-Path $root ($path.Replace("/", "\"))
        if (Test-Path $file -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($file).ToLower()
            if ($mime.ContainsKey($ext)) { $ctx.Response.ContentType = $mime[$ext] }
            $ctx.Response.Headers.Add("Access-Control-Allow-Origin", "*")
            $b = [System.IO.File]::ReadAllBytes($file)
            $ctx.Response.ContentLength64 = $b.Length
            $ctx.Response.OutputStream.Write($b, 0, $b.Length)
        } else {
            $ctx.Response.StatusCode = 404
            $b = [System.Text.Encoding]::UTF8.GetBytes("404")
            $ctx.Response.OutputStream.Write($b, 0, $b.Length)
        }
        $ctx.Response.Close()
    }
} finally { $listener.Stop() }
