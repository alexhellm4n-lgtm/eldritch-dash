import { describe, expect, it } from 'vitest';

const sources = import.meta.glob<string>('../src/{systems,core}/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('архитектура', () => {
  it('systems/ и core/ не импортируют Phaser (SPEC §3)', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(0);
    for (const [file, code] of Object.entries(sources)) {
      expect(code, file).not.toMatch(/from\s+['"]phaser['"]/);
    }
  });
});
