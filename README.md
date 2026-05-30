# Neon Curling VR

Holodeck VR curling — slide neon stones down a glowing ice sheet, sweep to control speed, and outmaneuver the AI opponent in this precision ice sport.

Built with [IWSDK 0.4.1](https://iwsdk.dev) (Immersive Web SDK).

## Play

**Live:** https://ellyz2426.github.io/neon-curling/

## Features

### Gameplay
- **Custom curling physics**: Ice friction, curl factor, stone-stone elastic collisions, wall bounces
- **Sweeping mechanic**: Hold Space (browser) or Left Trigger (VR) after release to reduce friction and extend stone travel
- **Curl control**: A/D keys or thumbstick to add left/right curl spin
- **Turn-based strategy**: Alternate throws with AI, play guards, takeouts, and draws
- **Scoring**: Closest stone(s) to button score — 1 point per stone closer than opponent's best

### Game Modes
- **Standard**: 8 ends, 4 stones each per end (full match)
- **Quick Match**: 4 ends, fast game
- **Knockout**: 1 stone each, single end — last stone wins
- **Daily Challenge**: Seeded PRNG for daily reproducibility
- **Practice**: Unlimited throws, no opponent, free practice

### AI Opponent
- **3 difficulty levels**: Easy, Medium, Hard
- **Strategic targeting**: Takeout attempts on close player stones, draw shots to button
- **Adaptive accuracy**: Scales with difficulty — noise, power, and aim variance

### Controls

| Action | Browser | VR |
|--------|---------|-----|
| Charge throw | Click + hold | Right Trigger hold |
| Release/throw | Release click | Release Trigger |
| Aim direction | Mouse left/right | Right Thumbstick |
| Curl (spin) | A/D keys | Left Thumbstick |
| Sweep | Hold Space | Left Trigger |
| Pause | ESC | B Button |

### Visual & Audio
- 5 ice themes: Holodeck, Crimson, Toxic, Ultraviolet, Solar
- Holodeck environment: neon grid floor/ceiling, floating wireframe decorations, ambient particles
- House (target rings): 4-foot, 8-foot, 12-foot concentric rings with button center
- Procedural Web Audio: 15+ SFX (stone release, collision, sweep, score, takeout, countdown) + ambient drone
- Particle effects on stone collisions

### Progression
- 20 achievements (First Stone, Takeout Artist, Double Takeout, Sweep Master, Champion, etc.)
- Leaderboard (top 20 results)
- Statistics tracking (games, wins, stones thrown, takeouts, best end, sweep time)

### Tech
- IWSDK 0.4.1 dual-runtime (VR + browser) with `xr: { offer: 'once' }`
- **ALL UI via PanelUI** — 15 `.uikitml` templates, zero HTML DOM overlays
- Follower head-locked HUDs: score, power bar, sweep bar, toast, countdown
- World-space panels: title, mode select, difficulty, scoreboard, game over, leaderboard, achievements, settings, help
- Zero TypeScript errors
- Zero HTML DOM anti-patterns

## Project Structure

```
src/
  index.ts    - Main game (world, physics, AI, input, UI)
  types.ts    - Types, constants, themes, achievements, persistence
  audio.ts    - AudioManager with procedural SFX + ambient music
ui/
  title.uikitml, modeselect.uikitml, difficulty.uikitml,
  hud.uikitml, sweepbar.uikitml, powerbar.uikitml,
  scoreboard.uikitml, pause.uikitml, gameover.uikitml,
  leaderboard.uikitml, achievements.uikitml, settings.uikitml,
  help.uikitml, toast.uikitml, countdown.uikitml
```

## Build

```bash
npm install
npm run build
```

## License

Private project — IWSDK game portfolio.
