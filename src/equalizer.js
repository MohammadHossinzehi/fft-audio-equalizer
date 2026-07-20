import { BiquadFilter } from './biquad.js';

// A multi-band parametric equalizer: a chain of peaking-filter bands
// plus fixed low/high shelves at the ends, each independently
// adjustable in center frequency, gain, and Q. Samples are pushed
// through every band's biquad in series, one after another.

const DEFAULT_BANDS = [
  { type: 'lowshelf', freq: 100, q: 0.71, gainDb: 0 },
  { type: 'peaking', freq: 300, q: 1, gainDb: 0 },
  { type: 'peaking', freq: 1000, q: 1, gainDb: 0 },
  { type: 'peaking', freq: 3000, q: 1, gainDb: 0 },
  { type: 'highshelf', freq: 8000, q: 0.71, gainDb: 0 },
];

export class Equalizer {
  constructor(sampleRate, bands = DEFAULT_BANDS) {
    this.sampleRate = sampleRate;
    this.bands = bands.map(
      (b) => new BiquadFilter(b.type, sampleRate, b.freq, b.q, b.gainDb)
    );
    this.bandSpecs = bands.map((b) => ({ ...b }));
  }

  setGain(bandIndex, gainDb) {
    const spec = this.bandSpecs[bandIndex];
    spec.gainDb = gainDb;
    this.bands[bandIndex].reconfigure(spec.type, this.sampleRate, spec.freq, spec.q, gainDb);
  }

  processBuffer(input) {
    let output = input;
    for (const band of this.bands) {
      output = band.processBuffer(output, new Float32Array(output.length));
    }
    return output;
  }

  // Composite frequency response of the whole chain, used to draw the
  // EQ curve overlay on the spectrum canvas.
  magnitudeAt(freq) {
    let mag = 1;
    for (const band of this.bands) {
      mag *= band.magnitudeAt(this.sampleRate, freq);
    }
    return mag;
  }

  reset() {
    for (const band of this.bands) band.reset();
  }
}
