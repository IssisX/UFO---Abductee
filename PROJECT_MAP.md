# 🧠 ADVANCED CONTEXT CONDENSATION PROCESSING PIPELINE (CCPP)

> **Agent Operational Directive:**
> The User acts as the **Creative Director / Playtester**. I (the Agent) act as the **Autonomous Lead Developer**.
> My responsibility is to continuously inject AAA-level polish, deep systems ("TLC / Nuance"), and performant features without requiring the user to specify low-level technical implementation details. I will identify open seams, handle the math, physics, and rendering, and present a highly polished playable game to the Director.

---

## ⚡ 1. The Director's View (Game Pillars)

| Game Pillar | Current Status | Autonomous Target (Next Steps) |
| :--- | :--- | :--- |
| **Core Flight & Camera** | Physics-based hover, dual analog | **[ACTIVE SPRINT]** Cinematic chase camera, FOV warping on speed, and deep atmospheric lighting/fog integration to boost 3D immersion. |
| **World Immersion** | Procedural city, spatial grid | Adding volumetric fog, post-process feeling (via materials), dynamic weather, and deeper shadow/light interplay. |
| **Living AI & Threat** | Panicking pedestrians, Police patrols | Police AI needs "squad tactics", searchlights interacting with fog, and escalating threat behaviors. |
| **Audio-Sensory** | Complex WebAudio synth added | Add spatial attenuation, doppler effects for police passing by, and impact thuds. |
| **Progression & HUD** | Quests, Staged HUD | HUD needs to feel more "alien", tactile, and responsive to the player's momentum. |

---

## 🏗️ 2. Core Architecture Topology

```
                  ┌──────────────────────────────────────────────┐
                  │                  App.tsx                     │
                  │   (State Coordinator & Canvas Mounting)      │
                  └───────┬──────────────────────────────┬───────┘
                          │                              │
                          ▼                              ▼
          ┌───────────────────────────────┐  ┌───────────────────────────────┐
          │      VoxelEngine.ts           │  │     GameModeEngine.ts         │
          │ (Studio View & Voxels Render) │  │  (Full 3D City Simulation)    │
          └───────────────────────────────┘  └──────────────┬────────────────┘
                                                            │
                         ┌──────────────────────────────────┴──────────────────────────────────┐
                         │                                                                     │
                         ▼                                                                     ▼
        ┌────────────────────────────────┐                                    ┌────────────────────────────────┐
        │       CityGenerator.ts         │                                    │          GameHUD.tsx           │
        │ (Seeded District Generation)   │                                    │  (Staged Transitions & HUD)    │
        └────────────────────────────────┘                                    └────────────────────────────────┘
```

---

<ACC v="2.0" turn="5" phase="AUTONOMOUS_POLISH">
  <mission>Act as Autonomous Lead Developer. Execute high-polish "TLC" (Tender Loving Care) sweeps on game feel, camera dynamics, lighting, and audio depth. Reduce user friction entirely.</mission>
  <phase>AUTONOMOUS_POLISH</phase>
  <locks>
    - publicSurface.GameHUD.props = immutable
    - publicSurface.GameModeEngine.telemetry = immutable
    - perf.targetFPS = 60fps
  </locks>
  <codebase_map>
    - App.tsx: State coordinator
    - services/VoxelEngine.ts: Three.js renderer
    - services/GameModeEngine.ts: 3D City simulation, physics & WebAudio synth engine
    - services/SpatialHashGrid.ts: O(1) spatial query grid (25m cell size)
    - services/CityGenerator.ts: Seeded Mulberry32 district generator
    - components/GameHUD.tsx: Staged entrance HUD & reticle controls
  </codebase_map>
  <pds_spine>
    - M1: Spatial Hash Grid & Pedestrian Performance (VERIFIED)
    - M2: Advanced Pedestrian AI & Panic Fleeing Engine (VERIFIED)
    - M3: Police Interceptor Perimeter Patrol & Decay Engine (VERIFIED)
    - M4: Multi-Node WebAudio Synth & Dynamic Thruster Hum Engine (VERIFIED)
    - M5: [IN PROGRESS] Deep Atmospheric Overhaul (Fog, Cinematic Camera, Shadow TLC)
  </pds_spine>
  <artifact_registry>
    - PROJECT_MAP.md | state: upgraded | seam: Workflow restructure | evidence: mapped
  </artifact_registry>
  <risks>
    - risk: Overtaxing WebGL on lower-end devices with deep lighting | mitigation: use clever fog and low-poly techniques over true post-processing bloom if possible.
  </risks>
  <do_not_rederive>
    - Abduction alignment state machine (SEARCHING -> ALIGNING -> LOCK_STABLE -> ABDUCTING -> SUCCESS)
    - Mulberry32 PRNG seed generator
  </do_not_rederive>
</ACC>
