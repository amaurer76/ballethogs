import { melody, newGame, playNote, LEVEL_LENGTH, NOTE_TIME } from './game.js';

const $ = selector => document.querySelector(selector);
const notes = [
  ['C4', 'do', 'a', 261.63], ['C#4', '', 'w', 277.18],
  ['D4', 're', 's', 293.66], ['D#4', '', 'e', 311.13],
  ['E4', 'mi', 'd', 329.63], ['F4', 'fa', 'f', 349.23],
  ['F#4', '', 't', 369.99], ['G4', 'sol', 'g', 392],
  ['G#4', '', 'y', 415.3], ['A4', 'la', 'h', 440],
  ['A#4', '', 'u', 466.16], ['B4', 'ti', 'j', 493.88],
  ['C5', 'do', 'k', 523.25],
];
let state = newGame();
let context;
let listening = false;
let playback = 0;
let whiteCount = 0;
let deadline = 0;
let countdown;
let transition;
const keys = new Map();
const timers = new Map();

// Mirrored pairs meet at matching edges and repeat without an empty gap.
const scenery = $('.landscape');
const sceneryTrack = document.createElement('div');
sceneryTrack.className = 'scenery-track';
scenery.before(sceneryTrack);
sceneryTrack.append(scenery);
for (let i = 1; i < 4; i++) {
  const tile = scenery.cloneNode(true);
  tile.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
  sceneryTrack.append(tile);
}

for (const [note, solfege, shortcut] of notes) {
  const button = document.createElement('button');
  const black = note.includes('#');
  button.className = `piano-key ${black ? 'black-key' : 'white-key'}`;
  button.dataset.note = note;
  button.setAttribute('aria-label', `${solfege ? solfege + ', ' : ''}${note.replace('#', ' sharp ')}, keyboard ${shortcut.toUpperCase()}`);
  if (black) {
    button.style.left = `calc(${whiteCount * 12.5}% - 3.85%)`;
    button.textContent = shortcut.toUpperCase();
  } else {
    whiteCount++;
    button.innerHTML = `<span class="solfege">${solfege}</span><span class="note-name">${note}</span><span class="shortcut">${shortcut.toUpperCase()}</span>`;
  }
  button.addEventListener('click', () => strike(note));
  $('#keyboard').append(button);
  keys.set(note, button);
}

async function audioReady() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) throw new Error('Audio unavailable');
  context ||= new Audio();
  if (context.state === 'suspended') await context.resume();
}

function sound(note, delay = 0) {
  if (!context || context.state !== 'running') return;
  const frequency = notes.find(row => row[0] === note)[3];
  const start = context.currentTime + delay;
  // A short attack and decaying harmonics give the synthesized keys a piano-like tone.
  for (const [harmonic, volume] of [[1, .24], [2, .075], [3, .025]]) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency * harmonic;
    oscillator.type = 'sine';
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + .012);
    gain.gain.exponentialRampToValueAtTime(.001, start + 1.2);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 1.3);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}

function flash(note, type) {
  const key = keys.get(note);
  clearTimeout(timers.get(note));
  key.classList.remove('pressed', 'wrong', 'listening');
  key.classList.add(type);
  timers.set(note, setTimeout(() => key.classList.remove('pressed', 'wrong', 'listening'), 400));
}

function render() {
  const target = state.sequence[state.step];
  for (const [note, key] of keys) {
    key.classList.toggle('target', $('#hints').checked && state.status === 'playing' && note === target);
    key.disabled = listening || state.status !== 'playing';
  }
  document.querySelectorAll('[data-step]').forEach((el, index) => {
    el.classList.toggle('current', $('#hints').checked && melody[index] === target);
    el.classList.remove('complete');
  });
  document.querySelectorAll('.stepping-stones span').forEach((el, index) => el.classList.toggle('done', index < state.step));
  document.querySelectorAll('.life').forEach((el, index) => el.classList.toggle('used', index >= 3 - state.mistakes));
  $('.lives').setAttribute('aria-label', `${3 - state.mistakes} chances remaining`);
  $('.chances').textContent = `${3 - state.mistakes} ${state.mistakes === 2 ? 'chance' : 'chances'}`;
  $('#dancer-position').style.left = '38%';
  $('#stage').style.setProperty('--dancer-x', '38%');
  $('#stage').classList.toggle('is-ended', state.status !== 'playing');
  $('#progress').textContent = `${state.step} / ${LEVEL_LENGTH} notes`;
  $('#stage').classList.toggle('lost', state.status === 'lost');
  $('#stage-result').hidden = state.status === 'playing';
  $('#listen').disabled = listening || state.status !== 'playing';
  $('#listen').innerHTML = listening ? '<span>♫</span> Listen closely…' : '<span>▶</span> Hear note again';
  if (state.status !== 'playing') {
    const won = state.status === 'won';
    $('#result-kicker').textContent = won ? 'A PERFECT LITTLE FINALE' : 'THE GROUNDHOGS SEND THEIR THANKS';
    $('#result-title').textContent = won ? 'Take a bow.' : 'Dinner is served.';
    stopClock();
    $('#result-copy').textContent = won ? 'Ten notes, one lovely dance. The meadow is yours.' : 'Three missed notes. One hungry groundhog chorus.';
    $('#feedback').textContent = won ? 'You did it! Play again, or turn off hints for an ear challenge.' : 'The groundhogs got her! Start over for another dance.';
    $('#stage-caption').textContent = won ? 'A standing ovation. Even from the groundhogs.' : 'An unfortunate end to a promising ballet career.';
  }
}

