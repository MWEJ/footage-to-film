import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileTitle, nextFilmPath, previewRate } from './names';

const have = (...files: string[]) => (p: string) => files.includes(p);

test('the first render gets the plain name', () => {
  assert.equal(nextFilmPath('/f', 'Maya', have()), '/f/Maya.mp4');
});

test('later renders are numbered and never overwrite an earlier one', () => {
  assert.equal(nextFilmPath('/f', 'Maya', have('/f/Maya.mp4')), '/f/Maya (render 2).mp4');
  assert.equal(nextFilmPath('/f', 'Maya', have('/f/Maya.mp4', '/f/Maya (render 2).mp4')), '/f/Maya (render 3).mp4');
});

test('replace gives the plain name even when it exists', () => {
  assert.equal(nextFilmPath('/f', 'Maya', have('/f/Maya.mp4'), true), '/f/Maya.mp4');
});

test('characters a file name cannot hold are replaced', () => {
  assert.equal(fileTitle('Mum/Dad: 50 years'), 'Mum Dad 50 years');
  assert.equal(fileTitle('  '), 'Film');
  assert.equal(fileTitle('Ærø — sommer 2026'), 'Ærø — sommer 2026');
  assert.equal(nextFilmPath('/f', 'Mum/Dad: 50 years', have()), '/f/Mum Dad 50 years.mp4');
});

test('a preview fits in 24 MB whatever the film length', () => {
  assert.deepEqual(previewRate(12), { video: 4_000_000, side: 720 }); // a short film is capped, not inflated
  const threeMinutes = previewRate(180);
  assert.ok(((threeMinutes.video + 128_000) * 180) / 8 <= 24_000_000 && threeMinutes.side === 720);
  assert.equal(previewRate(300).side, 540);
});
