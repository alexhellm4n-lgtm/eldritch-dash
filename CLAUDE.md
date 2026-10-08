# Eldritch Dash — заметки для Claude Code

Idle-раннер на Phaser 4 + TypeScript + Vite. Полные требования — в `SPEC.md` (источник истины).
Работаем строго по этапам из SPEC §16. Текущий этап: **M0 (каркас) завершён**, следующий — M1.

## Команды

| Команда           | Что делает                                                           |
| ----------------- | -------------------------------------------------------------------- |
| `npm run dev`     | dev-сервер Vite (http://localhost:5173)                              |
| `npm run build`   | `tsc --noEmit` + сборка в `dist/` (относительные пути, `base: './'`) |
| `npm run preview` | локальный просмотр `dist/`                                           |
| `npm run test`    | Vitest, тесты в `tests/**/*.test.ts`                                 |
| `npm run lint`    | ESLint + `prettier --check`                                          |
| `npm run format`  | Prettier с автоисправлением                                          |

После каждого этапа `build`, `test`, `lint` должны быть зелёными.

## Архитектура

- `src/main.ts` — bootstrap: создаёт платформенный адаптер, выставляет язык, запускает `Phaser.Game`.
- `src/config/*.json` — **все** числа баланса и параметры. В коде магических чисел нет.
- `src/core/` — состояние, `EventBus` (типизированный), большие числа, часы. Без Phaser/DOM.
- `src/systems/` — чистая игровая логика без Phaser/DOM, чтобы её можно было тестировать и гонять
  в симуляторе баланса под Node. Это проверяют ESLint (`no-restricted-imports`/`globals`) и
  `tests/architecture.test.ts`.
- `src/platform/` — `PlatformAdapter` (интерфейс из SPEC §3) и реализации. Сейчас есть только `WebAdapter`.
- `src/save/` — сохранения и миграции (M2).
- `src/scenes/` — сцены Phaser: только читают состояние и отправляют команды. Сейчас есть `BootScene` (заглушка).
- `src/render/` — `palette.ts` (цветовые токены SPEC §8.1), плейсхолдеры, cut-out-риг, эффекты.
- `src/i18n/` — `ru.json` / `en.json` и `t(key)`. Текст для игрока выводится только через ключи;
  `tests/i18n.test.ts` проверяет, что наборы ключей совпадают.
- `scripts/` — dev-скрипты (атлас, симулятор баланса); `assets-src/` — исходные SVG; `public/assets/` — сгенерированные атласы.

## Соглашения

- Строгий TS (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` → `import type`).
- TypeScript закреплён на `~6.0`: typescript-eslint 8.x пока не поддерживает TS 7.
- Новые npm-зависимости — только из SPEC §2, остальные — после согласования с пользователем.
- CI: `.github/workflows/ci.yml` — lint → test → build, затем деплой `dist/` на GitHub Pages при пуше в `main`
  (в настройках репозитория: Settings → Pages → Source: GitHub Actions).
