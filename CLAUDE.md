# Eldritch Dash — заметки для Claude Code

Idle-раннер на Phaser 4 + TypeScript + Vite. Полные требования — в `SPEC.md` (источник истины;
файл только локальный, в git не попадает). Работаем строго по этапам из SPEC §16.
Текущий этап: **M4 (контент) готов**, включая сгенерированную графику биомов, тварей, боссов и городка.
Следующий — M5 (платформы).

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
| `npm run ui`      | интерфейс v2: иконки, доска, шкалы, карточки, печати, свиток, газета    |
| `npm run meta`    | предметы M3, значки фаз/валют, щупальца и свет Пробуждения              |

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
  - M3: `sanity.json` (рассудок, искажения, иллюзии, Прозрение), `stars.json` (фазы, веса, модификаторы),
    `dream.json` (страницы, полёт, кольца, ритм, награда), `cat.json` (кот и его прокачка),
    `grimoire.json` (40 узлов: глава, позиция, цена в Эссенции, требования, звёзды, keep, эффект),
    `run.json → awakening`, `economy.json → chest, prestige (делитель, бонус звезды, знамения)`.
  - M4: `biomes.json` (3 биома: `lengthM` до босса, `boss`, `coinMult`, `miniBoss` — шанс, масштаб,
    hp/награда, отброс), `progression.json` (порядок биомов, круги, боссы: hp, подлёт к герою, волны,
    призыв, время боя, откат пути), `town.json` (6 построек: base/growth/maxLevel/эффект),
    `journal.json` (порядок карточек, встреч до полной записи, бонус, карточка «Поделиться»),
    `achievements.json` (группы показателей с тирами, +1 % за каждое), `newspaper.json` (награды серии,
    число заголовков).
  - `upgrades.json` — снаряжение (base/cps, growth 1.15, вехи ×2) и улучшения героя
    (тиры `costs`, эффекты `add`/`mul` над `RunModifiers`). `enemies.json` — твари и их поведение
    (`walker`/`flyer`/`hopper`/`burrower`/`blinker`, hp, награда). `biomes.json` — трасса и параллакс.
  - `juice.json` — тряска, hit-stop, частицы, squash/stretch, масштаб растеризации текстур.
- `src/core/` — `EventBus`, `BigNum` (Decimal из break_infinity + `formatNumber` по SPEC §5.5),
  `GameState` (единое сериализуемое состояние), `Clock` (офлайн-дельта с защитой от перевода часов).
- `src/systems/` — чистая логика:
  - Бонусы — единый `RunModifiers`: улучшения героя + гримуар + знамение + кот складываются через
    `applyEffect` (add/mul); тёмные звёзды дают общий множитель (`starMultiplier`).
  - `Sanity` (множитель монет, пороги искажений), `Stars` (фаза по времени: хеш номера слота →
    взвешенный выбор; прогноз и средний множитель для офлайна), `Grimoire`, `Prestige` (звёзды, знамения),
    `Dream` (`DreamSim` — сон без Phaser).
  - `GameSession` — владеет GameState: CpS, номинал монеты, покупки (×1/×10/×100/MAX), пассивный и
    офлайн-доход, онбординг; `attachRun(sim)` зачисляет награды забега и передаёт модификаторы.
  - `Economy` (цены как геометрический ряд, вехи, CpS), `Upgrades` (тиры → `RunModifiers`), `Offline`.
  - M4: `Town` (цены построек, эффекты по уровням, туман от маяка), `Journal` (встречи, полные записи,
    бонус), `Achievements` (тиры по показателям `statValue`, множитель дохода), `Newspaper` (день по
    времени платформы, серия, награда, заголовки по seed дня), `Hints` (`HintWatcher`: «впервые
    случилось» → `session.queueHint`; очередь `takeHint`, показанные — в `state.hints`).
  - Сессия ведёт `state.world` (биом, путь, круг, побеждённые боссы) по забегу; Погружение
    возвращает путь на побережье, городок/дневник/достижения остаются. Общий множитель дохода =
    тёмные звёзды × достижения; городок и дневник — через `RunModifiers`.
- Забег (детерминирован по seed):
  - `RunSim` — оркестратор: шаг симуляции, столкновения, награды, события в `bus`, rebase мира;
    в M3 — рассудок и Прозрение, иллюзии/скрытые препятствия, пикапы и страницы, Эссенция и сундуки,
    Пробуждение, кот, модификаторы фазы. Игровые броски — отдельный `Rng` (`luck`), трасса — свой.
    В M4 — путь по биому (`biomeProgressM`), мини-боссы (`Track.spawnElite`), бой с боссом
    (`bossExposure()` — подлёт в зону вспышки, волны-препятствия с `vx`, призыв тварей, уход по таймеру),
    смена биома `setBiome` (новая `Track` с того же курсора) и круги. «Крот» (`burrowed`) неуязвим и
    безвреден под землёй; `blinker` перескакивает между землёй и высотой.
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
- M3-отрисовка: `render/CatView.ts`, `render/MetaFx.ts` (`AwakeningFx` — щупальца и свечение,
  `Distortion` — фильтры камеры Phaser 4: смещение по шуму, цветовая матрица, виньетка),
  `render/ui/MetaHud.ts` (фаза, валюты, рассудок, глубина, страницы, Пробуждение, кнопка гримуара),
  `render/ui/effects.ts` (описание эффектов узлов из конфига), плейсхолдеры `placeholders/meta.ts`.
