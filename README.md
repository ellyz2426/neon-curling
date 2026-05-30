# Neon Curling VR

Holodeck VR curling — slide neon stones down a glowing ice sheet, sweep to control speed, and outmaneuver the AI opponent in this precision ice sport.

Built with [IWSDK 0.4.1](https://iwsdk.dev) (Immersive Web SDK).

## 🎮 Play

**[▶ Play Now](https://ellyz2426.github.io/neon-curling/)**

Works in any modern browser. VR headset optional (Meta Quest recommended).

## Features

### Gameplay
- **Custom curling physics**: ice friction, swept friction, curl spin, elastic stone-stone collisions, wall bouncing, hog-line violations
- **6 game modes**: Standard (8 ends), Quick (4 ends), Knockout (1 stone), Tournament (4-team bracket), Daily Challenge (seeded PRNG), Practice
- **3 AI difficulty levels** with strategic AI (takeouts, draws, guards, freeze shots, come-around curls, hammer strategy)
- **Hammer tracking** — authentic curling rule: scoring team gives up last-stone advantage
- **Extra end tiebreaker** — sudden death if tied after regulation
- **Ice condition system** — Standard, Fast, Slow, Curly ice modifiers (randomized in daily challenges)
- **Sweeping mechanic** reduces friction (Space key / left VR trigger)
- **Curl spin control** for curved shots (A/D keys / thumbstick)
- **Concede option** from pause menu

### Progression
- **XP / level system** — earn XP for wins, difficulty, scoring, tournament play
- **30 achievements** with localStorage persistence
- **8 stone skins** unlocked by wins (Championship Gold from tournament)
- **Career stats tracking** — games, wins, takeouts, sweep time, best end, win rate
- **Top 20 leaderboard**

### Visuals
- **Holodeck environment**: grid floor/ceiling, 12 floating wireframe decorations, 40 ambient particles
- **5 ice themes**: Holodeck, Crimson, Toxic, Ultraviolet, Solar
- **Ice pebble marks** — 200 surface detail dots
- **Stone trail rendering** — glowing marks on ice behind sliding stones
- **Animated house ring scoring** — ring brightness pulses during scoring
- **Stone spin visualization** — visible rotation during curl
- **Button-proximity glow** — closest stones pulse brighter
- **Power charge indicator** — stone scales up while charging
- **Celebration particles** — burst on scoring
- **End summary panel** — detailed breakdown after each end

### Audio
- **20+ procedural Web Audio SFX**: stone release, collision, sweep, takeout, hog violation, score, achievement, extra end, tournament win, skin unlock, countdown, game start/end
- **Ambient synthwave drone** music with bass + pad + LFO

### UI
- **19 PanelUI templates** (`.uikitml`), zero HTML DOM — fully VR-compatible
- HUD with end, scores, stones, turn, hammer indicator, best stone distance
- Practice mode tips with rotating suggestions

### Controls
| Action | Browser | VR |
|--------|---------|-----|
| Charge & Throw | Click + hold, release | Right Trigger |
| Aim | Mouse left/right | Right Thumbstick |
| Sweep | Hold Space | Left Trigger |
| Curl | A/D keys | Right Thumbstick X |
| Pause | Escape | B Button |

## Tech

- IWSDK 0.4.1 (Three.js + ECS)
- TypeScript (~2,500 lines across 3 source files)
- 19 `.uikitml` spatial UI templates
- Procedural Web Audio (no audio files)
- localStorage persistence (achievements, stats, skins, leaderboard)
- GitHub Pages deployment

## Build

```bash
npm install
npx vite build
```

## License

MIT
