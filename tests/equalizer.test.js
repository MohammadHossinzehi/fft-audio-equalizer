import test from 'node:test';
import assert from 'node:assert/strict';
import { Equalizer } from '../src/equalizer.js';

test('equalizer with all bands at 0dB is close to unity across the band', () => {
  const sr = 44100;
  const eq = new Equalizer(sr);
  for (const freq of [50, 200, 1000, 4000, 10000]) {
    const gainDb = 20 * Math.log10(eq.magnitudeAt(freq));
    assert.ok(Math.abs(gainDb) < 1.5, `expected near-unity at ${freq}Hz, got ${gainDb}dB`);
  }
});

test('setGain changes the composite response at that band', () => {
  const sr = 44100;
  const eq = new Equalizer(sr);
  const before = eq.magnitudeAt(1000);
  eq.setGain(2, 12); // the 1000 Hz peaking band
  const after = eq.magnitudeAt(1000);
  assert.ok(after > before * 3, `expected a large boost near 1000Hz, before=${before} after=${after}`);
});

test('processBuffer runs samples through every band without throwing', () => {
  const sr = 44100;
  const eq = new Equalizer(sr);
  eq.setGain(1, 6);
  eq.setGain(3, -6);
  const input = new Float32Array(512).map((_, i) => Math.sin((2 * Math.PI * 440 * i) / sr));
  const output = eq.processBuffer(input);
  assert.equal(output.length, input.length);
  assert.ok(output.every((v) => Number.isFinite(v)));
});
