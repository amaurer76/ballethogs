export const melody = ['C4', 'D4', 'E4'];
export const scale = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
export const levels = [
  { name: 'Meadow', added: 'do · re · mi', theme: 'meadow' },
  { name: 'Autumn woods', added: 'fa (F)', theme: 'autumn' },
  { name: 'Mountain pass', added: 'sol (G)', theme: 'mountain' },
  { name: 'Lakeside', added: 'la (A)', theme: 'lake' },
  { name: 'Moonlit garden', added: 'ti (B)', theme: 'moonlight' },
  { name: 'Palace finale', added: 'high do (C5)', theme: 'palace' },
];
export const LEVEL_LENGTH = 10;
export const NOTE_TIME = 5000;
export function newGame(random = Math.random, level = 0) {
  const pool = scale.slice(0, level + 3);
  const sequence = ['C4', ...Array.from({ length: LEVEL_LENGTH - 1 }, () => pool[Math.floor(random() * pool.length)])];
  // Every new level practices its newly introduced note at least once.
  if (level > 0) sequence[1 + Math.floor(random() * (LEVEL_LENGTH - 1))] = pool.at(-1);
  return { level, step: 0, mistakes: 0, status: 'playing', sequence };
}
export function playNote(state, note) {
  if (state.status !== 'playing') return state;
  if (note === state.sequence[state.step]) {
    const step = state.step + 1;
    return { ...state, step, status: step === LEVEL_LENGTH ? 'won' : 'playing' };
  }
  const mistakes = state.mistakes + 1;
  return { ...state, mistakes, status: mistakes === 3 ? 'lost' : 'playing' };
}
