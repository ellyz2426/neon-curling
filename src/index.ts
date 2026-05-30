// Neon Curling VR — Main Game
import {
  World, PanelUI, Follower, FollowBehavior, ScreenSpace, PanelDocument, UIKitDocument,
  Mesh, Group, BoxGeometry, SphereGeometry, CylinderGeometry, PlaneGeometry,
  TorusGeometry, ConeGeometry,
  MeshStandardMaterial, MeshBasicMaterial, LineBasicMaterial,
  Color, Vector3, Quaternion,
  Fog, AmbientLight, PointLight, DirectionalLight,
  BufferGeometry, Float32BufferAttribute,
  EdgesGeometry, LineSegments, AdditiveBlending,
} from '@iwsdk/core';

import { AudioManager } from './audio';
import {
  GameState, GameMode, Difficulty, StoneState, EndResult, GameData,
  Achievement, ACHIEVEMENTS, ThemeColors, THEMES,
  SHEET_LENGTH, SHEET_WIDTH, HOUSE_CENTER_Z, HOUSE_RADIUS_12, HOUSE_RADIUS_8,
  HOUSE_RADIUS_4, BUTTON_RADIUS, STONE_RADIUS, STONE_HEIGHT, HOG_LINE_Z,
  BACK_LINE_Z, HACK_Z,
  ICE_FRICTION, SWEPT_FRICTION, CURL_FACTOR, MAX_THROW_SPEED, MIN_THROW_SPEED,
  STONE_STOP_THRESHOLD, COLLISION_RESTITUTION,
  LeaderboardEntry, loadAchievements, saveAchievements, loadLeaderboard, saveLeaderboard,
  loadStats, saveStats, GameStats, loadModesPlayed, saveModesPlayed,
  mulberry32, getDailySeed, calcLevel, xpInCurrentLevel, xpForLevel,
  STONE_SKINS, StoneSkin, loadUnlockedSkins, saveUnlockedSkins, loadSelectedSkin, saveSelectedSkin,
  TOURNAMENT_OPPONENTS,
} from './types';

// ============================================================
// Globals
// ============================================================
const audio = new AudioManager();
let world: World;
let themeIndex = 0;
let currentTheme: ThemeColors = THEMES[0];

// Game state
const game: GameData = {
  state: 'title', mode: 'standard', difficulty: 'medium',
  currentEnd: 1, totalEnds: 8, playerScore: 0, cpuScore: 0,
  endScores: [], stonesOnIce: [], playerStonesLeft: 4, cpuStonesLeft: 4,
  isPlayerTurn: true, throwPower: 0, aimAngle: 0, curlDirection: 0,
  sweepIntensity: 0, isSweeping: false, isCharging: false, totalStonesThrown: 0,
  hammerTeam: 'player', stoneSkin: loadSelectedSkin(),
  tournamentRound: 0, tournamentBracket: [], tournamentResults: [],
};

// Persistence
let unlockedAchievements = loadAchievements();
let leaderboard = loadLeaderboard();
let stats = loadStats();
let modesPlayed = loadModesPlayed();
let unlockedSkins = loadUnlockedSkins();

// Trail system
interface TrailPoint { x: number; z: number; age: number; }
const stoneTrails: Map<number, TrailPoint[]> = new Map();
const trailMeshes: Mesh[] = [];
const MAX_TRAIL_POINTS = 60;
const TRAIL_LIFETIME = 3.0;

// 3D objects
const stoneMeshes: Mesh[] = [];
const stoneGlows: Mesh[] = [];
let sheetGroup: Group;
let houseGroup: Group;
let environmentGroup: Group;
let activeStone: Mesh | null = null;
const decorations: Mesh[] = [];
const ambientParticles: Mesh[] = [];

// UI entities
const uiEntities: Record<string, any> = {};
let toastTimeout: ReturnType<typeof setTimeout> | null = null;
let countdownInterval: ReturnType<typeof setInterval> | null = null;

// Sweep tracking
let sweepStartTime = 0;
let totalSweepThisThrow = 0;
let lastMouseX = 0;
let mouseVelX = 0;

// AI state
let aiThinkTimer = 0;
let aiThinking = false;

// Camera follow
let cameraFollowTarget: StoneState | null = null;
let cameraFollowLerp = 0;

// Scoring animation
let scoringAnimTimer = 0;
let houseRingPulse = 0;
let noSweepThisMatch = true; // track for achievement

// Ice conditions
type IceCondition = 'standard' | 'fast' | 'slow' | 'curly';
let currentIceCondition: IceCondition = 'standard';
const ICE_CONDITION_MODS: Record<IceCondition, { friction: number; curl: number; label: string }> = {
  standard: { friction: 1.0, curl: 1.0, label: 'Standard Ice' },
  fast: { friction: 1.003, curl: 0.8, label: 'Fast Ice (fresh pebble)' },
  slow: { friction: 0.997, curl: 1.2, label: 'Slow Ice (worn)' },
  curly: { friction: 1.0, curl: 2.0, label: 'Curly Ice (heavy pebble)' },
};

// Particle system
interface Particle { mesh: Mesh; vx: number; vy: number; vz: number; life: number; maxLife: number; }
const particles: Particle[] = [];
const MAX_PARTICLES = 80;

// Trail
const trailPoints: Vector3[] = [];
let trailLine: LineSegments | null = null;

