import test from 'node:test';
import assert from 'node:assert/strict';
import { BiquadFilter } from '../src/biquad.js';

test('lowpass filter passes DC and attenuates far above cutoff', () => {
  const sr = 44100;
  const filter = new BiquadFilter('lowpass', sr, 1000, Math.SQRT1_2);
  const dcGain = filter.magnitudeAt(sr, 1);
  const highGain = filter.magnitudeAt(sr, 15000);
  assert.ok(dcGain > 0.95, `expected near-unity DC gain, got ${dcGain}`);
  assert.ok(highGain < 0.1, `expected strong attenuation at 15kHz, got ${highGain}`);
});

test('highpass filter attenuates DC and passes high frequencies', () => {
  const sr = 44100;
  const filter = new BiquadFilter('highpass', sr, 1000, Math.SQRT1_2);
  const dcGain = filter.magnitudeAt(sr, 1);
  const highGain = filter.magnitudeAt(sr, 15000);
  assert.ok(dcGain < 0.05, `expected strong DC attenuation, got ${dcGain}`);
  assert.ok(highGain > 0.9, `expected near-unity high gain, got ${highGain}`);
});

test('lowpass magnitude at cutoff is close to the -3dB point', () => {
  const sr = 44100;
  const cutoff = 2000;
  const filter = new BiquadFilter('lowpass', sr, cutoff, Math.SQRT1_2);
  const gain = filter.magnitudeAt(sr, cutoff);
  const gainDb = 20 * Math.log10(gain);
  assert.ok(Math.abs(gainDb - -3) < 1, `expected ~-3dB at cutoff, got ${gainDb}dB`);
});

test('peaking filter boosts at its center frequency and settles to unity far away', () => {
  const sr = 44100;
  const filter = new BiquadFilter('peaking', sr, 1000, 1, 12);
  const centerGainDb = 20 * Math.log10(filter.magnitudeAt(sr, 1000));
  const farGainDb = 20 * Math.log10(filter.magnitudeAt(sr, 30));
  assert.ok(Math.abs(centerGainDb - 12) < 0.5, `expected ~12dB boost, got ${centerGainDb}dB`);
  assert.ok(Math.abs(farGainDb) < 1, `expected ~0dB far from center, got ${farGainDb}dB`);
});

test('peaking filter with a cut settles back to unity far from center', () => {
  const sr = 44100;
  const filter = new BiquadFilter('peaking', sr, 5000, 1, -9);
  const centerGainDb = 20 * Math.log10(filter.magnitudeAt(sr, 5000));
  const farGainDb = 20 * Math.log10(filter.magnitudeAt(sr, 100));
  assert.ok(Math.abs(centerGainDb - -9) < 0.5, `expected ~-9dB cut, got ${centerGainDb}dB`);
  assert.ok(Math.abs(farGainDb) < 1, `expected ~0dB far from center, got ${farGainDb}dB`);
});

test('processSample matches processBuffer for an impulse response', () => {
  const sr = 44100;
  const filter = new BiquadFilter('lowpass', sr, 500, 1);
  const impulse = new Float32Array(16);
  impulse[0] = 1;
  const viaBuffer = filter.processBuffer(impulse);

  filter.reset();
  const viaSample = new Float32Array(16);
  for (let i = 0; i < impulse.length; i++) {
    viaSample[i] = filter.processSample(impulse[i]);
  }

  for (let i = 0; i < impulse.length; i++) {
    assert.ok(Math.abs(viaBuffer[i] - viaSample[i]) < 1e-12);
  }
});
