import { ALLIES } from '../config/allies';
import { ZOMBIES } from '../config/enemies';
import { CHAPTERS, ENDLESS, LEVELS, type LevelDef } from '../config/levels';
import { UPGRADES, upgradeCost } from '../config/upgrades';
import { audio } from '../core/audio';
import { Input } from '../core/input';
import { buyUpgrade, finishLevel, mods, persist, save, totalStars, type LevelResult } from '../meta/save';
import { Renderer } from '../render/renderer';
import { SS, survivorSprite, zombieSet } from '../render/sprites';
import { botControl } from '../sim/bot';
import { STEP, step } from '../sim/step';
import { ROAD_L, ROAD_R, World } from '../sim/world';
import { Hud } from './hud';

type Mode = 'title' | 'menu' | 'play' | 'pause' | 'end';

const h = (html: string) => {
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d.firstElementChild as HTMLElement;
};
const coinsHtml = (n: number) => `<span class="coins"><span class="coin-ico"></span>${Math.floor(n)}</span>`;

export class App {
  stage = document.getElementById('stage')!;
  ui = document.getElementById('ui')!;
  r: Renderer;
  hud: Hud;
  input = new Input();
  world!: World;
  mode: Mode = 'title';
  level: LevelDef = LEVELS[0];
  acc = 0;
  last = performance.now();
  firstMove = false;

