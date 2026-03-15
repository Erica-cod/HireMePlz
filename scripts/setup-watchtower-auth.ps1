# 为 Watchtower 生成 GHCR 认证配置
# Docker Desktop 使用 Windows 凭据管理器，Watchtower (Linux 容器) 无法读取
# 此脚本生成一个独立的 config.json 供 Watchtower 使用

param(
    [Parameter(Mandatory=$true)]
    [string]$GitHubUser,

    [Parameter(Mandatory=$true)]
    [string]$GitHubPAT
)

$auth = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${GitHubUser}:${GitHubPAT}"))

$config = @{
    auths = @{
        "ghcr.io" = @{
            auth = $auth
        }
    }
} | ConvertTo-Json -Depth 3

$outputPath = Join-Path (Split-Path $PSScriptRoot) "watchtower-config.json"
Set-Content -Path $outputPath -Value $config -Encoding UTF8

Write-Host "Created $outputPath" -ForegroundColor Green
Write-Host "Watchtower can now authenticate with GHCR." -ForegroundColor Green
Write-Host "Restart watchtower: docker compose -f docker-compose.ghcr.yml restart watchtower" -ForegroundColor Cyan
