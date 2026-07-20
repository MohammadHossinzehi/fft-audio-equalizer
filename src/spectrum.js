import { fft, hannWindow, nextPowerOfTwo, isPowerOfTwo } from './fft.js';

// Turns a raw time-domain audio frame into a display-ready magnitude
// spectrum: window the frame, zero-pad to a power of two, run the
// from-scratch FFT, convert to dB, and (optionally) resample the
// linear-frequency bins onto a logarithmic axis for display, since
// human hearing and most spectrum analyzers are log-frequency.

export function magnitudeSpectrumDb(samples, { minDb = -100 } = {}) {
  const n = isPowerOfTwo(samples.length)
    ? samples.length
    : nextPowerOfTwo(samples.length);

  const window = hannWindow(samples.length);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < samples.length; i++) {
    re[i] = samples[i] * window[i];
  }
  // Remaining entries up to n stay zero (zero-padding).

  fft(re, im);

  const bins = n / 2;
  const magsDb = new Float64Array(bins);
  // Coherent gain of a Hann window is 0.5, so normalize by n/2 to keep
  // magnitude roughly independent of FFT size.
  const norm = n / 2;
  for (let k = 0; k < bins; k++) {
    const mag = Math.hypot(re[k], im[k]) / norm;
    const db = 20 * Math.log10(Math.max(mag, 1e-12));
    magsDb[k] = Math.max(db, minDb);
  }
  return magsDb;
}

export function binToFrequency(bin, fftSize, sampleRate) {
  return (bin * sampleRate) / fftSize;
}

// Map magnitude bins (linear frequency spacing) onto `outBins` buckets
// spaced logarithmically between minFreq and maxFreq, averaging any
// linear bins that fall in each log bucket. This is what makes a
// spectrum analyzer display look like the ones in real audio software.
export function toLogFrequencyBuckets(
  magsDb,
  fftSize,
  sampleRate,
  outBins,
  minFreq = 20,
  maxFreq = sampleRate / 2
) {
  const result = new Float64Array(outBins);
  const logMin = Math.log10(minFreq);
  const logMax = Math.log10(maxFreq);

  for (let i = 0; i < outBins; i++) {
    const f0 = Math.pow(10, logMin + (i / outBins) * (logMax - logMin));
    const f1 = Math.pow(10, logMin + ((i + 1) / outBins) * (logMax - logMin));
    const bin0 = Math.max(0, Math.floor((f0 * fftSize) / sampleRate));
    const bin1 = Math.min(magsDb.length - 1, Math.ceil((f1 * fftSize) / sampleRate));

    if (bin1 <= bin0) {
      const bin = Math.min(bin0, magsDb.length - 1);
      result[i] = magsDb[bin];
      continue;
    }
    let sum = 0;
    let count = 0;
    for (let b = bin0; b <= bin1; b++) {
      sum += magsDb[b];
      count++;
    }
    result[i] = sum / count;
  }
  return result;
}
