import type { Ending, EndingId, Move, Rank } from '../types';
import { ENDINGS } from './endings';
import { MOVES, STRIKE_MOVE } from './moves';
import { DEV_RANKS } from './ranks/dev';
import { RANK_INTERN } from './ranks/00-intern';
import { RANK_JUNIOR } from './ranks/01-junior';
import { RANK_SPECIALIST } from './ranks/02-specialist';

export interface Content {
  ranks: Rank[];
  endings: Record<EndingId, Ending>;
  moves: Move[];
  strike: Move;
}

export const RANKS: Rank[] = [RANK_INTERN, RANK_JUNIOR, RANK_SPECIALIST, ...DEV_RANKS];
export { ENDINGS, MOVES, STRIKE_MOVE };

export const CONTENT: Content = { ranks: RANKS, endings: ENDINGS, moves: MOVES, strike: STRIKE_MOVE };
