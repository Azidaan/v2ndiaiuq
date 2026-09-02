# Перенос проекта guiaidn на другое устройство

Архив содержит исходный код, Docker-конфигурацию, локальный `.env`,
полный дамп PostgreSQL и все файлы из постоянного тома загрузок.

Снимок создан 27.07.2026. Перед переносом проверка целостности базы
завершилась со статусом `ok`: 1 пользователь CMS, 1 сеанс,
82 материала, 0 обращений, нарушений целостности нет.

## Что потребуется

- Docker Desktop с Docker Compose;
- свободные порты, включая локальный порт сайта `8080`;
- интернет при первой сборке Docker-образов.

На Windows рекомендуется Docker Desktop с включённым WSL 2.

## Автоматическое восстановление

Откройте терминал в распакованной папке `guiaidn`.

macOS / Linux:

```bash
chmod +x restore.sh
./restore.sh
```

Windows PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\restore.ps1
```

После восстановления:

- сайт: <http://localhost:8080>
- CMS: <http://localhost:8080/admin>

## Ручное восстановление

Если автоматический сценарий недоступен, выполните команды по порядку:

```bash
docker compose up -d db
docker compose cp backups/database.dump db:/tmp/database.dump
docker compose exec -T db pg_restore -U ipi -d ipi --clean --if-exists --no-owner --no-privileges /tmp/database.dump
docker compose up --build -d app
docker compose exec -T app sh -c "find /app/uploads -mindepth 1 -maxdepth 1 -exec rm -rf {} +"
docker compose cp backups/uploads/. app:/app/uploads/
docker compose restart app
docker compose exec -T app pnpm db:check
```

Последняя команда должна вернуть `"status": "ok"`.

## Важно

- Не выполняйте `docker compose down -v`: параметр `-v` удаляет базу и загруженные файлы.
- Обычная безопасная остановка: `docker compose stop`.
- Файл `.env` содержит локальные данные доступа. Храните архив в защищённом месте и не публикуйте его.
- После переноса на публичный сервер замените секреты в `.env`,
  включите `COOKIE_SECURE=true`, настройте HTTPS и регулярные резервные
  копии.
