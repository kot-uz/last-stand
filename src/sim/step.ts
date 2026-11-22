import { updateBoss } from './boss';
import { buildGrid, cleanup, separateZombies, updateBullets, updateProps, updateShots, updateZombies, zombieContacts } from './combat';
import { updateDirector } from './director';
import { updateSquad } from './squad';
import type { World } from './world';

export const STEP = 1 / 60;

/** Advance the simulation by one fixed step. */
export function step(w: World, dt = STEP) {
  if (w.hitstop > 0) {
    w.hitstop -= dt;
    return;
  }
  if (w.slowmo > 0) {
    w.slowmo -= dt;
    dt *= 0.3;
  }
  w.time += dt;
  if (w.state === 'playing') w.stats.time += dt;
  else w.endT += dt;

  w.squadY -= w.scroll * dt;
  updateDirector(w, dt);
  updateSquad(w, dt);
  updateZombies(w, dt);
  buildGrid(w);
  separateZombies(w);
  zombieContacts(w);
  updateBullets(w, dt);
  updateProps(w, dt);
  updateShots(w, dt);
  updateBoss(w, dt);
  cleanup(w);
  if (w.zombies.length > w.stats.peakZombies) w.stats.peakZombies = w.zombies.length;
}
