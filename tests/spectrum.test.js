import test from 'node:test';
import assert from 'node:assert/strict';
import { magnitudeSpectrumDb, binToFrequency, toLogFrequencyBuckets } from '../src/spectrum.js';

test('binToFrequency maps bin 0 to 0Hz and scales linearly', () => {
  assert.equal(binToFrequency(0, 1024, 44100), 0);
  assert.ok(Math.abs(binToFrequency(512, 1024, 44100) - 22050) < 1e-9);
});

test('a pure tone produces a clear peak near its true frequency', () => {
  const sr = 44100;
  const freq = 1000;
  const n = 2048;
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    samples[i] = Math.sin((2 * Math.PI * freq * i) / sr);
  }
  const magsDb = magnitudeSpectrumDb(samples);
  let peakBin = 0;
  for (let i = 1; i < magsDb.length; i++) {
    if (magsDb[i] > magsDb[peakBin]) peakBin = i;
  }
  const peakFreq = binToFrequency(peakBin, n, sr);
  assert.ok(Math.abs(peakFreq - freq) < (sr / n) * 2, `expected peak near ${freq}Hz, got ${peakFreq}Hz`);
});

test('toLogFrequencyBuckets produces the requested number of buckets and stays within range', () => {
  const sr = 44100;
  const n = 2048;
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) samples[i] = Math.sin((2 * Math.PI * 300 * i) / sr);
  const magsDb = magnitudeSpectrumDb(samples);
  const buckets = toLogFrequencyBuckets(magsDb, n, sr, 64);
  assert.equal(buckets.length, 64);
  for (const v of buckets) {
    assert.ok(v >= -100 - 1e-9 && v <= 0 + 1e-6);
  }
});
