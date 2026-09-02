$ErrorActionPreference = "Stop"

if (-not (Test-Path "docker-compose.yml") -or
    -not (Test-Path "backups/database.dump")) {
    throw "Запустите сценарий из корневой папки guiaidn."
}

Write-Host "1/6 Запуск PostgreSQL..."
docker compose up -d db
if ($LASTEXITCODE -ne 0) { throw "Не удалось запустить PostgreSQL." }

$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    docker compose exec -T db pg_isready -U ipi -d ipi *> $null
    if ($LASTEXITCODE -eq 0) {
        $ready = $true
        break
    }
    Start-Sleep -Seconds 2
}
if (-not $ready) { throw "PostgreSQL не стал доступен за отведённое время." }

Write-Host "2/6 Восстановление базы данных..."
docker compose cp backups/database.dump db:/tmp/database.dump
if ($LASTEXITCODE -ne 0) { throw "Не удалось скопировать дамп базы." }
docker compose exec -T db pg_restore `
    -U ipi -d ipi `
    --clean --if-exists --no-owner --no-privileges `
    /tmp/database.dump
if ($LASTEXITCODE -ne 0) { throw "Не удалось восстановить базу." }

Write-Host "3/6 Сборка и запуск приложения..."
docker compose up --build -d app
if ($LASTEXITCODE -ne 0) { throw "Не удалось собрать приложение." }

$ready = $false
for ($i = 0; $i -lt 90; $i++) {
    docker compose exec -T app node -e `
        "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" `
        *> $null
    if ($LASTEXITCODE -eq 0) {
        $ready = $true
        break
    }
    Start-Sleep -Seconds 2
}
if (-not $ready) { throw "Приложение не стало доступно за отведённое время." }

Write-Host "4/6 Восстановление загруженных файлов..."
docker compose exec -T app sh -c `
    "find /app/uploads -mindepth 1 -maxdepth 1 -exec rm -rf {} +"
if ($LASTEXITCODE -ne 0) { throw "Не удалось очистить том загрузок." }
docker compose cp backups/uploads/. app:/app/uploads/
if ($LASTEXITCODE -ne 0) { throw "Не удалось восстановить загрузки." }
docker compose restart app
if ($LASTEXITCODE -ne 0) { throw "Не удалось перезапустить приложение." }

Write-Host "5/6 Проверка целостности..."
docker compose exec -T app pnpm db:check
if ($LASTEXITCODE -ne 0) { throw "Проверка целостности завершилась ошибкой." }

Write-Host "6/6 Готово."
Write-Host "Сайт: http://localhost:8080"
Write-Host "CMS:  http://localhost:8080/admins"
