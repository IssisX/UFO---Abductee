/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Quest } from '../types';

export const UFO_QUESTS: Quest[] = [
  { id: 'u0', title: 'First Abduction', description: 'Abduct 1 Civilian with Tractor Beam [F]', progress: 0, target: 1, completed: false, reward: 800 },
  { id: 'u1', title: 'Crystal Harvester', description: 'Collect 3 Cyber Crystals', progress: 0, target: 3, completed: false, reward: 500 },
  { id: 'a50', title: 'High Altitude', description: 'Reach 45m Altitude in Flight', progress: 0, target: 45, completed: false, reward: 750 },
  { id: 'emp3', title: 'Shockwave Master', description: 'Fire Action Ability 3 Times', progress: 0, target: 3, completed: false, reward: 1000 },
  { id: 'u2', title: 'Alien Scientist', description: 'Abduct 3 Civilians & Launch Ragdolls!', progress: 0, target: 3, completed: false, reward: 1500 }
];

export const ALIEN_QUESTS: Quest[] = [
  { id: 'al1', title: 'First Contact', description: 'Talk to or scare 3 civilians on foot [F]', progress: 0, target: 3, completed: false, reward: 800 },
  { id: 'al2', title: 'Ground Explorer', description: 'Explore city sidewalks on foot', progress: 0, target: 1, completed: false, reward: 600 },
  { id: 'al3', title: 'Roof Leaper', description: 'Use parkour bounce pads to jump onto roofs', progress: 0, target: 1, completed: false, reward: 900 },
  { id: 'al4', title: 'Master Terrifier', description: 'Scare 5 civilians with Telepathy', progress: 0, target: 5, completed: false, reward: 1200 }
];
