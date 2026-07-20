import { Equalizer } from '../src/equalizer.js';
import { magnitudeSpectrumDb, toLogFrequencyBuckets } from '../src/spectrum.js';

const canvas = document.getElementById('spectrum');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const bandsEl = document.getElementById('bands');
const micBtn = document.getElementById('micBtn');
const fileInput = document.getElementById('fileInput');
const stopBtn = document.getElementById('stopBtn');

const FFT_FRAME_SIZE = 2048;
const OUT_BINS = 128;

let audioCtx = null;
let sourceNode = null;
let processorNode = null;
let equalizer = null;
let currentStream = null;

function setStatus(msg) {
  statusEl.textContent = msg;
}

function buildBandControls(eq) {
  bandsEl.innerHTML = '';
  eq.bandSpecs.forEach((spec, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'band';

    const label = document.createElement('label');
    label.textContent = `${spec.type}\n${spec.freq} Hz`;
    label.style.whiteSpace = 'pre-line';

    const range = document.createElement('input');
    range.type = 'range';
    range.min = '-24';
    range.max = '24';
    range.step = '0.5';
    range.value = '0';

    const out = document.createElement('output');
    out.textContent = '0 dB';

    range.addEventListener('input', () => {
      const gain = parseFloat(range.value);
      eq.setGain(i, gain);
      out.textContent = `${gain.toFixed(1)} dB`;
    });

    wrap.append(label, range, out);
    bandsEl.appendChild(wrap);
  });
}

function drawSpectrum(magsDb) {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#05070a';
  ctx.fillRect(0, 0, w, h);

  const minDb = -100;
  const maxDb = 0;
  const barWidth = w / magsDb.length;

  for (let i = 0; i < magsDb.length; i++) {
    const t = (magsDb[i] - minDb) / (maxDb - minDb);
    const barHeight = Math.max(0, Math.min(1, t)) * h;
    const hue = 200 - t * 160;
    ctx.fillStyle = `hsl(${hue}, 80%, 55%)`;
    ctx.fillRect(i * barWidth, h - barHeight, Math.ceil(barWidth), barHeight);
  }
}

function ensureAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    equalizer = new Equalizer(audioCtx.sampleRate);
    buildBandControls(equalizer);
  }
  return audioCtx;
}

// ScriptProcessorNode is deprecated in favor of AudioWorklet, but it
// keeps this demo to a single synchronous file with no separate worklet
// module to load and no cross-thread message passing to wire up. See
// README "Design decisions" for the tradeoff.
function attachProcessing(node) {
  processorNode = audioCtx.createScriptProcessor(FFT_FRAME_SIZE, 1, 1);
  processorNode.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    const filtered = equalizer.processBuffer(input);
    event.outputBuffer.getChannelData(0).set(filtered);

    const magsDb = magnitudeSpectrumDb(filtered);
    const bucketed = toLogFrequencyBuckets(
      magsDb,
      magsDb.length * 2,
      audioCtx.sampleRate,
      OUT_BINS
    );
    drawSpectrum(bucketed);
  };
  node.connect(processorNode);
  processorNode.connect(audioCtx.destination);
}

function teardown() {
  if (processorNode) {
    processorNode.disconnect();
    processorNode.onaudioprocess = null;
    processorNode = null;
  }
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }
  if (currentStream) {
    currentStream.getTracks().forEach((t) => t.stop());
    currentStream = null;
  }
  stopBtn.disabled = true;
}

micBtn.addEventListener('click', async () => {
  try {
    ensureAudioContext();
    teardown();
    currentStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    sourceNode = audioCtx.createMediaStreamSource(currentStream);
    attachProcessing(sourceNode);
    stopBtn.disabled = false;
    setStatus('Streaming from microphone.');
  } catch (err) {
    setStatus(`Microphone error: ${err.message}`);
  }
});

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  try {
    ensureAudioContext();
    teardown();
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = decoded;
    sourceNode.loop = true;
    attachProcessing(sourceNode);
    sourceNode.start();
    stopBtn.disabled = false;
    setStatus(`Playing "${file.name}" through the equalizer.`);
  } catch (err) {
    setStatus(`File error: ${err.message}`);
  }
});

stopBtn.addEventListener('click', () => {
  teardown();
  setStatus('Stopped.');
});