- Админ-панель: `scenes/DebugScene.ts` (шестерёнка справа под страницами) — валюты, рассудок,
  Пробуждение, страницы и сон, кот, принудительная фаза (`session.forcedPhase`), мир (босс сейчас,
  следующий биом, мини-босс, газета, дневник +10, подсказки заново), офлайн 2 ч, скорость ×1/×3/×8
  (подшаги `RunScene.debugTimeScale`), «меньше искажений», сброс прогресса (двойное нажатие).
  Включена в dev и по `?debug=1` (`debug/flags.ts`); TODO(M5): вырезать из сборок для порталов.
- Предметы и значки M3 — листы `meta_items.json` (+ `meta_ring.json`) → `propParts.json`,
  `meta_icons.json` → `uiParts.json`; части вырезаются прямоугольником `box` (пар у чая отдельно от чашки).
- Пробуждение: `awaken.json` (3 прямых щупальца, основание слева) → `fxParts.json`; `AwakeningFx`
  натягивает их на `Rope` и гнёт по точкам. Свет — `awaken_light_{a,b}.json` (luma): сигил в небе,
  свечение из щелей настила, искры. Без растра — старые цепочки `TentacleChain`.
- Кот: `render/CatView.ts` берёт риг `assets-src/rigs/cat.generated.json` (сгенерированные части,
  `assets-src/generated/cat.json`), иначе — векторный плейсхолдер.
- Сцены M3: `GrimoireScene` (гримуар + окно Погружения со знамениями), `DreamScene` (сон; забег на паузе,
  `RunScene.wakeUp()` возвращает его). Лавка получила вкладку «Кот».
- M4-отрисовка: твари леса/города и боссы — `RigCreatureView` по ригам `assets-src/rigs/<тварь>.json`
  (части-плейсхолдеры `placeholders/creatures.ts`; у частей `swing`/`pulse`/`flip`, у «крота» `burrow` —
  холмик); мини-босс — масштаб `e.scale` и ореол. Фоны биомов — `placeholders/biomes.ts`, смена биома —
  `RunScene.crossfadeBiome` (две `Parallax` с `setFade`). HUD: путь до босса / здоровье и таймер босса,
  кнопки «Городок», «Дневник». `UIScene`: подсказки из очереди сессии, всплывашки (достижения, записи),
  окно «Утренний вестник» (после онбординга, время — `platform.getServerTime()`).
- Графика M4 (Seedream 5 Pro): фоны `forest.json`/`sunken.json`/`ground_m4.json` (там же `town_bg`) через
  `build-bg`; твари — по листу на тварь (`cultist`, `eyebush`, `cube`, `firefly`, `rootcrawler` + холмик,
  `polyp`, `jelly`, `priest`) и боссы (`reef`, `mother`, `sleeper`) через `build-parts` → `enemyParts.json`;
  препятствия и волны — `props_forest.json`/`props_sunken.json`, постройки — `town.json` → `propParts.json`.
  Риги сгенерированных частей — `assets-src/rigs/<тварь>.generated.json` (выбираются, если загрузился
  ключевой растр; иначе — плейсхолдерный риг). Хитбоксы препятствий/волн подогнаны под рисунок.
- Интерфейс v2 (листы `ui2_*.json`, сгенерированы пользователем): `render/ui/skin.json` — срезы nine-slice.
  `Button`: латунь для основной кнопки (`fill: lanternAmber`), деревянная доска для остальных (светлый текст),
  круглый значок — латунный иллюминатор; `addStrip`/`fitStrip` — горизонтальные полосы (свиток подсказок,
  лента заголовка, плашка всплывашек, строка лавки). `render/ui/Bar.ts` — шкала: рамка-бревно и
  тонируемая заливка (рассудок, Пробуждение, путь/босс). Гримуар — печати (`ui_seal`/`ui_wax`/
  `ui_seal_locked`), дневник — карточки `ui_card`, газета — `ui_newspaper`. Без растра — векторные варианты.
- Сцены M4: `TownScene` (панорама утёса `placeholders/town.ts`, туман тает с маяком, карточка постройки),
  `JournalScene` (бестиарий: зарисовки — портреты тварей `createCreaturePortrait` с тонировкой,
  незнакомые — силуэты; «Поделиться» — `RenderTexture` → PNG → `render/ui/share.ts`: Web Share API или
  скачивание; вкладка достижений). Окна гримуара/городка/дневника открываются по одному.
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
- Сохранения v2 (M3): Эссенция, сардинки, тёмные звёзды, глубина, знамение, гримуар, кот; миграция 1→2.
- Сохранения v3 (M4): подсказки, мир (биом/путь/круг/боссы/биомы), городок, дневник, достижения, газета,
  новые счётчики статистики; миграция 2→3 (общий пробег = лучшая дистанция).
- Новые поля сохранения: поднять `SAVE_VERSION`, добавить миграцию и тест (`tests/save.test.ts`).
- Сжатие сохранений (lz-string) не подключено: пакета нет в SPEC §2 — нужно согласование.
- Новые npm-зависимости — только из SPEC §2, остальные — после согласования с пользователем.
- CI: `.github/workflows/ci.yml` — lint → test → build → деплой на GitHub Pages при пуше в `main`.