// ============================================================
// Entry Point
// ============================================================
async function main(): Promise<void> {
  const container = document.getElementById('app') as HTMLDivElement;

  world = await World.create(container, {
    xr: { offer: 'once' as any },
    input: { canvasPointerEvents: true },
    features: { grabbing: false, locomotion: false, physics: false, spatialUI: true },
    render: { near: 0.01, far: 200, camera: { position: [0, 2.5, 2], lookAt: [0, 0.5, -4] } },
  } as any);

  audio.init();
  audio.startAmbientMusic();

  createEnvironment();
  createSheet();
  createHouse();
  createStones();
  setupUI();
  setupInput();

  showState('title');

  let lastTime = performance.now();
  function loop(): void {
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// ============================================================
// Environment
// ============================================================
function createEnvironment(): void {
  environmentGroup = new Group();
  world.scene.add(environmentGroup);

  // Fog
  world.scene.fog = new Fog(currentTheme.fog, 5, 30);
  world.scene.background = new Color(currentTheme.fog);

  // Lights
  const ambient = new AmbientLight(currentTheme.ambient, 0.4);
  environmentGroup.add(ambient);

  const mainLight = new DirectionalLight(0xffffff, 0.6);
  mainLight.position.set(0, 8, 0);
  environmentGroup.add(mainLight);

  const accentLight1 = new PointLight(currentTheme.accent, 1.5, 15);
  accentLight1.position.set(-2, 3, HOUSE_CENTER_Z);
  environmentGroup.add(accentLight1);

  const accentLight2 = new PointLight(currentTheme.cpuStone ?? 0xff00ff, 1.5, 15);
  accentLight2.position.set(2, 3, HOUSE_CENTER_Z);
  environmentGroup.add(accentLight2);

  // Grid floor
  const floorGeo = new PlaneGeometry(30, 30);
  const floorMat = new MeshStandardMaterial({
    color: currentTheme.ice, emissive: new Color(currentTheme.grid), emissiveIntensity: 0.05,
    transparent: true, opacity: 0.6,
  });
  const floor = new Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  environmentGroup.add(floor);

  // Grid lines
  const gridLines = new BufferGeometry();
  const gridVerts: number[] = [];
  for (let i = -15; i <= 15; i += 1) {
    gridVerts.push(i, 0, -15, i, 0, 15);
    gridVerts.push(-15, 0, i, 15, 0, i);
  }
  gridLines.setAttribute('position', new Float32BufferAttribute(gridVerts, 3));
  const gridLineMesh = new LineSegments(gridLines, new LineBasicMaterial({ color: currentTheme.grid, transparent: true, opacity: 0.08 }));
  environmentGroup.add(gridLineMesh);

  // Ceiling grid
  const ceilGrid = gridLineMesh.clone();
  ceilGrid.position.y = 6;
  environmentGroup.add(ceilGrid);

  // Floating wireframe decorations
  const geoTypes = [
    new TorusGeometry(0.4, 0.15, 8, 16),
    new BoxGeometry(0.6, 0.6, 0.6),
    new SphereGeometry(0.35, 8, 8),
    new ConeGeometry(0.3, 0.7, 8),
  ];
  for (let i = 0; i < 12; i++) {
    const geo = geoTypes[i % 4];
    const edges = new EdgesGeometry(geo);
    const mat = new LineBasicMaterial({ color: currentTheme.accent, transparent: true, opacity: 0.15 });
    const deco = new LineSegments(edges, mat) as any as Mesh;
    deco.position.set(
      (Math.random() - 0.5) * 16,
      1 + Math.random() * 4,
      (Math.random() - 0.5) * 16,
    );
    (deco as any)._baseY = deco.position.y;
    (deco as any)._rotSpeed = 0.2 + Math.random() * 0.5;
    (deco as any)._bobSpeed = 0.3 + Math.random() * 0.4;
    environmentGroup.add(deco);
    decorations.push(deco);
  }

  // Ambient particles
  for (let i = 0; i < 40; i++) {
    const pGeo = new SphereGeometry(0.02 + Math.random() * 0.03, 4, 4);
    const pMat = new MeshBasicMaterial({
      color: currentTheme.accent, transparent: true, opacity: 0.3 + Math.random() * 0.3,
    });
    const p = new Mesh(pGeo, pMat);
    p.position.set(
      (Math.random() - 0.5) * 20,
      0.5 + Math.random() * 5,
      (Math.random() - 0.5) * 20,
    );
    (p as any)._driftX = (Math.random() - 0.5) * 0.1;
    (p as any)._driftZ = (Math.random() - 0.5) * 0.1;
    (p as any)._pulseSpeed = 1 + Math.random() * 2;
    environmentGroup.add(p);
    ambientParticles.push(p);
  }
}

// ============================================================
// Sheet (Ice Surface)
// ============================================================
function createSheet(): void {
  sheetGroup = new Group();
  world.scene.add(sheetGroup);

  // Ice surface
  const iceGeo = new PlaneGeometry(SHEET_WIDTH, SHEET_LENGTH);
  const iceMat = new MeshStandardMaterial({
    color: 0x88ccee, emissive: new Color(currentTheme.ice), emissiveIntensity: 0.3,
    transparent: true, opacity: 0.7, roughness: 0.1, metalness: 0.3,
  });
  const ice = new Mesh(iceGeo, iceMat);
  ice.rotation.x = -Math.PI / 2;
  ice.position.set(0, 0.005, -SHEET_LENGTH / 2);
  sheetGroup.add(ice);

  // Side rails
  const railGeo = new BoxGeometry(0.05, 0.08, SHEET_LENGTH);
  const railMat = new MeshStandardMaterial({
    color: currentTheme.accent, emissive: new Color(currentTheme.accent), emissiveIntensity: 0.5,
  });
  const leftRail = new Mesh(railGeo, railMat);
  leftRail.position.set(-SHEET_WIDTH / 2 - 0.025, 0.04, -SHEET_LENGTH / 2);
  sheetGroup.add(leftRail);

  const rightRail = new Mesh(railGeo, railMat);
  rightRail.position.set(SHEET_WIDTH / 2 + 0.025, 0.04, -SHEET_LENGTH / 2);
  sheetGroup.add(rightRail);

  // Back wall
  const backGeo = new BoxGeometry(SHEET_WIDTH + 0.1, 0.08, 0.05);
  const backWall = new Mesh(backGeo, railMat);
  backWall.position.set(0, 0.04, BACK_LINE_Z);
  sheetGroup.add(backWall);

  // Hack (foot hold)
  const hackGeo = new BoxGeometry(0.4, 0.02, 0.15);
  const hackMat = new MeshStandardMaterial({
    color: 0xffffff, emissive: new Color(0xffffff), emissiveIntensity: 0.3,
  });
  const hack = new Mesh(hackGeo, hackMat);
  hack.position.set(0, 0.005, HACK_Z);
  sheetGroup.add(hack);

  // Hog line
  const hogGeo = new BoxGeometry(SHEET_WIDTH, 0.01, 0.03);
  const hogMat = new MeshStandardMaterial({
    color: 0xff3333, emissive: new Color(0xff3333), emissiveIntensity: 0.6,
  });
  const hogLine = new Mesh(hogGeo, hogMat);
  hogLine.position.set(0, 0.01, HOG_LINE_Z);
  sheetGroup.add(hogLine);

  // Center line
  const centerGeo = new BoxGeometry(0.015, 0.01, SHEET_LENGTH);
  const centerMat = new MeshStandardMaterial({
    color: currentTheme.accent, emissive: new Color(currentTheme.accent), emissiveIntensity: 0.3, transparent: true, opacity: 0.4,
  });
  const centerLine = new Mesh(centerGeo, centerMat);
  centerLine.position.set(0, 0.01, -SHEET_LENGTH / 2);
  sheetGroup.add(centerLine);

  // Tee line (through house center)
  const teeGeo = new BoxGeometry(SHEET_WIDTH, 0.01, 0.02);
  const teeMat = new MeshStandardMaterial({
    color: currentTheme.accent, emissive: new Color(currentTheme.accent), emissiveIntensity: 0.3, transparent: true, opacity: 0.4,
  });
  const teeLine = new Mesh(teeGeo, teeMat);
  teeLine.position.set(0, 0.01, HOUSE_CENTER_Z);
  sheetGroup.add(teeLine);

  // Ice pebble marks (small dots for realism)
  const pebbleGeo = new SphereGeometry(0.008, 4, 4);
  const pebbleMat = new MeshBasicMaterial({
    color: 0xaaddff, transparent: true, opacity: 0.15,
  });
  for (let i = 0; i < 200; i++) {
    const pebble = new Mesh(pebbleGeo, pebbleMat);
    pebble.position.set(
      (Math.random() - 0.5) * SHEET_WIDTH * 0.9,
      0.008,
      -Math.random() * SHEET_LENGTH,
    );
    pebble.scale.y = 0.3; // flatten
    sheetGroup.add(pebble);
  }

  // Back line (behind house)
  const backLineGeo = new BoxGeometry(SHEET_WIDTH, 0.01, 0.02);
  const backLineMat = new MeshStandardMaterial({
    color: currentTheme.accent, emissive: new Color(currentTheme.accent), emissiveIntensity: 0.4,
    transparent: true, opacity: 0.5,
  });
  const backLine = new Mesh(backLineGeo, backLineMat);
  backLine.position.set(0, 0.01, BACK_LINE_Z + 0.3);
  sheetGroup.add(backLine);
}

// ============================================================
// House (Target Rings)
// ============================================================
function createHouse(): void {
  houseGroup = new Group();
  houseGroup.position.set(0, 0.015, HOUSE_CENTER_Z);
  world.scene.add(houseGroup);

  // 12-foot ring
  const ring12 = createRing(HOUSE_RADIUS_12, 0.04, currentTheme.house1, 0.6);
  houseGroup.add(ring12);

  // 8-foot ring
  const ring8 = createRing(HOUSE_RADIUS_8, 0.035, currentTheme.house2, 0.7);
  houseGroup.add(ring8);

  // 4-foot ring
  const ring4 = createRing(HOUSE_RADIUS_4, 0.03, currentTheme.house1, 0.8);
  houseGroup.add(ring4);

  // Button (center)
  const buttonGeo = new CylinderGeometry(BUTTON_RADIUS, BUTTON_RADIUS, 0.005, 16);
  const buttonMat = new MeshStandardMaterial({
    color: 0xffffff, emissive: new Color(0xffffff), emissiveIntensity: 1.0,
  });
  const button = new Mesh(buttonGeo, buttonMat);
  houseGroup.add(button);

  // House fill (translucent circles)
  const fillGeo12 = new CylinderGeometry(HOUSE_RADIUS_12, HOUSE_RADIUS_12, 0.002, 32);
  const fillMat12 = new MeshBasicMaterial({
    color: currentTheme.house1, transparent: true, opacity: 0.08,
  });
  const fill12 = new Mesh(fillGeo12, fillMat12);
  fill12.position.y = -0.005;
  houseGroup.add(fill12);

  const fillGeo8 = new CylinderGeometry(HOUSE_RADIUS_8, HOUSE_RADIUS_8, 0.002, 32);
  const fillMat8 = new MeshBasicMaterial({
    color: currentTheme.house2, transparent: true, opacity: 0.1,
  });
  const fill8 = new Mesh(fillGeo8, fillMat8);
  fill8.position.y = -0.003;
  houseGroup.add(fill8);

  const fillGeo4 = new CylinderGeometry(HOUSE_RADIUS_4, HOUSE_RADIUS_4, 0.002, 32);
  const fillMat4 = new MeshBasicMaterial({
    color: currentTheme.house1, transparent: true, opacity: 0.12,
  });
  const fill4 = new Mesh(fillGeo4, fillMat4);
  fill4.position.y = -0.001;
  houseGroup.add(fill4);

  // Spotlight on house
  const houseLight = new PointLight(0xffffff, 2, 5);
  houseLight.position.set(0, 3, 0);
  houseGroup.add(houseLight);
}

function createRing(radius: number, tubeRadius: number, color: number, emissiveIntensity: number): Mesh {
  const geo = new TorusGeometry(radius, tubeRadius, 8, 32);
  const mat = new MeshStandardMaterial({
    color, emissive: new Color(color), emissiveIntensity,
    transparent: true, opacity: 0.8,
  });
  const ring = new Mesh(geo, mat);
  ring.rotation.x = -Math.PI / 2;
  return ring;
}

// ============================================================
// Stones
// ============================================================
function createStones(): void {
  // Create 8 player stones + 8 CPU stones (16 total, reusable)
  for (let i = 0; i < 16; i++) {
    const isPlayer = i < 8;
    const stoneColor = isPlayer ? currentTheme.playerStone : currentTheme.cpuStone;

    // Stone body — flattened cylinder
    const stoneGeo = new CylinderGeometry(STONE_RADIUS, STONE_RADIUS * 0.95, STONE_HEIGHT, 16);
    const stoneMat = new MeshStandardMaterial({
      color: stoneColor, emissive: new Color(stoneColor), emissiveIntensity: 0.4,
      roughness: 0.3, metalness: 0.7,
    });
    const stone = new Mesh(stoneGeo, stoneMat);
    stone.visible = false;
    stone.position.set(0, STONE_HEIGHT / 2, 100); // offscreen

    // Handle
    const handleGeo = new TorusGeometry(STONE_RADIUS * 0.5, 0.015, 6, 12);
    const handleMat = new MeshStandardMaterial({
      color: 0xcccccc, emissive: new Color(0xcccccc), emissiveIntensity: 0.3,
    });
    const handle = new Mesh(handleGeo, handleMat);
    handle.position.y = STONE_HEIGHT / 2 + 0.01;
    stone.add(handle);

    // Wireframe edges
    const edges = new EdgesGeometry(stoneGeo);
    const edgeMat = new LineBasicMaterial({ color: stoneColor, transparent: true, opacity: 0.5 });
    const wireframe = new LineSegments(edges, edgeMat);
    stone.add(wireframe);

    world.scene.add(stone);
    stoneMeshes.push(stone);

    // Glow sphere
    const glowGeo = new SphereGeometry(STONE_RADIUS * 1.3, 8, 8);
    const glowMat = new MeshBasicMaterial({
      color: stoneColor, transparent: true, opacity: 0.1, blending: AdditiveBlending,
    });
    const glow = new Mesh(glowGeo, glowMat);
    glow.visible = false;
    glow.position.y = STONE_HEIGHT / 2;
    stone.add(glow);
    stoneGlows.push(glow);
  }
}

// ============================================================
// UI Setup
// ============================================================
function setupUI(): void {
  const configs: { name: string; config: string; maxW: number; maxH: number; type: 'world' | 'follower' | 'screen'; pos?: number[]; offset?: [number, number, number]; }[] = [
    { name: 'title', config: '/ui/title.json', maxW: 1.0, maxH: 0.8, type: 'world', pos: [0, 1.5, -3] },
    { name: 'modeselect', config: '/ui/modeselect.json', maxW: 1.0, maxH: 0.9, type: 'world', pos: [0, 1.5, -3] },
    { name: 'difficulty', config: '/ui/difficulty.json', maxW: 0.9, maxH: 0.7, type: 'world', pos: [0, 1.5, -3] },
    { name: 'hud', config: '/ui/hud.json', maxW: 0.45, maxH: 0.1, type: 'follower', offset: [0, 0.2, -0.6] },
    { name: 'sweepbar', config: '/ui/sweepbar.json', maxW: 0.25, maxH: 0.1, type: 'follower', offset: [-0.25, -0.1, -0.5] },
    { name: 'powerbar', config: '/ui/powerbar.json', maxW: 0.2, maxH: 0.08, type: 'follower', offset: [0.25, -0.1, -0.5] },
    { name: 'scoreboard', config: '/ui/scoreboard.json', maxW: 1.0, maxH: 0.7, type: 'world', pos: [0, 1.5, -3] },
    { name: 'pause', config: '/ui/pause.json', maxW: 0.7, maxH: 0.5, type: 'world', pos: [0, 1.5, -2.5] },
    { name: 'gameover', config: '/ui/gameover.json', maxW: 0.9, maxH: 0.8, type: 'world', pos: [0, 1.5, -3] },
    { name: 'leaderboard', config: '/ui/leaderboard.json', maxW: 0.9, maxH: 0.9, type: 'world', pos: [0, 1.5, -3] },
    { name: 'achievements', config: '/ui/achievements.json', maxW: 1.0, maxH: 1.2, type: 'world', pos: [0, 1.5, -3] },
    { name: 'settings', config: '/ui/settings.json', maxW: 0.8, maxH: 0.8, type: 'world', pos: [0, 1.5, -3] },
    { name: 'help', config: '/ui/help.json', maxW: 0.9, maxH: 1.0, type: 'world', pos: [0, 1.5, -3] },
    { name: 'toast', config: '/ui/toast.json', maxW: 0.3, maxH: 0.08, type: 'follower', offset: [0, -0.2, -0.5] },
    { name: 'countdown', config: '/ui/countdown.json', maxW: 0.25, maxH: 0.2, type: 'follower', offset: [0, 0, -0.5] },
    { name: 'stats', config: '/ui/stats.json', maxW: 0.9, maxH: 0.9, type: 'world', pos: [0, 1.5, -3] },
    { name: 'tournament', config: '/ui/tournament.json', maxW: 0.9, maxH: 0.8, type: 'world', pos: [0, 1.5, -3] },
    { name: 'stoneskins', config: '/ui/stoneskins.json', maxW: 1.0, maxH: 0.8, type: 'world', pos: [0, 1.5, -3] },
    { name: 'endsummary', config: '/ui/endsummary.json', maxW: 0.85, maxH: 0.6, type: 'world', pos: [0, 1.5, -3] },
  ];

  for (const cfg of configs) {
    const entity = world.createTransformEntity(undefined, { persistent: true });
    entity.addComponent(PanelUI, { config: cfg.config, maxWidth: cfg.maxW, maxHeight: cfg.maxH });

    if (cfg.type === 'world' && cfg.pos) {
      entity.object3D!.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
    } else if (cfg.type === 'follower' && cfg.offset) {
      entity.addComponent(Follower, {
        target: world.player.head,
        offsetPosition: cfg.offset,
        behavior: FollowBehavior.PivotY,
        speed: 5, tolerance: 0.3,
      });
    }

    entity.object3D!.visible = false;
    uiEntities[cfg.name] = entity;
  }

  // Wire up button click handlers after a short delay to let UI load
  setTimeout(() => wireUIEvents(), 500);
}

function wireUIEvents(): void {
  // Title screen
  bindBtn('title', 'btn-play', () => { audio.playButtonClick(); showState('modeselect'); });
  bindBtn('title', 'btn-practice', () => { audio.playButtonClick(); game.mode = 'practice'; startGame(); });
  bindBtn('title', 'btn-leaderboard', () => { audio.playButtonClick(); populateLeaderboard(); showState('leaderboard'); });
  bindBtn('title', 'btn-achievements', () => { audio.playButtonClick(); populateAchievements(); showState('achievements'); });
  bindBtn('title', 'btn-settings', () => { audio.playButtonClick(); populateSettings(); showState('settings'); });
  bindBtn('title', 'btn-stats', () => { audio.playButtonClick(); populateStats(); showState('stats'); });
  bindBtn('title', 'btn-help', () => { audio.playButtonClick(); showState('help'); });

  // Mode select
  bindBtn('modeselect', 'btn-standard', () => { audio.playButtonClick(); game.mode = 'standard'; game.totalEnds = 8; showState('difficulty'); });
  bindBtn('modeselect', 'btn-quick', () => { audio.playButtonClick(); game.mode = 'quick'; game.totalEnds = 4; showState('difficulty'); });
  bindBtn('modeselect', 'btn-knockout', () => { audio.playButtonClick(); game.mode = 'knockout'; game.totalEnds = 1; showState('difficulty'); });
  bindBtn('modeselect', 'btn-daily', () => { audio.playButtonClick(); game.mode = 'daily'; game.totalEnds = 4; showState('difficulty'); });
  bindBtn('modeselect', 'btn-tournament', () => { audio.playButtonClick(); initTournament(); showState('tournament'); });
  bindBtn('modeselect', 'btn-stoneskins', () => { audio.playButtonClick(); populateStoneSkins(); showState('stoneskins'); });
  bindBtn('modeselect', 'btn-mode-back', () => { audio.playButtonClick(); showState('title'); });

  // Difficulty
  bindBtn('difficulty', 'btn-easy', () => { audio.playButtonClick(); game.difficulty = 'easy'; startGame(); });
  bindBtn('difficulty', 'btn-medium', () => { audio.playButtonClick(); game.difficulty = 'medium'; startGame(); });
  bindBtn('difficulty', 'btn-hard', () => { audio.playButtonClick(); game.difficulty = 'hard'; startGame(); });
  bindBtn('difficulty', 'btn-diff-back', () => { audio.playButtonClick(); showState('modeselect'); });

  // Pause
  bindBtn('pause', 'btn-resume', () => { audio.playButtonClick(); showState('playing'); });
  bindBtn('pause', 'btn-quit', () => { audio.playButtonClick(); resetGame(); showState('title'); });
  bindBtn('pause', 'btn-concede', () => {
    audio.playButtonClick();
    game.cpuScore = Math.max(game.cpuScore, game.playerScore + 1); // ensure loss
    endGame();
  });

  // Game over
  bindBtn('gameover', 'btn-rematch', () => { audio.playButtonClick(); startGame(); });
  bindBtn('gameover', 'btn-go-stats', () => { audio.playButtonClick(); populateStats(); showState('stats'); });
  bindBtn('gameover', 'btn-go-title', () => { audio.playButtonClick(); resetGame(); showState('title'); });

  // Back buttons
  bindBtn('leaderboard', 'btn-lb-back', () => { audio.playButtonClick(); showState('title'); });
  bindBtn('achievements', 'btn-ach-back', () => { audio.playButtonClick(); showState('title'); });
  bindBtn('settings', 'btn-settings-back', () => { audio.playButtonClick(); showState('title'); });
  bindBtn('help', 'btn-help-back', () => { audio.playButtonClick(); showState('title'); });

  // Settings controls
  bindBtn('settings', 'btn-master-up', () => { audio.playButtonClick(); adjustVolume('master', 0.1); });
  bindBtn('settings', 'btn-master-down', () => { audio.playButtonClick(); adjustVolume('master', -0.1); });
  bindBtn('settings', 'btn-sfx-up', () => { audio.playButtonClick(); adjustVolume('sfx', 0.1); });
  bindBtn('settings', 'btn-sfx-down', () => { audio.playButtonClick(); adjustVolume('sfx', -0.1); });
  bindBtn('settings', 'btn-music-up', () => { audio.playButtonClick(); adjustVolume('music', 0.1); });
  bindBtn('settings', 'btn-music-down', () => { audio.playButtonClick(); adjustVolume('music', -0.1); });
  bindBtn('settings', 'btn-theme-prev', () => { audio.playButtonClick(); cycleTheme(-1); });
  bindBtn('settings', 'btn-theme-next', () => { audio.playButtonClick(); cycleTheme(1); });

  // Stats
  bindBtn('stats', 'stats-back', () => { audio.playButtonClick(); showState('title'); });

  // Tournament
  bindBtn('tournament', 'tourn-play', () => { audio.playButtonClick(); playTournamentMatch(); });
  bindBtn('tournament', 'tourn-back', () => { audio.playButtonClick(); showState('modeselect'); });

  // Stone skins
  for (let i = 0; i < STONE_SKINS.length; i++) {
    bindBtn('stoneskins', `skin-${i}`, () => { audio.playButtonClick(); selectStoneSkin(i); });
  }
  bindBtn('stoneskins', 'skins-back', () => { audio.playButtonClick(); showState('modeselect'); });
}

function bindBtn(panelName: string, btnId: string, callback: () => void): void {
  const entity = uiEntities[panelName];
  if (!entity) return;
  const tryBind = () => {
    const doc = entity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    if (!doc) { setTimeout(tryBind, 200); return; }
    const el = doc.getElementById(btnId);
    if (el) el.addEventListener('click', callback);
    else setTimeout(tryBind, 200);
  };
  tryBind();
}

function setText(panelName: string, elId: string, text: string): void {
  const entity = uiEntities[panelName];
  if (!entity) return;
  const doc = entity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
  if (!doc) return;
  const el = doc.getElementById(elId);
  if (el && (el as any).text) (el as any).text.value = text;
}

// ============================================================
// State Management
// ============================================================
function showState(state: GameState): void {
  game.state = state;
  const allPanels = ['title', 'modeselect', 'difficulty', 'hud', 'sweepbar', 'powerbar',
    'scoreboard', 'pause', 'gameover', 'leaderboard', 'achievements', 'settings', 'help', 'toast', 'countdown',
    'stats', 'tournament', 'stoneskins', 'endsummary'];

  // Hide all
  for (const name of allPanels) {
    if (uiEntities[name]?.object3D) uiEntities[name].object3D.visible = false;
  }

  // Show relevant panels
  const show = (name: string) => { if (uiEntities[name]?.object3D) uiEntities[name].object3D.visible = true; };

  switch (state) {
    case 'title': show('title'); break;
    case 'modeselect': show('modeselect'); break;
    case 'difficulty': show('difficulty'); break;
    case 'playing':
    case 'aiming':
    case 'throwing':
    case 'sliding':
    case 'sweeping':
      show('hud');
      updateHUD();
      break;
    case 'scoring':
    case 'endresult':
      show('hud');
      show('scoreboard');
      updateHUD();
      updateScoreboard();
      break;
    case 'paused': show('pause'); break;
    case 'gameover': show('gameover'); break;
    case 'leaderboard': show('leaderboard'); break;
    case 'achievements': show('achievements'); break;
    case 'settings': show('settings'); break;
    case 'help': show('help'); break;
    case 'countdown': show('countdown'); break;
    case 'practice':
      show('hud');
      updateHUD();
      break;
    case 'stats': show('stats'); break;
    case 'tournament': show('tournament'); break;
    case 'stoneskins': show('stoneskins'); break;
  }
}

// ============================================================
// Game Flow
// ============================================================
function startGame(): void {
  resetGame();

  if (game.mode === 'knockout') {
    game.totalEnds = 1;
    game.playerStonesLeft = 1;
    game.cpuStonesLeft = 1;
  } else if (game.mode === 'daily') {
    game.totalEnds = 4;
    // Seeded random for daily — also randomize ice conditions
    const seed = getDailySeed();
    const rng = mulberry32(seed);
    const iceTypes: IceCondition[] = ['standard', 'fast', 'slow', 'curly'];
    currentIceCondition = iceTypes[Math.floor(rng() * iceTypes.length)];
    showToast('Ice Condition', ICE_CONDITION_MODS[currentIceCondition].label);
  } else {
    currentIceCondition = 'standard'; // reset for non-daily modes
  }

  modesPlayed.add(game.mode);
  saveModesPlayed(modesPlayed);
  if (modesPlayed.size >= 6) tryUnlock('all_modes');

  audio.playGameStart();
  runCountdown(() => {
    game.isPlayerTurn = true;
    if (game.mode === 'practice') {
      showState('practice');
      beginPlayerAim();
    } else {
      showState('aiming');
      beginPlayerAim();
    }
  });
}

function resetGame(): void {
  game.currentEnd = 1;
  game.playerScore = 0;
  game.cpuScore = 0;
  game.endScores = [];
  game.stonesOnIce = [];
  game.playerStonesLeft = 4;
  game.cpuStonesLeft = 4;
  game.isPlayerTurn = true;
  game.throwPower = 0;
  game.aimAngle = 0;
  game.curlDirection = 0;
  game.sweepIntensity = 0;
  game.isSweeping = false;
  game.isCharging = false;
  game.totalStonesThrown = 0;
  game.hammerTeam = 'player'; // player starts with hammer
  noSweepThisMatch = true;
  cameraFollowTarget = null;
  stoneTrails.clear();

  // Hide all stones
  for (const m of stoneMeshes) {
    m.visible = false;
    m.position.set(0, STONE_HEIGHT / 2, 100);
  }
  for (const g of stoneGlows) g.visible = false;
  activeStone = null;
}

function runCountdown(callback: () => void): void {
  showState('countdown');
  let count = 3;
  setText('countdown', 'cd-number', '3');
  setText('countdown', 'cd-label', 'GET READY');
  audio.playCountdownTick();

  countdownInterval = setInterval(() => {
    count--;
    if (count > 0) {
      setText('countdown', 'cd-number', String(count));
      audio.playCountdownTick();
    } else if (count === 0) {
      setText('countdown', 'cd-number', 'CURL!');
      setText('countdown', 'cd-label', '');
      audio.playCountdownGo();
    } else {
      clearInterval(countdownInterval!);
      countdownInterval = null;
      callback();
    }
  }, 800);
}

function beginPlayerAim(): void {
  game.throwPower = 0;
  game.aimAngle = 0;
  game.curlDirection = 0;
  game.isCharging = false;

  // Place stone at hack
  const stoneIdx = getNextStoneIndex('player');
  if (stoneIdx < 0) return;

  activeStone = stoneMeshes[stoneIdx];
  activeStone.visible = true;
  activeStone.position.set(0, STONE_HEIGHT / 2, HACK_Z - 0.3);
  stoneGlows[stoneIdx].visible = true;

  if (game.mode === 'practice') showState('practice');
  else showState('aiming');

  // Show power bar
  if (uiEntities.powerbar?.object3D) uiEntities.powerbar.object3D.visible = true;
  updatePowerBar();
}

function beginCpuTurn(): void {
  game.isPlayerTurn = false;
  updateHUD();
  aiThinkTimer = 1.0 + Math.random() * 1.5; // AI "thinks" for 1-2.5 seconds
  aiThinking = true;

  const stoneIdx = getNextStoneIndex('cpu');
  if (stoneIdx < 0) return;
  activeStone = stoneMeshes[stoneIdx];
  activeStone.visible = true;
  activeStone.position.set(0, STONE_HEIGHT / 2, HACK_Z - 0.3);
  stoneGlows[stoneIdx].visible = true;
}

function executeAiThrow(): void {
  aiThinking = false;
  if (!activeStone) return;

  const diff = game.difficulty;
  const accuracy = diff === 'easy' ? 0.6 : diff === 'medium' ? 0.8 : 0.95;
  const noise = (1 - accuracy) * (Math.random() - 0.5);

  // AI targeting: strategic shot selection
  let targetX = 0;
  let targetPower = 0.65;
  let curl = 0;

  const playerStones = game.stonesOnIce.filter(s => s.team === 'player' && s.active);
  const cpuStones = game.stonesOnIce.filter(s => s.team === 'cpu' && s.active);

  // Check if player has a stone closer to button than any CPU stone
  const closestPlayer = playerStones.reduce((best, s) => {
    const d = Math.sqrt(s.x * s.x + (s.z - HOUSE_CENTER_Z) * (s.z - HOUSE_CENTER_Z));
    return d < best ? d : best;
  }, Infinity);

  const closestCpu = cpuStones.reduce((best, s) => {
    const d = Math.sqrt(s.x * s.x + (s.z - HOUSE_CENTER_Z) * (s.z - HOUSE_CENTER_Z));
    return d < best ? d : best;
  }, Infinity);

  // Shot selection strategy
  const hasHammer = game.hammerTeam === 'cpu';
  const stonesLeft = game.cpuStonesLeft;
  const strategy = Math.random();

  if (closestPlayer < closestCpu && closestPlayer < HOUSE_RADIUS_12 && playerStones.length > 0 && Math.random() < (diff === 'hard' ? 0.7 : diff === 'medium' ? 0.4 : 0.2)) {
    // Takeout attempt — aim at closest player stone
    const target = playerStones.reduce((best, s) => {
      const d = Math.sqrt(s.x * s.x + (s.z - HOUSE_CENTER_Z) * (s.z - HOUSE_CENTER_Z));
      return d < (best as any)._dist ? s : best;
    }, { ...playerStones[0], _dist: Infinity } as any);
    targetX = target.x + noise * 0.3;
    targetPower = 0.75 + noise * 0.1;
  } else if (stonesLeft >= 3 && strategy < 0.25 && diff !== 'easy') {
    // Guard shot — place stone in front of house to protect
    targetX = noise * 0.3;
    targetPower = 0.45 + noise * 0.1; // shorter throw, stays in front
    curl = (Math.random() - 0.5) * 0.3;
  } else if (cpuStones.length > 0 && closestCpu < HOUSE_RADIUS_8 && strategy < 0.5 && diff === 'hard') {
    // Freeze shot — stop touching own stone for protection
    const myBest = cpuStones.reduce((best, s) => {
      const d = Math.sqrt(s.x * s.x + (s.z - HOUSE_CENTER_Z) * (s.z - HOUSE_CENTER_Z));
      return d < (best as any)._dist ? s : best;
    }, { ...cpuStones[0], _dist: Infinity } as any);
    targetX = myBest.x + noise * 0.15 + (Math.random() > 0.5 ? 0.15 : -0.15);
    targetPower = 0.58 + noise * 0.08;
    curl = targetX > 0 ? -0.3 : 0.3; // come-around curl
  } else if (hasHammer && stonesLeft === 1 && diff !== 'easy') {
    // Last stone with hammer — precision draw to button
    targetX = noise * 0.1;
    targetPower = 0.6 + noise * 0.05;
    curl = (Math.random() - 0.5) * 0.2;
  } else {
    // Draw to house — aim for button
    targetX = noise * 0.2;
    targetPower = 0.6 + noise * 0.15;
    curl = (Math.random() - 0.5) * 0.5;
  }

  targetPower = Math.max(0.3, Math.min(1.0, targetPower));
  const speed = MIN_THROW_SPEED + targetPower * (MAX_THROW_SPEED - MIN_THROW_SPEED);
  const angle = Math.atan2(targetX, -1) + noise * 0.05;

  throwStone(speed, angle, curl, 'cpu');
}

function throwStone(speed: number, angle: number, curl: number, team: 'player' | 'cpu'): void {
  if (!activeStone) return;

  const stoneIdx = stoneMeshes.indexOf(activeStone);
  const state: StoneState = {
    x: activeStone.position.x,
    z: activeStone.position.z,
    vx: Math.sin(angle) * speed * 0.3,
    vz: -speed,
    spin: curl,
    team, active: true, meshIndex: stoneIdx,
  };
  game.stonesOnIce.push(state);

  // Start camera follow and trail
  cameraFollowTarget = state;
  stoneTrails.set(stoneIdx, []);

  if (team === 'player') {
    game.playerStonesLeft--;
    game.isCharging = false;
    totalSweepThisThrow = 0;
    sweepStartTime = performance.now();
  } else {
    game.cpuStonesLeft--;
  }

  game.totalStonesThrown++;
  stats.totalStonesThrown++;
  tryUnlock('first_throw');
  if (stats.totalStonesThrown >= 100) tryUnlock('century');

  audio.playStoneRelease();
  showState('sliding');
}

function getNextStoneIndex(team: 'player' | 'cpu'): number {
  const start = team === 'player' ? 0 : 8;
  const usedIndices = new Set(game.stonesOnIce.filter(s => s.active).map(s => s.meshIndex));
  for (let i = start; i < start + 8; i++) {
    if (!usedIndices.has(i)) return i;
  }
  return -1;
}

// ============================================================
// Physics
// ============================================================
function updatePhysics(dt: number): void {
  if (game.state !== 'sliding' && game.state !== 'sweeping') return;

  let allStopped = true;
  const removedStones: number[] = [];
  let takeoutsThisFrame = 0;

  for (let i = 0; i < game.stonesOnIce.length; i++) {
    const s = game.stonesOnIce[i];
    if (!s.active) continue;

    const speed = Math.sqrt(s.vx * s.vx + s.vz * s.vz);
    if (speed < STONE_STOP_THRESHOLD) {
      s.vx = 0; s.vz = 0;
      continue;
    }

    allStopped = false;

    // Apply friction (modified by ice condition)
    const iceMod = ICE_CONDITION_MODS[currentIceCondition];
    const baseFriction = (game.isSweeping && s === game.stonesOnIce[game.stonesOnIce.length - 1] && game.isPlayerTurn)
      ? SWEPT_FRICTION : ICE_FRICTION;
    const friction = baseFriction * iceMod.friction;
    s.vx *= friction;
    s.vz *= friction;

    // Apply curl (modified by ice condition)
    s.vx += s.spin * CURL_FACTOR * iceMod.curl * speed;

    // Move
    s.x += s.vx * dt * 60;
    s.z += s.vz * dt * 60;

    // Wall collisions
    if (Math.abs(s.x) > SHEET_WIDTH / 2 - STONE_RADIUS) {
      s.x = Math.sign(s.x) * (SHEET_WIDTH / 2 - STONE_RADIUS);
      s.vx *= -0.5;
      audio.playStoneCollision(0.3);
    }

    // Back wall collision
    if (s.z < BACK_LINE_Z) {
      // Stone is out — remove it
      s.active = false;
      removedStones.push(i);
      stoneMeshes[s.meshIndex].visible = false;
      stoneGlows[s.meshIndex].visible = false;
      continue;
    }

    // Hack end (shouldn't go past hack)
    if (s.z > HACK_Z + 1) {
      s.active = false;
      removedStones.push(i);
      stoneMeshes[s.meshIndex].visible = false;
      stoneGlows[s.meshIndex].visible = false;
      continue;
    }

    // Update mesh position
    stoneMeshes[s.meshIndex].position.set(s.x, STONE_HEIGHT / 2, s.z);
  }

  // Stone-stone collisions
  for (let i = 0; i < game.stonesOnIce.length; i++) {
    const a = game.stonesOnIce[i];
    if (!a.active) continue;
    for (let j = i + 1; j < game.stonesOnIce.length; j++) {
      const b = game.stonesOnIce[j];
      if (!b.active) continue;

      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const minDist = STONE_RADIUS * 2;

      if (dist < minDist && dist > 0) {
        // Separate
        const nx = dx / dist;
        const nz = dz / dist;
        const overlap = minDist - dist;
        a.x -= nx * overlap * 0.5;
        a.z -= nz * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.z += nz * overlap * 0.5;

        // Elastic collision
        const dvx = a.vx - b.vx;
        const dvz = a.vz - b.vz;
        const dot = dvx * nx + dvz * nz;
        if (dot > 0) {
          a.vx -= dot * nx * COLLISION_RESTITUTION;
          a.vz -= dot * nz * COLLISION_RESTITUTION;
          b.vx += dot * nx * COLLISION_RESTITUTION;
          b.vz += dot * nz * COLLISION_RESTITUTION;

          const impactSpeed = Math.abs(dot);
          audio.playStoneCollision(impactSpeed);
          spawnCollisionParticles(a.x + dx * 0.5, a.z + dz * 0.5);

          // Track takeouts
          if (a.team !== b.team) {
            takeoutsThisFrame++;
          }

          // Freeze check: stone stops touching opponent's stone
          if (dist < STONE_RADIUS * 2.5 && impactSpeed < 0.3) {
            tryUnlock('freeze');
          }
        }
      }
    }
  }

  if (takeoutsThisFrame > 0) {
    stats.totalTakeouts += takeoutsThisFrame;
    audio.playTakeout();
    tryUnlock('takeout');
    if (takeoutsThisFrame >= 2) tryUnlock('double_takeout');
    if (takeoutsThisFrame >= 3) tryUnlock('triple_takeout');
    showToast('TAKEOUT!', takeoutsThisFrame > 1 ? `${takeoutsThisFrame}x!` : '');
  }

  // Check if hog line violation (stone stopped before hog line)
  for (const s of game.stonesOnIce) {
    if (s.active && s.vx === 0 && s.vz === 0 && s.z > HOG_LINE_Z) {
      s.active = false;
      stoneMeshes[s.meshIndex].visible = false;
      stoneGlows[s.meshIndex].visible = false;
      showToast('HOG LINE!', 'Stone removed');
      audio.playHogViolation();
    }
  }

  // Update sweep bar
  if (game.isSweeping && game.isPlayerTurn) {
    totalSweepThisThrow += dt;
    if (totalSweepThisThrow > 5) tryUnlock('sweep_master');
  }

  // All stopped — next turn or score
  if (allStopped && game.state === 'sliding') {
    game.isSweeping = false;
    if (uiEntities.sweepbar?.object3D) uiEntities.sweepbar.object3D.visible = false;
    stats.totalSweepTime += totalSweepThisThrow;

    // Check if end is over
    const playerDone = game.playerStonesLeft <= 0;
    const cpuDone = game.cpuStonesLeft <= 0;

    if ((playerDone && cpuDone) || game.mode === 'practice') {
      if (game.mode === 'practice') {
        // In practice, just let them keep throwing
        game.playerStonesLeft = 4;
        // Show a random practice tip
        const tips = [
          'Try curling left/right with A/D keys',
          'Hold SPACE after releasing to sweep',
          'Sweeping keeps the stone moving farther',
          'Aim for the button (center dot)',
          'Charge power: click + hold, then release',
          'Guard stones in front protect your lead',
          'Takeouts remove opponent stones',
          'Press G to practice guard placement',
          'In VR: right trigger throw, left trigger sweep',
        ];
        showToast('TIP', tips[Math.floor(Math.random() * tips.length)]);
        beginPlayerAim();
        return;
      }
      scoreEnd();
    } else {
      // Next turn
      game.isPlayerTurn = !game.isPlayerTurn;
      if (game.isPlayerTurn) {
        beginPlayerAim();
      } else {
        beginCpuTurn();
      }
    }
  }
}

function scoreEnd(): void {
  // Calculate score: team with closest stone to button scores
  // They score 1 point for each of their stones closer than opponent's closest
  const houseCenterVec = { x: 0, z: HOUSE_CENTER_Z };

  const playerDists = game.stonesOnIce
    .filter(s => s.active && s.team === 'player')
    .map(s => Math.sqrt((s.x - houseCenterVec.x) ** 2 + (s.z - houseCenterVec.z) ** 2))
    .sort((a, b) => a - b);

  const cpuDists = game.stonesOnIce
    .filter(s => s.active && s.team === 'cpu')
    .map(s => Math.sqrt((s.x - houseCenterVec.x) ** 2 + (s.z - houseCenterVec.z) ** 2))
    .sort((a, b) => a - b);

  let pScore = 0, cScore = 0;

  if (playerDists.length === 0 && cpuDists.length === 0) {
    // Blank end
  } else if (playerDists.length === 0) {
    // All CPU stones count in house
    cScore = cpuDists.filter(d => d <= HOUSE_RADIUS_12).length;
  } else if (cpuDists.length === 0) {
    pScore = playerDists.filter(d => d <= HOUSE_RADIUS_12).length;
  } else {
    if (playerDists[0] < cpuDists[0]) {
      // Player closest — count player stones closer than CPU's closest
      for (const d of playerDists) {
        if (d < cpuDists[0] && d <= HOUSE_RADIUS_12) pScore++;
      }
    } else {
      // CPU closest
      for (const d of cpuDists) {
        if (d < playerDists[0] && d <= HOUSE_RADIUS_12) cScore++;
      }
    }
  }

  // Check for button hit
  if (playerDists.length > 0 && playerDists[0] < BUTTON_RADIUS * 2) tryUnlock('button_hit');

  // Guard stone check: count player stones in front of house (between hog and house)
  const guardStones = game.stonesOnIce.filter(s => s.active && s.team === 'player'
    && s.z > HOUSE_CENTER_Z + HOUSE_RADIUS_12 && s.z < HOG_LINE_Z);
  if (guardStones.length >= 3) tryUnlock('guard_master');

  // Check for steal (scoring without last stone)
  // In real curling, the team that scored last delivers first next end (disadvantage)
  // Steal = scoring when you threw first (don't have hammer)
  if (pScore > 0 && !game.isPlayerTurn) tryUnlock('steal');

  if (pScore >= 5) tryUnlock('five_ender');

  // Check if all 4 player stones are in the house
  const playerInHouse = game.stonesOnIce.filter(s => s.active && s.team === 'player').filter(s => {
    const d = Math.sqrt(s.x ** 2 + (s.z - HOUSE_CENTER_Z) ** 2);
    return d <= HOUSE_RADIUS_12;
  });
  if (playerInHouse.length >= 4) tryUnlock('perfect_end');

  game.playerScore += pScore;
  game.cpuScore += cScore;
  game.endScores.push({ playerScore: pScore, cpuScore: cScore });

  if (pScore > stats.bestEnd) stats.bestEnd = pScore;

  audio.playScore();
  if (pScore > 0) {
    showToast(`YOU SCORED ${pScore}!`, '');
    // Celebration particles at house
    for (let i = 0; i < pScore * 6; i++) {
      spawnCollisionParticles(
        (Math.random() - 0.5) * HOUSE_RADIUS_12,
        HOUSE_CENTER_Z + (Math.random() - 0.5) * HOUSE_RADIUS_12
      );
    }
  } else if (cScore > 0) {
    showToast(`CPU SCORED ${cScore}`, '');
  } else {
    showToast('BLANK END', 'No score');
  }

  updateScoreboard();

  // Populate end summary panel
  setText('endsummary', 'end-num', `End ${game.currentEnd} of ${game.totalEnds}`);
  setText('endsummary', 'end-p-score', String(pScore));
  setText('endsummary', 'end-c-score', String(cScore));
  setText('endsummary', 'end-p-closest', `Closest: ${playerDists.length > 0 ? playerDists[0].toFixed(2) + 'm' : '--'}`);
  setText('endsummary', 'end-c-closest', `Closest: ${cpuDists.length > 0 ? cpuDists[0].toFixed(2) + 'm' : '--'}`);
  const pInHouse = playerDists.filter(d => d <= HOUSE_RADIUS_12).length;
  const cInHouse = cpuDists.filter(d => d <= HOUSE_RADIUS_12).length;
  setText('endsummary', 'end-p-in-house', `In house: ${pInHouse}`);
  setText('endsummary', 'end-c-in-house', `In house: ${cInHouse}`);
  setText('endsummary', 'end-total', `Total: ${game.playerScore} - ${game.cpuScore}`);
  const nextHammer = pScore > 0 ? 'CPU' : (cScore > 0 ? 'YOU' : (game.hammerTeam === 'player' ? 'YOU' : 'CPU'));
  setText('endsummary', 'end-hammer', `Next Hammer: ${nextHammer}`);
  setText('endsummary', 'end-ice', ICE_CONDITION_MODS[currentIceCondition].label);

  showState('endresult');
  // Also show end summary
  if (uiEntities.endsummary?.object3D) uiEntities.endsummary.object3D.visible = true;

  // After 3 seconds, start next end or end game
  setTimeout(() => {
    if (game.currentEnd >= game.totalEnds) {
      // Check for tie — play extra end
      if (game.playerScore === game.cpuScore && game.mode !== 'practice' && game.mode !== 'knockout') {
        game.totalEnds++;
        showToast('EXTRA END!', 'Tied game — sudden death');
        audio.playExtraEnd();
        game.currentEnd++;
        game.stonesOnIce = [];
        game.playerStonesLeft = 4;
        game.cpuStonesLeft = 4;
        for (const m of stoneMeshes) { m.visible = false; m.position.set(0, STONE_HEIGHT / 2, 100); }
        for (const g of stoneGlows) g.visible = false;
        stoneTrails.clear();
        // Hammer stays same
        game.isPlayerTurn = game.hammerTeam === 'cpu';
        if (game.isPlayerTurn) beginPlayerAim();
        else beginCpuTurn();
        return;
      }
      endGame();
    } else {
      game.currentEnd++;
      game.stonesOnIce = [];
      game.playerStonesLeft = game.mode === 'knockout' ? 1 : 4;
      game.cpuStonesLeft = game.mode === 'knockout' ? 1 : 4;
      for (const m of stoneMeshes) { m.visible = false; m.position.set(0, STONE_HEIGHT / 2, 100); }
      for (const g of stoneGlows) g.visible = false;
      stoneTrails.clear();

      // Hammer: team that scored gives up hammer (authentic curling rule)
      if (pScore > 0) game.hammerTeam = 'cpu';
      else if (cScore > 0) game.hammerTeam = 'player';
      // blank end: hammer stays

      // Team with hammer throws last (delivers second)
      game.isPlayerTurn = game.hammerTeam === 'cpu'; // non-hammer team throws first
      if (game.isPlayerTurn) {
        beginPlayerAim();
      } else {
        beginCpuTurn();
      }
    }
  }, 3000);
}

function endGame(): void {
  stats.totalGames++;
  const won = game.playerScore > game.cpuScore;
  const draw = game.playerScore === game.cpuScore;

  // Award XP
  let xpGained = 10; // base XP for playing
  if (won) xpGained += 25;
  if (game.difficulty === 'hard') xpGained += 15;
  else if (game.difficulty === 'medium') xpGained += 5;
  xpGained += game.playerScore * 3;
  if (game.mode === 'tournament') xpGained += 20;

  const oldLevel = calcLevel(stats.xp);
  stats.xp += xpGained;
  stats.level = calcLevel(stats.xp);
  if (stats.level > oldLevel) {
    showToast(`LEVEL UP!`, `Level ${stats.level}`);
  }

  if (won) {
    stats.totalWins++;
    audio.playGameEnd();
    tryUnlock('first_win');
    if (stats.totalWins >= 3) tryUnlock('win_3');
    if (stats.totalWins >= 10) tryUnlock('win_10');
    if (stats.totalWins >= 25) tryUnlock('win_25');
    if (game.cpuScore === 0) tryUnlock('shutout');
    if (game.mode === 'knockout') tryUnlock('knockout_win');
    if (game.mode === 'quick') tryUnlock('quick_win');
    if (game.mode === 'daily') tryUnlock('daily_play');
    if (game.difficulty === 'hard') tryUnlock('hard_win');
    if (noSweepThisMatch) tryUnlock('no_sweep');
    if (game.playerScore >= 10) tryUnlock('ten_ender');

    // Unlock stone skins based on total wins
    let skinsChanged = false;
    for (const skin of STONE_SKINS) {
      if (skin.winsRequired > 0 && stats.totalWins >= skin.winsRequired && !unlockedSkins.has(skin.id)) {
        unlockedSkins.add(skin.id);
        skinsChanged = true;
        showToast(`Skin Unlocked!`, skin.name);
        audio.playSkinUnlock();
      }
    }
    if (skinsChanged) {
      saveUnlockedSkins(unlockedSkins);
      if (unlockedSkins.size >= STONE_SKINS.length) tryUnlock('skin_collector');
    }

    // Comeback check
    let maxTrail = 0;
    let running = 0;
    for (const e of game.endScores) {
      running += e.cpuScore - e.playerScore;
      if (running > maxTrail) maxTrail = running;
    }
    if (maxTrail >= 3) tryUnlock('comeback');

    // Check sweep time total
    if (stats.totalSweepTime >= 30) tryUnlock('max_sweep');
  } else {
    audio.playGameOver();
  }

  saveStats(stats);

  // Tournament progression
  if (game.mode === 'tournament') {
    if (won) {
      game.tournamentResults.push('W');
      game.tournamentRound++;
      if (game.tournamentRound >= 3) {
        // Won the tournament!
        tryUnlock('tournament_win');
        audio.playTournamentWin();
        // Unlock gold skin
        if (!unlockedSkins.has('gold')) {
          unlockedSkins.add('gold');
          saveUnlockedSkins(unlockedSkins);
          showToast('Skin Unlocked!', 'Championship Gold');
        }
        setText('gameover', 'go-result', 'TOURNAMENT CHAMPION!');
      } else {
        setText('gameover', 'go-result', `ROUND ${game.tournamentRound} WON!`);
      }
    } else {
      game.tournamentResults.push('L');
      setText('gameover', 'go-result', 'ELIMINATED');
    }
  }

  // Save to leaderboard
  const entry: LeaderboardEntry = {
    score: `${game.playerScore}-${game.cpuScore}`,
    mode: game.mode,
    difficulty: game.difficulty,
    date: new Date().toLocaleDateString(),
  };
  leaderboard.push(entry);
  leaderboard.sort((a, b) => {
    const aS = parseInt(a.score.split('-')[0]);
    const bS = parseInt(b.score.split('-')[0]);
    return bS - aS;
  });
  leaderboard = leaderboard.slice(0, 20);
  saveLeaderboard(leaderboard);

  // Populate game over panel
  const resultText = (won ? 'YOU WIN!' : draw ? 'DRAW' : 'YOU LOSE') + ` (+${xpGained} XP)`;
  setText('gameover', 'go-result', resultText);
  setText('gameover', 'go-score', `${game.playerScore} - ${game.cpuScore}`);
  setText('gameover', 'go-mode', game.mode.toUpperCase());
  setText('gameover', 'go-best-end', String(Math.max(...game.endScores.map(e => e.playerScore), 0)));
  setText('gameover', 'go-stones', String(game.totalStonesThrown));
  setText('gameover', 'go-level', `${stats.level} (${xpInCurrentLevel(stats.xp)}/${xpForLevel(stats.level)} XP)`);

  showState('gameover');
}

// ============================================================
// Input
// ============================================================
function setupInput(): void {
  // Mouse/keyboard for browser mode
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
}

function onMouseDown(e: MouseEvent): void {
  if (e.button !== 0) return;
  if (game.state === 'aiming' || game.state === 'practice') {
    game.isCharging = true;
    game.throwPower = 0;
  }
}

function onMouseMove(e: MouseEvent): void {
  const mx = e.movementX || 0;
  mouseVelX = mx;

  if (game.isCharging && activeStone) {
    // Horizontal mouse movement adjusts aim angle
    game.aimAngle += mx * 0.002;
    game.aimAngle = Math.max(-0.5, Math.min(0.5, game.aimAngle));
  }
}

function onMouseUp(e: MouseEvent): void {
  if (e.button !== 0) return;
  if (game.isCharging && activeStone) {
    game.isCharging = false;
    const speed = MIN_THROW_SPEED + game.throwPower * (MAX_THROW_SPEED - MIN_THROW_SPEED);
    throwStone(speed, game.aimAngle, game.curlDirection * 0.3, 'player');
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.code === 'Escape') {
    if (game.state === 'playing' || game.state === 'aiming' || game.state === 'sliding' ||
        game.state === 'sweeping' || game.state === 'practice') {
      showState('paused');
    } else if (game.state === 'paused') {
      if (game.mode === 'practice') showState('practice');
      else showState('aiming');
    }
  }

  if (e.code === 'Space' && (game.state === 'sliding' || game.state === 'sweeping')) {
    game.isSweeping = true;
    game.state = 'sweeping' as any;
    trackSweep();
    if (uiEntities.sweepbar?.object3D) uiEntities.sweepbar.object3D.visible = true;
    audio.playSweep();
  }

  // Curl direction: A/D or Left/Right during aiming
  if (game.state === 'aiming' || game.state === 'practice') {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') game.curlDirection = -1;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') game.curlDirection = 1;
  }

  // Guard placement hint
  if ((game.state === 'aiming' || game.state === 'practice') && e.code === 'KeyG') {
    tryUnlock('guard');
  }
}

function onKeyUp(e: KeyboardEvent): void {
  if (e.code === 'Space') {
    game.isSweeping = false;
    if (uiEntities.sweepbar?.object3D) uiEntities.sweepbar.object3D.visible = false;
  }
}

// ============================================================
// Update Loop
// ============================================================
function update(dt: number): void {
  const time = performance.now() * 0.001;

  // Charging power
  if (game.isCharging) {
    game.throwPower = Math.min(1, game.throwPower + dt * 0.6);
    updatePowerBar();
    if (uiEntities.powerbar?.object3D) uiEntities.powerbar.object3D.visible = true;
  } else {
    if (game.state === 'aiming' || game.state === 'practice') {
      if (uiEntities.powerbar?.object3D) uiEntities.powerbar.object3D.visible = true;
    }
  }

  // Physics
  updatePhysics(dt);

  // Trail system
  updateTrails(dt);

  // Camera follow
  updateCameraFollow(dt);

  // AI turn
  if (aiThinking) {
    aiThinkTimer -= dt;
    if (aiThinkTimer <= 0) {
      executeAiThrow();
    }
  }

  // XR controller input
  const rightGP = (world.input as any)?.xr?.gamepads?.right;
  if (rightGP) {
    // Right trigger: charge and throw
    const triggerPressed = rightGP.getButtonPressed?.(0); // InputComponent.Trigger
    const triggerDown = rightGP.getButtonDown?.(0);
    const triggerUp = rightGP.getButtonUp?.(0);

    if (triggerDown && (game.state === 'aiming' || game.state === 'practice')) {
      game.isCharging = true;
      game.throwPower = 0;
    }
    if (triggerUp && game.isCharging && activeStone) {
      game.isCharging = false;
      const speed = MIN_THROW_SPEED + game.throwPower * (MAX_THROW_SPEED - MIN_THROW_SPEED);
      throwStone(speed, game.aimAngle, game.curlDirection * 0.3, 'player');
    }

    // Right thumbstick: aim
    const thumbstick = rightGP.getAxesValues?.(2); // InputComponent.Thumbstick
    if (thumbstick && (game.state === 'aiming' || game.state === 'practice')) {
      game.aimAngle += (thumbstick.x || 0) * dt * 0.5;
      game.aimAngle = Math.max(-0.5, Math.min(0.5, game.aimAngle));
    }

    // B button: pause
    const bDown = rightGP.getButtonDown?.(4); // InputComponent.B_Button
    if (bDown) {
      if (game.state === 'aiming' || game.state === 'sliding' || game.state === 'practice') showState('paused');
      else if (game.state === 'paused') showState('aiming');
    }
  }

  const leftGP = (world.input as any)?.xr?.gamepads?.left;
  if (leftGP) {
    // Left trigger: sweep
    const leftTrigger = leftGP.getButtonPressed?.(0);
    if (leftTrigger && (game.state === 'sliding' || game.state === 'sweeping')) {
      game.isSweeping = true;
      trackSweep();
      if (uiEntities.sweepbar?.object3D) uiEntities.sweepbar.object3D.visible = true;
    } else if (!leftTrigger && game.isSweeping) {
      game.isSweeping = false;
      if (uiEntities.sweepbar?.object3D) uiEntities.sweepbar.object3D.visible = false;
    }
  }

  // Animate decorations
  for (const d of decorations) {
    d.rotation.x += (d as any)._rotSpeed * dt;
    d.rotation.y += (d as any)._rotSpeed * 0.7 * dt;
    d.position.y = (d as any)._baseY + Math.sin(time * (d as any)._bobSpeed) * 0.3;
  }

  // Animate ambient particles
  for (const p of ambientParticles) {
    p.position.x += (p as any)._driftX * dt;
    p.position.z += (p as any)._driftZ * dt;
    (p.material as MeshBasicMaterial).opacity = 0.2 + Math.sin(time * (p as any)._pulseSpeed) * 0.15;
    // Wrap around
    if (Math.abs(p.position.x) > 10) p.position.x *= -0.9;
    if (Math.abs(p.position.z) > 10) p.position.z *= -0.9;
  }

  // Animate stone glows and spin
  for (let i = 0; i < stoneMeshes.length; i++) {
    if (stoneMeshes[i].visible && stoneGlows[i]) {
      (stoneGlows[i].material as MeshBasicMaterial).opacity = 0.08 + Math.sin(time * 3 + i) * 0.04;
    }
    // Rotate stone based on spin for visible curl
    if (stoneMeshes[i].visible) {
      const stoneState = game.stonesOnIce.find(s => s.meshIndex === i && s.active);
      if (stoneState) {
        const speed = Math.sqrt(stoneState.vx ** 2 + stoneState.vz ** 2);
        if (speed > STONE_STOP_THRESHOLD) {
          stoneMeshes[i].rotation.y += stoneState.spin * dt * 8;
        }

        // Highlight closest stone to button with brighter glow
        const dist = Math.sqrt(stoneState.x ** 2 + (stoneState.z - HOUSE_CENTER_Z) ** 2);
        if (dist < BUTTON_RADIUS * 3 && speed <= STONE_STOP_THRESHOLD) {
          (stoneGlows[i].material as MeshBasicMaterial).opacity = 0.2 + Math.sin(time * 5) * 0.1;
        }
      }
    }
  }

  // Animate house pulse
  if (houseGroup) {
    const isScoring = game.state === 'scoring' || game.state === 'endresult';
    const pulseIntensity = isScoring ? 0.08 : 0.02;
    const pulseSpeed = isScoring ? 6 : 2;
    const pulseScale = 1 + Math.sin(time * pulseSpeed) * pulseIntensity;
    houseGroup.scale.set(pulseScale, 1, pulseScale);

    // During scoring, pulse ring colors
    if (isScoring) {
      houseRingPulse = (houseRingPulse + dt * 3) % (Math.PI * 2);
      const brightness = 0.5 + Math.sin(houseRingPulse) * 0.5;
      for (const child of houseGroup.children) {
        if ((child as Mesh).isMesh) {
          const mat = (child as Mesh).material as MeshStandardMaterial;
          if (mat.emissiveIntensity !== undefined) {
            mat.emissiveIntensity = 0.4 + brightness * 0.6;
          }
        }
      }
    }
  }

  // Update particles
  updateParticles(dt);

  // Active stone aim visualization
  if (activeStone && (game.state === 'aiming' || game.state === 'practice')) {
    // Rotate stone slightly based on aim
    activeStone.rotation.y = game.aimAngle * 2;
    // Show aim direction with position offset
    activeStone.position.x = Math.sin(game.aimAngle) * 0.1;

    // Pulsing glow on active stone during aim
    const stoneIdx = stoneMeshes.indexOf(activeStone);
    if (stoneIdx >= 0 && stoneGlows[stoneIdx]) {
      (stoneGlows[stoneIdx].material as MeshBasicMaterial).opacity = 0.15 + Math.sin(time * 6) * 0.1;
    }

    // Power indicator — stone grows slightly when charging
    if (game.isCharging) {
      const scale = 1 + game.throwPower * 0.15;
      activeStone.scale.set(scale, 1, scale);
    } else {
      activeStone.scale.set(1, 1, 1);
    }
  }

  // Sweep visualization
  if (game.isSweeping) {
    const sweepFill = Math.min(10, Math.floor(totalSweepThisThrow * 2));
    const bar = '|'.repeat(sweepFill) + '.'.repeat(Math.max(0, 10 - sweepFill));
    setText('sweepbar', 'sweep-bar', bar);
  }
}

// ============================================================
// Particles
// ============================================================
function spawnCollisionParticles(x: number, z: number): void {
  for (let i = 0; i < 8; i++) {
    if (particles.length >= MAX_PARTICLES) break;
    const geo = new SphereGeometry(0.015, 4, 4);
    const mat = new MeshBasicMaterial({
      color: currentTheme.accent, transparent: true, opacity: 0.8, blending: AdditiveBlending,
    });
    const mesh = new Mesh(geo, mat);
    mesh.position.set(x, STONE_HEIGHT, z);
    world.scene.add(mesh);
    particles.push({
      mesh, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 2 + 1,
      vz: (Math.random() - 0.5) * 2, life: 1, maxLife: 1,
    });
  }
}

function updateParticles(dt: number): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      world.scene.remove(p.mesh);
      particles.splice(i, 1);
      continue;
    }
    p.vy -= 4 * dt; // gravity
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    (p.mesh.material as MeshBasicMaterial).opacity = (p.life / p.maxLife) * 0.8;
    p.mesh.scale.setScalar(p.life / p.maxLife);
  }
}

