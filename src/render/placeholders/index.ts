import { runConfig } from '../../config';
import { coastBackgroundArt } from './backgrounds';
import { enemyArt } from './enemies';
import { heroArt } from './hero';
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
    ...coastBackgroundArt(runConfig.world.groundY),
  ];
}
