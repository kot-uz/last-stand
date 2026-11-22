import { POWERS, TIMED_POWERS } from '../config/props';
import type { Effects } from '../render/fx';
import { SS, drawWeaponIcon, ellipse } from '../render/sprites';
import type { World } from '../sim/world';

const el = (html: string) => {
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d.firstElementChild as HTMLElement;
};

export class Hud {
  root: HTMLElement;
  private progFill!: HTMLElement;
  private progLbl!: HTMLElement;
  private progEnd!: HTMLElement;
  private coins!: HTMLElement;
  private coinBox!: HTMLElement;
  private boss!: HTMLElement;
  private bossFill!: HTMLElement;
  private bossName!: HTMLElement;
  private wIcon!: HTMLCanvasElement;
  private wName!: HTMLElement;
  private ammo!: HTMLElement;
  private ammoFill!: HTMLElement;
  private ammoT!: HTMLElement;
  private cnt!: HTMLElement;
  private hp!: HTMLElement;
  private hpFill!: HTMLElement;
  private powers!: HTMLElement;
  private banner!: HTMLElement;
  private hint!: HTMLElement;
  private dragHint!: HTMLElement;
  private bannerQueue: World['banners'] = [];
  private bannerT = 0;
  private last: Record<string, string | number> = {};
  onPause: () => void = () => {};

  constructor(root: HTMLElement) {
    this.root = root;
  }

  build(w: World) {
    this.root.innerHTML = '';
    this.last = {};
    this.bannerQueue = [];
    this.bannerT = 0;
    const top = el(`<div class="hud-top">
      <button class="icon-btn" aria-label="Пауза">❚❚</button>
      <div class="progress"><div class="lbl"></div><div class="bar"><div class="fill"></div><div class="end"></div></div></div>
      <div class="coins hud-coins"><span class="coin-ico"></span><span class="v">0</span></div>
    </div>`);
    top.querySelector('button')!.addEventListener('click', () => this.onPause());
    this.progFill = top.querySelector('.bar .fill')!;
    this.progLbl = top.querySelector('.lbl')!;
    this.progEnd = top.querySelector('.end')!;
    this.coinBox = top.querySelector('.hud-coins')!;
    this.coins = top.querySelector('.hud-coins .v')!;
    this.root.append(top);

    this.boss = el(`<div class="bossbar"><div class="nm"></div><div class="bar"><div class="fill"></div></div></div>`);
    this.bossFill = this.boss.querySelector('.fill')!;
    this.bossName = this.boss.querySelector('.nm')!;
    this.root.append(this.boss);

    const bottom = el(`<div class="hud-bottom">
      <div class="card wcard"><canvas width="${46 * SS}" height="${46 * SS}"></canvas><div><div class="wn"></div><div class="ammo"><div class="fill"></div></div><div class="ammo-t"></div></div></div>
      <div class="card scard"><div class="cnt">👥 <span class="n">1</span> <small>бойцов</small></div><div class="hp"><div class="fill"></div></div></div>
    </div>`);
    this.wIcon = bottom.querySelector('canvas')!;
    this.wName = bottom.querySelector('.wn')!;
    this.ammo = bottom.querySelector('.ammo')!;
    this.ammoFill = bottom.querySelector('.ammo .fill')!;
    this.ammoT = bottom.querySelector('.ammo-t')!;
    this.cnt = bottom.querySelector('.cnt .n')!;
    this.hp = bottom.querySelector('.hp')!;
    this.hpFill = bottom.querySelector('.hp .fill')!;
    this.root.append(bottom);

    this.powers = el(`<div class="powers"></div>`);
    this.root.append(this.powers);
    this.banner = el(`<div class="banner"><div class="t"></div><div class="s"></div></div>`);
    this.root.append(this.banner);
    this.hint = el(`<div class="hint" style="display:none"></div>`);
    this.root.append(this.hint);
    this.dragHint = el(`<div class="drag-hint" style="display:none"><div class="hand">👆</div><div>Веди влево-вправо</div></div>`);
    this.root.append(this.dragHint);
    this.progLbl.textContent = w.level.endless ? 'Бесконечная дорога' : `${w.level.id} · ${w.level.name}`;
    this.progEnd.textContent = w.level.endless ? '' : w.level.boss ? '☠' : '⛺';
  }

  showDragHint(on: boolean) { this.dragHint.style.display = on ? 'flex' : 'none'; }

