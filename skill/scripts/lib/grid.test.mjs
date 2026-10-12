import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gridFilter } from './grid.mjs';

test('the grid has ten cells each way, numbered lines, yellow middles and a label', () => {
  const f = gridFilter('land 2.00 s');
  assert.match(f, /^drawgrid=w=iw\/10:h=ih\/10:t=1:c=white@0\.45,/);
  assert.equal((f.match(/drawbox=/g) ?? []).length, 2); // the two middle lines
  assert.equal((f.match(/drawtext=/g) ?? []).length, 19); // .1 to .9 along the top and down the left, and the label
  assert.match(f, /text='\.3':x=w\*0\.3\+3:y=3/);
  assert.match(f, /text='\.7':x=3:y=h\*0\.7\+3/);
  assert.match(f, /text='land 2\.00 s'/);
});

test('a label cannot break the filter', () => {
  assert.match(gridFilter("IMG_1's, clip: 50%"), /text='IMG_1s clip 50'/);
});
