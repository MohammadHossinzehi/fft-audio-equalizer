// Radix-2 iterative Cooley-Tukey FFT (in-place), operating on parallel
// Float64Array buffers for real and imaginary parts. Length must be a
// power of two.
//
// This is the classic decimation-in-time algorithm: bit-reverse the
// input order, then combine spectra of size 1 into size 2, size 2 into
// size 4, and so on up to N, using precomputed twiddle factors at each
// stage so no trigonometric functions are evaluated inside the hot loop.

export function isPowerOfTwo(n) {
  return n > 0 && (n & (n - 1)) === 0;
}

export function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function bitReverseInPlace(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
}

function transform(re, im, inverse) {
  const n = re.length;
  if (n === 0) return;
  if (!isPowerOfTwo(n)) {
    throw new Error(`fft: length must be a power of two, got ${n}`);
  }
  if (im.length !== n) {
    throw new Error('fft: re and im must have the same length');
  }

  bitReverseInPlace(re, im);

  const sign = inverse ? 1 : -1;
  for (let size = 2; size <= n; size *= 2) {
    const half = size / 2;
    const angleStep = (sign * 2 * Math.PI) / size;
    // Precompute twiddle factors for this stage.
    const twRe = new Float64Array(half);
    const twIm = new Float64Array(half);
    for (let k = 0; k < half; k++) {
      const angle = angleStep * k;
      twRe[k] = Math.cos(angle);
      twIm[k] = Math.sin(angle);
    }
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const evenIdx = start + k;
        const oddIdx = start + k + half;
        const tRe = re[oddIdx] * twRe[k] - im[oddIdx] * twIm[k];
        const tIm = re[oddIdx] * twIm[k] + im[oddIdx] * twRe[k];
        re[oddIdx] = re[evenIdx] - tRe;
        im[oddIdx] = im[evenIdx] - tIm;
        re[evenIdx] += tRe;
        im[evenIdx] += tIm;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

export function fft(re, im) {
  transform(re, im, false);
}

export function ifft(re, im) {
  transform(re, im, true);
}

// Slow O(n^2) reference DFT, used only in tests to check fft() against
// a ground truth that is implemented completely differently.
export function dftReference(re, im) {
  const n = re.length;
  const outRe = new Float64Array(n);
  const outIm = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    let sumRe = 0;
    let sumIm = 0;
    for (let t = 0; t < n; t++) {
      const angle = (-2 * Math.PI * k * t) / n;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      sumRe += re[t] * cos - im[t] * sin;
      sumIm += re[t] * sin + im[t] * cos;
    }
    outRe[k] = sumRe;
    outIm[k] = sumIm;
  }
  return [outRe, outIm];
}

export function hannWindow(n) {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  }
  return w;
}
