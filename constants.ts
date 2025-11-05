import type { Voice } from './types';

export const VOICES: Voice[] = [
  { id: 'Kore', name: 'Kore' },
  { id: 'Puck', name: 'Puck' },
  { id: 'Charon', name: 'Charon' },
  { id: 'Fenrir', name: 'Fenrir' },
  { id: 'Zephyr', name: 'Zephyr' },
];

export const DEFAULT_VOICE_ID = 'Kore';
export const DEFAULT_INPUT_COUNT = 4;
export const MAX_INPUT_COUNT = 10;