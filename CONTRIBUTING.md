# Git-процесс

Репозиторий: **origin** на GitHub. Локально используйте Git из [Git for Windows](https://git-scm.com/download/win), если команда `git` не в PATH:

`"C:\Program Files\Git\bin\git.exe"`.

## Ветки

| Ветка | Назначение |
|--------|------------|
| `main` | Стабильная, релизная. Только merge из `develop` или hotfix после ревью. |
| `develop` | Интеграция. Все feature-ветки сюда через PR. |
| `feature/<кратко>` | Одна логическая задача, ответвление от `develop`. |

Примеры: `feature/document-upload`, `feature/generation-tests`, `feature/frontend-chat`.

## Поток работы

1. Обновить `develop`: `git fetch origin && git checkout develop && git pull`.
2. Создать ветку: `git checkout -b feature/моя-задача`.
3. Коммиты с осмысленными сообщениями (см. ниже).
4. `git push -u origin feature/моя-задача`.
5. Открыть **Pull Request** в `develop`, заполнить шаблон из `.github/PULL_REQUEST_TEMPLATE.md`.
6. Code review: второй разработчик approve → merge в `develop`.
7. Релиз на `main` — по договорённости (Tech Lead), после smoke-проверки.

Прямой push в `main` **запрещён** (кроме экстренных hotfix по согласованию).

## Коммиты

Стиль: **императив**, по смыслу; при желании префикс по типу:

- `feat: ...` — новая функциональность
- `fix: ...` — исправление бага
- `chore: ...` — инфра, зависимости, без изменения поведения продукта
- `docs: ...` — только документация

Примеры:

- `feat(document-service): validate MIME types on upload`
- `chore: pin httpx version in api-gateway`
- `docs: update TEAM.md responsibilities`

Плохо: `fix`, `wip`, `update` без контекста.

## Роли

| | Tech Lead | Никита |
|---|-----------|--------|
| api-gateway, auth, rag, инфра | основной | ревью |
| document-service, generation | консультации, ревью | основной |
| ai-service | контракты, промпты | часть реализации |
| frontend | архитектурные решения при необходимости | основной (UI, загрузка, чат, результаты) |

Подробнее зоны: [`docs/TEAM.md`](docs/TEAM.md).

## Code review

- Ревьюер смотрит логику, читаемость, утечки секретов, соответствие API.
- Мерж только после **approve** (можно 1 approve на хакатоне между вами двумя).
