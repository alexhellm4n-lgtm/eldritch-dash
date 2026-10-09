import { runConfig } from '../../config';
import { coastBackgroundArt } from './backgrounds';
import { forestBackgroundArt, sunkenBackgroundArt } from './biomes';
import { creatureArt } from './creatures';
import { townArt } from './town';
import { enemyArt } from './enemies';
import { heroArt } from './hero';
import { metaArt } from './meta';
import { propArt } from './props';
import type { PlaceholderArt } from './svg';

export type { PlaceholderArt } from './svg';
export { toDataUri } from './svg';

/** Все программные плейсхолдеры. Ключи совпадают с будущими файлами из assets-src/ (SPEC §8.4). */
export function allPlaceholderArt(): PlaceholderArt[] {
  return [
    ...heroArt(),
    ...enemyArt(),
    ...propArt(),
    ...metaArt(),
    ...creatureArt(),
    ...townArt(),
    ...coastBackgroundArt(runConfig.world.groundY),
    ...forestBackgroundArt(runConfig.world.groundY),
    ...sunkenBackgroundArt(runConfig.world.groundY),
  ];
}
