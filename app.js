import { scale, levels, newGame, playNote, LEVEL_LENGTH, NOTE_TIME } from './game.js';

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
const guided = () => $('#mode').value === 'guided';
levels.forEach((level, index) => $('#level-select').add(new Option(`${index + 1}. ${level.name}`, index)));

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
    key.classList.toggle('target', guided() && state.status === 'playing' && note === target);
    key.disabled = listening || state.status !== 'playing';
  }
  document.querySelectorAll('[data-step]').forEach((el, index) => {
    el.classList.toggle('current', guided() && scale[index] === target);
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
  $('#next-level').hidden = state.status !== 'won' || state.level === levels.length - 1;
  $('#listen').disabled = listening || state.status !== 'playing';
  $('#listen').innerHTML = listening ? '<span>♫</span> Listen closely…' : '<span>▶</span> Hear note again';
  if (state.status !== 'playing') {
    const won = state.status === 'won';
    $('#result-kicker').textContent = won ? 'A PERFECT LITTLE FINALE' : 'THE GROUNDHOGS SEND THEIR THANKS';
    $('#result-title').textContent = won ? 'Take a bow.' : 'Dinner is served.';
    stopClock();
    $('#result-copy').textContent = won ? (state.level === levels.length - 1 ? 'The whole scale, the whole journey. A grand finale!' : `Ten notes mastered! Next: ${levels[state.level + 1].name}, adding ${levels[state.level + 1].added}.`) : 'Three missed notes. One hungry groundhog chorus.';
    $('#feedback').textContent = won ? 'You did it! Replay this level or continue your journey.' : 'The groundhogs got her! Start over for another dance.';
    $('#stage-caption').textContent = won ? 'A standing ovation. Even from the groundhogs.' : 'An unfortunate end to a promising ballet career.';
  }
}

function prompt(prefix = '') {
  const target = notes.find(row => row[0] === state.sequence[state.step]);
  const name = `${target[1]} (${target[0]})`;
  $('#feedback').textContent = prefix + (guided() ? `Play ${name}. Follow the glowing key.` : 'Listen and find the note. Use “Hear note again” to replay.');
}

const scenes = [
  '',
  '<g fill="#c48451"><path d="M160 285V180h12v105zM740 290V170h12v120z"/><circle cx="166" cy="160" r="48"/><circle cx="746" cy="150" r="57"/></g><g fill="#e5ba62"><circle cx="205" cy="191" r="33"/><circle cx="700" cy="183" r="38"/></g>',
  '<path d="M60 275 300 55 490 275 650 90 920 280" fill="#8397a9"/><path d="m235 115 65-60 64 74-37-12-23 18-27-25zM603 143l47-53 61 57-39-12-20 16-18-17z" fill="#edf1e9"/>',
  '<ellipse cx="520" cy="275" rx="430" ry="39" fill="#83b9c2"/><g stroke="#d5ece5" stroke-width="3"><path d="M200 270h150m100 14h200m30-20h130"/></g><path d="m770 264 25-55 25 55z" fill="#faf0cf"/><path d="M758 268h73l-15 12h-45z" fill="#9d7961"/>',
  '<g fill="#fff2c9"><circle cx="180" cy="60" r="3"/><circle cx="370" cy="90" r="2"/><circle cx="610" cy="45" r="3"/><circle cx="760" cy="130" r="2"/><circle cx="940" cy="40" r="3"/></g><path d="M390 284v-65q0-85 80-85t80 85v65h-18v-65q0-65-62-65t-62 65v65z" fill="#829b91"/><g fill="#c3a0b2"><circle cx="405" cy="177" r="9"/><circle cx="466" cy="143" r="10"/><circle cx="535" cy="184" r="9"/></g>',
  '<path d="M300 289V160h70v-35h260v35h70v129z" fill="#dfceb3"/><path d="M300 160v-65h70v65m260 0V95h70v65" fill="#b29cae"/><path d="m285 95 50-50 50 50m230 0 50-50 50 50" fill="#887b94"/><path d="M464 289v-62a36 36 0 0 1 72 0v62" fill="#8b8195"/><g fill="#f9e7a6"><path d="M320 185h25v35h-25zm335 0h25v35h-25zM400 155h22v32h-22zm177 0h22v32h-22z"/></g>',
];
const palettes = [
  ['#dce7dc', '#f1efdb', '#b9ceba', '#91b49a', '#668e78', '#71956d'],
  ['#f1d8ba', '#f8e8c8', '#d0b783', '#c39e6c', '#aa7953', '#9c915d'],
  ['#d3e0eb', '#edf0e8', '#bbcbd0', '#98b0ad', '#5d807b', '#7e9c8a'],
  ['#d7ecec', '#f2f1d8', '#b1cfbf', '#90b9a9', '#668f84', '#86a581'],
  ['#424d75', '#a8a9bd', '#798da4', '#6f8e97', '#506f7c', '#718d82'],
  ['#e8d7e5', '#f9ecd6', '#c9b8cd', '#b2a6b9', '#8b8e9d', '#929e80'],
];
function updateLevel() {
  const level = levels[state.level];
  $('#stage').dataset.theme = level.theme;
  $('.level').textContent = String(state.level + 1).padStart(2, '0');
  $('.stage-header > div:first-child > span:last-child').textContent = level.name.toUpperCase();
  $('.scene-label').textContent = level.name.toUpperCase();
  $('#level-description').textContent = state.level ? `New note: ${level.added}. Keep all the notes you have learned.` : 'Begin with do, re, and mi. Ten right notes complete each level.';
  $('#mode-label').textContent = guided() ? 'Guided mode' : 'By ear';
  const pool = scale.slice(0, state.level + 3);
  $('.lesson-row .eyebrow').textContent = `LEVEL ${state.level + 1} · TEN NOTES TO THE FINALE`;
  $('.melody').setAttribute('aria-label', `Available notes: ${pool.join(', ')}`);
  $('.melody').innerHTML = pool.map((note, index) => {
    const row = notes.find(entry => entry[0] === note);
    return `<span data-step="${index}">${note === 'C5' ? 'do′' : row[1]} <small>${note}</small></span>`;
  }).join('<i>·</i>');
  const colors = palettes[state.level];
  sceneryTrack.querySelectorAll('.landscape').forEach(tile => {
    // Remember each source color so switching levels is reversible.
    tile.querySelectorAll('[fill]').forEach(element => {
      element.dataset.originalFill ||= element.getAttribute('fill');
      const index = ['#b9ceba', '#91b49a', '#668e78', '#71956d'].indexOf(element.dataset.originalFill);
      if (index >= 0) element.setAttribute('fill', colors[index + 2]);
    });
    tile.querySelectorAll('linearGradient stop').forEach((stop, index) => stop.setAttribute('stop-color', colors[index]));
    tile.querySelector('.level-scenery')?.remove();
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('level-scenery');
    group.innerHTML = scenes[state.level];
    tile.insertBefore(group, tile.querySelector('g[data-original-fill="#668e78"]'));
  });
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
$('#mode').addEventListener('change', () => {
  reset();
  const token = playback;
  audioReady().then(() => { if (token === playback) sound(state.sequence[0]); }).catch(() => {
    $('#feedback').textContent = 'Audio unavailable. Choose Guided mode or try a browser with Web Audio support.';
  });
});
$('#level-select').addEventListener('change', reset);
$('#next-level').addEventListener('click', () => {
  $('#level-select').value = String(state.level + 1);
  reset();
  $('#listen').focus();
});
function reset() {
  playback++;
  clearTimeout(transition);
  stopClock();
  listening = false;
  state = newGame(Math.random, Number($('#level-select').value));
  updateLevel();
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
    if (guided()) flash(note, 'listening');
  } catch {
    if (token === playback) $('#feedback').textContent = 'Sound unavailable. Try a browser with Web Audio support.';
    return;
  }
  if (token === playback) prompt();
});
updateLevel();
render();
if ('serviceWorker' in navigator && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
