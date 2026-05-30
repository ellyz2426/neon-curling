// Neon Curling VR — Types, constants, themes, achievements

export type GameState = 'title' | 'modeselect' | 'difficulty' | 'playing' | 'aiming' | 'throwing' |
  'sliding' | 'sweeping' | 'scoring' | 'endresult' | 'paused' | 'gameover' |
  'leaderboard' | 'achievements' | 'settings' | 'help' | 'practice' | 'countdown' |
  'tournament' | 'stats' | 'stoneskins';

export type GameMode = 'standard' | 'quick' | 'knockout' | 'daily' | 'practice' | 'tournament';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface StoneState {
  x: number;
  z: number;
  vx: number;
  vz: number;
  spin: number; // rotation for curl
  team: 'player' | 'cpu';
  active: boolean;
  meshIndex: number;
}

export interface EndResult {
  playerScore: number;
  cpuScore: number;
}

export interface GameData {
  state: GameState;
  mode: GameMode;
  difficulty: Difficulty;
  currentEnd: number;
  totalEnds: number;
  playerScore: number;
  cpuScore: number;
  endScores: EndResult[];
  stonesOnIce: StoneState[];
  playerStonesLeft: number;
  cpuStonesLeft: number;
  isPlayerTurn: boolean;
  throwPower: number;
  aimAngle: number;
  curlDirection: number; // -1 left, 0 straight, 1 right
  sweepIntensity: number;
  isSweeping: boolean;
  isCharging: boolean;
  totalStonesThrown: number;
  hammerTeam: 'player' | 'cpu'; // last stone advantage
  stoneSkin: number; // index into STONE_SKINS
  // Tournament
  tournamentRound: number;
  tournamentBracket: string[];
  tournamentResults: string[];
}

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  unlocked: boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_throw', name: 'First Stone', desc: 'Throw your first stone', unlocked: false },
  { id: 'first_win', name: 'Winner', desc: 'Win your first match', unlocked: false },
  { id: 'button_hit', name: 'On the Button', desc: 'Place a stone on the button', unlocked: false },
  { id: 'steal', name: 'Steal!', desc: 'Score without last stone advantage', unlocked: false },
  { id: 'five_ender', name: 'Five Ender', desc: 'Score 5+ points in one end', unlocked: false },
  { id: 'perfect_end', name: 'Perfect End', desc: 'Score with all 4 stones in the house', unlocked: false },
  { id: 'takeout', name: 'Takeout Artist', desc: 'Remove an opponent stone', unlocked: false },
  { id: 'double_takeout', name: 'Double Takeout', desc: 'Remove 2 stones with one throw', unlocked: false },
  { id: 'sweep_master', name: 'Sweep Master', desc: 'Sweep for 5+ seconds on a throw', unlocked: false },
  { id: 'shutout', name: 'Shutout', desc: 'Win without opponent scoring', unlocked: false },
  { id: 'win_3', name: 'Hat Trick', desc: 'Win 3 matches', unlocked: false },
  { id: 'win_10', name: 'Veteran', desc: 'Win 10 matches', unlocked: false },
  { id: 'daily_play', name: 'Daily Player', desc: 'Complete a daily challenge', unlocked: false },
  { id: 'comeback', name: 'Comeback', desc: 'Win after trailing by 3+', unlocked: false },
  { id: 'knockout_win', name: 'Knockout King', desc: 'Win a knockout match', unlocked: false },
  { id: 'quick_win', name: 'Speed Curler', desc: 'Win a quick match', unlocked: false },
  { id: 'hard_win', name: 'Champion', desc: 'Win on hard difficulty', unlocked: false },
  { id: 'guard', name: 'Guard Play', desc: 'Place a stone in front of the house', unlocked: false },
  { id: 'all_modes', name: 'Well Rounded', desc: 'Play all game modes', unlocked: false },
  { id: 'century', name: 'Century', desc: 'Throw 100 stones total', unlocked: false },
  { id: 'triple_takeout', name: 'Triple Takeout', desc: 'Remove 3 stones with one throw', unlocked: false },
  { id: 'freeze', name: 'Freeze Play', desc: 'Stop a stone touching the opponent\'s stone', unlocked: false },
  { id: 'guard_master', name: 'Guard Master', desc: 'Place 3 guard stones in one end', unlocked: false },
  { id: 'ten_ender', name: 'Ten Ender', desc: 'Score 10+ points total in one match', unlocked: false },
  { id: 'no_sweep', name: 'Natural Slider', desc: 'Win without sweeping once', unlocked: false },
  { id: 'max_sweep', name: 'Broom Worn Out', desc: 'Sweep for 30+ seconds total in a match', unlocked: false },
  { id: 'tournament_win', name: 'Tournament Champion', desc: 'Win a tournament', unlocked: false },
  { id: 'skin_collector', name: 'Collector', desc: 'Unlock all stone skins', unlocked: false },
  { id: 'win_25', name: 'Legend', desc: 'Win 25 matches', unlocked: false },
];

