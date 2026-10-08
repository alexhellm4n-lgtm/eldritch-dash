# Eldritch Dash — заметки для Claude Code

Idle-раннер на Phaser 4 + TypeScript + Vite. Полные требования — в `SPEC.md` (источник истины;
файл только локальный, в git не попадает). Работаем строго по этапам из SPEC §16.
Текущий этап: **M1 (ядро забега) готов**, следующий — M2 (экономика).

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

Главное правило: **`systems/` и `core/` не знают о Phaser и DOM** (ESLint + `tests/architecture.test.ts`).
Сцены только шлют команды (`press`/`release`) и рисуют состояние.

- `src/main.ts` — bootstrap: адаптер платформы → язык → `Phaser.Game` (Boot → Preload → Run + UI).
  В dev объект игры доступен как `window.game` (отладка из консоли).
- `src/config/*.json` — **все** числа баланса/фила; типы в `config/types.ts`, загрузка в `config/index.ts`,
  проверка инвариантов — `tests/config.test.ts`.
  - `run.json` — мир (уровень земли, rebase), герой (скорость, прыжок, оглушение), парение, атака.
  - `economy.json` — номинал монеты, ступени комбо. `enemies.json` — твари и их поведение
    (`walker`/`flyer`/`hopper`, hp, награда). `biomes.json` — генерация трассы и параллакс.
  - `juice.json` — тряска, hit-stop, частицы, squash/stretch, масштаб растеризации текстур.
- `src/core/` — `EventBus` (типизированный), `format.ts` (временное форматирование до BigNum в M2).
- `src/systems/` — чистая логика забега, детерминированная по seed:
  - `RunSim` — оркестратор: шаг симуляции, столкновения, награды, события в `bus`, rebase мира.
  - `HeroMotor` (бег/прыжок/буфер ввода/парение/оглушение), `Combat` (вспышка фонаря, броня, отброс),
    `Combo`, `Track` (процедурные паттерны), `Entity`+`EntityPool` (пул без аллокаций), `Rng`.
- `src/render/` — только отображение:
  - `placeholders/*.ts` — программные SVG в стиле SPEC §8 (ключи = будущие файлы `assets-src/`);
    PreloadScene растеризует их через `load.svg` (data-URI в base64 — так требует загрузчик Phaser).
  - `textures.ts` — реестр масштаба растеризации, `unitImage()` даёт картинку в игровых единицах.
  - `CutoutRig` (части + точки вращения из `assets-src/rigs/*.json`), `TentacleChain`.
  - `HeroView` (анимация героя), `EntityViews` (твари/монеты/препятствия, пулы по типу),
    `Parallax` (4 слоя + настил + туман, сдвиг по дистанции), `Particles`, `Juice` (попапы, тряска, hit-stop).
- `src/scenes/` — `BootScene`, `PreloadScene`, `RunScene` (ввод, синхронизация видов), `UIScene` (HUD, подсказки).
- `src/platform/` — `PlatformAdapter` (SPEC §3), `WebAdapter`, `current.ts` (активный адаптер).
- `src/i18n/` — `ru.json` / `en.json`, `t(key, params)`; весь текст для игрока только через ключи.

## Соглашения

- Строгий TS (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`).
  `arr[i]!` в горячих циклах разрешён (правило `no-non-null-assertion` выключено осознанно).
- TypeScript закреплён на `~6.0`: typescript-eslint 8.x пока не поддерживает TS 7.
- Горячий цикл без аллокаций: объекты трассы из пула, события несут ссылки на сущности
  (не хранить их после `despawn`).
- Цвета — только токены из `render/palette.ts` (`palette` — числа для тонировки, `tones` — строки для SVG).
- Новые npm-зависимости — только из SPEC §2, остальные — после согласования с пользователем.
- CI: `.github/workflows/ci.yml` — lint → test → build → деплой на GitHub Pages при пуше в `main`.