  private set(key: string, v: string | number, fn: () => void) {
    if (this.last[key] === v) return;
    this.last[key] = v;
    fn();
  }

  update(w: World, fx: Effects, dt: number) {
    const prog = w.level.endless ? Math.min(1, (w.dist % 1600) / 1600) : w.progress;
    this.set('prog', Math.round(prog * 200), () => (this.progFill.style.width = `${prog * 100}%`));
    if (w.level.endless) this.set('dist', Math.floor(w.dist / 10), () => (this.progLbl.textContent = `Бесконечная дорога · ${Math.floor(w.dist / 10)} м`));
    const coins = Math.floor(w.stats.coins);
    this.set('coins', coins, () => {
      this.coins.textContent = String(coins);
      this.coinBox.classList.remove('bump');
      void this.coinBox.offsetWidth;
      this.coinBox.classList.add('bump');
    });

    const b = w.boss;
    const bossOn = !!b && b.entered && !b.dead;
    this.set('bossOn', bossOn ? 1 : 0, () => {
      this.boss.classList.toggle('on', bossOn);
      if (b) this.bossName.textContent = b.name;
    });
    if (bossOn) this.set('bossHp', Math.round((b!.hp / b!.maxHp) * 300), () => (this.bossFill.style.width = `${(b!.hp / b!.maxHp) * 100}%`));

    const wd = w.weapon;
    this.set('wid', wd.def.id + wd.lvl, () => {
      const g = this.wIcon.getContext('2d')!;
      g.setTransform(SS, 0, 0, SS, 0, 0);
      g.clearRect(0, 0, 46, 46);
      g.translate(23, 23);
      ellipse(g, 0, 0, 20, 20, wd.def.ammo ? '#ffb627' : '#3a3f52', true, 2);
      drawWeaponIcon(g, wd.def.id, 28, wd.def.ammo ? '#1a1a22' : '#e8e2d4');
      this.wName.innerHTML = `${wd.def.name}${wd.lvl > 1 ? ` <span class="wl">${'I'.repeat(wd.lvl)}</span>` : ''}`;
      this.ammo.style.display = wd.def.ammo ? 'block' : 'none';
      if (!wd.def.ammo) this.ammoT.textContent = '∞ патронов';
    });
    if (wd.def.ammo) this.set('ammo', wd.ammo, () => {
      this.ammoFill.style.width = `${(wd.ammo / wd.maxAmmo) * 100}%`;
      this.ammoT.textContent = `${wd.ammo} / ${wd.maxAmmo}`;
    });

    let hp = 0, max = 0;
    for (const m of w.squad) { hp += m.hp; max += m.maxHp; }
    const r = max ? hp / max : 0;
    this.set('cnt', w.squad.length, () => (this.cnt.textContent = String(w.squad.length)));
    this.set('hp', Math.round(r * 100), () => {
      this.hpFill.style.width = `${r * 100}%`;
      this.hp.classList.toggle('low', r < 0.35);
    });

    const pk = TIMED_POWERS.filter(p => w.powers[p] > 0).map(p => p + Math.ceil(w.powers[p])).join();
    this.set('pw', pk, () => {
      this.powers.innerHTML = TIMED_POWERS.filter(p => w.powers[p] > 0)
        .map(p => `<div class="pw" style="background:${POWERS[p].color}">${POWERS[p].icon}<div class="left" style="height:${(1 - w.powers[p] / POWERS[p].dur) * 100}%"></div></div>`)
        .join('');
    });

    // banners
    if (w.banners.length) { this.bannerQueue.push(...w.banners); w.banners.length = 0; }
    this.bannerT -= dt;
    if (this.bannerT <= 0 && this.bannerQueue.length) {
      const bn = this.bannerQueue.shift()!;
      const t = this.banner.querySelector('.t') as HTMLElement;
      t.textContent = bn.text;
      t.classList.toggle('big', !!bn.big);
      t.style.color = bn.color ?? '#fff';
      (this.banner.querySelector('.s') as HTMLElement).textContent = bn.sub ?? '';
      this.banner.classList.remove('show');
      void this.banner.offsetWidth;
      this.banner.classList.add('show');
      this.bannerT = this.bannerQueue.length ? 1.1 : 1.6;
    }
    const hint = fx.hints[0]?.text ?? '';
    this.set('hint', hint, () => {
      this.hint.style.display = hint ? 'block' : 'none';
      this.hint.textContent = hint;
    });
  }
}
