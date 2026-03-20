# Подключает Node.js к PATH для текущей сессии (нужно для npm/postinstall).
# Запуск:  . .\tools\use-node-path.ps1   (именно с точкой — dot-source)

$nodeDir = Join-Path ${env:ProgramFiles} "nodejs"
if (-not (Test-Path (Join-Path $nodeDir "npm.cmd"))) {
    Write-Error "Node.js не найден в $nodeDir. Установите: winget install OpenJS.NodeJS.LTS"
    exit 1
}
if ($env:Path -notlike "*$nodeDir*") {
    $env:Path = "$nodeDir;$env:Path"
}
Write-Host "OK: node $(& node --version), npm $(& npm --version)"
