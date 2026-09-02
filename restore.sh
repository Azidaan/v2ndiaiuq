#!/usr/bin/env sh
set -eu

if [ ! -f "docker-compose.yml" ] || [ ! -f "backups/database.dump" ]; then
  echo "Запустите сценарий из корневой папки guiaidn." >&2
  exit 1
fi

echo "1/6 Запуск PostgreSQL..."
docker compose up -d db

i=0
until docker compose exec -T db pg_isready -U ipi -d ipi >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "PostgreSQL не стал доступен за отведённое время." >&2
    exit 1
  fi
  sleep 2
done

echo "2/6 Восстановление базы данных..."
docker compose cp backups/database.dump db:/tmp/database.dump
docker compose exec -T db pg_restore \
  -U ipi -d ipi \
  --clean --if-exists --no-owner --no-privileges \
  /tmp/database.dump

echo "3/6 Сборка и запуск приложения..."
docker compose up --build -d app

i=0
until docker compose exec -T app node -e \
  "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
  >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 90 ]; then
    echo "Приложение не стало доступно за отведённое время." >&2
    exit 1
  fi
  sleep 2
done

echo "4/6 Восстановление загруженных файлов..."
docker compose exec -T app sh -c \
  "find /app/uploads -mindepth 1 -maxdepth 1 -exec rm -rf {} +"
docker compose cp backups/uploads/. app:/app/uploads/
docker compose restart app

echo "5/6 Проверка целостности..."
docker compose exec -T app pnpm db:check

echo "6/6 Готово."
echo "Сайт: http://localhost:8080"
echo "CMS:  http://localhost:8080/admin"
