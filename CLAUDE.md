# Eldritch Dash — заметки для Claude Code

Idle-раннер на Phaser 4 + TypeScript + Vite. Полные требования — в `SPEC.md` (источник истины;
файл только локальный, в git не попадает). Работаем строго по этапам из SPEC §16.
Текущий этап: **M2 (экономика) готов — сырой, но играбельный билд**, следующий — M3 (мета).

## Команды

| Команда           | Что делает                                                              |
| ----------------- | ----------------------------------------------------------------------- |
| `npm run dev`     | dev-сервер Vite (http://localhost:5173)                                 |
| `npm run build`   | `tsc --noEmit` + сборка в `dist/` (относительные пути, `base: './'`)    |
| `npm run preview` | локальный просмотр `dist/`                                              |
| `npm run test`    | Vitest, тесты в `tests/**/*.test.ts`                                    |
| `npm run lint`    | ESLint + `prettier --check`                                             |
| `npm run format`  | Prettier с автоисправлением                                             |
| `npm run bg`      | сборка фонов и земли → `public/assets/bg/*.webp` + манифест             |
| `npm run hero`    | сборка частей героя из листа персонажа → `public/assets/hero/*.webp`    |
| `npm run enemies` | сборка частей тварей (сейчас чайка) → `public/assets/enemies/*.webp`    |
| `npm run fx`      | частицы, свет (выстрел фонаря, свечение) и UI → `public/assets/{fx,ui}` |

После каждого этапа `build`, `test`, `lint` должны быть зелёными.

## Архитектура

Главное правило: **`systems/` и `core/` не знают о Phaser и DOM** (ESLint + `tests/architecture.test.ts`).
Сцены только шлют команды (`press`/`release`) и рисуют состояние.

- `src/main.ts` — bootstrap: адаптер платформы → язык → загрузка сохранения → `GameSession` → офлайн-отчёт →
  автосейв → `Phaser.Game` (Boot → Preload → Run + UI + ShopOverlay).
  В dev из консоли доступны `window.game`, `window.session`, `window.saves`.
- `src/app.ts` — общие сервисы для сцен: `app().platform`, `app().session`, `app().saves`.
- `src/config/*.json` — **все** числа баланса/фила; типы в `config/types.ts`, загрузка в `config/index.ts`,
  проверка инвариантов — `tests/config.test.ts`.
  - `run.json` — мир (уровень земли, rebase), герой (скорость, прыжок, оглушение), парение, атака.
  - `economy.json` — номинал монеты (`cpsFactor`), офлайн (rate/cap/minSec), автосейв, ступени комбо.
  - `upgrades.json` — снаряжение (base/cps, growth 1.15, вехи ×2) и улучшения героя
    (тиры `costs`, эффекты `add`/`mul` над `RunModifiers`). `enemies.json` — твари и их поведение
    (`walker`/`flyer`/`hopper`, hp, награда). `biomes.json` — генерация трассы и параллакс.
  - `juice.json` — тряска, hit-stop, частицы, squash/stretch, масштаб растеризации текстур.
- `src/core/` — `EventBus`, `BigNum` (Decimal из break_infinity + `formatNumber` по SPEC §5.5),
  `GameState` (единое сериализуемое состояние), `Clock` (офлайн-дельта с защитой от перевода часов).
- `src/systems/` — чистая логика:
  - `GameSession` — владеет GameState: CpS, номинал монеты, покупки (×1/×10/×100/MAX), пассивный и
    офлайн-доход, онбординг; `attachRun(sim)` зачисляет награды забега и передаёт модификаторы.
  - `Economy` (цены как геометрический ряд, вехи, CpS), `Upgrades` (тиры → `RunModifiers`), `Offline`.
- Забег (детерминирован по seed):
  - `RunSim` — оркестратор: шаг симуляции, столкновения, награды, события в `bus`, rebase мира.
  - `HeroMotor` (бег/прыжок/буфер ввода/парение/оглушение), `Combat` (вспышка фонаря, броня, отброс),
    `Combo`, `Track` (процедурные паттерны), `Entity`+`EntityPool` (пул без аллокаций), `Rng`.
- `src/render/` — только отображение:
  - `placeholders/*.ts` — программные SVG в стиле SPEC §8 (ключи = будущие файлы `assets-src/`);
    PreloadScene растеризует их через `load.svg` (data-URI в base64 — так требует загрузчик Phaser).
  - Фоны параллакса — растровые, из генератора (Magnific, Seedream 5 Pro): сырые PNG на пурпурном фоне
    лежат в `assets-src/generated/raw/` (не в git), параметры слоёв — `assets-src/generated/coast.json`.
    `npm run bg` вырезает фон (адаптивный хромакей с восстановлением полупрозрачности, отдельная
    обработка луча маяка), обрезает пустоту, сводит края для бесшовного тайлинга и пишет WebP +
    `render/backgrounds.json` (позиция слоя по Y). Если растрового слоя нет — используется SVG-плейсхолдер.
  - Герой — тоже из генератора: лист персонажа (фигура + части на пурпурном фоне) →
    `npm run hero` (параметры — `assets-src/generated/hero.json`: точка внутри каждой части и масштаб) →
    WebP частей + `render/heroParts.json`. Риг сгенерированных частей — `assets-src/rigs/hero.generated.json`
    (точки вращения, крепление кисти и фонаря, позы крыльев/руки); риг SVG-плейсхолдеров — `hero.json`.
    Твари — так же: листы `assets-src/generated/{gull,fishman,squid,net}.json` → `render/enemyParts.json`.
    Земля (настил причала) — `assets-src/generated/ground.json` через `build-bg` (`fitTrimmed` + `top`:
    верх настила на уровне земли). Препятствия и монета — `props.json` через `build-parts` (`fitHeight`
    под хитбокс из `biomes.json`) → `render/propParts.json`; каждый предмет откатывается отдельно.
    Частицы — `fx.json` (пурпурный фон); свет — `light_{a,b}.json` с `keyMode: "luma"` (лист на чёрном,
    альфа = яркость, рисуется аддитивно; мягкие свечения вырезаются `box`). UI — `ui.json`:
    панель/табличка/плашка рисуются через `nineslice` (срезы в `render/ui/skin.json`), значок и иконки — картинками;
    без растра `Button`/`addPanel`/`addPlate` рисуют векторный вариант.
    Выстрел фонаря — `render/LanternFx.ts`: вспышка у фонаря, луч до первой задетой твари
    (событие `flash` несёт её), всплеск попадания; длительности — `juice.json → shot`.
    Глаза на листах — пустые белые круги, зрачок рисуется поверх и следит за героем.
    Чайка — `GeneratedGullView` (риг `gull.generated.json`); остальные — универсальный `RigCreatureView`,
    целиком описанный JSON-ригом (`{fishman,squid,net}.generated.json`: части, глаза с привязкой к части,
    анимация `walk` или `tentacles`, `armor`). Если части не загрузились — векторный вид из кода.
    `rasterAssets.ts` сводит все растровые замены; PreloadScene грузит их вместо плейсхолдеров с теми же ключами.
  - `textures.ts` — реестр масштаба растеризации, `unitImage()` даёт картинку в игровых единицах.
  - `CutoutRig` (части + точки вращения из `assets-src/rigs/*.json`), `TentacleChain`.
  - `HeroView` (анимация героя), `EntityViews` (твари/монеты/препятствия, пулы по типу),
    `Parallax` (4 слоя + настил + туман, сдвиг по дистанции), `Particles`, `Juice` (попапы, тряска, hit-stop).
  - `ui/Button.ts` — кнопка (зона клика ≥ 44 px) и `drawPanel` (пергаментная панель).
- `src/scenes/` — `BootScene`, `PreloadScene`, `RunScene` (ввод, синхронизация видов, `session.tick`),
  `UIScene` (HUD, подсказки, окно офлайн-дохода), `ShopOverlay` (выезжающая лавка; забег не останавливается).
- `src/save/` — `schema.ts` (формат v1, Decimal строками, мягкая валидация), `migrations.ts` (цепочка версий),
  `SaveManager.ts` (encode/decode: JSON → base64; автосейв, visibilitychange, pagehide).
- `src/platform/` — `PlatformAdapter` (SPEC §3), `WebAdapter` (localStorage, rewarded-заглушка).
- `src/i18n/` — `ru.json` / `en.json`, `t(key, params)`; `tId()` для ключей из данных (`item.<id>`),
  `formatDuration()`. Весь текст для игрока только через ключи.

## Соглашения

- Строгий TS (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`).
  `arr[i]!` в горячих циклах разрешён (правило `no-non-null-assertion` выключено осознанно).
- `scripts/` не входят в `tsc` (нет `@types/node` — пакета нет в SPEC §2); запускаются Node 24 напрямую.
- TypeScript закреплён на `~6.0`: typescript-eslint 8.x пока не поддерживает TS 7.
- Горячий цикл без аллокаций: объекты трассы из пула, события несут ссылки на сущности
  (не хранить их после `despawn`).
- Цвета — только токены из `render/palette.ts` (`palette` — числа для тонировки, `tones` — строки для SVG).
- Деньги — только `Decimal`; в кошелёк начисляет `GameSession`, `RunSim` лишь считает награду (`entity.reward`).
- Новые поля сохранения: поднять `SAVE_VERSION`, добавить миграцию и тест (`tests/save.test.ts`).
- Сжатие сохранений (lz-string) не подключено: пакета нет в SPEC §2 — нужно согласование.
- Новые npm-зависимости — только из SPEC §2, остальные — после согласования с пользователем.
- CI: `.github/workflows/ci.yml` — lint → test → build → деплой на GitHub Pages при пуше в `main`.
