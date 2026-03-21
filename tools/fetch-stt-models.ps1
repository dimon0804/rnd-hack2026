# Список моделей STT (hackai :6640). Ключ: переменная STT_API_KEY или по умолчанию hackaton2026.
# Запуск из корня репозитория:
#   .\tools\fetch-stt-models.ps1
#   $env:STT_API_KEY = "ваш_ключ"; .\tools\fetch-stt-models.ps1

$ErrorActionPreference = "Stop"
$BaseUrl = if ($env:STT_BASE_URL) { $env:STT_BASE_URL.TrimEnd("/") } else { "https://hackai.centrinvest.ru:6630" }
$ApiKey = if ($env:STT_API_KEY) { $env:STT_API_KEY } else { "hackaton2026" }

$uri = "$BaseUrl/v1/models"
Write-Host "GET $uri" -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $uri -Headers @{
        "Authorization" = "Bearer $ApiKey"
        "Accept"        = "application/json"
    } -Method Get

    $response | ConvertTo-Json -Depth 10

    if ($response.data -and $response.data.Count -gt 0) {
        Write-Host ""
        Write-Host "=== id моделей (подставьте в .env как STT_MODEL=...) ===" -ForegroundColor Green
        foreach ($m in $response.data) {
            $id = $m.id
            if ($id) { Write-Host "  $id" }
        }
    }
}
catch {
    Write-Host "Ошибка запроса: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host $reader.ReadToEnd()
    }
    exit 1
}