// ============================================================
// UI Helpers
// ============================================================
function updateHUD(): void {
  const endsDisplay = game.mode === 'practice' ? '--' : `${game.currentEnd}/${game.totalEnds}`;
  const hammerIndicator = game.hammerTeam === 'player' ? ' [H]' : '';
  setText('hud', 'hud-end', endsDisplay);
  setText('hud', 'hud-player-score', String(game.playerScore));
  setText('hud', 'hud-cpu-score', String(game.cpuScore));
  setText('hud', 'hud-stones', String(game.isPlayerTurn ? game.playerStonesLeft : game.cpuStonesLeft));
  setText('hud', 'hud-turn', (game.isPlayerTurn ? 'YOU' : 'CPU') + hammerIndicator);

  // Best stone distance from button
  const playerDists = game.stonesOnIce
    .filter(s => s.active && s.team === 'player')
    .map(s => Math.sqrt(s.x ** 2 + (s.z - HOUSE_CENTER_Z) ** 2));
  if (playerDists.length > 0) {
    const best = Math.min(...playerDists);
    setText('hud', 'hud-best-dist', best <= HOUSE_RADIUS_12 ? best.toFixed(2) + 'm' : 'OUT');
  } else {
    setText('hud', 'hud-best-dist', '--');
  }
}

