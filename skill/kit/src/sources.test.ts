import { test } from 'node:test';
import assert from 'node:assert/strict';
import { photoFor, pickFile, type ClipFile, type PhotoFile } from './sources';

const CLIPS: Record<string, ClipFile[]> = {
  '5608': [{ file: '5608_P_011.0-031.0.mp4', tier: 'P', a: 11, b: 31, fps: 60, w: 1080, h: 1920, audio: true }],
  '5592': [
    { file: '5592_P_000.0-005.9.mp4', tier: 'P', a: 0, b: 5.9, fps: 60, w: 1080, h: 1920, audio: true },
    { file: '5592_F_000.0-003.2.mp4', tier: 'F', a: 0, b: 3.2, fps: 60, w: 2160, h: 3840, audio: true },
  ],
  '5442': [{ file: '5442_P_000.0-007.6.mp4', tier: 'P', a: 0, b: 7.6, fps: 60, w: 1080, h: 1920, audio: true }],
};
const PHOTOS: Record<string, PhotoFile> = { IMG_1: { file: 'IMG_1.jpg', w: 2160, h: 2880 }, IMG_2: { file: 'IMG_2.jpg', w: 2880, h: 2160 } };

test('pickFile returns the file that covers the shot', () => {
  assert.equal(pickFile(CLIPS, '5608', 11.0, 1.9, 1, false).file, '5608_P_011.0-031.0.mp4');
});

test('full prefers the full-resolution tier when it covers the range', () => {
  assert.equal(pickFile(CLIPS, '5592', 2.0, 1, 0.5, true).tier, 'F');
});

test('full falls back to another tier when the full-resolution file is too short', () => {
  assert.equal(pickFile(CLIPS, '5592', 4.0, 1, 1, true).tier, 'P');
});

test('speed scales how much source a shot needs', () => {
  assert.equal(pickFile(CLIPS, '5442', 6.2, 2, 0.5, false).file, '5442_P_000.0-007.6.mp4');
  assert.throws(() => pickFile(CLIPS, '5442', 6.2, 2, 1, false), /no converted file covers clip 5442 from 6\.20 to 8\.20 s \(have: P 0-7\.6\)/);
});

test('a range that was never exported names the clip and what exists', () => {
  assert.throws(() => pickFile(CLIPS, '5608', 5, 1, 1, false), /no converted file covers clip 5608 from 5\.00 to 6\.00 s \(have: P 11-31\)/);
});

test('an unknown clip id is an error that lists the clips', () => {
  // JavaScript lists keys that look like whole numbers in ascending order
  assert.throws(() => pickFile(CLIPS, '0000', 0, 1, 1, false), /unknown clip 0000 \(have: 5442, 5592, 5608\)/);
});

test('photoFor finds a photo, and an unknown name lists the photos', () => {
  assert.equal(photoFor(PHOTOS, 'IMG_2').w, 2880);
  assert.throws(() => photoFor(PHOTOS, 'IMG_9'), /unknown photo IMG_9 \(have: IMG_1, IMG_2\)/);
});