  constructor() {
    this.r = new Renderer(document.getElementById('game') as HTMLCanvasElement);
    this.hud = new Hud(document.getElementById('hud')!);
    this.hud.onPause = () => this.pause();
    this.input.getScale = () => this.r.scale;
    this.input.onPause = () => (this.mode === 'play' ? this.pause() : this.mode === 'pause' ? this.resume() : 0);
    this.input.onFirstInput = () => { audio.unlock(); if (this.mode === 'play') { this.firstMove = true; this.hud.showDragHint(false); } };
    this.input.attach(this.stage);
    audio.enabled = save.sound;
    audio.musicOn = save.music;
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (this.mode === 'play') this.pause(); audio.suspend(); } else audio.resume();
    });
    document.addEventListener('pointerdown', () => audio.unlock(), { once: true });
    this.resize();
    this.demo();
    this.showTitle();
    requestAnimationFrame(t => this.frame(t));
  }

  resize() {
    const vh = this.r.resize(window.innerWidth, window.innerHeight);
    const cw = parseFloat(this.r.canvas.style.width);
    this.stage.style.width = this.r.canvas.style.width;
    this.stage.style.height = this.r.canvas.style.height;
    document.documentElement.style.setProperty('--u', `${cw / 540}px`);
    if (this.world) this.world.viewH = vh;
  }

  private newWorld(level: LevelDef, demo = false) {
    const w = new World(level, mods(), demo ? [{ cls: 'rifleman', rank: 1 }, { cls: 'gunner', rank: 0 }, { cls: 'medic', rank: 0 }] : save.squad);
    w.viewH = this.r.viewH;
    w.demo = demo;
    this.world = w;
    this.r.setLevel(w);
    this.input.reset();
  }

  demo() { this.newWorld({ ...LEVELS[2], length: Infinity, endless: true }, true); }

  frame(t: number) {
    const dt = Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    const w = this.world;
    if (this.mode !== 'play') this.input.flush();
    const running = this.mode === 'play' || this.mode === 'title' || this.mode === 'menu' || this.mode === 'end';
    if (running) {
      this.acc += dt;
      while (this.acc >= STEP) {
        if (w.demo) {
          botControl(w, 0.9);
          if (w.squad.length < 3) w.addMember('rifleman', 0, true);
        } else if (this.mode === 'play') {
          const [l, r] = w.roadBounds(w.squadY);
          w.targetX = this.input.apply(w.targetX, STEP, Math.max(ROAD_L, l), Math.min(ROAD_R, r));
        }
        step(w);
        if (w.demo) { w.sfx.length = 0; w.banners.length = 0; }
        this.acc -= STEP;
      }
      if (!w.demo) {
        for (const s of w.sfx) audio.play(s);
        w.sfx.length = 0;
      }
    }
    this.r.render(w, running ? dt : 0);
    if (this.mode === 'play') {
      this.hud.update(w, this.r.fx, dt);
      audio.music(dt, Math.min(1, w.zombies.length / 60 + (w.boss ? 0.6 : 0)), true);
      if (w.state !== 'playing' && w.endT > (w.state === 'won' ? 1.8 : 1.4)) this.endLevel();
    }
    requestAnimationFrame(tt => this.frame(tt));
  }

  // ───────────────────────── screens ─────────────────────────
  private show(node: HTMLElement) {
    this.ui.innerHTML = '';
    this.ui.append(node);
    node.querySelectorAll('button').forEach(b => b.addEventListener('click', () => audio.play('click')));
  }

  showTitle() {
    this.mode = 'title';
    this.hud.root.innerHTML = '';
    const s = h(`<div class="screen title">
      <div class="logo"><div class="l1">LAST</div><div class="l2">STAND</div><div class="tag">Дорога мёртвых</div></div>
      <div class="title-actions">
        <button class="btn" data-a="play">Играть</button>
        <div class="title-row"><button class="btn secondary small" data-a="sound">${save.sound ? '🔊' : '🔇'} Звук</button></div>
      </div></div>`);
    s.querySelector('[data-a=play]')!.addEventListener('click', () => { audio.unlock(); this.showMap(); });
    s.querySelector('[data-a=sound]')!.addEventListener('click', e => {
      save.sound = !save.sound; persist(); audio.setEnabled(save.sound);
      (e.target as HTMLElement).textContent = `${save.sound ? '🔊' : '🔇'} Звук`;
    });
    this.show(s);
  }

  showMap() {
    this.mode = 'menu';
    if (!this.world.demo) this.demo();
    this.hud.root.innerHTML = '';
    const chapters = CHAPTERS.map((c, ci) => {
      const lv = LEVELS.filter(l => l.chapter === ci);
      const locked = lv[0].index > save.unlocked;
      const nodes = lv.map(l => {
        const st = save.stars[l.id] ?? 0;
        const cls = l.index > save.unlocked ? 'locked' : l.index === save.unlocked && !st ? 'current' : 'done';
        return `<button class="node ${cls} ${l.boss ? 'boss' : ''}" data-l="${l.id}">
          <div class="disc">${l.index > save.unlocked ? '🔒' : l.index % 4 + 1}</div>
          <div class="stars">${[0, 1, 2].map(i => `<span class="${i < st ? 'on' : ''}">★</span>`).join('')}</div></button>`;
      }).join('');
      return `<div class="panel chapter ${locked ? 'locked' : ''}" style="--cc:${c.color};animation-delay:${ci * 0.06}s">
        <div class="bgart">${ci + 1}</div>
        <div class="chapter-head"><div><div class="sub">${c.subtitle}</div><div class="name">${c.name}</div></div></div>
        <div class="nodes">${nodes}</div></div>`;
    }).join('');
    const endlessOpen = save.unlocked >= 4;
    const s = h(`<div class="screen dim scroll">
      <div class="topbar"><button class="icon-btn" data-a="back">‹</button>
        <span class="chip"><span class="star">★</span> ${totalStars()}/48</span>${coinsHtml(save.coins)}</div>
      <div class="chapters">${chapters}
        <div class="panel endless ${endlessOpen ? '' : 'locked'}"><div><div class="h2">∞ Бесконечная дорога</div>
          <div class="muted" style="font-size:calc(var(--u)*13)">${endlessOpen ? `Рекорд: ${save.endlessBest} м` : 'Откроется после главы 1'}</div></div>
          <button class="btn small" data-a="endless" ${endlessOpen ? '' : 'disabled'}>Старт</button></div>
      </div>
      <div class="bottom-actions"><button class="btn teal" data-a="shop">⚙ Улучшения</button></div></div>`);
    s.querySelector('[data-a=back]')!.addEventListener('click', () => this.showTitle());
    s.querySelector('[data-a=shop]')!.addEventListener('click', () => this.showShop(() => this.showMap()));
    s.querySelector('[data-a=endless]')!.addEventListener('click', () => this.start(ENDLESS));
    s.querySelectorAll<HTMLElement>('.node').forEach(n => n.addEventListener('click', () => {
      const l = LEVELS.find(x => x.id === n.dataset.l)!;
      if (l.index <= save.unlocked) this.brief(l);
    }));
    this.show(s);
  }

  private zombieCanvas(type: string) {
    const c = document.createElement('canvas');
    c.width = c.height = 64 * SS;
    const g = c.getContext('2d')!;
    const def = (ZOMBIES as any)[type];
    const set = zombieSet(Object.keys(ZOMBIES).indexOf(type), 0);
    const sc = Math.min(1.8, 56 / set.size * 1.4);
    g.drawImage(set.frames[0].c, 32 * SS - (set.size * sc * SS) / 2, 32 * SS - (set.size * sc * SS) / 2, set.size * sc * SS, set.size * sc * SS);
    void def;
    return c;
  }

  private unitCanvas(cls: string) {
    const c = document.createElement('canvas');
    c.width = c.height = 40 * SS;
    const s = survivorSprite(cls as any, 0);
    c.getContext('2d')!.drawImage(s.c, (40 - s.w) * SS / 2, (40 - s.h) * SS / 2 + 4);
    return c;
  }

  brief(l: LevelDef) {
    const ch = CHAPTERS[l.chapter];
    if (!save.seenStory.includes(l.chapter)) {
      save.seenStory.push(l.chapter); persist();
      const s = h(`<div class="screen story"><div class="chap" style="color:${ch.color}">${ch.subtitle}</div>
        <div class="name">${ch.name}</div><p>${ch.story}</p><button class="btn">Продолжить</button></div>`);
      s.querySelector('button')!.addEventListener('click', () => this.brief(l));
      this.show(s);
      return;
    }
    const s = h(`<div class="screen dim scroll"><div class="panel modal">
      <div class="brief-head"><div class="lid">${ch.name.toUpperCase()} · ${l.id}</div><div class="h1" style="text-align:left">${l.name}</div></div>
      <div class="brief-desc">${l.desc}</div>
      <div class="enemies"></div>
      <div><div class="label">Звёзды</div><div class="goals">
        <div><span class="star">★</span> Дойти до конца</div><div><span class="star">★</span> Спасти 60% выживших</div><div><span class="star">★</span> Без потерь в отряде</div></div></div>
      <div><div class="label">Отряд</div><div class="squad-row"></div></div>
      <div class="row"><button class="btn secondary" data-a="back">Назад</button><button class="btn" data-a="go">В бой!</button></div>
    </div></div>`);
    const en = s.querySelector('.enemies')!;
    for (const t of l.intro ?? []) {
      const def = (ZOMBIES as any)[t];
      const card = h(`<div class="enemy-card"><div><div class="t">Новый враг: ${def.name}</div><div class="d">${def.tip ?? ''}</div></div></div>`);
      card.prepend(this.zombieCanvas(t));
      en.append(card);
    }
    const row = s.querySelector('.squad-row')!;
    for (const m of [{ cls: 'commander', rank: 0 }, ...save.squad]) {
      const u = h(`<div class="unit" title="${ALLIES[m.cls as keyof typeof ALLIES].name}"><div class="rank">${'▲'.repeat(m.rank)}</div></div>`);
      u.prepend(this.unitCanvas(m.cls));
      row.append(u);
    }
    s.querySelector('[data-a=back]')!.addEventListener('click', () => this.showMap());
    s.querySelector('[data-a=go]')!.addEventListener('click', () => this.start(l));
    this.show(s);
  }

  start(l: LevelDef) {
    audio.unlock();
    this.level = l;
    this.newWorld(l);
    this.ui.innerHTML = '';
    this.hud.build(this.world);
    this.firstMove = false;
    this.hud.showDragHint(true);
    setTimeout(() => this.hud.showDragHint(false), 3500);
    this.mode = 'play';
  }

  pause() {
    if (this.mode !== 'play') return;
    this.mode = 'pause';
    const s = h(`<div class="screen dim"><div class="panel modal">
      <div class="h1">Пауза</div>
      <div class="toggle-row">Звук <button class="switch ${save.sound ? 'on' : ''}" data-a="snd"></button></div>
      <div class="toggle-row">Музыка <button class="switch ${save.music ? 'on' : ''}" data-a="mus"></button></div>
      <button class="btn" data-a="resume">Продолжить</button>
      <div class="row"><button class="btn secondary small" data-a="restart">Заново</button><button class="btn secondary small" data-a="map">Карта</button></div>
    </div></div>`);
    s.querySelector('[data-a=resume]')!.addEventListener('click', () => this.resume());
    s.querySelector('[data-a=restart]')!.addEventListener('click', () => this.start(this.level));
    s.querySelector('[data-a=map]')!.addEventListener('click', () => this.showMap());
    s.querySelector('[data-a=snd]')!.addEventListener('click', e => { save.sound = !save.sound; persist(); audio.setEnabled(save.sound); (e.target as HTMLElement).classList.toggle('on', save.sound); });
    s.querySelector('[data-a=mus]')!.addEventListener('click', e => { save.music = !save.music; persist(); audio.setMusic(save.music); (e.target as HTMLElement).classList.toggle('on', save.music); });
    this.show(s);
  }

  resume() {
    this.ui.innerHTML = '';
    this.mode = 'play';
    this.last = performance.now();
  }

  endLevel() {
    this.mode = 'end';
    const w = this.world;
    const res = finishLevel(w);
    this.hud.root.innerHTML = '';
    if (w.level.endless) return this.showEndless(res);
    if (res.won && w.level.index === LEVELS.length - 1 && !save.seenStory.includes(99)) {
      save.seenStory.push(99); persist();
      const s = h(`<div class="screen story"><div class="chap" style="color:#ffb627">Эпилог</div><div class="name">Вертолёт взлетает</div>
        <p>Колосс пал. Над крышей штаба гремят винты — пилот всё-таки прилетел. Отряд, прошедший сотню миль ада, поднимается на борт. Внизу остаётся мёртвый город. Впереди — рассвет.</p>
        <button class="btn">Итоги</button></div>`);
      s.querySelector('button')!.addEventListener('click', () => this.showResult(res));
      this.show(s);
      return;
    }
    this.showResult(res);
  }

  showResult(res: LevelResult) {
    const w = this.world;
    const s = w.stats;
    const title = res.won ? (w.level.boss ? 'Босс повержен!' : 'Убежище достигнуто') : 'Отряд погиб';
    const goals = ['Дойти до конца', `Спасти ${s.rescued}/${Math.ceil(s.available * 0.6)}`, 'Без потерь'];
    const tips = ['Спасай выживших: каждый боец — это ещё один ствол.', 'Улучшения «Калибр» и «Бронежилеты» сильно помогают.', 'Стреляй по бочкам рядом с толпой зомби.', 'Не стой на месте, когда плюются кислотой.', 'Широкий отряд цепляет препятствия — следи за проходами.'];
    const el = h(`<div class="screen dim scroll"><div class="panel modal">
      <div class="result-title ${res.won ? 'win' : 'lose'}">${title}</div>
      ${res.won ? `<div class="big-stars">${[0, 1, 2].map(i => `<span class="big-star" data-i="${i}">★</span>`).join('')}</div>
        <div class="star-goals">${goals.map((g, i) => `<div class="${res.starFlags[i] ? 'ok' : ''}">${g}</div>`).join('')}</div>` : `<div class="note">${tips[Math.floor(Math.random() * tips.length)]}</div>`}
      <div class="stats">
        <div class="stat"><div class="k">Убито</div><div class="v">${s.kills}</div></div>
        <div class="stat"><div class="k">Спасено</div><div class="v">${s.rescued}</div></div>
        <div class="stat"><div class="k">Потери</div><div class="v">${s.lost}</div></div>
        <div class="stat"><div class="k">Время</div><div class="v">${Math.floor(s.time / 60)}:${String(Math.floor(s.time % 60)).padStart(2, '0')}</div></div>
      </div>
      <div class="tally">
        <div><span>Собрано монет</span>${coinsHtml(res.won ? res.collected : res.total)}</div>
        ${res.won ? `<div><span>За прохождение</span>${coinsHtml(res.clearBonus)}</div>
        ${res.starBonus ? `<div><span>Новые звёзды</span>${coinsHtml(res.starBonus)}</div>` : ''}
        ${res.campBonus ? `<div><span>Отправлено в лагерь (${res.sentToCamp})</span>${coinsHtml(res.campBonus)}</div>` : ''}` : '<div class="muted"><span>Сохранено 50% монет</span></div>'}
        <div class="total"><span>Итого</span>${coinsHtml(res.total)}</div>
      </div>
      ${res.won && res.promoted ? `<div class="note">▲ ${res.promoted} бойц. повышены в звании. В казарме: ${res.kept.length}</div>` : ''}
      <div class="row"><button class="btn secondary" data-a="shop">Улучшения</button>
        ${res.won ? `<button class="btn" data-a="next">${w.level.index < LEVELS.length - 1 ? 'Дальше ▶' : 'Карта'}</button>` : '<button class="btn" data-a="retry">Повторить</button>'}</div>
      <button class="btn secondary small" data-a="map">Карта</button>
    </div></div>`);
    el.querySelectorAll<HTMLElement>('.big-star').forEach(st => {
      const i = Number(st.dataset.i);
      if (i < res.stars) setTimeout(() => { st.classList.add('on'); audio.play('star'); }, 400 + i * 350);
    });
    const next = () => (w.level.index < LEVELS.length - 1 ? this.brief(LEVELS[w.level.index + 1]) : this.showMap());
    el.querySelector('[data-a=next]')?.addEventListener('click', next);
    el.querySelector('[data-a=retry]')?.addEventListener('click', () => this.start(this.level));
    el.querySelector('[data-a=map]')!.addEventListener('click', () => this.showMap());
    el.querySelector('[data-a=shop]')!.addEventListener('click', () => this.showShop(() => (res.won ? next() : this.brief(this.level))));
    this.show(el);
  }

  showEndless(res: LevelResult) {
    const el = h(`<div class="screen dim"><div class="panel modal">
      <div class="result-title lose">Конец пути</div>
      <div class="stats"><div class="stat"><div class="k">Дистанция</div><div class="v">${res.distance} м</div></div>
      <div class="stat"><div class="k">Рекорд</div><div class="v">${save.endlessBest} м</div></div></div>
      <div class="tally"><div class="total"><span>Монеты</span>${coinsHtml(res.total)}</div></div>
      <div class="row"><button class="btn secondary" data-a="map">Карта</button><button class="btn" data-a="retry">Ещё раз</button></div>
    </div></div>`);
    el.querySelector('[data-a=retry]')!.addEventListener('click', () => this.start(ENDLESS));
    el.querySelector('[data-a=map]')!.addEventListener('click', () => this.showMap());
    this.show(el);
  }

  showShop(back: () => void, tab: 'arsenal' | 'squad' = 'arsenal') {
    if (this.mode === 'play') return;
    const list = UPGRADES.filter(u => u.tab === tab).map(u => {
      const lvl = save.upgrades[u.id] ?? 0;
      const max = lvl >= u.max;
      const cost = upgradeCost(u, lvl);
      return `<div class="panel upg" data-u="${u.id}"><div class="ico">${u.icon}</div>
        <div class="body"><div class="n">${u.name}</div><div class="d">${u.desc(lvl)}${max ? '' : ` → <b style="color:#63e6be">${u.desc(lvl + 1).replace(/^[^+\d]*/, '')}</b>`}</div>
        <div class="pips">${Array.from({ length: u.max }, (_, i) => `<div class="pip ${i < lvl ? 'on' : ''}"></div>`).join('')}</div></div>
        <button class="btn small" ${max || save.coins < cost ? 'disabled' : ''}>${max ? 'МАКС' : `<span>Купить</span><span style="font-size:calc(var(--u)*14)">${cost}</span>`}</button></div>`;
    }).join('');
    const roster = tab === 'squad' ? `<div class="panel" style="width:100%;padding:calc(var(--u)*14);margin-top:calc(var(--u)*12)">
      <div class="label">Казарма (${save.squad.length}/${mods().barracks})</div><div class="squad-row" style="margin-top:calc(var(--u)*8)"></div>
      <div class="muted" style="font-size:calc(var(--u)*13);margin-top:calc(var(--u)*8)">Выжившие бойцы переходят на следующий уровень и получают звания (+15% урона и HP).</div></div>` : '';
    const s = h(`<div class="screen dim scroll">
      <div class="topbar"><button class="icon-btn" data-a="back">‹</button><div class="h2">Улучшения</div>${coinsHtml(save.coins)}</div>
      <div class="tabs"><button class="tab ${tab === 'arsenal' ? 'on' : ''}" data-t="arsenal">Арсенал</button><button class="tab ${tab === 'squad' ? 'on' : ''}" data-t="squad">Отряд</button></div>
      <div class="upgrades">${list}</div>${roster}</div>`);
    const row = s.querySelector('.squad-row');
    if (row) for (const m of save.squad) {
      const u = h(`<div class="unit"><div class="rank">${'▲'.repeat(m.rank)}</div></div>`);
      u.prepend(this.unitCanvas(m.cls));
      row.append(u);
    }
    s.querySelector('[data-a=back]')!.addEventListener('click', back);
    s.querySelectorAll<HTMLElement>('.tab').forEach(t => t.addEventListener('click', () => this.showShop(back, t.dataset.t as any)));
    s.querySelectorAll<HTMLElement>('.upg').forEach(u => u.querySelector('button')!.addEventListener('click', () => {
      if (buyUpgrade(u.dataset.u as any)) { audio.play('buy'); this.showShop(back, tab); }
    }));
    this.show(s);
  }
}