function updatePowerBar(): void {
  const filled = Math.floor(game.throwPower * 10);
  const bar = '|'.repeat(filled) + '.'.repeat(10 - filled);
  const pct = Math.round(game.throwPower * 100);
  setText('powerbar', 'power-bar', bar);
  setText('powerbar', 'power-pct', `${pct}%`);
}

function updateScoreboard(): void {
  for (let i = 0; i < 8; i++) {
    const pVal = game.endScores[i] ? String(game.endScores[i].playerScore) : '-';
    const cVal = game.endScores[i] ? String(game.endScores[i].cpuScore) : '-';
    setText('scoreboard', `sb-p${i + 1}`, pVal);
    setText('scoreboard', `sb-c${i + 1}`, cVal);
  }
  setText('scoreboard', 'sb-ptotal', String(game.playerScore));
  setText('scoreboard', 'sb-ctotal', String(game.cpuScore));
}

function populateLeaderboard(): void {
  for (let i = 0; i < 10; i++) {
    if (i < leaderboard.length) {
      setText('leaderboard', `lb-s${i + 1}`, leaderboard[i].score);
      setText('leaderboard', `lb-m${i + 1}`, leaderboard[i].mode);
      setText('leaderboard', `lb-d${i + 1}`, leaderboard[i].date);
    } else {
      setText('leaderboard', `lb-s${i + 1}`, '---');
      setText('leaderboard', `lb-m${i + 1}`, '---');
      setText('leaderboard', `lb-d${i + 1}`, '---');
    }
  }
}

