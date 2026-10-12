import { test } from 'node:test';
import assert from 'node:assert/strict';
import { theme } from '../theme';
import { panelRow } from './panelRow';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} is not ${b}`);

test('panelRow lays clips and photos side by side, arriving one after another and ending together', () => {
  const s = theme.motion.stagger;
  const layers = panelRow({ a: 8, d: 2, area: [0, 0, 1920, 1080], panels: [{ clip: 'a', in: 1, speed: 0.5 }, { photo: 'p' }, { clip: 'b', in: 3 }] });
  assert.deepEqual(layers.map((l) => l.kind), ['shot', 'photo', 'shot']);
  layers.forEach((l, i) => {
    near(l.a, 8 + s * i);
    near(l.a + l.d, 10);
    if (l.kind === 'el' || l.kind === 'sfx') return;
    assert.equal(l.rect[1], 0);
    assert.equal(l.rect[3], 1080);
    assert.equal(l.free ?? false, i > 0 && s > 0); // only the first panel has to be on the beat
    assert.equal(l.reveal, 'up');
  });
  const [p0, p1, p2] = layers.map((l) => (l.kind === 'el' || l.kind === 'sfx' ? [0, 0, 0, 0] : l.rect));
  assert.equal(p0[0], 0);
  assert.ok(p1[0] > p0[0] + p0[2] && p2[0] > p1[0] + p1[2], 'panels do not touch');
  assert.equal(p2[0] + p2[2], 1920);
});

test('panelRow checks its weights and refuses an empty row', () => {
  assert.throws(() => panelRow({ a: 0, d: 1, panels: [] }), /panelRow: panels is empty/);
  assert.throws(() => panelRow({ a: 0, d: 1, panels: [{ photo: 'p' }], weights: [1, 2] }), /panelRow: 1 panels but 2 weights/);
});

test('panelRow can stack its panels as rows, for a tall frame', () => {
  const layers = panelRow({ a: 0, d: 2, area: [0, 0, 1080, 1920], direction: 'rows', panels: [{ clip: 'a', in: 0 }, { photo: 'p' }] });
  const [top, bottom] = layers.map((l) => (l.kind === 'el' || l.kind === 'sfx' ? [0, 0, 0, 0] : l.rect));
  assert.equal(top[0], 0);
  assert.equal(top[2], 1080);
  assert.equal(top[1], 0);
  assert.ok(bottom[1] > top[1] + top[3], 'the second panel is below the first, with a gutter');
  assert.equal(bottom[1] + bottom[3], 1920);
});
