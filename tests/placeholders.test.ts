import { describe, expect, it } from 'vitest';
import { biomesConfig, progressionConfig, townConfig } from '../src/config';
import { allPlaceholderArt } from '../src/render/placeholders';

const rigs = import.meta.glob<{ parts: { key: string }[] }>('../assets-src/rigs/*.json', {
  import: 'default',
  eager: true,
});

describe('плейсхолдеры', () => {
  const keys = new Set(allPlaceholderArt().map((a) => a.key));

  it('ключи не повторяются', () => {
    expect(keys.size).toBe(allPlaceholderArt().length);
  });

  it('у каждого биома — 4 слоя параллакса, земля, туман и все препятствия', () => {
    for (const [id, b] of Object.entries(biomesConfig)) {
      for (let i = 0; i < b.parallax.length; i++)
        expect(keys, `${id} ${i}`).toContain(`bg_${id}_layer${i}`);
      expect(keys).toContain(`ground_${id}`);
      expect(keys).toContain(`fog_${id}`);
      for (const o of Object.keys(b.obstacles)) expect(keys, o).toContain(o);
    }
  });

  it('волны боссов, части ригов и постройки городка нарисованы', () => {
    for (const b of Object.values(progressionConfig.bosses)) expect(keys).toContain(b.wave.key);
    for (const [file, rig] of Object.entries(rigs)) {
      // Риги сгенерированных частей ссылаются на растровые ключи — их проверяет сборка ассетов.
      if (file.includes('.generated.')) continue;
      for (const p of rig.parts) expect(keys, `${file}: ${p.key}`).toContain(p.key);
    }
    for (const b of townConfig.buildings) expect(keys).toContain(`town_${b.id}`);
    expect(keys).toContain('town_bg');
    expect(keys).toContain('town_plot');
    expect(keys).toContain('mound');
  });
});