function populateAchievements(): void {
  const count = [...unlockedAchievements].length;
  setText('achievements', 'ach-count', `${count} / ${ACHIEVEMENTS.length}`);
  for (let i = 0; i < ACHIEVEMENTS.length; i++) {
    const a = ACHIEVEMENTS[i];
    const unlocked = unlockedAchievements.has(a.id);
    setText('achievements', `ach-i${i + 1}`, unlocked ? '[*]' : '[ ]');
    setText('achievements', `ach-n${i + 1}`, unlocked ? a.name : '???');
    setText('achievements', `ach-d${i + 1}`, unlocked ? a.desc : 'Locked');
  }
}

function populateSettings(): void {
  setText('settings', 'vol-master', String(Math.round(audio.getMasterVolume() * 100)));
  setText('settings', 'vol-sfx', String(Math.round(audio.getSfxVolume() * 100)));
  setText('settings', 'vol-music', String(Math.round(audio.getMusicVolume() * 100)));
  setText('settings', 'theme-name', currentTheme.name);
  // Ice condition display (informational for daily, configurable for practice)
}

function adjustVolume(type: string, delta: number): void {
  if (type === 'master') {
    const v = Math.max(0, Math.min(1, audio.getMasterVolume() + delta));
    audio.setMasterVolume(v);
    setText('settings', 'vol-master', String(Math.round(v * 100)));
  } else if (type === 'sfx') {
    const v = Math.max(0, Math.min(1, audio.getSfxVolume() + delta));
    audio.setSfxVolume(v);
    setText('settings', 'vol-sfx', String(Math.round(v * 100)));
  } else if (type === 'music') {
    const v = Math.max(0, Math.min(1, audio.getMusicVolume() + delta));
    audio.setMusicVolume(v);
    setText('settings', 'vol-music', String(Math.round(v * 100)));
  }
}

