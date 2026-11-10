import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, playNote, melody, scale, levels } from '../game.js';
test('ten correct notes complete the dance, starting with do', () => {
  let state = newGame();
  assert.equal(state.sequence.length, 10);
  assert.equal(state.sequence[0], 'C4');
  assert.ok(state.sequence.every(note => melody.includes(note)));
  for (const note of state.sequence) state = playNote(state, note);
  assert.equal(state.status, 'won');
  assert.equal(state.step, 10);
  assert.equal(playNote(state, 'F4'), state);
});

test('each level adds exactly one scale note and guarantees practice of it', () => {
  for (let level = 0; level < levels.length; level++) {
    for (const random of [0, .5, .99]) {
      let state = newGame(() => random, level);
      const pool = scale.slice(0, level + 3);
      assert.equal(state.level, level);
      assert.equal(state.sequence.length, 10);
      assert.ok(state.sequence.every(note => pool.includes(note)));
      if (level > 0) assert.ok(state.sequence.includes(pool.at(-1)));
      for (const note of state.sequence) state = playNote(state, note);
      assert.equal(state.status, 'won');
    }
  }
});
test('wrong notes and timeouts accumulate without advancing progress', () => {
  let state = newGame(() => .5);
  state = playNote(state, 'F4');
  state = playNote(state, 'C4');
  state = playNote(state, null);
  assert.equal(state.step, 1);
  assert.equal(state.sequence[state.step], 'D4');
  state = playNote(state, 'G4');
  assert.equal(state.status, 'lost');
  assert.equal(state.mistakes, 3);
  assert.equal(playNote(state, 'D4'), state);
});
test('random choices cover do, re and mi', () => {
  for (const [random, expected] of [[0, 'C4'], [.5, 'D4'], [.99, 'E4']]) {
    const state = newGame(() => random);
    assert.ok(state.sequence.slice(1).every(note => note === expected));
    assert.equal(state.step, 0);
    assert.equal(state.mistakes, 0);
  }
});
