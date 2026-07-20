// Biquad filter coefficient design, following Robert Bristow-Johnson's
// "Audio EQ Cookbook" formulas, plus a Filter class that applies the
// resulting difference equation to a stream of samples via the
// Direct Form I Transposed structure (numerically stable, one
// multiply-add per coefficient per sample).

function designCoefficients(type, sampleRate, freq, q, gainDb = 0) {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * freq) / sampleRate;
  const cosW0 = Math.cos(w0);
  const sinW0 = Math.sin(w0);
  const alpha = sinW0 / (2 * q);

  let b0, b1, b2, a0, a1, a2;

  switch (type) {
    case 'lowpass':
      b0 = (1 - cosW0) / 2;
      b1 = 1 - cosW0;
      b2 = (1 - cosW0) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosW0;
      a2 = 1 - alpha;
      break;
    case 'highpass':
      b0 = (1 + cosW0) / 2;
      b1 = -(1 + cosW0);
      b2 = (1 + cosW0) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosW0;
      a2 = 1 - alpha;
      break;
    case 'peaking':
      b0 = 1 + alpha * A;
      b1 = -2 * cosW0;
      b2 = 1 - alpha * A;
      a0 = 1 + alpha / A;
      a1 = -2 * cosW0;
      a2 = 1 - alpha / A;
      break;
    case 'lowshelf': {
      const sqrtA = Math.sqrt(A);
      const beta = 2 * sqrtA * alpha;
      b0 = A * ((A + 1) - (A - 1) * cosW0 + beta);
      b1 = 2 * A * ((A - 1) - (A + 1) * cosW0);
      b2 = A * ((A + 1) - (A - 1) * cosW0 - beta);
      a0 = (A + 1) + (A - 1) * cosW0 + beta;
      a1 = -2 * ((A - 1) + (A + 1) * cosW0);
      a2 = (A + 1) + (A - 1) * cosW0 - beta;
      break;
    }
    case 'highshelf': {
      const sqrtA = Math.sqrt(A);
      const beta = 2 * sqrtA * alpha;
      b0 = A * ((A + 1) + (A - 1) * cosW0 + beta);
      b1 = -2 * A * ((A - 1) + (A + 1) * cosW0);
      b2 = A * ((A + 1) + (A - 1) * cosW0 - beta);
      a0 = (A + 1) - (A - 1) * cosW0 + beta;
      a1 = 2 * ((A - 1) - (A + 1) * cosW0);
      a2 = (A + 1) - (A - 1) * cosW0 - beta;
      break;
    }
    default:
      throw new Error(`biquad: unknown filter type "${type}"`);
  }

  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  };
}

export class BiquadFilter {
  constructor(type, sampleRate, freq, q = Math.SQRT1_2, gainDb = 0) {
    this.reconfigure(type, sampleRate, freq, q, gainDb);
    this.z1 = 0;
    this.z2 = 0;
  }

  reconfigure(type, sampleRate, freq, q = Math.SQRT1_2, gainDb = 0) {
    this.coeffs = designCoefficients(type, sampleRate, freq, q, gainDb);
  }

  reset() {
    this.z1 = 0;
    this.z2 = 0;
  }

  // Direct Form I Transposed: process one sample, return filtered sample.
  processSample(x) {
    const { b0, b1, b2, a1, a2 } = this.coeffs;
    const y = b0 * x + this.z1;
    this.z1 = b1 * x - a1 * y + this.z2;
    this.z2 = b2 * x - a2 * y;
    return y;
  }

  processBuffer(input, output = new Float32Array(input.length)) {
    for (let i = 0; i < input.length; i++) {
      output[i] = this.processSample(input[i]);
    }
    return output;
  }

  // Evaluate the filter's frequency response |H(f)| analytically (used
  // by tests and could drive a Bode-plot UI), without running any
  // samples through the filter.
  magnitudeAt(sampleRate, freq) {
    const { b0, b1, b2, a1, a2 } = this.coeffs;
    const w = (2 * Math.PI * freq) / sampleRate;
    const cos1 = Math.cos(w);
    const cos2 = Math.cos(2 * w);
    const sin1 = Math.sin(w);
    const sin2 = Math.sin(2 * w);

    const numRe = b0 + b1 * cos1 + b2 * cos2;
    const numIm = -b1 * sin1 - b2 * sin2;
    const denRe = 1 + a1 * cos1 + a2 * cos2;
    const denIm = -a1 * sin1 - a2 * sin2;

    const numMag = Math.hypot(numRe, numIm);
    const denMag = Math.hypot(denRe, denIm);
    return numMag / denMag;
  }
}
