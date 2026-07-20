import test from 'node:test';
import assert from 'node:assert/strict';
import { fft, ifft, dftReference, isPowerOfTwo, nextPowerOfTwo } from '../src/fft.js';

function randomSignal(n, seed = 1) {
  // Small deterministic PRNG so test failures are reproducible.
  let s = seed;
  const next = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s / 0x7fffffff) * 2 - 1;
  };
  const re = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = next();
  return re;
}

test('isPowerOfTwo / nextPowerOfTwo', () => {
  assert.equal(isPowerOfTwo(1), true);
  assert.equal(isPowerOfTwo(2), true);
  assert.equal(isPowerOfTwo(3), false);
  assert.equal(isPowerOfTwo(1024), true);
  assert.equal(nextPowerOfTwo(1), 1);
  assert.equal(nextPowerOfTwo(5), 8);
  assert.equal(nextPowerOfTwo(1024), 1024);
  assert.equal(nextPowerOfTwo(1025), 2048);
});

test('fft matches brute-force DFT reference on random signals', () => {
  for (const n of [2, 4, 8, 16, 64, 256]) {
    const re = randomSignal(n, n + 1);
    const im = new Float64Array(n);
    const [refRe, refIm] = dftReference(re, im);

    const fftRe = Float64Array.from(re);
    const fftIm = Float64Array.from(im);
    fft(fftRe, fftIm);

    for (let k = 0; k < n; k++) {
      assert.ok(
        Math.abs(fftRe[k] - refRe[k]) < 1e-8,
        `re mismatch at n=${n}, k=${k}: ${fftRe[k]} vs ${refRe[k]}`
      );
      assert.ok(
        Math.abs(fftIm[k] - refIm[k]) < 1e-8,
        `im mismatch at n=${n}, k=${k}: ${fftIm[k]} vs ${refIm[k]}`
      );
    }
  }
});

test('ifft(fft(x)) recovers the original signal', () => {
  const n = 128;
  const re = randomSignal(n, 42);
  const im = new Float64Array(n);
  const originalRe = Float64Array.from(re);
  const originalIm = Float64Array.from(im);

  fft(re, im);
  ifft(re, im);

  for (let i = 0; i < n; i++) {
    assert.ok(Math.abs(re[i] - originalRe[i]) < 1e-9);
    assert.ok(Math.abs(im[i] - originalIm[i]) < 1e-9);
  }
});

test('a pure sine tone produces energy only at its own bin', () => {
  const n = 256;
  const k = 10; // target bin
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    re[i] = Math.sin((2 * Math.PI * k * i) / n);
  }
  fft(re, im);

  const mags = Array.from({ length: n }, (_, i) => Math.hypot(re[i], im[i]));
  const peakBin = mags.indexOf(Math.max(...mags));
  // Energy should show up at bin k and its mirror n-k.
  assert.ok(peakBin === k || peakBin === n - k, `expected peak at ${k}, got ${peakBin}`);
});

test('rejects non-power-of-two lengths', () => {
  const re = new Float64Array(6);
  const im = new Float64Array(6);
  assert.throws(() => fft(re, im), /power of two/);
});
