import runJson from './run.json';
import economyJson from './economy.json';
import enemiesJson from './enemies.json';
import biomesJson from './biomes.json';
import juiceJson from './juice.json';
import upgradesJson from './upgrades.json';
import type {
  BiomeConfig,
  EconomyConfig,
  EnemyConfig,
  JuiceConfig,
  RunConfig,
  UpgradesConfig,
} from './types';

// JSON выводится с широкими типами (string вместо union, number[] вместо кортежей),
// поэтому приводим явно; корректность значений проверяет tests/config.test.ts.
export const runConfig: RunConfig = runJson;
export const economyConfig: EconomyConfig = economyJson;
export const enemiesConfig = enemiesJson as Record<string, EnemyConfig>;
export const biomesConfig = biomesJson as unknown as Record<string, BiomeConfig>;
export const juiceConfig: JuiceConfig = juiceJson;
export const upgradesConfig: UpgradesConfig = upgradesJson;

export * from './types';