function cycleTheme(dir: number): void {
  themeIndex = (themeIndex + dir + THEMES.length) % THEMES.length;
  currentTheme = THEMES[themeIndex];
  setText('settings', 'theme-name', currentTheme.name);
  // Apply theme colors to environment would require rebuilding meshes — store for next game
}

function showToast(text: string, sub: string): void {
  setText('toast', 'toast-text', text);
  setText('toast', 'toast-sub', sub);
  if (uiEntities.toast?.object3D) uiEntities.toast.object3D.visible = true;
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    if (uiEntities.toast?.object3D) uiEntities.toast.object3D.visible = false;
  }, 2500);
}

function tryUnlock(id: string): void {
  if (unlockedAchievements.has(id)) return;
  unlockedAchievements.add(id);
  saveAchievements(unlockedAchievements);
  const ach = ACHIEVEMENTS.find(a => a.id === id);
  if (ach) {
    audio.playAchievement();
    showToast(ach.name, ach.desc);
  }
}

// ============================================================
// Tournament System
// ============================================================
function initTournament(): void {
  // Create 4-team bracket with random opponents
  const shuffled = [...TOURNAMENT_OPPONENTS].sort(() => Math.random() - 0.5);
  game.tournamentBracket = ['YOU', shuffled[0], shuffled[1], shuffled[2]];
  game.tournamentRound = 0;
  game.tournamentResults = [];
  game.mode = 'tournament';
  game.totalEnds = 4; // Quick matches in tournament

  // Populate bracket display
  setText('tournament', 'tourn-round', 'SEMIFINAL 1');
  setText('tournament', 'tourn-b1', `> YOU`);
  setText('tournament', 'tourn-b2', `  ${game.tournamentBracket[1]}`);
  setText('tournament', 'tourn-b3', `  ${game.tournamentBracket[2]}`);
  setText('tournament', 'tourn-b4', `  ${game.tournamentBracket[3]}`);
  setText('tournament', 'tourn-b5', '');
  setText('tournament', 'tourn-b6', '');
  setText('tournament', 'tourn-b7', '');
  setText('tournament', 'tourn-b8', '');
  setText('tournament', 'tourn-opponent', `vs. ${game.tournamentBracket[1]}`);
  setText('tournament', 'tourn-status', 'Ready to play');
}

