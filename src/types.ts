export type StatKey = 'loyalty' | 'reputation' | 'competence' | 'stress';
export type Stats = Record<StatKey, number>;

export type MoveId = 'agree' | 'data' | 'blame' | 'joke' | 'strike';
export interface Move {
  id: MoveId;
  name: string;
  stat: StatKey | null; // null у strike
  hint: string;
}

export interface Choice {
  text: string;
  effects?: Partial<Stats>;
  setFlag?: string;
  requiresFlag?: string;
  reaction?: { portrait: string; text: string };
}

export interface GameEvent {
  id: string;
  title: string;
  speaker: { name: string; portrait: string };
  text: string;
  repeatText?: string;
  choices: Choice[];
}

export type HeroPose = 'idle' | 'attack' | 'hurt' | 'win';
export type BossPose = 'idle' | 'attack' | 'hurt' | 'defeated';

export interface Boss {
  id: string;
  name: string;
  title: string;
  patience: number;
  attack: number;
  weakness: MoveId;
  immunity: MoveId;
  final: boolean;
  sprites: Record<BossPose, string>;
  portraits: { neutral: string; angry: string };
  intro: string;
  lines: { hit: string[]; immune: string[]; special: string[]; defeated: string[] };
}

export interface Rank {
  id: string;
  title: string;
  background: string;
  events: GameEvent[];
  boss: Boss;
}

export type EndingId = 'promotion' | 'burnout' | 'fatality';
export interface Ending {
  id: EndingId;
  title: string;
  text: string;
  illustration: string;
}

export type BattleOutcome = 'win' | 'lose' | 'fatality';

export interface GameState {
  rank: number;
  step: number;
  week: number;
  stats: Stats;
  flags: Set<string>;
  seenEvents: Set<string>;
  lastBattle: { bossId: string; outcome: BattleOutcome } | null;
}

export interface BattleState {
  confidence: number;
  maxConfidence: number;
  patience: number;
  maxPatience: number;
  turn: number;
  hitImmune: boolean;
  bossSpecialHit: boolean;
  finishHim: boolean;
}

export interface TurnResult {
  battle: BattleState;
  outcome: 'continue' | BattleOutcome;
  player: { move: MoveId; damage: number; weakness: boolean; immune: boolean; lineIndex: number };
  boss: { damage: number; special: boolean; lineIndex: number } | null;
}

export type BannerText =
  | 'ROUND 1' | 'FIGHT!' | 'FLAWLESS PRESENTATION' | 'PROMOTION!!!'
  | 'PERFORMANCE REVIEW' | 'FINISH HIM' | 'FATALITY';

export type SoundName =
  | 'hit' | 'immune' | 'special' | 'whoosh' | 'bar' | 'banner' | 'type' | 'win' | 'lose';

export type Step =
  | { t: 'pose'; who: 'hero'; pose: HeroPose }
  | { t: 'pose'; who: 'boss'; pose: BossPose }
  | { t: 'move'; who: 'hero' | 'boss'; dx: number; ms: number }
  | { t: 'camera'; zoom: number; ms: number }
  | { t: 'flash'; ms: number; color: string }
  | { t: 'shake'; ms: number; amp: number }
  | { t: 'particles'; at: 'hero' | 'boss' | 'screen'; kind: 'paper' | 'sparks' | 'confetti' }
  | { t: 'damage'; at: 'hero' | 'boss'; value: number; muted: boolean }
  | { t: 'bar'; who: 'hero' | 'boss'; to: number; ms: number }
  | { t: 'line'; text: string; style: 'bubble' | 'center' }
  | { t: 'banner'; text: BannerText }
  | { t: 'sound'; name: SoundName; gain?: number }
  | { t: 'voice'; id: string }
  | { t: 'dim'; to: number; ms: number }
  | { t: 'grayscale'; to: number; ms: number }
  | { t: 'timeScale'; to: number }
  | { t: 'wait'; ms: number };

export type AssetKind = 'sprite' | 'portrait' | 'background' | 'illustration' | 'music' | 'voice';
export type AssetGroup = 'core' | 'rank0' | 'rank1' | 'rank2' | 'rank3' | 'rank4' | 'rank5' | 'endings';

export interface AssetEntry {
  id: string;
  kind: AssetKind;
  group: AssetGroup;
  file: string;
  model: string;
  prompt: string;
  generated: boolean;
  character?: string;
  size?: [number, number];
  anchor?: [number, number];
  references?: string[];
  dependsOn?: string[];
  chroma?: string;
  flip?: boolean;
  duration?: number;
  seed?: number;
}

export interface Manifest {
  stylePrefix: string;
  entries: AssetEntry[];
}