function prompt(prefix = '') {
  const name = { C4: 'do (C)', D4: 're (D)', E4: 'mi (E)' }[state.sequence[state.step]];
  $('#feedback').textContent = prefix + ($('#hints').checked ? `Play ${name}. Follow the glowing key.` : 'Listen and find the next note.');
}

function strike(note) {
  if (listening || state.status !== 'playing') return;
  // Update synchronously so quick key presses preserve the player's order.
  const correct = note === state.sequence[state.step];
  state = playNote(state, note);
  audioReady().then(() => sound(note)).catch(() => {
    $('#feedback').textContent = 'Sound unavailable in this browser. You can still follow the highlighted notes.';
  });
  flash(note, correct ? 'pressed' : 'wrong');
  $('#dancer').classList.remove('hop', 'stumble', 'falling');
  void $('#dancer').offsetWidth;
  if (correct) {
    stopClock();
    $('#dancer').classList.remove('hop');
    void $('#dancer').offsetWidth;
    $('#dancer').classList.add('hop');
    if (state.status === 'playing') nextNote();
    $('#stage-caption').textContent = 'Another little leap. Listen for your next note.';
  } else if (state.status === 'playing') {
    $('#dancer').classList.add(state.mistakes === 1 ? 'stumble' : 'falling');
    prompt(state.mistakes === 1 ? 'A little stumble! ' : 'She’s losing her balance! ');
    $('#stage-caption').textContent = state.mistakes === 1 ? 'A stumble. The groundhogs look up.' : 'One more wrong note and the groundhogs get dinner.';
  }
  render();
}

function stopClock() {
  clearInterval(countdown);
  deadline = 0;
  $('#timer').textContent = state.status === 'playing' ? '5.0s' : 'Finished';
  $('#time-fill').style.width = '100%';
}

function startClock() {
  stopClock();
  deadline = performance.now() + NOTE_TIME;
  countdown = setInterval(() => {
    const remaining = Math.max(0, deadline - performance.now());
    $('#timer').textContent = `${(remaining / 1000).toFixed(1)}s`;
    $('#time-fill').style.width = `${remaining / NOTE_TIME * 100}%`;
    if (remaining === 0) {
      stopClock();
      state = playNote(state, null);
      if (state.status === 'playing') {
        prompt('Time’s up! One chance lost. Try this note again. ');
        sound(state.sequence[state.step]);
        startClock();
      }
      render();
    }
  }, 50);
}

function nextNote() {
  listening = true;
  const token = ++playback;
  $('#feedback').textContent = 'Lovely! Keep dancing — a new note is coming…';
  transition = setTimeout(async () => {
    try { await audioReady(); } catch { /* Visual hints remain available without audio. */ }
    if (token !== playback) return;
    listening = false;
    sound(state.sequence[state.step]);
    prompt();
    startClock();
    render();
  }, 850);
}

$('#dancer').addEventListener('animationend', event => {
  if (event.animationName === 'hop') $('#dancer').classList.remove('hop');
  if (event.animationName === 'trip') $('#dancer').classList.remove('stumble');
  if (event.animationName === 'near-fall') $('#dancer').classList.remove('falling');
});
document.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  const note = notes.find(row => row[2] === event.key.toLowerCase());
  if (note) { event.preventDefault(); strike(note[0]); }
});
$('#hints').addEventListener('change', () => { if (state.status === 'playing') prompt(); render(); });
function reset() {
  playback++;
  clearTimeout(transition);
  stopClock();
  listening = false;
  state = newGame();
  for (const [note, key] of keys) {
    clearTimeout(timers.get(note));
    key.classList.remove('pressed', 'wrong', 'listening');
  }
  $('#dancer').classList.remove('hop', 'stumble', 'falling');
  $('#stage-caption').innerHTML = 'Every great dance starts with a little <em>do.</em>';
  prompt();
  render();
  $('#timer').textContent = 'Play do to start';
}
$('#reset').addEventListener('click', reset);
$('#play-again').addEventListener('click', () => { reset(); keys.get('C4').focus(); });
$('#listen').addEventListener('click', async () => {
  if (listening || state.status !== 'playing') return;
  const token = playback;
  try {
    await audioReady();
    if (token !== playback) return;
    const note = state.sequence[state.step];
    sound(note);
    if ($('#hints').checked) flash(note, 'listening');
  } catch {
    if (token === playback) $('#feedback').textContent = 'Sound unavailable. Try a browser with Web Audio support.';
    return;
  }
  if (token === playback) prompt();
});
render();
if ('serviceWorker' in navigator && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