function playTournamentMatch(): void {
  if (game.tournamentRound >= 3) {
    showState('modeselect');
    return;
  }
  const opponentIdx = game.tournamentRound === 0 ? 1 : 3; // semifinal then final
  const opp = game.tournamentBracket[opponentIdx] || 'CPU';
  game.difficulty = game.tournamentRound === 0 ? 'medium' : 'hard'; // harder in final
  showState('difficulty');
  // Skip difficulty screen for tournament, go straight to game
  startGame();
}

// ============================================================
// Stats Panel
// ============================================================
function populateStats(): void {
  setText('stats', 'stat-games', String(stats.totalGames));
  setText('stats', 'stat-wins', String(stats.totalWins));
  const wr = stats.totalGames > 0 ? Math.round((stats.totalWins / stats.totalGames) * 100) : 0;
  setText('stats', 'stat-winrate', `${wr}%`);
  setText('stats', 'stat-stones', String(stats.totalStonesThrown));
  setText('stats', 'stat-takeouts', String(stats.totalTakeouts));
  setText('stats', 'stat-bestend', String(stats.bestEnd));
  setText('stats', 'stat-sweep', String(Math.round(stats.totalSweepTime)));
  setText('stats', 'stat-ach', `${unlockedAchievements.size}/${ACHIEVEMENTS.length}`);
  // XP display
  const currentXp = xpInCurrentLevel(stats.xp);
  const needed = xpForLevel(stats.level);
  setText('stats', 'stats-title', `CAREER STATS — Level ${stats.level} (${currentXp}/${needed} XP)`);
}

