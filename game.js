export const melody = ['C4', 'D4', 'E4'];
export const LEVEL_LENGTH = 10;
export const NOTE_TIME = 5000;
export function newGame(random = Math.random) {
  return { step: 0, mistakes: 0, status: 'playing', sequence: ['C4', ...Array.from({ length: LEVEL_LENGTH - 1 }, () => melody[Math.floor(random() * melody.length)])] };
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