export interface ThemeColors {
  name: string;
  ice: number;
  grid: number;
  accent: number;
  house1: number;
  house2: number;
  fog: number;
  ambient: number;
  playerStone: number;
  cpuStone: number;
}

export const THEMES: ThemeColors[] = [
  { name: 'Holodeck', ice: 0x001a2e, grid: 0x00ffff, accent: 0x00ffff, house1: 0x00ffff, house2: 0xff00ff, fog: 0x000a14, ambient: 0x003344, playerStone: 0x00ffff, cpuStone: 0xff00ff },
  { name: 'Crimson', ice: 0x1a0005, grid: 0xff3333, accent: 0xff3333, house1: 0xff3333, house2: 0xff8800, fog: 0x0a0002, ambient: 0x330011, playerStone: 0xff3333, cpuStone: 0xff8800 },
  { name: 'Toxic', ice: 0x001a00, grid: 0x00ff44, accent: 0x00ff44, house1: 0x00ff44, house2: 0xffff00, fog: 0x000a00, ambient: 0x003300, playerStone: 0x00ff44, cpuStone: 0xffff00 },
  { name: 'Ultraviolet', ice: 0x0a0020, grid: 0x8844ff, accent: 0x8844ff, house1: 0x8844ff, house2: 0xff44aa, fog: 0x050010, ambient: 0x220044, playerStone: 0x8844ff, cpuStone: 0xff44aa },
  { name: 'Solar', ice: 0x1a1000, grid: 0xffaa00, accent: 0xffaa00, house1: 0xffaa00, house2: 0xff4400, fog: 0x0a0800, ambient: 0x332200, playerStone: 0xffaa00, cpuStone: 0xff4400 },
];

// Sheet dimensions (meters, scaled for VR comfort)
export const SHEET_LENGTH = 10;
export const SHEET_WIDTH = 2;
export const HOUSE_CENTER_Z = -8; // Distance from hack (origin) to house center
export const HOUSE_RADIUS_12 = 0.9;
export const HOUSE_RADIUS_8 = 0.6;
export const HOUSE_RADIUS_4 = 0.3;
export const BUTTON_RADIUS = 0.08;
export const STONE_RADIUS = 0.14;
export const STONE_HEIGHT = 0.06;
export const HOG_LINE_Z = -3; // Stones must pass this line
export const BACK_LINE_Z = HOUSE_CENTER_Z - HOUSE_RADIUS_12 - 0.3;
export const HACK_Z = 0;

// Physics
export const ICE_FRICTION = 0.985; // Per-frame velocity multiplier
export const SWEPT_FRICTION = 0.993; // Reduced friction when sweeping
export const CURL_FACTOR = 0.0008; // How much spin affects lateral movement
export const MAX_THROW_SPEED = 4.5;
export const MIN_THROW_SPEED = 0.5;
export const STONE_STOP_THRESHOLD = 0.005;
export const COLLISION_RESTITUTION = 0.85;

// Leaderboard entry
export interface LeaderboardEntry {
  score: string;
  mode: string;
  difficulty: string;
  date: string;
}

// Persistence keys
export const STORAGE_KEYS = {
  achievements: 'neon-curling-achievements',
  leaderboard: 'neon-curling-leaderboard',
  settings: 'neon-curling-settings',
  stats: 'neon-curling-stats',
  modesPlayed: 'neon-curling-modes-played',
};

export function loadAchievements(): Set<string> {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.achievements);
    return data ? new Set(JSON.parse(data)) : new Set();
  } catch { return new Set(); }
}

export function saveAchievements(unlocked: Set<string>): void {
  try { localStorage.setItem(STORAGE_KEYS.achievements, JSON.stringify([...unlocked])); } catch {}
}

export function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.leaderboard);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

