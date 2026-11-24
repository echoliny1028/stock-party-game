/* 行情引擎：不碰页面，只管算。半秒走一步（=现实 1 分钟），一天 240 步。 */
window.GAME = window.GAME || {};
(function (G) {
  const E = G.E = {}, L = [];
  let S, rnd;
  const TPD = 240, PART = 4;
  E.DAYS = 5;
  E.PH = [
    { k: "PRE", n: 40, t: "开盘前挂单" }, { k: "AM", n: 120, t: "上午盘" }, { k: "NOON", n: 40, t: "午间休市" },
    { k: "PM", n: 120, t: "下午盘" }, { k: "POST", n: 40, t: "收盘后" }];
  E.on = f => L.push(f);
  const emit = (t, d) => L.forEach(f => f(t, d));

  function mul(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const gs = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.732;
  const r2 = x => Math.round(x * 100) / 100, cl = (x, a, b) => x < a ? a : x > b ? b : x;
  const pick = a => a[(rnd() * a.length) | 0], ri = n => (rnd() * n) | 0;
  const TM = { "大盘股": .6, "券商股": 1, "题材股": 1.3, "冷门股": 1.1, "地雷股": .8, "微小盘": 1.5 };
  const phk = () => E.PH[S.ph].k;
  E.isT = () => !S.over && (phk() === "AM" || phk() === "PM");
  E.clock = function () {
    const k = phk(), T = Math.min(S.t, 239);
    const m = k === "PRE" ? 555 + Math.floor(S.pt / 4) : k === "NOON" ? 690 + Math.floor(S.pt * 2.25) : k === "POST" ? 900 + S.pt : T < 120 ? 570 + T : 780 + (T - 120);
    return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  };

  /* ---------- 账户 ---------- */
  function val(a) { let v = 0; for (const k in a.pos) v += a.pos[k].q * S.ins[k].price; return v; }
  function fpnl(a) { let v = 0; for (const k in a.fut) { const f = S.ins[k], p = a.fut[k]; v += (f.price - p.entry) * p.q * f.mult; } return v; }
  function fmar(a) { let v = 0; for (const k in a.fut) { const f = S.ins[k]; v += Math.abs(a.fut[k].q) * f.price * f.mult * f.mr * (a.lev ? .5 : 1); } return v; }
  E.val = val; E.fpnl = fpnl; E.fmar = fmar;
  E.eq = a => a.cash + a.bank + val(a) + fpnl(a);
  E.avail = a => a.cash - fmar(a) + Math.min(0, fpnl(a));
  function newPos() { return { q: 0, av: 0, cost: 0, td: 0, tdc: 0, luq: 0, luc: 0, lud: 0 }; }
  /* 玩家“今天”的小账本：悬赏和徽章要用 */
  function newDay(e0) { return { e0, low: 0, win: 0, ord: 0, posts: 0, fw0: 0, dip: null, buys: [], sells: [] }; }
  const dayRet = a => E.eq(a) / a.st.d.e0 - 1;
  const cp = o => JSON.parse(JSON.stringify(o));
  /* 下单前给账户拍个照，“后悔药”用它倒回去 */
  function snap(a) { const st = a.st; a.snap = { d: S.day, t: S.t, cash: a.cash, bank: a.bank, pos: cp(a.pos), fut: cp(a.fut), orders: cp(a.orders), st: cp({ buy: st.buy, real: st.real, t0: st.t0, dare: st.dare, fw: st.fw, db: st.db, wn: st.wn, ban: st.ban, warns: st.warns, d: st.d }) }; }
  function lock(a, n, k) { a.lock = n; a.lockK = k || ""; emit("lock", { n, k: a.lockK }); }
  function badge(k) { if (S.badges.indexOf(k) < 0) { S.badges.push(k); emit("badge", k); } }
  const soon = (n, f) => S.soon.push({ n, f });
  const mut = k => !!S.mut && S.mut.k === k;
  /* 量化现在是不是歇着：被举报停了，或者“量化严管”局的上午 */
  const qIdle = E.qIdle = () => S.qOff > 0 || (mut("qpm") && S.t < 120);
  function give(a, s, v) { const sh = Math.floor(v / s.price / 100) * 100; if (sh <= 0) return; const p = newPos(); p.q = p.av = sh; p.cost = s.price; a.pos[s.id] = p; a.cash -= sh * s.price; }

  /* ---------- 成交 ---------- */
  function tradeSh(a, s, side, sh, o) {
    if (sh <= 0 || !E.isT()) return 0;
    if (side > 0 && s.lu && !a.dare) return 0;      // 涨停买不进（敢死队除外）
    if (side < 0 && s.ld) return 0;                 // 跌停卖不出
    if (side > 0 && a.human && a.st.ban[s.id]) { if (o) o.rem = 0; return 0; }   // 被监管限制买入
    let p = a.pos[s.id]; if (!p) p = a.pos[s.id] = newPos();
    if (side < 0) { sh = Math.min(sh, a.t0 ? p.q : p.av); if (sh <= 0) { if (!p.q) delete a.pos[s.id]; return 0; } }
    /* 量化被停、或者开着“极速通道”的时候，人下单几乎没有冲击成本 */
    const easy = a.human && (S.qOff > 0 || a.fast > 0);
    const px0 = s.price, imp = (s.kappa * Math.sqrt(sh * px0 / s.tickLiq) * .5 + .0003) * (easy ? .25 : 1);
    const px = cl(r2(px0 * (1 + side * imp)), s.dn, s.up);
    if (side > 0) { sh = Math.min(sh, Math.floor(E.avail(a) / (px * 1.0003) / 100) * 100); if (sh <= 0) { if (!p.q) delete a.pos[s.id]; return 0; } }
    const amt = sh * px, fee = (a.human && a.fast > 0) || mut("fee") ? 0 : Math.max(a.human ? 5 : 0, amt * .00025) + (side < 0 ? amt * .0005 : 0);
    let pl = 0;
    if (side > 0) {
      a.cash -= amt + fee; p.cost = (p.cost * p.q + amt + fee) / (p.q + sh); p.q += sh; if (a.t0) p.av = p.q;
      p.tdc = (p.tdc * p.td + amt) / (p.td + sh); p.td += sh;
      if (s.lu) { p.luq += sh; p.luc = px; p.lud = S.day; }
      a.st.buy[s.id] = (a.st.buy[s.id] || 0) + amt;
      if (a.human) { const d = a.st.d; d.buys.push([s.id, px]); if (!d.dip && px0 / s.prev - 1 <= -.03) d.dip = { id: s.id, px }; }
      /* 游资一天之内把一只股票买得太猛：先电话提醒（流通盘 4%），再限制买入（8%） */
      if (a.human && a.g === "游资") {
        const f = (a.st.db[s.id] = (a.st.db[s.id] || 0) + amt) / s.floatCap;
        if (f > .08) { a.st.ban[s.id] = 1; a.st.warns++; if (o) o.rem = sh; emit("toast", "监管出手：今天不许再买 " + s.name + " 了，明天解除"); S.dyn.push("【监管】交易所对 " + s.name + " 的异常交易账户采取当日限制买入措施。"); }
        else if (f > .04 && !a.st.wn[s.id]) { a.st.wn[s.id] = 1; emit("toast", "监管来电：你今天买 " + s.name + " 买得太猛，再买会被限制"); }
      }
    } else {
      pl = (px - p.cost) * sh - fee;
      a.cash += amt - fee; a.st.real[s.id] = (a.st.real[s.id] || 0) + pl;
      const once = !o || !o.cnt;
      if (a.t0 && p.td > 0) { if (px > p.tdc * 1.005 && once) { a.st.t0++; if (o) o.cnt = 1; if (a.human) emit("fx", { k: "goal", r: "t0" }); } p.td = Math.max(0, p.td - sh); }
      if (p.luq > 0 && S.day > p.lud) { if (px > p.luc && once) { a.st.dare++; if (o) o.cnt = 1; if (a.human) emit("fx", { k: "goal", r: "dare" }); } p.luq = 0; }
      p.q -= sh; p.av = a.t0 ? p.q : Math.max(0, p.av - sh); if (p.q <= 0) delete a.pos[s.id];
      if (a.human) { const d = a.st.d; d.sells.push([s.id, px]); if (pl > 0) { if (!o || !o.won) { d.win++; if (o) o.won = 1; if (++a.st.streak >= 2) emit("fx", { k: "streak", n: a.st.streak }); } badge("first"); } else if (pl < 0 && (!o || !o.lost)) { a.st.streak = 0; if (o) o.lost = 1; } }
    }
    s.flow += side * amt; s.xamt += amt; s.lhb[a.g] = (s.lhb[a.g] || 0) + side * amt;
    if (a.human) emit("fill", { name: s.name, side, sh, px, pl });
    return sh;
  }
  const trade = (a, s, side, v) => tradeSh(a, s, side, Math.floor(v / s.price / 100) * 100) * s.price;

  function ftrade(a, f, lots) {
    if (!lots || !E.isT()) return 0;
    let c = a.fut[f.id]; if (!c) c = a.fut[f.id] = { q: 0, entry: 0 };
    const sg = Math.sign(lots), px = Math.round(f.price * (1 + sg * .0002) * 5) / 5; let n = Math.abs(lots), done = 0;
    if (c.q && Math.sign(c.q) !== sg) {
      const k = Math.min(n, Math.abs(c.q)), pnl = (px - c.entry) * Math.sign(c.q) * k * f.mult;
      a.cash += pnl; if (pnl > 0) { a.st.fw++; if (a.human) { a.st.d.win++; badge("first"); emit("fx", { k: "goal", r: "lev" }); } } c.q += sg * k; n -= k; done += k;
      if (a.human) emit("fx", { k: "pl", v: pnl });
    }
    if (n > 0) {
      const per = px * f.mult * f.mr * (a.lev ? .5 : 1); n = Math.min(n, Math.max(0, Math.floor(E.avail(a) / per)));
      if (n > 0) { c.entry = (c.entry * Math.abs(c.q) + px * n) / (Math.abs(c.q) + n); c.q += sg * n; done += n; }
    }
    if (done) { if (!mut("fee")) a.cash -= done * px * f.mult * .0001; f.flow += sg * done * px * f.mult; }
    if (!c.q) delete a.fut[f.id];
    return done;
  }

  /* ---------- 历史 K 线 ---------- */
  function hist(s) {
    let c = 1, dr = 0; const a = [];
    for (let d = 0; d < 100; d++) {
      if (d % 18 === 0) dr = (rnd() - .47) * s.sigma * .5;
      const o = c * (1 + gs() * s.sigma * .25), ch = cl(dr + gs() * s.sigma, -s.lim, s.lim), c2 = c * (1 + ch);
      a.push({ o, c: c2, h: Math.max(o, c2) * (1 + Math.abs(gs()) * s.sigma * .35), l: Math.min(o, c2) * (1 - Math.abs(gs()) * s.sigma * .35), v: (.6 + rnd()) * (1 + Math.abs(ch) / s.sigma * .8) });
      c = c2;
    }
    const k = s.price / c, vb = s.tickLiq * TPD / s.price / 100;
    a.forEach(d => { d.o *= k; d.c *= k; d.h *= k; d.l *= k; d.v *= vb; });
    return a;
  }
  function ihist(ix) {
    const a = [];
    for (let d = 0; d < 100; d++) {
      const o = { o: 0, c: 0, h: 0, l: 0, v: 0 };
      ix.m.forEach((id, j) => { const s = S.ins[id], q = s.days[d];["o", "c", "h", "l"].forEach(k => o[k] += ix.w[j] * q[k] / s.ref * ix.base); o.v += q.v * q.c * 100 / 1e8; });
      const hi = Math.max(o.o, o.c), lo = Math.min(o.o, o.c); o.h = hi + (o.h - hi) * .45; o.l = lo - (lo - o.l) * .45; a.push(o);
    }
    return a;
  }
  const idxNow = ix => ix.m.reduce((x, id, j) => x + ix.w[j] * S.ins[id].price / S.ins[id].ref, 0) * ix.base;

  /* ---------- 开局 ---------- */
  E.newGame = function (o) {
    rnd = mul(o.seed || ((Math.random() * 2147483647) | 0));
    S = E.S = { day: 0, ph: 0, pt: 0, t: 0, over: false, closed: true, ins: [], agents: [], quants: [], sig: [], later: [], dyn: [], hotLog: [], oid: 0, nn: 6, bn: 5, cn: 8, idxFail: false, ldFail: false, dayRet: [], res: null,
      soon: [], rage: 0, rageW: 0, qOff: 0, qn: 30, qDay0: 0, life: null, lifeQ: [], guess: null, bty: null, badges: [], stat: { bty: 0, gz: 0, rep: 0 } };
    S.script = pick(G.SCRIPTS); S.regime = gs() * .003 - .0035;
    S.mut = rnd() < .35 ? null : pick(G.MUTS);   // 本局特别规则：大约三局里有两局会有一条
    (S.script.ev || []).forEach(e => S.later.push({ d: e[0], t: e[1], f: () => { applyNews(e[2]); news(e[2][3], false, tgId(e[2][0]), true); } }));
    { const ds = [0, 1, 2, 3, 4].sort(() => rnd() - .5); S.lifeQ = [{ d: ds[0], t: 20 + ri(190) }, { d: ds[1], t: 20 + ri(190) }].sort((x, y) => x.d - y.d); }
    G.STOCKS.forEach((d, i) => {
      const s = Object.assign({ id: i, kind: "stock" }, d);
      s.big = i < 10; s.ref = d.price; s.floatCap = d.price * d.shares * 1e8 * d.floatR; s.tickLiq = s.floatCap * d.turn / TPD; s.kappa = d.sigma / Math.sqrt(TPD) * (!s.big && mut("small") ? 1.3 : 1);
      s.step = Math.max(.01, r2(d.price * .002)); s.days = hist(s); s.fair = d.price * (1 + gs() * .015);
      s.luStreak = s.ldStreak = s.luMax = 0; s.halt = 0; s.crowd = 0; s.jump = 0; s.p = []; s.v = []; s.tr = []; s.dist = {}; s.prev = d.price; s.up = r2(d.price * (1 + d.lim)); s.dn = r2(d.price * (1 - d.lim));
      S.ins.push(s);
    });
    S.stocks = S.ins.slice(0, 15);
    const bigM = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], smM = [10, 11, 12, 13, 14];
    const mkIdx = (id, name, base, m, w) => { const x = { id, kind: "idx", name, base, m, w, lim: .1, price: base, prev: base, p: [], v: [], tr: [], dist: {} }; x.days = ihist(x); S.ins.push(x); return x; };
    S.big = mkIdx(15, "大盘指数", 3000, bigM, bigM.map(i => G.STOCKS[i].w));
    S.small = mkIdx(16, "小盘指数", 2000, smM, smM.map(() => .2));
    const mkFut = (id, name, u, mult, mr, liq) => { const f = { id, kind: "fut", name, u, mult, mr, liq, basis: 0, flow: 0, lim: .1, price: u.price, prev: u.price, p: [], v: [], tr: [], dist: {}, days: u.days.map(d => Object.assign({}, d)) }; S.ins.push(f); return f; };
    S.futB = mkFut(17, "大盘期货", S.big, 300, .12, 4e8);
    S.futS = mkFut(18, "小盘期货", S.small, 200, .15, 8e7);

    const GRP = r => r === "gov" ? "国家队" : (r === "org" || r === "spy") ? "机构" : r === "hot" ? "游资" : "散户";
    const AIN = { gov: ["国家队"], spy: ["机构甲"], org: ["机构乙"], hot: ["游资甲", "游资乙"], big: ["特大号"], t0: ["开挂哥"], info: ["灵通姐"], dare: ["敢死队"], lev: ["杠杆哥"], pay: ["发工资"] };
    function mkA(name, role, human) {
      const R = G.ROLES[role];
      const a = { name, role, grp: R.grp, g: GRP(role), human: !!human, cash: R.money, bank: 0, pos: {}, fut: {}, orders: [], t0: role === "t0", dare: role === "dare", lev: role === "lev", essays: 3, shouts: 2, inq: 2,
        res: 3, adv: 2, rally: 2, owe: 0, lock: 0, lockK: "", fast: 0, tipN: 0, cards: { tip: 0, undo: 0, xray: 0 }, xray: null, snap: null,
        st: { buy: {}, real: {}, t0: 0, dare: 0, fw: 0, liq: false, dd: 0, peak: 0, flows: [], db: {}, wn: {}, ban: {}, warns: 0, streak: 0, d: newDay(R.money) } };
      if (R.hold) { const ws = bigM.filter(i => i !== 9), tw = ws.reduce((x, i) => x + G.STOCKS[i].w, 0); ws.forEach(i => give(a, S.ins[i], R.money * R.hold * G.STOCKS[i].w / tw)); }
      return a;
    }
    const rets = ["big", "t0", "info", "dare", "lev", "pay"], isRet = rets.includes(o.role);
    const rr = rets.filter(r => r !== o.role).sort(() => rnd() - .5);
    const seats = ["gov", "spy", "org", "hot", "hot"].concat(isRet ? [o.role].concat(rr.slice(0, 4)) : rr.slice(0, 5));
    let used = false; const cnt = {};
    seats.forEach(r => {
      const hum = !used && r === o.role; if (hum) used = true; cnt[r] = (cnt[r] || 0);
      const a = mkA(hum ? "你" : AIN[r][cnt[r]++ % AIN[r].length], r, hum);
      if (hum) { S.me = a; if (G.ROLES[r].pick) { const inn = Math.round(a.cash * cl(o.inPct == null ? 1 : o.inPct, .1, 1)); a.bank = a.cash - inn; a.cash = inn; } }
      else { a.act = AI[a.g]; if (a.g === "游资") { a.uni = [4, 5, 6, 7, 10, 11, 12, 13, 14]; a.tg = null; } if (a.g === "国家队") a.core = [0, 2, 1, 3]; if (a.g === "机构") a.k = ri(6); }
      S.agents.push(a);
    });
    const mkQ = (name, typ, cash, x) => { const a = Object.assign({ name, typ, g: "量化", quant: true, t0: true, cash, bank: 0, pos: {}, fut: {}, orders: [], st: { buy: {}, real: {}, t0: 0, dare: 0, fw: 0 }, base: {}, hf: 0, jobs: [], seen: 0 }, x); S.agents.push(a); S.quants.push(a); return a; };
    const all = S.stocks.map(s => s.id), theme = [4, 5, 6, 7, 10, 11, 12, 13, 14];
    mkQ("追涨一号", "追涨", 5e8, { act: qMom, uni: all, look: 12, th: .12, rate: .6 });
    mkQ("追涨二号", "追涨", 2e8, { act: qMom, uni: theme, look: 6, th: .10, rate: .8 });
    mkQ("追涨三号", "追涨", 1e9, { act: qMom, uni: bigM, look: 25, th: .15, rate: .5 });
    [mkQ("做T一号", "做T", 8e8, { act: qT, uni: bigM.filter(i => i !== 9) }), mkQ("做T二号", "做T", 1.5e8, { act: qT, uni: theme })].forEach(a => {
      a.baseVal = {}; a.uni.forEach(id => { const s = S.ins[id], v = Math.min(a.cash * .6 / a.uni.length, s.tickLiq * 25); give(a, s, v); a.baseVal[id] = (a.pos[id] ? a.pos[id].q : 0) * s.price; a.base[id] = a.pos[id] ? a.pos[id].q : 0; });
    });
    mkQ("读新闻一号", "读新闻", 3e8, { act: qNews, rate: .8, lots: 20 });
    mkQ("读新闻二号", "读新闻", 1e8, { act: qNews, rate: .5, lots: 8 });
    S.hft = mkQ("高频一号", "高频", 2e8, {});
    S.agents.forEach(a => { a.init = E.eq(a); a.cash0 = a.cash; a.eqPrev = a.init; a.st.peak = a.init; });
    S.pool = G.NEWS.concat(genNews(120)).sort(() => rnd() - .5);
    emit("new");
    return S;
  };
  E.qpnl = a => a.typ === "高频" ? a.hf : E.eq(a) - (a.cash0 + Object.keys(a.base).reduce((x, k) => x + a.base[k] * S.ins[k].price, 0));

  /* ---------- 消息 ---------- */
  const KP = p => .008 * Math.pow(p, 1.45);          // 力度 1 → 0.8%，2 → 2.2%，3 → 3.9%
  const byName = q => S.stocks.find(z => z.name === q);
  const tgId = t => t === "大盘" ? 15 : t === "小盘" ? 16 : G.THEMES[t] ? (byName(G.THEMES[t][0]) || {}).id : (byName(t) || {}).id;
  /* soft：传闻阶段，只动情绪和价格，不动公司的真实价值 */
  function applyNews(n, soft) {
    const tg = n[0], e = n[1], p = n[2]; if (!tg) return;
    const mark = I => { if (I && n[3]) (I.nm = I.nm || []).push([S.t, n[3].replace(/^【[^】]*】/, "")]); };   // 在分时图上记一笔“这时候出过消息”
    if (!e) { const z = byName(tg); if (z) { mark(z); S.sig.push({ id: z.id, e: rnd() < .5 ? 1 : -1, p: 2 }); } return; }
    const sh = (s, x) => { if (!soft) s.fair *= 1 + x; s.jump += x * (soft ? .4 : .55); };
    const one = (s, w) => { mark(s); sh(s, e * KP(p) * TM[s.type] * w); s.crowd += e * s.tickLiq * p * 1.5 * w; if (p >= .6) S.sig.push({ id: s.id, e, p }); };
    if (tg === "大盘") { mark(S.big); mark(S.futB); S.stocks.forEach(s => sh(s, e * KP(p) * .5 * (s.big ? (s.type === "大盘股" ? 1 : 1.3) : .7))); if (p >= .6) S.sig.push({ id: 17, e, p }); }
    else if (tg === "小盘") { mark(S.small); mark(S.futS); S.stocks.forEach(s => { if (!s.big) sh(s, e * KP(p) * 1.25); }); if (p >= .6) S.sig.push({ id: 18, e, p }); }
    else if (G.THEMES[tg]) G.THEMES[tg].forEach(nm => { const s = byName(nm); if (s) one(s, .6); });
    else {
      const s = byName(tg); if (!s) return; one(s, 1);
      /* 板块联动：一家出事，同板块的跟着小动 */
      if (p >= 1) for (const k in G.THEMES) if (G.THEMES[k].indexOf(tg) >= 0) G.THEMES[k].forEach(nm => { const z = byName(nm); if (z && z !== s) sh(z, e * KP(p) * TM[z.type] * .15); });
    }
  }
  /* 用模板现编 N 条消息：数字随机，力度跟着数字走 */
  function genNews(N) {
    const D = G.NEWSGEN, P = D.pools, out = [], used = {}, all = G.STOCKS.map(x => x.name); let rare = 0, guard = 0;
    const fmt = v => v % 1 ? v.toFixed(1) : String(v);
    while (out.length < N && guard++ < N * 30) {
      const i = ri(D.tpl.length), T = D.tpl[i], o = T[5] || {};
      if ((used[i] || 0) >= (T[0][0] === "*" ? 3 : 1)) continue;
      if (o.rare) { if (rare || S.rare) continue; rare = S.rare = 1; }
      used[i] = (used[i] || 0) + 1;
      const lo = T[2], hi = T[3], c = o.c || 0, dec = lo % 1 || hi % 1; let n, g = 0;
      do { n = lo + rnd() * (hi - lo); if (o.st) n = lo + Math.round((n - lo) / o.st) * o.st; n = dec ? Math.round(n * 10) / 10 : Math.round(n); }
      while (lo < c && hi > c && Math.abs(n - c) < Math.max(hi - c, c - lo) * .15 && g++ < 30);
      const pos = n - c >= 0, str = T[4] ? cl((n - c) / T[4], -3.2, 3.2) : 0, av = Math.abs(n);
      let tg = T[0]; if (tg[0] === "*") tg = pick(tg === "*大" ? all.slice(0, 10) : tg === "*小" ? all.slice(10) : all);
      let c1 = pick(P["国"]), c2 = pick(P["国"].filter(x => x !== c1));
      const x = T[1].replace(/\{s\}/g, tg).replace(/\{n×([\d.]+)\}/g, (m, k) => fmt(Math.round(av * k * 10) / 10)).replace(/\{n\}/g, fmt(av))
        .replace(/\{([^{}|]+)\|([^{}|]+)\}/g, (m, u, d) => pos ? u : d).replace(/\{国2\}/g, c2).replace(/\{国\}/g, c1)
        .replace(/\{(星|人|行|城|物|部门|媒体)\}/g, (m, k) => pick(P[k]));
      out.push([tg, str > 0 ? 1 : str < 0 ? -1 : 0, Math.abs(str), x, o.r]);
    }
    return out;
  }
  const news = (x, early, id, hot) => emit("news", { x, tm: E.clock(), early: !!early, id, hot: !!hot });
  const dyn = x => S.dyn.push(x);
  function runLater() { const q = S.later; S.later = []; const keep = q.filter(j => { if (j.d < S.day || (j.d === S.day && j.t <= S.t)) { j.f(); return false; } return true; }); S.later = keep.concat(S.later); }
  const brief = x => { const t = x.replace(/^【[^】]*】/, "").replace(/[。.]$/, ""); return t.length > 20 ? t.slice(0, 20) + "…" : t; };
  function postNews() {
    if (S.dyn.length && rnd() < .4) return news(S.dyn.shift());
    if (!S.pool.length) S.pool = genNews(40);
    const n = S.pool.pop(), tip = S.me.role !== "info" && S.me.tipN > 0, early = S.me.role === "info" || tip, id = tgId(n[0]), hot = n[2] >= 2.4;
    if (tip) S.me.tipN--;
    if (early) news(n[3], true, id, hot);
    if (hot) react("hot");
    S.later.push({ d: S.day, t: S.t + 6, f: () => {
      const rum = n[4] != null; applyNews(n, rum); if (!early) news(n[3], false, id, hot);
      /* 传闻：过一阵子要么证实（价值真的变），要么辟谣（刚才的涨跌吐回去） */
      if (rum) { const truth = rnd() < n[4]; S.later.push({ d: S.day, t: S.t + 30 + ri(40), f: () => {
        const tx = truth ? "【证实】“" + brief(n[3]) + "”属实，相关方已发布正式公告。" : "【辟谣】“" + brief(n[3]) + "”不实，相关方已出面澄清。";
        if (truth) applyNews([n[0], n[1], n[2] * .8, tx]); else applyNews([n[0], -n[1], n[2] * .5, tx], true);
        news(tx, false, id);
      } }); }
    } });
  }
  function say(grp, who, x) { emit("chat", { grp, who, x }); if (grp === "游资群") S.hotLog.push({ d: S.day, am: S.t < 120, who, x }); }
  function barTalk() {
    const a = S.stocks.slice().sort((x, y) => y.price / y.prev - x.price / x.prev), r = rnd();
    const s = r < .35 ? a[ri(3)] : r < .7 ? a[a.length - 1 - ri(3)] : pick(a), t = r < .35 ? G.BAR.up : r < .7 ? G.BAR.down : G.BAR.any;
    emit("bar", { who: pick(G.BAR.names), x: pick(t).replace("{s}", s.name) });
  }
  function grpTalk() {
    const grp = pick(["散户群", "散户群", "游资群", "机构群"]), sp = S.agents.filter(a => a.grp === grp && !a.human); if (!sp.length) return;
    const s = grp === "游资群" ? S.ins[pick([4, 5, 7, 10, 11, 12, 13, 14])] : pick(S.stocks);
    say(grp, pick(sp).name, pick(G.CHAT[grp]).replace("{s}", s.name));
  }
  /* 盘面出事的时候，股吧和各个群里有人跟着喊两句 */
  function react(k, s) {
    const R = G.REACT[k]; if (!R || S.t - (S.rT || -99) < 5) return; S.rT = S.t; const nm = s ? s.name : "";
    if (R.bar) soon(2 + ri(4), () => emit("bar", { who: pick(G.BAR.names), x: pick(R.bar).replace("{s}", nm) }));
    ["散户群", "游资群", "机构群"].forEach(g => { if (!R[g] || rnd() > .7) return; const sp = S.agents.filter(a => a.grp === g && !a.human); if (sp.length) soon(3 + ri(6), () => say(g, pick(sp).name, pick(R[g]).replace("{s}", nm))); });
  }
  function essay(s, dir, truth) {
    emit("bar", { who: "匿名用户", x: pick(dir > 0 ? G.BAR.essayUp : G.BAR.essayDn).replace("{s}", s.name), zw: true, truth });
    S.sig.push({ id: s.id, e: dir, p: 2 }); s.crowd += dir * s.tickLiq * 4;
    S.later.push({ d: S.day, t: S.t + 35, f: () => { if (truth) { s.fair *= 1 + dir * .035 * TM[s.type]; news("【" + s.name + "】公司公告证实了此前的市场传闻。"); } else news("【" + s.name + "】公司澄清：网传消息不实，经营一切正常。"); } });
  }
  function shout(dir) {
    S.stocks.forEach(s => s.fair *= 1 + dir * .01 * (s.big ? 1 : .6)); S.sig.push({ id: 17, e: dir, p: 2 });
    news(dir > 0 ? "【权威发声】有关部门表示：坚定看好市场长期发展，将适时出手维护稳定。" : "【权威发声】有关部门提示：注意市场过热风险，理性投资。");
  }

  /* ---------- 好玩的部分：举报量化、悬赏、竞猜、道具卡、生活小事件 ---------- */
  const qTot = () => S.quants.reduce((x, q) => x + E.qpnl(q), 0);
  E.qDay = () => qTot() - S.qDay0;
  const CARD = E.CARD = { tip: "内参", undo: "后悔药", xray: "透视镜" };
  const CARDT = E.CARDT = { tip: "接下来 3 条消息，你比别人早 3 秒看到", undo: "把你的账户倒回到上一次下单之前（下单后 20 秒内有效）", xray: "1 分钟内看清选中的股票今天是谁在买、谁在卖" };
  function addCard(a, k) { if (a.role === "info" && k === "tip") k = "xray"; a.cards[k]++; return k; }
  function report(byMe) {
    S.rage = 0; S.rageW = 0; S.qOff = 60; S.hft.hf -= 3e6; if (byMe) { S.stat.rep++; badge("report"); }
    news("【监管】收到大量散户联名举报，交易所对程序化交易窗口指导：量化盘暂停报单 1 小时，一家高频机构被罚 300 万元。", false, undefined, true);
    emit("bar", { who: pick(S.quants).name, x: pick(G.QSAY.off), q: true });
    soon(3, () => emit("bar", { who: pick(G.BAR.names), x: pick(G.CHEER) })); soon(7, () => emit("bar", { who: pick(G.BAR.names), x: pick(G.CHEER) }));
    emit("fx", { k: "report", me: byMe });
  }
  E.report = function () {
    const a = S.me; if (S.over) return "这局已经结束了"; if (a.g !== "散户") return "只有散户能举报";
    if (!E.isT()) return "交易时间才能举报"; if (S.qOff > 0) return "量化已经被停了"; if (S.rage < 100) return "怒气还没攒满";
    if (a.lock > 0) return busy(a);
    report(true); return "举报成功：量化停 1 小时。这段时间你下单几乎没有冲击成本";
  };
  const busy = a => "你现在腾不出手，还要 " + Math.ceil(a.lock / 2) + " 秒";

  /* 每日悬赏：每天开盘前给 3 个，挑 1 个，做成了给一张道具卡 */
  const hasPos = a => Object.keys(a.pos).length + Object.keys(a.fut).length > 0;
  const BTY = {
    beat: { t: "今天至少下一单，收盘时你今天的收益率比大盘高", r: "tip", fin: a => a.st.d.ord > 0 && dayRet(a) > S.big.price / S.big.prev - 1, pg: a => "你 " + pcs(dayRet(a)) + "，大盘 " + pcs(S.big.price / S.big.prev - 1) },
    win2: { t: "今天赚钱卖出 2 笔（期货赚钱平仓也算）", r: "undo", live: a => a.st.d.win >= 2, pg: a => a.st.d.win + "/2 笔" },
    calm: { t: "全天总资产没比开盘时低过 1%，而且收盘时手里有货", r: "xray", dead: a => a.st.d.low <= -.01, fin: a => hasPos(a), pg: a => "今天最低到过 " + pcs(a.st.d.low) },
    dip: { t: "买一只当时已经跌了 3% 以上的股票，收盘时它的价格比你买的高", r: "undo", fin: a => !!a.st.d.dip && S.ins[a.st.d.dip.id].price > a.st.d.dip.px, pg: a => a.st.d.dip ? S.ins[a.st.d.dip.id].name + " 买在 " + a.st.d.dip.px.toFixed(2) + "，现在 " + S.ins[a.st.d.dip.id].price.toFixed(2) : "还没买" },
    few: { t: "今天最多下 3 张单子，收盘时今天是赚的", r: "tip", dead: a => a.st.d.ord > 3, fin: a => a.st.d.ord > 0 && dayRet(a) > 0, pg: a => "已下 " + a.st.d.ord + " 单，今天 " + pcs(dayRet(a)) },
    board: { t: "收盘时手里有一只今天涨了 5% 以上的股票", r: "xray", fin: a => Object.keys(a.pos).some(k => S.ins[k].price / S.ins[k].prev - 1 >= .05), pg: a => { let m = null; for (const k in a.pos) { const r = S.ins[k].price / S.ins[k].prev - 1; if (m == null || r > m) m = r; } return m == null ? "现在空仓" : "手里最强的今天 " + pcs(m); } },
    fut: { t: "用期货赚钱平仓 1 次", r: "tip", live: a => a.st.fw > a.st.d.fw0, pg: () => "还没做成" },
    one: { t: "收盘时今天赚到 1% 以上", r: "undo", fin: a => dayRet(a) >= .01, pg: a => "今天 " + pcs(dayRet(a)) }
  };
  function offerBty() { const ks = Object.keys(BTY).sort(() => rnd() - .5).slice(0, 3); S.bty = { d: S.day, opts: ks.map(k => { const ck = S.me.role === "info" && BTY[k].r === "tip" ? "xray" : BTY[k].r; return { k, t: BTY[k].t, ck, card: CARD[ck] }; }), pick: -1, done: false, fail: false }; emit("bty", S.bty); }
  E.pickBty = function (i) { const b = S.bty; if (!b || b.pick >= 0 || !b.opts[i]) return "今天的悬赏已经选过了"; b.pick = i; emit("bty", b); return "接下悬赏：" + b.opts[i].t; };
  E.btyNow = function () { const b = S.bty; if (!b || b.pick < 0) return null; const o = b.opts[b.pick]; return { t: o.t, card: o.card, done: b.done, fail: b.fail, pg: b.done ? "已完成" : b.fail ? "今天没成，明天还有" : BTY[o.k].pg(S.me) }; };
  function chkBty(fin) {
    const b = S.bty, a = S.me; if (!b || b.pick < 0 || b.done || b.fail) return;
    const o = b.opts[b.pick], D = BTY[o.k]; let r = null;
    if (D.dead && D.dead(a)) r = false; else if (D.live && D.live(a)) r = true; else if (fin) r = !!(D.fin && D.fin(a));
    if (r == null) return;
    if (r) { b.done = true; S.stat.bty++; const k = addCard(a, D.r); if (mut("bty2")) addCard(a, D.r); emit("bounty", { ok: true, t: o.t, card: CARD[k], n: mut("bty2") ? 2 : 1 }); if (S.stat.bty >= 3) badge("hunter"); }
    else { b.fail = true; if (!fin) emit("bounty", { ok: false, t: o.t }); }
  }

  /* 午休竞猜：下午收盘，大盘比现在高还是低。桌上其他人的票是有一点参考价值的 */
  function mkGuess() {
    /* 桌上有人听到了下午的风声：票数里掺了一点“下午会出什么消息”的信息 */
    let ex = 0; S.big.m.forEach((id, j) => ex += S.big.w[j] * Math.log(S.ins[id].fair / S.ins[id].price) * .5);
    S.pool.slice(-10).forEach(n => { if (!n[1]) return; if (n[0] === "大盘") ex += n[1] * KP(n[2]) * .6; else { const z = byName(n[0]); if (z && z.big) ex += z.w * n[1] * KP(n[2]) * TM[z.type]; } });
    const pu = cl(.5 + ex * 30, .2, .8); let up = 0; for (let i = 0; i < 9; i++) if (rnd() < pu) up++;
    S.guess = { d: S.day, base: S.big.price, pick: 0, up, dn: 9 - up, res: 0 }; emit("guess", S.guess);
  }
  E.guess = function (dir) { const g = S.guess; if (!g || g.d !== S.day || g.res) return "现在没有竞猜"; if (g.pick) return "已经猜过了"; if (phk() !== "NOON" && !(phk() === "PM" && S.pt < 12)) return "下午已经开盘，来不及了"; g.pick = dir; return "你猜下午收盘比 " + g.base.toFixed(2) + (dir > 0 ? " 高" : " 低"); };

  /* 道具卡 */
  E.useCard = function (k, id) {
    const a = S.me, s = S.ins[id]; if (S.over) return "这局已经结束了"; if (!(a.cards[k] > 0)) return "没有这张卡"; if (a.lock > 0) return busy(a);
    if (k === "tip") { a.cards.tip--; a.tipN += 3; return "内参已生效：接下来 3 条消息你会提前 3 秒看到"; }
    if (k === "xray") { if (!s || s.kind !== "stock") return "先选一只股票"; a.cards.xray--; a.xray = { id, d: S.day, until: S.t + 120 }; return "透视镜已对准 " + s.name + "，1 分钟内有效"; }
    if (k === "undo") {
      const p = a.snap; if (!p || p.d !== S.day || S.t - p.t > 40 || phk() === "POST") return "20 秒内没下过单，没什么可后悔的（卡没用掉）";
      a.cards.undo--; a.cash = p.cash; a.bank = p.bank; a.pos = p.pos; a.fut = p.fut; a.orders = p.orders; Object.assign(a.st, p.st); a.snap = null;
      return "后悔药生效：账户已倒回到刚才下单之前";
    }
    return "";
  };
  E.xray = function () {
    const x = S.me.xray; if (!x || x.d !== S.day || S.t > x.until) return null; const s = S.ins[x.id];
    return { id: x.id, name: s.name, left: Math.ceil((x.until - S.t) / 2), rows: ["量化", "游资", "机构", "国家队", "散户"].map(g => [g, s.lhb[g] || 0]) };
  };
  /* 开挂散户的雷达：追涨的量化现在手里拿着什么 */
  E.radar = function () {
    const m = {}; S.quants.forEach(q => { if (q.typ === "追涨") for (const k in q.pos) m[k] = (m[k] || 0) + q.pos[k].q * S.ins[k].price; });
    return Object.keys(m).filter(k => m[k] > 0).sort((x, y) => m[y] / S.ins[y].tickLiq - m[x] / S.ins[x].tickLiq).slice(0, 3).map(k => S.ins[k]);
  };
  function rallyTo(s) { const al = S.agents.find(x => x.g === "游资" && !x.human); if (!al) return; al.tg = s.id; al.left = E.eq(al) * .25; al.n = 40; say("游资群", al.name, "收到，我跟 " + s.name + "，一起封"); }
  const fairTxt = s => { const g = s.fair / s.price - 1 + gs() * .008; return s.name + (Math.abs(g) < .015 ? " 现在的价格差不多合理" : g > 0 ? " 现在比它的真实价值便宜约 " + (g * 100).toFixed(0) + "%" : " 现在比它的真实价值贵约 " + (-g * 100).toFixed(0) + "%"); };

  /* 生活小事件：一局两次，突然弹出来，8 秒内二选一，不选就当没发生 */
  const pstock = () => pick(S.stocks.filter(s => !s.lu && !s.ld));
  function plant(s) {
    const good = rnd() < .65, n = 20 + ri(60);
    S.later.push({ d: S.day, t: S.t + 16 + ri(14), f: () => { const m = good ? [s.name, 1, 2.2, "【" + s.name + "】突发公告：签下重大合同，金额相当于去年营收的 " + n + "%。"] : [s.name, -1, 1.6, "【" + s.name + "】澄清公告：网传的重大利好并不存在，并提示经营风险。"]; applyNews(m); news(m[3], false, s.id, good); } });
  }
  /* 大 V 喊单：先被跟风买上去，之后要么真有料，要么大 V 自己先跑 */
  function vpost(s) {
    s.crowd += s.tickLiq * 7; S.sig.push({ id: s.id, e: 1, p: 1.5 }); const real = rnd() < .5;
    emit("bar", { who: "股吧大V·老韭菜", x: s.name + "，这只要起飞，不解释。懂的都懂。", zw: true, truth: real });
    S.later.push({ d: S.day, t: S.t + 30 + ri(20), f: () => { if (real) { const m = [s.name, 1, 1.8, "【" + s.name + "】公告证实了市场传闻，大 V 这次说对了。"]; applyNews(m); news(m[3], false, s.id); } else { s.crowd -= s.tickLiq * 12; news("【股吧】大 V“老韭菜”被扒：喊完 " + s.name + " 之后，自己第一个卖了。", false, s.id); } } });
  }
  const gift = (a, v) => { a.cash += v; a.init += v; a.st.peak += v; a.eqPrev += v; a.st.d.e0 += v; };
  const LIFE = {
    "散户": [
      { t: "老板朝你工位走过来了。", a: ["切到表格装忙（5 秒不能下单）", "赌他不看我（三成概率被叫去开会 15 秒）"], f: [a => (lock(a, 10, "boss"), "你切到了表格，老板点点头走了"), a => rnd() < .3 ? (lock(a, 30, "meet"), "被老板叫去开会了，15 秒后回来") : "老板没往你这边看，虚惊一场"] },
      { t: "有人把你拉进“内部荐股群”，群主说手里有绝密消息。", a: ["听听看（一半是真内参，一半是广告刷屏 6 秒）", "退群"], f: [a => rnd() < .5 ? "这次是真的：得到 1 张“" + CARD[addCard(a, "tip")] + "”卡" : (lock(a, 12, "ad"), "是卖课的，广告刷了你一屏"), () => "你退群了，什么都没发生"] },
      { t: "券商客服来电：送你半分钟“极速通道”体验，体验完要听 5 秒推销。", a: ["要（半分钟内下单几乎没有冲击成本，免手续费）", "挂掉"], f: [a => { a.fast = 60; soon(60, () => lock(a, 10, "ad")); return "极速通道已开，半分钟内下单最划算"; }, () => "你把电话挂了"] },
      { t: "同事凑过来：“听说 {s} 马上要出大消息，要不要一起买点？”（同事的消息大约六成靠谱）", s: 1, a: ["去看看这只股票", "不信，接着干自己的"], f: [(a, s) => { plant(s); return { go: s.id, m: "消息真假很快见分晓" }; }, (a, s) => { plant(s); return "你没理他"; }] },
      { t: "一笔意外之财到账：1 万元。", a: ["转进股市（场内多 1 万，不算你赚的）", "存起来"], f: [a => { gift(a, 1e4); return "1 万元已到场内可用"; }, () => "你把钱存起来了"] },
      { t: "炒股软件弹窗：免费试用 1 分钟“高级行情”，试完要看 4 秒广告。", a: ["试用（1 分钟内看清我选中的股票是谁在买卖）", "关掉"], f: [(a, s, sel) => { const z = S.ins[sel]; if (!z || z.kind !== "stock") return "你选中的不是股票，试用白开了"; a.xray = { id: z.id, d: S.day, until: S.t + 120 }; soon(120, () => lock(a, 8, "ad")); return "高级行情已打开，对准了 " + z.name; }, () => "你把弹窗关了"] },
      { t: "股吧大 V 发帖点名 {s}：“这只要起飞，不解释。”（大 V 一半有料，一半是想找人接盘）", s: 1, a: ["去看看这只股票", "不看，大 V 的话听听就好"], f: [(a, s) => { vpost(s); return { go: s.id, m: "很多人跟着大 V 冲进去了，真假半分钟内见分晓" }; }, (a, s) => { vpost(s); return "你没理大 V"; }] },
      { t: "外卖到了，骑手在楼下打电话。", a: ["下楼去拿（6 秒不能下单，吃饱了脑子清醒：得一张道具卡）", "让他放门口，接着盯盘"], f: [a => { lock(a, 12, "food"); return "饭拿上来了，得到 1 张“" + CARD[addCard(a, pick(["tip", "undo", "xray"]))] + "”卡"; }, () => "外卖放门口了，凉了再说"] },
      { t: "手机只剩 3% 的电了。", a: ["去找充电器（6 秒不能下单）", "硬撑（四成概率关机 20 秒）"], f: [a => (lock(a, 12, "chg"), "找到充电器了"), a => rnd() < .4 ? (lock(a, 40, "off"), "手机关机了，20 秒后开机") : "电量撑住了"] }
    ],
    "机构": [
      { t: "大客户来电：“最近业绩怎么回事？”", a: ["耐心解释（8 秒不能下单）", "先挂了（三成概率他赎回 1%）"], f: [a => (lock(a, 16, "call"), "客户被你稳住了"), a => { if (rnd() >= .3) return "客户没计较"; a.cash *= .99; for (const id in a.pos) { const p = a.pos[id]; p.q = Math.floor(p.q * .99 / 100) * 100; p.av = Math.min(p.av, p.q); if (!p.q) delete a.pos[id]; } return "客户生气了，赎回了 1%"; }] },
      { t: "研究员递来一份刚写完的深度报告：{s}。", s: 1, a: ["花 5 秒看完", "先放一边"], f: [(a, s) => (lock(a, 10, "read"), { go: s.id, m: "报告结论：" + fairTxt(s) }), () => "报告被你压在了咖啡杯下面"] },
      { t: "同行饭局上有人说：{s} 马上要出大消息。（饭局上的话大约六成靠谱）", s: 1, a: ["去看看这只股票", "听听就算了"], f: [(a, s) => { plant(s); return { go: s.id, m: "消息真假很快见分晓" }; }, (a, s) => { plant(s); return "你没往心里去"; }] }
    ],
    "游资": [
      { t: "营业部经理来电：“你的席位太显眼了，要不要换个马甲？”", a: ["换（今天的监管计数清零，5 秒不能下单）", "不换"], f: [a => { a.st.db = {}; a.st.wn = {}; lock(a, 10, "call"); return "马甲换好了，今天的买入量从头算"; }, () => "你没换"] },
      { t: "老搭档发来消息：“今天打哪只？带我一个。”", a: ["告诉他：就打我现在选中的这只", "保密"], f: [(a, s, sel) => { const z = S.ins[sel]; if (!z || z.kind !== "stock" || z.lu) return "你选中的不是能打的股票，他没听懂"; rallyTo(z); return "老搭档跟你一起买 " + z.name; }, () => "你没告诉他"] },
      { t: "圈里有人说：{s} 马上要出大消息。（圈里的话大约六成靠谱）", s: 1, a: ["去看看这只股票", "不信"], f: [(a, s) => { plant(s); return { go: s.id, m: "消息真假很快见分晓" }; }, (a, s) => { plant(s); return "你没理"; }] }
    ],
    "国家队": [
      { t: "财经媒体想约你做个专访。", a: ["接受（喊话次数 +1，8 秒不能操作）", "婉拒"], f: [a => { a.shouts++; lock(a, 16, "call"); return "专访做完了，喊话次数 +1"; }, () => "你婉拒了"] },
      { t: "上级来电，要听一下今天的情况。", a: ["汇报（5 秒不能操作，问询函 +1）", "稍后再说"], f: [a => { a.inq++; lock(a, 10, "call"); return "汇报完了，问询函 +1"; }, () => "你说稍后回电"] },
      { t: "研究部门送来一份内部评估：{s}。", s: 1, a: ["花 5 秒看完", "先放一边"], f: [(a, s) => (lock(a, 10, "read"), { go: s.id, m: "评估结论：" + fairTxt(s) }), () => "你没看"] }
    ]
  };
  function startLife() {
    const a = S.me, L0 = LIFE[a.g].filter(e => !(e.a[0].indexOf("转进股市") >= 0 && !G.ROLES[a.role].pick)), i = ri(L0.length), ev = L0[i], s = ev.s ? pstock() : null;
    if (ev.s && !s) return;
    S.life = { ev, s, left: 18 }; emit("life", { t: ev.t.replace("{s}", s ? s.name : ""), a: ev.a, left: 18, go: s ? s.id : undefined });
  }
  E.life = function (i, sel) {
    const L1 = S.life; if (!L1) return ""; S.life = null; emit("life", null);
    const r = L1.ev.f[i](S.me, L1.s, sel); return r || "";
  };

  /* 你在股吧、群里说话：有人回你；在股吧带着股票名喊涨喊跌，一天头两次会有人跟 */
  E.post = function (to, x) {
    if (!S || S.over) return; const a = S.me, d = a.st.d;
    const s = S.stocks.find(z => x.indexOf(z.name) >= 0 || x.indexOf(z.name.replace(/股份|科技|电力|机械|食品|生物|传媒|建材/, "")) >= 0);
    const dir = /涨|买|冲|牛|飞|上车|拉|封|看多|加仓|抄底/.test(x) ? 1 : /跌|卖|跑|割|崩|垃圾|出货|看空|砸|雷/.test(x) ? -1 : 0;
    if (to === "bar2") {
      if (s && dir && E.isT() && d.posts < 2) { d.posts++; s.crowd += dir * s.tickLiq * 1.5; }
      const say1 = () => emit("bar", { who: pick(G.BAR.names), x: pick(s && dir ? (dir > 0 ? G.REPLY.up : G.REPLY.dn) : G.REPLY.any).replace("{s}", s ? s.name : "") });
      soon(3 + ri(4), say1); if (rnd() < .6) soon(8 + ri(6), say1);
    } else if (a.grp) { const sp = S.agents.filter(q => q.grp === a.grp && !q.human); if (sp.length) soon(3 + ri(5), () => emit("chat", { grp: a.grp, who: pick(sp).name, x: pick(G.GREPLY) })); }
  };

  /* ---------- 量化盘 ---------- */
  function qMom(a) {
    for (const id of a.uni) {
      const s = S.ins[id]; if (s.halt > 0) continue;
      const b = S.t > a.look ? s.p[S.t - 1 - a.look] : s.prev, r = s.price / b - 1, th = s.lim * a.th, p = a.pos[id], have = p ? p.q * s.price : 0;
      let tgt = have; if (r > th) tgt = Math.min(a.init / 5, s.tickLiq * 25); else if (r < -th * .5) tgt = 0;
      const d = tgt - have; if (Math.abs(d) > s.price * 100) trade(a, s, Math.sign(d), Math.min(Math.abs(d), s.tickLiq * a.rate));
    }
  }
  function qT(a) {
    if (S.t < 5 || S.t % 4) return;
    for (const id of a.uni) {
      const s = S.ins[id]; if (s.halt > 0) continue;
      const B = a.baseVal[id], dev = s.price / s.vwap - 1, tgt = B * (1 - cl(dev / (s.sigma * .8), -1, 1) * .8), p = a.pos[id], d = tgt - (p ? p.q * s.price : 0);
      if (Math.abs(d) > B * .2) trade(a, s, Math.sign(d), Math.min(Math.abs(d), s.tickLiq * .6));
    }
  }
  function qNews(a) {
    for (; a.seen < S.sig.length; a.seen++) { const g = S.sig[a.seen]; if (g.p < 2 && rnd() < .5) continue; a.jobs.push({ id: g.id, e: g.e, n: 6, hold: 40 + ri(30) }); }
    a.jobs = a.jobs.filter(j => {
      const x = S.ins[j.id];
      if (x.kind === "fut") { if (j.n > 0) { ftrade(a, x, j.e * a.lots); j.n = 0; return true; } if (--j.hold > 0) return true; const p = a.fut[x.id]; if (p) ftrade(a, x, -Math.sign(p.q) * Math.min(Math.abs(p.q), a.lots)); return false; }
      if (x.halt > 0) return true;
      if (j.n > 0) { trade(a, x, j.e, x.tickLiq * a.rate); j.n--; return true; }
      if (--j.hold > 0) return true;
      const p = a.pos[j.id]; if (j.e > 0 && p && p.q > 0) { trade(a, x, -1, x.tickLiq * a.rate * .6); return !!a.pos[j.id] && !x.ld ? true : false; }
      return false;
    });
  }

  /* ---------- 电脑扮演的其他角色 ---------- */
  const AI = {
    "国家队": function (a) {
      const r = S.big.price / S.big.prev - 1;
      if (r < -.015) { if (!a.gD) { a.gD = 1; dyn("【桌上】国家队进场托盘了，在买大盘股。"); } a.core.forEach(id => trade(a, S.ins[id], 1, S.ins[id].tickLiq * 2)); if (r < -.022 && a.shouts > 0 && !a.shD) { a.shD = 1; a.shouts--; shout(1); } }
      else if (r > .022) a.core.forEach(id => trade(a, S.ins[id], -1, S.ins[id].tickLiq));
    },
    "机构": function (a) {
      if ((S.t + a.k) % 6) return;
      for (let id = 0; id < 9; id++) { const s = S.ins[id], g = Math.log(s.fair / s.price), p = a.pos[id]; if (g > .02) trade(a, s, 1, s.tickLiq * .5); else if (g < -.02 && p && p.av > 0) trade(a, s, -1, s.tickLiq * .5); }
      if (a.essays > 0 && rnd() < .006) { a.essays--; dyn("【桌上】有一家机构刚往股吧发了一篇小作文，真假不知道。"); essay(S.ins[pick([3, 4, 5, 6, 7, 10, 11, 12, 13, 14])], rnd() < .55 ? 1 : -1, rnd() < .5); }
    },
    "游资": function (a) {
      const T = S.t;
      if (a.tg == null && T === a.go) {
        let best = null, bs = -9;
        for (const id of a.uni) { const s = S.ins[id]; if (s.lu || s.halt > 0) continue; const sc = Math.log(s.fair / s.price) * 3 + (s.price / s.prev - 1) + rnd() * .03; if (sc > bs) { bs = sc; best = s; } }
        if (best) { a.tg = best.id; a.left = E.eq(a) * .2; a.n = 40; say("游资群", a.name, rnd() < .8 ? "我去点火 " + best.name + "，想跟的跟" : "今天看 " + S.ins[pick(a.uni)].name + "，先试一笔"); dyn("【桌上】有一个游资出手了，盯上了一只" + (best.big ? "题材股" : "微小盘股") + "。"); }
      }
      if (a.tg != null && a.n > 0) { const s = S.ins[a.tg]; if (!(s.halt > 0)) a.left -= trade(a, s, 1, Math.min(a.left, s.tickLiq * 2.5)); a.n--; if (s.lu || a.left < s.price * 100) a.n = 0; }
      if (T > 3) for (const id in a.pos) { const p = a.pos[id], s = S.ins[id]; if (p.av > 0 && +id !== a.tg && !(s.halt > 0)) { if (s.lu && s.seal > s.tickLiq * 3) continue; if (s.price < p.cost * .97 && T < 200) continue; trade(a, s, -1, s.tickLiq * .8); } }
    },
    "散户": function (a) {
      if (rnd() > .03) return;
      const hold = Object.keys(a.pos).filter(k => (a.t0 ? a.pos[k].q : a.pos[k].av) > 0);
      if (hold.length && rnd() < .5) { const id = pick(hold), s = S.ins[id], p = a.pos[id], g = s.price / p.cost - 1; if (g > .06 || g < -.07 || rnd() < .05) tradeSh(a, s, -1, a.t0 ? p.q : p.av); return; }
      const c = S.stocks.filter(s => (a.dare || !s.lu) && s.price / s.prev - 1 > .02), s = c.length && rnd() < .4 ? pick(c) : pick(S.stocks);
      trade(a, s, 1, E.avail(a) * .3);
    }
  };

  /* ---------- 每一步的行情 ---------- */
  function stepStock(s) {
    const T = S.t; if (s.halt > 0) s.halt--;
    const cr = s.crowd / 5; s.crowd -= cr;
    const herd = s.big && s.type !== "题材股" ? 0 : .10 * s.tickLiq * cl((s.price / s.prev - 1) / (s.lim * .5), -1, 1);
    const f = s.flow + cr + herd, lf = Math.log(s.fair / s.price);
    const jp = s.jump; s.jump = 0;
    const ret = jp + s.kappa * .8 * gs() + s.kappa * Math.sign(f) * Math.sqrt(Math.abs(f) / s.tickLiq) + .035 * lf + .03 * (s.big ? S.futB.basis : S.futS.basis);
    let np = s.price * (1 + ret);
    if (s.lu) {
      s.seal += s.flow + cr + s.tickLiq * (.1 + gs() * .6 + 6 * lf);
      if (s.seal > 0) np = s.up; else { s.lu = false; s.seal = 0; np = s.up * (1 - .004 - Math.abs(gs()) * .008); dyn("【盘面】" + s.name + " 涨停板被砸开。"); S.rage = Math.min(100, S.rage + 2); if (S.me.pos[s.id]) emit("fx", { k: "boom", id: s.id }); react("boom", s); }
    } else if (s.ld) {
      s.seal += -(s.flow + cr) + s.tickLiq * (.1 + gs() * .6 - 6 * lf);
      if (s.seal > 0) np = s.dn; else { s.ld = false; s.seal = 0; np = s.dn * (1 + .004 + Math.abs(gs()) * .008); dyn("【盘面】" + s.name + " 跌停板被撬开。"); }
    } else if (np >= s.up) { np = s.up; s.lu = true; s.seal = s.tickLiq * 2 + Math.max(0, f); if (++s.luN <= 2) dyn("【盘面】" + s.name + " 封上涨停。"); if (S.me.pos[s.id]) emit("fx", { k: "lu", id: s.id }); if (s.luN <= 1) react("lu", s); }
    else if (np <= s.dn) { np = s.dn; s.ld = true; s.seal = s.tickLiq * 2 + Math.max(0, -f); if (++s.ldN <= 2) dyn("【盘面】" + s.name + " 跌停。"); S.rage = Math.min(100, S.rage + 3); if (S.me.pos[s.id]) emit("fx", { k: "ld", id: s.id }); if (s.ldN <= 1) react("ld", s); }
    np = Math.max(.01, cl(r2(np), s.dn, s.up));
    const u = 1.6 - Math.sin(Math.PI * T / 239);
    const amt = s.tickLiq * (.35 + rnd() * .9) * u * (s.lu || s.ld ? .25 : 1) * (1 + Math.min(3, Math.abs(ret) / s.kappa * .3)) + s.xamt, sh = amt / np;
    s.cumA += amt; s.cumV += sh; s.vwap = s.cumA / s.cumV; s.la = amt;
    s.p.push(np); s.v.push(sh / 100);
    const key = (Math.round(np / s.step) * s.step).toFixed(2); s.dist[key] = (s.dist[key] || 0) + sh / 100;
    s.tr.push([E.clock(), np, Math.max(1, Math.round(sh / 100)), np > s.price ? 1 : np < s.price ? -1 : (f >= 0 ? 1 : -1)]); if (s.tr.length > 60) s.tr.shift();
    if (!s.lu && !s.ld && !qIdle()) S.hft.hf += amt * .00004; if (Math.abs(ret) > 3 * s.kappa) S.hft.hf -= s.tickLiq * Math.abs(ret) * .3;
    s.fair *= Math.pow(np / s.fair, .003) * (1 + gs() * s.kappa * .3);
    s.price = np; s.flow = 0; s.xamt = 0;
  }
  function stepIdx(x) {
    const np = r2(idxNow(x)), v = x.m.reduce((q, id) => q + S.ins[id].la, 0) / 1e8;
    x.tr.push([E.clock(), np, Math.round(v * 100) / 100, np >= x.price ? 1 : -1]); if (x.tr.length > 60) x.tr.shift();
    x.price = np; x.p.push(np); x.v.push(v);
  }
  function stepFut(f) {
    f.basis += .0005 * Math.sign(f.flow) * Math.sqrt(Math.abs(f.flow) / f.liq) - .06 * f.basis + gs() * .00015;
    const np = Math.round(f.u.price * (1 + f.basis) * 5) / 5, lots = Math.max(1, Math.round((f.liq * (.4 + rnd()) + Math.abs(f.flow)) / (np * f.mult)));
    const key = (Math.round(np / (f.u.base * .001)) * f.u.base * .001).toFixed(1); f.dist[key] = (f.dist[key] || 0) + lots;
    f.tr.push([E.clock(), np, lots, np >= f.price ? 1 : -1]); if (f.tr.length > 60) f.tr.shift();
    f.price = np; f.p.push(np); f.v.push(lots); f.flow = 0;
  }
  function risk(a) {
    let has = false; for (const k in a.fut) { has = true; break; }
    if (has && a.cash + fpnl(a) < fmar(a) * .5) {
      for (const k of Object.keys(a.fut)) ftrade(a, S.ins[k], -a.fut[k].q);
      a.st.liq = true; if (a.human) emit("toast", "期货保证金不够了，已被强制平仓");
    }
    if (a.human) { const e = E.eq(a); if (e > a.st.peak) a.st.peak = e; a.st.dd = Math.max(a.st.dd, 1 - e / a.st.peak); a.st.d.low = Math.min(a.st.d.low, e / a.st.d.e0 - 1); }
  }
  function fill(a) {
    a.orders = a.orders.filter(o => {
      const s = S.ins[o.id], mx = Math.max(100, Math.floor(s.tickLiq * PART / s.price / 100) * 100), got = tradeSh(a, s, o.side, Math.min(o.rem, mx), o);
      o.rem -= got; if (o.rem <= 0) return false;
      if (got === 0) { if (o.side > 0 && !s.lu) { emit("toast", "钱不够了，" + s.name + " 剩下的买单已撤"); return false; } if (o.side < 0 && !s.ld) return false; }
      return true;
    });
  }

  /* ---------- 一天的流程 ---------- */
  function startDay() {
    S.t = 0; S.closed = false;
    S.stocks.forEach(s => { s.prev = s.price; s.up = r2(s.prev * (1 + s.lim)); s.dn = r2(s.prev * (1 - s.lim)); s.p = []; s.v = []; s.dist = {}; s.tr = []; s.lu = s.ld = false; s.seal = 0; s.lhb = {}; s.cumA = s.cumV = 0; s.vwap = s.prev; s.flow = 0; s.xamt = 0; s.luN = s.ldN = 0; s.la = 0; s.nm = []; });
    [S.big, S.small, S.futB, S.futS].forEach(x => { x.nm = []; x.prev = x.price; x.p = []; x.v = []; x.tr = []; x.dist = {}; });
    S.agents.forEach(a => {
      for (const k in a.pos) { const p = a.pos[k]; p.av = p.q; p.td = 0; p.tdc = 0; }
      a.st.db = {}; a.st.wn = {}; a.st.ban = {};
      if (a.role === "pay") { if (a.owe > 0) { a.owe--; if (a.human) emit("toast", "今天的工资之前预支掉了，不发"); } else { a.cash += 2e4; a.init += 2e4; a.st.peak += 2e4; a.eqPrev += 2e4; if (a.human) emit("toast", "工资到账 2 万元"); } }
      if (a.g === "游资" && !a.human) { a.tg = null; a.go = 5 + ri(60); }
      a.shD = 0; a.gD = 0;
    });
    const sc = S.script, thm = sc.theme ? G.THEMES[sc.theme] : null;
    S.stocks.forEach(s => { s.fair *= 1 + S.regime + (s.big ? sc.big[S.day] : sc.small[S.day]) + (thm && thm.indexOf(s.name) >= 0 ? sc.th[S.day] : 0) + gs() * .004; s.jump = 0; if (s.chk) { s.chk = 0; s.halt = 120; s.crowd *= .3; } });
    runLater();
    for (let i = 0; i < 2 && S.pool.length; i++) { const n = S.pool.pop(); applyNews(n); emit("news", { x: n[3], tm: "盘前", id: tgId(n[0]), hot: n[2] >= 2.4 }); }
    /* 券商晨报：大约六成准 */
    { const dr = sc.big[S.day], dir = (Math.abs(dr) < .002 ? (rnd() < .5 ? 1 : -1) : Math.sign(dr)) * (rnd() < .65 ? 1 : -1);
      emit("news", { x: "【晨报】" + pick(G.NEWSGEN.pools["行"]) + "证券晨会：今天大盘" + pick(dir > 0 ? G.MORN.up : G.MORN.dn), tm: "盘前" }); }
    const me = S.me; me.st.d = newDay(me.eqPrev); me.st.d.fw0 = me.st.fw; me.snap = null; me.xray = null;
    S.qDay0 = qTot(); S.guess = null; S.dflag = {}; S.rT = -99; offerBty();
    if (S.day === 0 && S.mut) emit("news", { x: "【本局规则】" + S.mut.n + "：" + S.mut.t, tm: "盘前", hot: true });
    emit("news", { x: "【黄历】今日股民黄历：宜 " + pick(G.ALMANAC.good) + "，忌 " + pick(G.ALMANAC.bad) + "。（图个乐，不准）", tm: "盘前" });
  }
  function open() {
    S.stocks.forEach(s => { s.price = cl(r2(s.prev * Math.pow(s.fair / s.prev, .5) * (1 + gs() * .003)), s.dn, s.up); s.open = s.price; });
    [S.big, S.small].forEach(x => x.price = r2(idxNow(x)));[S.futB, S.futS].forEach(f => f.price = Math.round(f.u.price * 5) / 5);
  }
  function closeDay() {
    const ir = S.big.price / S.big.prev - 1; S.closed = true; S.dayRet.push(ir);
    const me = S.me, e0 = E.eq(me), rk = S.stocks.map(s => [s.name, s.price / s.prev - 1, s.id]).sort((x, y) => y[1] - x[1]);
    S.sum = { day: S.day, ir, sr: S.small.price / S.small.prev - 1, my: e0 - me.eqPrev, myPct: e0 / me.eqPrev - 1, lu: S.stocks.filter(s => s.price >= s.up).map(s => s.name), ld: S.stocks.filter(s => s.price <= s.dn).map(s => s.name), top: rk.slice(0, 3), bot: rk.slice(-3).reverse(), amt: S.stocks.reduce((x, s) => x + (s.cumA || 0), 0) };
    S.pm = []; (S.hist = S.hist || []).push(S.sum);
    /* 悬赏、竞猜、徽章：都在收盘这一刻结算 */
    S.sum.qd = E.qDay(); chkBty(true);
    { const b = S.bty; if (b && b.pick >= 0) S.sum.bty = { ok: b.done, t: b.opts[b.pick].t, card: b.opts[b.pick].card };
      const g = S.guess; if (g && g.pick) { g.res = S.big.price > g.base ? 1 : -1; const ok = g.res === g.pick; S.sum.guess = { ok, card: ok ? CARD[addCard(me, pick(["tip", "undo", "xray"]))] : "" }; if (ok && ++S.stat.gz >= 3) badge("seer"); }
      const d = me.st.d, my = S.sum.my, hi = id => Math.max.apply(null, S.ins[id].p), lo = id => Math.min.apply(null, S.ins[id].p);
      if (Object.keys(me.pos).some(k => S.ins[k].price >= S.ins[k].up)) badge("board");
      if (d.sells.some(x => x[1] >= hi(x[0]) * .997)) badge("top");
      if (d.buys.some(x => x[1] <= lo(x[0]) * 1.003 && S.ins[x[0]].price >= x[1] * 1.02)) badge("dip");
      if (S.sum.qd < 0 && S.sum.myPct >= .01) badge("beatq");
      if (ir <= -.015 && my >= 0) badge("dodge");
      if (d.ord > 0 && d.ord <= 2 && S.sum.myPct >= .005) badge("calm");
      if (d.low <= -.02 && my > 0) badge("comeback");
      if (S.hist.length >= 3 && S.hist.slice(-3).every(x => x.my > 0)) badge("streak3"); }
    const sum = a => a.reduce((x, y) => x + y, 0);
    S.stocks.forEach(s => {
      s.days.push({ o: s.p[0], c: s.price, h: Math.max.apply(null, s.p), l: Math.min.apply(null, s.p), v: sum(s.v) });
      s.luStreak = s.price >= s.up ? s.luStreak + 1 : 0; s.ldStreak = s.price <= s.dn ? s.ldStreak + 1 : 0; s.luMax = Math.max(s.luMax, s.luStreak); if (s.ldStreak >= 2) S.ldFail = true;
      if (s.luStreak === 2) S.pm.push(["【异动】" + s.name + " 连续两日涨停，公司发布异常波动公告：没有应披露而未披露的事项。", s.id]);
      if (s.luStreak >= 3) { s.chk = 1; S.pm.push(["【监管】" + s.name + " 连续 " + s.luStreak + " 日涨停，被列入重点监控，明天上午量化和游资席位不得买入。", s.id]); }
      if (s.ldStreak === 1) S.pm.push(["【风险】" + s.name + " 今日跌停，明天再跌停就是连续两天。", s.id]);
      if (s.luStreak) { s.fair = Math.max(s.fair, s.price) * (1.02 + rnd() * .04); s.crowd = s.tickLiq * (6 + rnd() * 10); }
      else if (s.ldStreak) { s.fair = Math.min(s.fair, s.price) * (.98 - rnd() * .03); s.crowd = -s.tickLiq * (5 + rnd() * 8); }
    });
    [S.big, S.small, S.futB, S.futS].forEach(x => x.days.push({ o: x.p[0], c: x.price, h: Math.max.apply(null, x.p), l: Math.min.apply(null, x.p), v: sum(x.v) }));
    if (Math.abs(ir) > .02) S.idxFail = true;
    S.agents.forEach(a => {
      a.orders = [];
      if (a.g === "机构") {
        const e = E.eq(a), ex = e / a.eqPrev - 1 - ir, fl = cl(ex * 3, -.05, .05);
        if (fl >= 0) a.cash += e * fl; else { const k = 1 + fl; a.cash *= k; for (const id in a.pos) { const p = a.pos[id]; p.q = Math.floor(p.q * k / 100) * 100; p.av = p.q; if (!p.q) delete a.pos[id]; } }
        a.st.flows.push(e * fl); a.eqPrev = E.eq(a);
        if (a.human) emit("toast", (ex >= 0 ? "今天跑赢大盘 " : "今天跑输大盘 ") + (Math.abs(ex) * 100).toFixed(2) + "%，客户" + (fl >= 0 ? "加钱 " : "赎回 ") + E.money(Math.abs(e * fl)));
      } else a.eqPrev = E.eq(a);
    });
  }
  function post() {
    emit("news", { x: "【收盘】大盘指数收于 " + S.big.price.toFixed(2) + "，" + (S.big.price >= S.big.prev ? "涨 " : "跌 ") + Math.abs((S.big.price / S.big.prev - 1) * 100).toFixed(2) + "%。", tm: "15:00" });
    S.stocks.filter(s => Math.abs(s.price / s.prev - 1) >= s.lim * .7).slice(0, 5).forEach(s => {
      const ks = Object.keys(s.lhb); if (!ks.length) return;
      const b = ks.slice().sort((x, y) => s.lhb[y] - s.lhb[x])[0], sl = ks.slice().sort((x, y) => s.lhb[x] - s.lhb[y])[0];
      emit("news", { x: "【龙虎榜】" + s.name + " " + (s.price >= s.prev ? "涨 " : "跌 ") + Math.abs((s.price / s.prev - 1) * 100).toFixed(1) + "%：买得最多的是" + (s.lhb[b] > 0 ? b + "席位" : "普通账户") + "，卖得最多的是" + (s.lhb[sl] < 0 ? sl + "席位" : "普通账户") + "。", tm: "盘后" });
    });
  }
  function postExtra() {
    (S.pm || []).forEach(m => emit("news", { x: m[0], tm: "盘后", id: m[1] }));
    const g = E.goal(S.me); S.sum.goal = g.items.filter(x => x[1]).length + "/" + g.items.length; S.sum.last = S.day >= E.DAYS - 1;
    emit("close", S.sum);
  }
  function noon() {
    if (S.me.role === "spy") emit("peek", S.hotLog.filter(m => m.d === S.day && m.am));
    mkGuess();
  }
  function tradeTick() {
    runLater();
    if (--S.nn <= 0) { S.nn = mut("news") ? 5 + ri(6) : 10 + ri(11); postNews(); }
    if (S.dyn.length > 6) S.dyn.splice(0, S.dyn.length - 6);
    if (--S.bn <= 0) { S.bn = 7 + ri(10); barTalk(); }
    if (--S.cn <= 0) { S.cn = 10 + ri(14); grpTalk(); }
    /* 量化：被举报后停 1 小时；平时一边赚钱一边攒散户的怒气 */
    if (S.qOff > 0) { if (--S.qOff === 0) news("【监管】窗口指导到期，量化盘恢复报单。"); }
    else {
      const qd = E.qDay(); S.rage = Math.min(100, S.rage + (.22 + (qd > 0 ? .16 : 0)) * (mut("rage") ? 2 : 1));
      if (S.rage >= 100 && (S.me.g !== "散户" ? rnd() < .03 : ++S.rageW > 160)) report(false);
    }
    if (--S.qn <= 0) { S.qn = 40 + ri(50); emit("bar", { who: pick(S.quants).name, x: pick(qIdle() ? G.QSAY.off : E.qDay() > 0 ? G.QSAY.win : G.QSAY.lose), q: true }); }
    if (!S.life && S.lifeQ.length && S.lifeQ[0].d <= S.day && (S.lifeQ[0].d < S.day || S.lifeQ[0].t <= S.t) && !(S.me.lock > 0)) { S.lifeQ.shift(); startLife(); }
    if (S.t === 220) emit("fx", { k: "tail" });
    { const r = S.big.price / S.big.prev - 1, f = S.dflag; if (r < -.015 && !f.c) { f.c = 1; react("crash"); } else if (r > .015 && !f.s) { f.s = 1; react("surge"); } }
    S.agents.forEach(a => { if (a.act && !(a.quant && qIdle())) a.act(a); });
    fill(S.me);
    S.stocks.forEach(stepStock);
    stepIdx(S.big); stepIdx(S.small); stepFut(S.futB); stepFut(S.futS);
    S.agents.forEach(risk);
    chkBty(false);
    S.t++;
  }
  E.tick = function () {
    if (S.over) return;
    const k = phk(), me = S.me;
    if (S.soon.length) { const q = S.soon; S.soon = []; q.forEach(j => { if (--j.n <= 0) j.f(); else S.soon.push(j); }); }
    if (me.lock > 0) me.lock--; if (me.fast > 0) me.fast--;
    if (S.life && --S.life.left <= 0) { S.life = null; emit("life", null); }
    if (S.pt === 0) { if (k === "PRE") startDay(); else if (k === "AM") { open(); if (S.bty && S.bty.pick < 0) { S.bty.pick = 0; emit("bty", S.bty); emit("toast", "悬赏没选，帮你接了第一个"); } } else if (k === "NOON") noon(); else if (k === "POST") { post(); postExtra(); } }
    if (k === "AM" || k === "PM") tradeTick();
    S.pt++;
    if (S.pt >= E.PH[S.ph].n) {
      if (k === "PM") closeDay();
      S.pt = 0; S.ph++;
      if (S.ph >= E.PH.length) { S.ph = 0; S.day++; if (S.day >= E.DAYS) { S.day = E.DAYS - 1; S.ph = E.PH.length - 1; S.pt = E.PH[S.ph].n; finish(); } }
    }
    emit("tick");
  };

  /* ---------- 玩家操作 ---------- */
  E.money = x => { const s = x < 0 ? "-" : "", v = Math.abs(x); return s + (v >= 1e8 ? (v / 1e8).toFixed(2) + " 亿" : v >= 1e4 ? (v / 1e4).toFixed(2) + " 万" : v.toFixed(0)); };
  E.order = function (id, side, frac) {
    const a = S.me, s = S.ins[id]; if (S.over) return "这局已经结束了"; if (!s || s.kind !== "stock") return "先选一只股票";
    if (phk() === "POST") return "已经收盘了，明天再下单";
    if (side > 0 && a.st.ban[id]) return "今天你被监管限制买入这只股票，明天解除";
    if (a.lock > 0) return busy(a);
    let sh;
    if (side > 0) { sh = Math.floor(E.avail(a) * frac / (s.price * 1.001) / 100) * 100; if (sh <= 0) return "钱不够买一手（一手要 " + E.money(s.price * 100) + " 元）"; }
    else {
      const p = a.pos[id], can = p ? (a.t0 ? p.q : p.av) : 0, pend = a.orders.filter(o => o.id === id && o.side < 0).reduce((x, o) => x + o.rem, 0), left = can - pend;
      sh = frac >= 1 ? left : Math.floor(left * frac / 100) * 100;
      if (sh <= 0) return p && p.q > 0 && !pend ? "今天买的明天才能卖" : "没有可卖的";
    }
    snap(a); a.st.d.ord++;
    a.orders.push({ oid: ++S.oid, id, side, rem: sh, tot: sh });
    return null;
  };
  E.cancel = oid => { S.me.orders = S.me.orders.filter(o => o.oid !== oid); };
  E.fut = function (id, act, lots) {
    const a = S.me, f = S.ins[id]; if (!f || f.kind !== "fut") return "先选一个期货";
    if (!E.isT()) return "期货只能在交易时间买卖";
    if (a.lock > 0) return busy(a);
    const c = a.fut[id];
    if (act === "close") { if (!c) return "没有持仓可平"; snap(a); a.st.d.ord++; const n = ftrade(a, f, -c.q); return "已平仓 " + n + " 手"; }
    snap(a);
    const n = ftrade(a, f, (act === "long" ? 1 : -1) * lots); if (n) a.st.d.ord++;
    return n ? "成交 " + n + " 手" : "保证金不够（一手要 " + E.money(f.price * f.mult * f.mr * (a.lev ? .5 : 1)) + " 元）";
  };
  E.futMax = f => Math.max(0, Math.floor(E.avail(S.me) / (f.price * f.mult * f.mr * (S.me.lev ? .5 : 1))));
  E.transfer = function (dir) {
    const a = S.me; if (!G.ROLES[a.role].pick) return "这个角色的钱都在场内";
    if (dir > 0) { const x = Math.round(a.bank * .25) || a.bank; if (x <= 0) return "场外没钱了"; a.bank -= x; a.cash += x; return "转入场内 " + E.money(x) + " 元"; }
    const x = Math.floor(Math.max(0, E.avail(a)) * .25); if (x <= 0) return "场内没有可转出的钱"; a.cash -= x; a.bank += x; return "转出到场外 " + E.money(x) + " 元";
  };
  E.skill = function (k, id) {
    const a = S.me, s = S.ins[id]; if (S.over) return "这局已经结束了"; if (a.lock > 0) return busy(a);
    if (k === "research") { if (a.role !== "big") return "只有特大号散户能去调研"; if (a.res <= 0) return "调研次数用完了"; if (!s || s.kind !== "stock") return "先选一只股票"; a.res--; return "调研回来了：" + fairTxt(s); }
    if (k === "advance") { if (a.role !== "pay") return "只有发工资散户能预支"; if (a.adv <= 0) return "预支次数用完了"; a.adv--; a.owe++; gift(a, 2e4); return "预支了 2 万元工资，之后有一天不发工资"; }
    if (!E.isT()) return "交易时间才能用";
    if (k === "rally") { if (a.role !== "hot") return "只有游资能喊兄弟"; if (a.rally <= 0) return "喊兄弟的次数用完了"; if (!s || s.kind !== "stock") return "先选一只股票"; if (s.lu) return "已经涨停了，不用喊"; a.rally--; rallyTo(s); return "另一个游资跟你一起买 " + s.name; }
    if (k === "essayUp" || k === "essayDn") { if (a.g !== "机构") return "只有机构能发小作文"; if (a.essays <= 0) return "小作文用完了"; if (!s || s.kind !== "stock") return "先选一只股票"; a.essays--; essay(s, k === "essayUp" ? 1 : -1, false); return "小作文已发到股吧"; }
    if (a.role !== "gov") return "只有国家队能用";
    if (k === "shoutUp" || k === "shoutDn") { if (a.shouts <= 0) return "喊话用完了"; a.shouts--; shout(k === "shoutUp" ? 1 : -1); return "已喊话"; }
    if (k === "inquiry") { if (a.inq <= 0) return "问询函用完了"; if (!s || s.kind !== "stock") return "先选一只股票"; a.inq--; s.halt = 60; s.fair *= .985; news("【监管】交易所向 " + s.name + " 下发问询函，要求说明股价异常波动的原因。"); return "已发问询函，量化和游资暂时不能动它"; }
    return "";
  };
  E.book = function (s) {
    const tk = s.kind === "fut" ? .2 : Math.max(.01, r2(s.price * .0002)), unit = s.kind === "fut" ? 8 : Math.max(1, s.tickLiq / s.price / 100 * .5), R = Math.random;
    const ask = [], bid = [];
    for (let i = 1; i <= 5; i++) { ask.push([s.price + tk * i, Math.max(1, Math.round(unit * (.3 + R() * 1.4)))]); bid.push([s.price - tk * (i - 1) - (s.lu ? 0 : tk), Math.max(1, Math.round(unit * (.3 + R() * 1.4)))]); }
    if (s.kind === "stock") {
      if (s.lu) { ask.length = 0; bid[0] = [s.up, Math.max(1, Math.round(s.seal / s.price / 100))]; for (let i = 1; i < 5; i++) bid[i][0] = s.up - tk * i; }
      if (s.ld) { bid.length = 0; ask[0] = [s.dn, Math.max(1, Math.round(s.seal / s.price / 100))]; for (let i = 1; i < 5; i++) ask[i][0] = s.dn + tk * i; }
      ask.forEach(r => r[0] = Math.min(r[0], s.up)); bid.forEach(r => r[0] = Math.max(r[0], s.dn));
    }
    return { ask, bid };
  };

  /* ---------- 目标和结算 ---------- */
  const pc = x => (x * 100).toFixed(2) + "%", pcs = x => (x >= 0 ? "+" : "") + pc(x);
  E.goal = function (a) {
    const st = a.st, e = E.eq(a), g = e / a.init - 1; let it = [];
    switch (a.role) {
      case "big": it = [["最大回撤不超过 10%（现在 " + pc(st.dd) + "）", st.dd <= .1], ["结束时没亏（现在 " + pcs(g) + "）", g >= 0]]; break;
      case "t0": it = [["当天买卖并赚到 0.5% 以上 " + st.t0 + "/5 次", st.t0 >= 5]]; break;
      case "info": it = [["总资产涨 3% 以上（现在 " + pcs(g) + "）", g >= .03]]; break;
      case "dare": it = [["买进涨停板后赚钱卖出 " + st.dare + "/2 次", st.dare >= 2]]; break;
      case "lev": it = [["期货赚钱平仓 " + st.fw + "/3 次", st.fw >= 3], ["没被强制平仓", !st.liq]]; break;
      case "pay": { const v = val(a); let up = 0; for (const k in a.pos) up += (S.ins[k].price - a.pos[k].cost) * a.pos[k].q; it = [["一半以上的钱在股票里（现在 " + pc(e ? v / e : 0) + "）", v >= e * .5], ["持仓整体是赚的（现在 " + E.money(up) + " 元）", up > 0]]; break; }
      case "hot": {
        let best = [false, false, false], bn = -1;
        S.stocks.forEach(s => { const c = [s.luMax >= 2 && (st.buy[s.id] || 0) >= .02 * s.floatCap, !a.pos[s.id] && (st.buy[s.id] || 0) > 0, (st.real[s.id] || 0) > 0], n = c.filter(Boolean).length + (c[0] ? 3 : 0); if (n > bn) { bn = n; best = c; } });
        it = [["有一只股连续两天收盘涨停，而且你是大买家", best[0]], ["结束前把它卖光", best[0] && best[1]], ["在它身上是赚的", best[0] && best[2]]]; break;
      }
      case "org": case "spy": it = [["管理规模比开局多（开局 " + E.money(a.init) + "，现在 " + E.money(e) + "）", e > a.init]]; break;
      case "gov": {
        const n = S.agents.filter(x => x.g === "散户" && E.eq(x) >= x.init).length;
        it = [["每天大盘涨跌不超 2%", !S.idxFail], ["没有股票连续两天跌停", !S.ldFail], ["现金不少于开局一半（现在 " + pc(a.cash / a.cash0) + "）", a.cash >= a.cash0 * .5], ["5 个散户至少 3 个没亏（现在 " + n + " 个）", n >= 3]]; break;
      }
    }
    return { items: it, ok: it.every(x => x[1]) };
  };
  function finish() {
    S.over = true; const a = S.me, e = E.eq(a);
    S.res = { goal: E.goal(a), pnl: e - a.init, pct: e / a.init - 1, quants: S.quants.map(q => ({ name: q.name, typ: q.typ, pnl: E.qpnl(q) })), script: S.script, mut: S.mut, badges: S.badges.slice(), stat: S.stat };
    emit("end", S.res);
  }
})(window.GAME);