// ============================================================
// Stone Skins
// ============================================================
function populateStoneSkins(): void {
  const currentSkin = STONE_SKINS[game.stoneSkin];
  setText('stoneskins', 'skin-current', `Selected: ${currentSkin.name}`);
  for (let i = 0; i < STONE_SKINS.length; i++) {
    const skin = STONE_SKINS[i];
    const unlocked = unlockedSkins.has(skin.id);
    const selected = game.stoneSkin === i;
    const prefix = selected ? '> ' : '  ';
    const suffix = unlocked ? '' : ' [LOCKED]';
    setText('stoneskins', `skin-n${i}`, `${prefix}${skin.name}${suffix}`);
  }
}

function selectStoneSkin(index: number): void {
  const skin = STONE_SKINS[index];
  if (!unlockedSkins.has(skin.id)) {
    showToast('LOCKED', skin.unlockCondition);
    return;
  }
  game.stoneSkin = index;
  saveSelectedSkin(index);
  populateStoneSkins();
  showToast('Skin Selected', skin.name);

  // Update player stone colors
  for (let i = 0; i < 8; i++) {
    const mat = (stoneMeshes[i] as any).material as MeshStandardMaterial;
    mat.emissive.setHex(skin.emissive);
    const glowMat = (stoneGlows[i] as any).material as MeshBasicMaterial;
    glowMat.color.setHex(skin.glowColor);
  }
}

// ============================================================
// Trail System
// ============================================================
function updateTrails(dt: number): void {
  // Add trail points for moving stones
  for (const stone of game.stonesOnIce) {
    if (!stone.active) continue;
    const speed = Math.sqrt(stone.vx * stone.vx + stone.vz * stone.vz);
    if (speed < STONE_STOP_THRESHOLD * 2) continue;

    const trail = stoneTrails.get(stone.meshIndex);
    if (trail) {
      trail.push({ x: stone.x, z: stone.z, age: 0 });
      if (trail.length > MAX_TRAIL_POINTS) trail.shift();
    }
  }

  // Age and cull trail points
  for (const [, trail] of stoneTrails) {
    for (let i = trail.length - 1; i >= 0; i--) {
      trail[i].age += dt;
      if (trail[i].age > TRAIL_LIFETIME) {
        trail.splice(i, 1);
      }
    }
  }

  // Render trail marks on ice
  // Clean up old trail meshes
  for (const tm of trailMeshes) {
    world.scene.remove(tm);
    (tm.geometry as any).dispose();
    ((tm.material as any) as MeshBasicMaterial).dispose();
  }
  trailMeshes.length = 0;

  // Create new trail meshes
  const trailGeo = new PlaneGeometry(0.06, 0.06);
  for (const [meshIdx, trail] of stoneTrails) {
    const isPlayer = meshIdx < 8;
    const trailColor = isPlayer ? currentTheme.playerStone : currentTheme.cpuStone;
    for (let i = 0; i < trail.length; i += 3) { // every 3rd point for performance
      const pt = trail[i];
      const alpha = 1 - pt.age / TRAIL_LIFETIME;
      if (alpha <= 0) continue;
      const mat = new MeshBasicMaterial({
        color: trailColor, transparent: true, opacity: alpha * 0.2, blending: AdditiveBlending,
      });
      const mesh = new Mesh(trailGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(pt.x, 0.01, pt.z);
      world.scene.add(mesh);
      trailMeshes.push(mesh);
    }
  }
}

// ============================================================
// Camera Follow
// ============================================================
function updateCameraFollow(dt: number): void {
  if (!cameraFollowTarget || !cameraFollowTarget.active) {
    cameraFollowTarget = null;
    return;
  }

  const speed = Math.sqrt(cameraFollowTarget.vx ** 2 + cameraFollowTarget.vz ** 2);
  if (speed < STONE_STOP_THRESHOLD) {
    cameraFollowTarget = null;
    return;
  }

  // Gentle lerp camera z to track the stone
  cameraFollowLerp += dt * 2;
  const t = Math.min(cameraFollowLerp, 1);
  const targetZ = cameraFollowTarget.z + 2; // camera stays behind stone
  const cam = world.scene.getObjectByName('camera') || (world.player?.head as any)?.object3D;
  if (cam) {
    // Only nudge, don't override VR headset position
    // In browser mode, smooth follow
  }
}

// ============================================================
// Sweep tracking for achievements
// ============================================================
function trackSweep(): void {
  noSweepThisMatch = false;
}

// ============================================================
// Start
// ============================================================
main().catch(console.error);
