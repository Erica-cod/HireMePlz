# 使用 GHCR 镜像 + Watchtower 自动更新启动项目
# 首次使用需要登录 GHCR（之后 Docker 会记住凭据）

param(
    [switch]$Login,
    [switch]$Pull,
    [switch]$Down
)

$ComposeFile = "docker-compose.ghcr.yml"

if ($Down) {
    Write-Host "Stopping all services..." -ForegroundColor Yellow
    docker compose -f $ComposeFile down
    exit 0
}

# 检查是否已登录 GHCR
$dockerConfig = "$env:USERPROFILE\.docker\config.json"
$needLogin = $Login

if (-not $needLogin -and (Test-Path $dockerConfig)) {
    $config = Get-Content $dockerConfig -Raw | ConvertFrom-Json
    if (-not ($config.auths.PSObject.Properties.Name -contains "ghcr.io")) {
        $needLogin = $true
    }
} elseif (-not (Test-Path $dockerConfig)) {
    $needLogin = $true
}

if ($needLogin) {
    Write-Host "Login to GitHub Container Registry (ghcr.io)" -ForegroundColor Cyan
    Write-Host "Use your GitHub username and a Personal Access Token (PAT) with 'read:packages' scope" -ForegroundColor Gray
    docker login ghcr.io
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Login failed. Aborting." -ForegroundColor Red
        exit 1
    }
}

if ($Pull) {
    Write-Host "Pulling latest images..." -ForegroundColor Cyan
    docker compose -f $ComposeFile pull
}

Write-Host "Starting services with Watchtower auto-update..." -ForegroundColor Green
docker compose -f $ComposeFile up -d

Write-Host ""
Write-Host "Services running:" -ForegroundColor Green
Write-Host "  Frontend:   http://localhost:3000"
Write-Host "  Backend:    http://localhost:4000"
Write-Host "  Watchtower: auto-checking for new images every 60s"
Write-Host ""
Write-Host "View logs:    docker compose -f $ComposeFile logs -f"
Write-Host "Stop:         .\scripts\start-ghcr.ps1 -Down"
