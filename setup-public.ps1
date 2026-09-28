# 克隆公开仓库后，生成免登录本地运行所需的 auth.js / oauth-bootstrap.js
$root = Split-Path -Parent $PSScriptRoot
Copy-Item -Force (Join-Path $root "auth.stub.js") (Join-Path $root "auth.js")
Copy-Item -Force (Join-Path $root "oauth-bootstrap.stub.js") (Join-Path $root "oauth-bootstrap.js")
Write-Host "已生成 auth.js 与 oauth-bootstrap.js（开源免登录版）。"
