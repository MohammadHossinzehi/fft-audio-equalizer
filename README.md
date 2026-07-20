# FFT Audio Spectrum Analyzer & Equalizer

A browser-based audio spectrum analyzer and 5-band parametric equalizer where every piece of signal processing is implemented from scratch: a radix-2 Cooley-Tukey FFT for the spectrum display, and RBJ Audio EQ Cookbook biquad filters for the equalizer, with no `AnalyserNode` and no `BiquadFilterNode` from the Web Audio API.

## Why this exists

Most "spectrum analyzer" demos on the web are five lines of code wrapping `AnalyserNode.getByteFrequencyData()` and a `BiquadFilterNode` chain. That's the right choice for production audio code, but it hides the actual algorithms: an FFT is deriving frequency content from a block of samples, and a biquad filter is a stateful IIR difference equation with coefficients chosen from a closed-form design formula. This project implements both from first principles, wires them into a live microphone/file pipeline, and verifies each piece against known-correct references with automated tests, rather than by eye.

## What it does

- Captures audio from the microphone or a local audio file.
- Runs each frame of samples through a hand-written radix-2 Cooley-Tukey FFT (`src/fft.js`) to compute a magnitude spectrum, which is windowed (Hann), zero-padded to a power of two, and remapped onto a logarithmic frequency axis for display, then drawn to a canvas in real time.
- Filters the same audio through a 5-band parametric equalizer (`src/equalizer.js`) built from RBJ Audio EQ Cookbook biquad filters (`src/biquad.js`): a low shelf, three peaking bands, and a high shelf, each with an interactive gain slider from -24dB to +24dB.
- Plays the equalized audio back so you can hear the effect while watching its spectrum.

## Project structure

```
src/
  fft.js          from-scratch radix-2 FFT/IFFT, brute-force DFT reference, Hann window
  biquad.js        RBJ cookbook biquad coefficient design + Direct Form I Transposed filter
  equalizer.js     chains biquads into a multi-band parametric EQ
  spectrum.js      turns a sample block into a windowed, log-scaled dB spectrum
public/
  index.html       UI: mic/file controls, spectrum canvas, band sliders
  app.js           Web Audio wiring: ScriptProcessorNode -> equalizer -> fft -> canvas
tests/
  fft.test.js
  biquad.test.js
  equalizer.test.js
  spectrum.test.js
```

## How to run it

Requirements: Node.js 18+ for tests, any modern browser with Web Audio API support for the app.

Run the test suite (no dependencies to install; everything uses Node's built-in test runner):

```
npm test
```

Run the app: serve the project root with any static file server (the app uses ES module imports, which most browsers block on `file://`), then open `public/index.html`.

```
npx http-server . -p 8080
# then visit http://localhost:8080/public/
```

Click "Use microphone" (and grant permission) or choose a local audio file, and watch the spectrum. Drag the band sliders to hear and see the equalizer change the signal in real time.

## Design decisions and testing

FFT correctness. The FFT is checked against a completely separate, deliberately slow O(n^2) brute-force DFT (`dftReference`) across several sizes, rather than against itself or a golden file, so a bug that's consistent between "implementation" and "reference" can't hide. Additional tests check that `ifft(fft(x))` recovers the original signal, that a pure sine at an exact bin produces energy only at that bin (and its mirror), and that non-power-of-two input is rejected with a clear error rather than silently producing garbage.

Biquad correctness. Rather than asserting exact coefficient values (fragile, and not really what matters), the tests assert on the filter's actual behavior: a lowpass passes DC and attenuates far above cutoff, a highpass does the reverse, the magnitude at the cutoff frequency for a Q=1/sqrt(2) lowpass is within 1dB of the expected -3dB point, and a peaking filter's boost/cut at its center frequency matches the requested gain while settling back to 0dB far away. `magnitudeAt()` evaluates the filter's transfer function analytically (no samples processed), which is also what would drive a Bode-plot overlay on the spectrum display if one were added.

ScriptProcessorNode over AudioWorklet. `ScriptProcessorNode` is deprecated in the Web Audio spec in favor of `AudioWorkletNode`, and in a production app the latter is the right call since it runs off the main thread. This project uses `ScriptProcessorNode` anyway because it keeps the whole pipeline in one synchronous, easy-to-read file without a separate worklet module and cross-thread message passing, which matches the project's goal of making the DSP legible rather than production-hardening the audio pipeline. Swapping in an `AudioWorkletProcessor` that calls the same `Equalizer`/`spectrum.js` functions would be a natural next step.

Zero-padding and windowing. Sample blocks are Hann-windowed before the FFT to reduce spectral leakage, then zero-padded to the next power of two since the FFT here only supports power-of-two lengths (a classic radix-2 simplification; a mixed-radix or Bluestein's algorithm would remove that restriction at the cost of complexity that isn't needed for a visual spectrum display).

## License

MIT — see LICENSE.
