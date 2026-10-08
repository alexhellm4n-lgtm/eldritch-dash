import runJson from './run.json';
import economyJson from './economy.json';
import enemiesJson from './enemies.json';
import biomesJson from './biomes.json';
import juiceJson from './juice.json';
import upgradesJson from './upgrades.json';
import sanityJson from './sanity.json';
import starsJson from './stars.json';
import dreamJson from './dream.json';
import catJson from './cat.json';
import grimoireJson from './grimoire.json';
import type {
  BiomeConfig,
  EconomyConfig,
  EnemyConfig,
  JuiceConfig,
  RunConfig,
  UpgradesConfig,
  SanityConfig,
  StarsConfig,
  DreamConfig,
  CatConfig,
  GrimoireConfig,
} from './types';

// JSON выводится с широкими типами (string вместо union, number[] вместо кортежей),
// поэтому приводим явно; корректность значений проверяет tests/config.test.ts.
export const runConfig: RunConfig = runJson;
export const economyConfig = economyJson as unknown as EconomyConfig;
export const enemiesConfig = enemiesJson as Record<string, EnemyConfig>;
export const biomesConfig = biomesJson as unknown as Record<string, BiomeConfig>;
export const juiceConfig: JuiceConfig = juiceJson;
export const upgradesConfig: UpgradesConfig = upgradesJson;
export const sanityConfig: SanityConfig = sanityJson;
export const starsConfig: StarsConfig = starsJson;
export const dreamConfig = dreamJson as unknown as DreamConfig;
export const catConfig: CatConfig = catJson;
export const grimoireConfig = grimoireJson as unknown as GrimoireConfig;

export * from './types';