export function saveLeaderboard(entries: LeaderboardEntry[]): void {
  try { localStorage.setItem(STORAGE_KEYS.leaderboard, JSON.stringify(entries.slice(0, 20))); } catch {}
}

export interface GameStats {
  totalGames: number;
  totalWins: number;
  totalStonesThrown: number;
  totalTakeouts: number;
  bestEnd: number;
  totalSweepTime: number;
}

export function loadStats(): GameStats {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.stats);
    return data ? JSON.parse(data) : { totalGames: 0, totalWins: 0, totalStonesThrown: 0, totalTakeouts: 0, bestEnd: 0, totalSweepTime: 0 };
  } catch { return { totalGames: 0, totalWins: 0, totalStonesThrown: 0, totalTakeouts: 0, bestEnd: 0, totalSweepTime: 0 }; }
}

export function saveStats(stats: GameStats): void {
  try { localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(stats)); } catch {}
}

export function loadModesPlayed(): Set<string> {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.modesPlayed);
    return data ? new Set(JSON.parse(data)) : new Set();
  } catch { return new Set(); }
}

export function saveModesPlayed(modes: Set<string>): void {
  try { localStorage.setItem(STORAGE_KEYS.modesPlayed, JSON.stringify([...modes])); } catch {}
}

// Stone Skins
export interface StoneSkin {
  id: string;
  name: string;
  color: number;
  glowColor: number;
  emissive: number;
  wireColor: number;
  unlockCondition: string; // human-readable
  winsRequired: number; // 0 = default
}

export const STONE_SKINS: StoneSkin[] = [
  { id: 'default', name: 'Neon Classic', color: 0x222233, glowColor: 0x00ffff, emissive: 0x003344, wireColor: 0x00ffff, unlockCondition: 'Default', winsRequired: 0 },
  { id: 'plasma', name: 'Plasma Core', color: 0x331133, glowColor: 0xff00ff, emissive: 0x330033, wireColor: 0xff44ff, unlockCondition: 'Win 3 matches', winsRequired: 3 },
  { id: 'solar', name: 'Solar Flare', color: 0x332200, glowColor: 0xffaa00, emissive: 0x331100, wireColor: 0xffcc44, unlockCondition: 'Win 5 matches', winsRequired: 5 },
  { id: 'toxic', name: 'Toxic Glow', color: 0x003300, glowColor: 0x00ff44, emissive: 0x002200, wireColor: 0x44ff44, unlockCondition: 'Win 8 matches', winsRequired: 8 },
  { id: 'ember', name: 'Ember Stone', color: 0x330505, glowColor: 0xff3300, emissive: 0x220202, wireColor: 0xff5533, unlockCondition: 'Win 12 matches', winsRequired: 12 },
  { id: 'ice', name: 'Pure Ice', color: 0x112233, glowColor: 0xaaddff, emissive: 0x112244, wireColor: 0xccddff, unlockCondition: 'Win 15 matches', winsRequired: 15 },
  { id: 'void', name: 'Void Walker', color: 0x0a0a15, glowColor: 0x4400ff, emissive: 0x110022, wireColor: 0x6644ff, unlockCondition: 'Win 20 matches', winsRequired: 20 },
  { id: 'gold', name: 'Championship Gold', color: 0x332200, glowColor: 0xffd700, emissive: 0x332800, wireColor: 0xffee44, unlockCondition: 'Win a tournament', winsRequired: 0 },
];

export function loadUnlockedSkins(): Set<string> {
  try {
    const data = localStorage.getItem('neon-curling-skins');
    return data ? new Set(JSON.parse(data)) : new Set(['default']);
  } catch { return new Set(['default']); }
}

export function saveUnlockedSkins(skins: Set<string>): void {
  try { localStorage.setItem('neon-curling-skins', JSON.stringify([...skins])); } catch {}
}

export function loadSelectedSkin(): number {
  try {
    const data = localStorage.getItem('neon-curling-selected-skin');
    return data ? parseInt(data, 10) : 0;
  } catch { return 0; }
}

export function saveSelectedSkin(index: number): void {
  try { localStorage.setItem('neon-curling-selected-skin', String(index)); } catch {}
}

// Tournament opponents
export const TOURNAMENT_OPPONENTS = [
  'Frost Wolves', 'Ice Hawks', 'Arctic Fox', 'Polar Bears',
  'Crystal Stags', 'Snow Vipers', 'Glacier Kings', 'Winter Storm',
];

// Seeded PRNG for daily challenges
export function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function getDailySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
