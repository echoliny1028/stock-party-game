/* 页面：把引擎算出来的东西显示出来，把玩家的点击交给引擎。 */
(function () {
  const G = window.GAME, E = G.E, C = G.C, $ = id => document.getElementById(id);
  const Q = new URLSearchParams(location.search);
  let S = null, sel = 4, mode = "T", bkTab = "book", aTab = "pos", frac = .25, lots = "1", paused = false, speed = +(Q.get("speed") || 1), timer = null, role = "t0";
  const f2 = n => n.toFixed(2), pc = x => (x >= 0 ? "+" : "") + (x * 100).toFixed(2) + "%", cls = x => x > 0 ? "up" : x < 0 ? "down" : "flat", M = E.money;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const vol = v => v >= 1e4 ? (v / 1e4).toFixed(1) + "万" : String(Math.round(v));
  /* 声音：加速到 6 倍时不响；gap 是同一种声音最少隔多少毫秒 */
  const SFX = G.SFX, sndT = {}, reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  function snd(k, gap) { if (speed > 2) return; if (gap) { const n = Date.now(); if (sndT[k] && n - sndT[k] < gap) return; sndT[k] = n; } SFX.play(k); }

  /* 像素小人 */
  const SK = "#FFBB88", SPR = {
    gov: [["..rrrrrr..", ".rrryyrrr.", ".rssssssr.", ".skssssks.", ".ssssssss.", ".sssmmsss.", "..ssssss..", ".cccyyccc.", "cccccccccc", "cccccccccc"], { r: "#AA0000", y: "#FFFF55", s: SK, k: "#000", m: "#AA0000", c: "#FF5555" }],
    org: [["..hhhhhh..", ".hhhhhhhh.", ".hssssssh.", ".wkwsswkw.", ".ssssssss.", ".sssmmsss.", "..ssssss..", ".ccwttwcc.", "ccccttcccc", "ccccttcccc"], { h: "#AAAAAA", s: SK, k: "#000", w: "#FFFFFF", m: "#AA5500", c: "#0000AA", t: "#FF5555" }],
    hot: [["..hhhhhh..", ".hhhhhhhh.", ".hssssssh.", ".gggggggg.", ".sggssggs.", ".sssmmsss.", "..ssssss..", ".ccyyyycc.", "cccccccccc", "cccccccccc"], { h: "#555555", s: SK, g: "#0000AA", m: "#AA0000", c: "#FFFF55", y: "#AA5500" }],
    spy: [["..hhhhhh..", ".hhhhhhhh.", ".hssssssh.", ".kkksskkk.", ".ssssssss.", ".sssmmsss.", ".cssssssc.", ".ccwttwcc.", "ccccttcccc", "ccccttcccc"], { h: "#AAAAAA", s: SK, k: "#222222", w: "#FFFFFF", m: "#AA5500", c: "#555555", t: "#AA00AA" }],
    big: [["..hhhhhh..", ".hhhhhhhh.", ".hssssssh.", ".skssssks.", ".ssssssss.", ".sssmmsss.", "..ssssss..", ".ccyyyycc.", "cccyccyccc", "ccccyycccc"], { h: "#333333", s: SK, k: "#000", m: "#AA0000", c: "#AA00AA", y: "#FFFF55" }],
    t0: [["..hhhhhh..", ".hhhhhhhh.", ".hssssssh.", ".gggggggg.", ".ssssssss.", ".sssmmsss.", "..ssssss..", ".cccccccc.", "ccccllcccc", "ccccllcccc"], { h: "#AA5500", s: SK, g: "#55FF55", m: "#AA0000", c: "#555555", l: "#55FF55" }],
    info: [["....a.....", "..hhahhh..", ".ehhhhhhe.", ".esksskse.", ".esssssse.", ".sssmmsss.", "..ssssss..", ".cccccccc.", "cccwwwwccc", "cccccccccc"], { a: "#FFFF55", h: "#AA5500", e: "#55FFFF", s: SK, k: "#000", m: "#AA0000", c: "#0000AA", w: "#FFFFFF" }],
    dare: [["..hhhhhh..", ".hhhhhhhh.", ".rrrrrrrrr", ".skssssks.", ".ssssssss.", ".sssmmsss.", "..ssssss..", ".cccccccc.", "cccwwwwccc", "cccccccccc"], { h: "#333333", r: "#FF5555", s: SK, k: "#000", m: "#AA0000", c: "#AA0000", w: "#FFFF55" }],
    lev: [[".h.h.h.h..", ".hhhhhhhh.", ".hssssssh.", ".wksssskw.", ".ssssssss.", ".ssmmmmss.", "..ssssss..", ".cccccccc.", "cccccccccc", "cccccccccc"], { h: "#FFFF55", s: SK, w: "#FFFFFF", k: "#AA0000", m: "#AA0000", c: "#AA5500" }],
    botUp: [["...a..a...", ".gggggggg.", ".gwwggwwg.", ".gwkggkwg.", ".gggggggg.", ".gkggggkg.", ".ggkkkkgg.", ".gggggggg.", "..gg..gg..", ".ggg..ggg."], { a: "#FF5555", g: "#AAAAAA", w: "#FFFFFF", k: "#000" }],
    botDn: [["...a..a...", ".gggggggg.", ".gwwggwwg.", ".gkwggkwg.", ".gtggggtg.", ".gggggggg.", ".ggkkkkgg.", ".gkggggkg.", "..gg..gg..", ".ggg..ggg."], { a: "#555555", g: "#AAAAAA", w: "#FFFFFF", k: "#000", t: "#55FFFF" }],
    botOff: [["..........", ".gggggggg.", ".gggggggg.", ".gkkggkkg.", ".gggggggg.", ".gggggggg.", ".gggkkggg.", ".gggggggg.", "..gg..gg..", ".ggg..ggg."], { g: "#555555", k: "#000" }],
    pay: [["..hhhhhh..", ".hhhhhhhh.", ".hssssssh.", ".skssssks.", ".ssssssss.", ".sssmmsss.", "..ssssss..", ".wwwttwww.", "wwwwttwwww", "wwwwttwwww"], { h: "#555555", s: SK, k: "#000", m: "#AA0000", w: "#FFFFFF", t: "#0000AA" }]
  };
  function sprite(cv, key) { const d = SPR[key], x = cv.getContext("2d"); x.clearRect(0, 0, 10, 10); d[0].forEach((r, y) => [...r].forEach((ch, i) => { if (d[1][ch]) { x.fillStyle = d[1][ch]; x.fillRect(i, y, 1, 1); } })); }

  let tt; function toast(t) { if (!t) return; const el = $("toast"); el.textContent = t; el.className = "toast on"; clearTimeout(tt); tt = setTimeout(() => el.className = "toast", Math.min(6000, 1600 + t.length * 90)); }
  /* 只有自己看得到的提示，记在消息框里，toast 没看清还能回头翻 */
  function note(t, tag) { if (t) feed("news", '<time>只有你</time><span class="tag t-g">' + (tag || "提示") + "</span>" + esc(t), true, true); }
  function feed(id, html, top, flash, o) {
    const b = $(id), p = document.createElement("p"); p.innerHTML = html;
    if (o) { if (o.i != null) p.dataset.i = o.i; if (o.hot) p.classList.add("hot"); }
    if (top) b.prepend(p); else { b.append(p); b.scrollTop = 1e6; }
    while (b.children.length > 80) (top ? b.lastChild : b.firstChild).remove();
    if (flash) { p.classList.add("new"); setTimeout(() => p.classList.remove("new"), 700); }
    const w = FEEDWIN[id]; if (w && !$(w).classList.contains("on")) { unread[w]++; badges(); }
  }
  const FEEDWIN = { news: "w0", bar2: "w1", chat: "w2" }, unread = { w0: 0, w1: 0, w2: 0 };
  function badges() { $("mtabs").querySelectorAll("button").forEach(b => { const n = unread[b.dataset.w]; b.querySelector("i").textContent = n ? (n > 99 ? "99+" : n) : ""; }); }
  /* 消息前面的【】做成小标签；带股票名的可以点，点了跳到那只股票 */
  const TAGC = { "监管": "r", "风险": "r", "黑天鹅": "r", "证实": "g", "辟谣": "m", "传闻": "m", "天文": "m", "重磅": "y", "突发": "r", "晨报": "y", "本局规则": "y", "桌上": "b", "股吧": "m", "黄历": "n", "收盘": "y", "龙虎榜": "y", "异动": "y", "盘面": "y" };
  function newsHtml(d) {
    let x = d.x, tag = ""; const m = /^【([^】]+)】/.exec(x);
    if (m) { x = x.slice(m[0].length); const isS = S.stocks.some(s => s.name === m[1]); tag = '<span class="tag t-' + (isS ? "s" : TAGC[m[1]] || "n") + '">' + esc(m[1]) + "</span>"; }
    return "<time>" + d.tm + "</time>" + (d.hot ? '<span class="tag t-y blink">重磅</span>' : "") + (d.early ? '<span class="tag t-g">早知道</span>' : "") + tag + esc(x);
  }

  /* ---------- 开局界面：10 个座位，抽签定角色 ---------- */
  const RET = ["big", "t0", "info", "dare", "lev", "pay"];
  let drawn = false, drawing = null;
  const shuf = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  /* 一桌的 10 个角色：国家队 1、潜伏机构 1、机构 1、游资 2、散户 5（6 种散户里随机出 5 种），打乱后发到 10 个座位上 */
  const deal = () => shuf(["gov", "spy", "org", "hot", "hot"].concat(shuf(RET.slice()).slice(0, 5)));
  const HOWMANY = { gov: "一桌 1 个", spy: "一桌 1 个", org: "一桌 1 个", hot: "一桌 2 个" };
  function buildBook() {
    $("roles").innerHTML = ["gov", "org", "spy", "hot", "big", "t0", "info", "dare", "lev", "pay"].map(k => { const r = G.ROLES[k]; return '<div class="rc"><canvas width="10" height="10" data-sp="' + r.sp + '"></canvas><b>' + r.name + "</b><u>" + (HOWMANY[k] || "散户 6 种里每局出 5 种") + "</u><i>本钱 " + M(r.money) + " 元" + (r.hold ? "，开局带持仓" : "") + "</i><span>" + r.skill + "</span><em>赢法：" + r.goal + "</em></div>"; }).join("");
    document.querySelectorAll("#roles canvas").forEach(c => sprite(c, c.dataset.sp));
  }
  function resetDraw() {
    clearInterval(drawing); drawing = null; drawn = false;
    $("seats").innerHTML = Array.from({ length: 10 }, (_, i) => '<div class="seat"><i>' + (i + 1) + " 号</i><b>?</b></div>").join("");
    ["mine", "optIn", "optHold", "bStart"].forEach(id => $(id).classList.add("hide"));
    $("bDraw").classList.remove("hide"); $("bDraw").disabled = false;
  }
  function setRole(k, seat) {
    role = k; drawn = true; const r = G.ROLES[k], els = $("seats").children;
    for (let i = 0; i < els.length; i++) els[i].classList.remove("hi");
    if (seat != null) { const el = els[seat]; el.classList.add("me"); el.innerHTML = "<i>" + (seat + 1) + ' 号 · 你</i><canvas width="10" height="10"></canvas>'; sprite(el.querySelector("canvas"), r.sp); }
    $("mine").innerHTML = '<canvas width="10" height="10"></canvas><div><small>你抽到的是</small><b>' + r.name + "</b><i>本钱 " + M(r.money) + " 元</i><span>" + r.skill + "</span><em>赢法：" + r.goal + "</em></div>";
    sprite($("mine").querySelector("canvas"), r.sp);
    $("mine").classList.remove("hide"); $("bDraw").classList.add("hide"); $("bStart").classList.remove("hide");
    $("optIn").classList.toggle("hide", !r.pick); $("optHold").classList.toggle("hide", !!r.pick); inTxt();
  }
  function draw() {
    if (drawn || drawing) return;
    const table = deal(), seat = (Math.random() * 10) | 0, els = $("seats").children;
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) { setRole(table[seat], seat); return; }
    $("bDraw").disabled = true;
    let n = 0, at = (seat + 10 - 17 % 10) % 10; const steps = 17;
    drawing = setInterval(() => {
      for (let i = 0; i < 10; i++) els[i].classList.toggle("hi", i === at); SFX.play("step");
      if (++n > steps) { clearInterval(drawing); drawing = null; setRole(table[seat], seat); SFX.play("reveal"); return; }
      at = (at + 1) % 10;
    }, 85);
  }
  function inTxt() { const r = G.ROLES[role], p = +$("inPct").value / 100; $("inTxt").textContent = Math.round(p * 100) + "%（场内 " + M(r.money * p) + " 元，场外 " + M(r.money * (1 - p)) + " 元）"; }

  function start() {
    if (!drawn) return;
    const seed = +Q.get("seed") || undefined;
    ["news", "bar2", "chat"].forEach(id => $(id).innerHTML = "");
    S = E.newGame({ role, inPct: +$("inPct").value / 100, seed });
    const a = S.me, r = G.ROLES[role];
    sprite($("me"), r.sp); $("rName").textContent = r.name; $("rSkill").textContent = r.skill;
    $("rMut").textContent = S.mut ? "本局规则：" + S.mut.n + "。" + S.mut.t : ""; if (S.mut && speed <= 6) setTimeout(() => banner("本局规则 · " + S.mut.n), 300);
    $("grpT").innerHTML = a.grp ? a.grp + " <small>只有同类看得到</small>" : "群聊 <small>国家队没有群</small>";
    $("chatForm").classList.toggle("hide", !a.grp);
    if (!a.grp) feed("chat", '<span class="none">国家队一个人扛，没有群。想说话就用“喊话”，会出现在消息框里。</span>');
    let sk = "";
    if (a.g === "机构") sk = '<button class="btn sm sk" data-k="essayUp"></button><button class="btn sm sk" data-k="essayDn"></button>';
    if (a.role === "gov") sk = '<button class="btn sm sk" data-k="shoutUp"></button><button class="btn sm sk" data-k="shoutDn"></button><button class="btn sm sk" data-k="inquiry"></button>';
    if (a.role === "big") sk = '<button class="btn sm sk" data-k="research"></button>';
    if (a.role === "pay") sk = '<button class="btn sm sk" data-k="advance"></button>';
    if (a.role === "hot") sk = '<button class="btn sm sk" data-k="rally"></button>';
    $("gSkill").innerHTML = sk; $("gBank").classList.toggle("hide", !r.pick);
    $("setup").classList.remove("on"); $("end").classList.remove("on");
    unread.w0 = unread.w1 = unread.w2 = 0; badges(); sumOn = false; lastPh = -1; lastPx = {}; buildTape();
    botKey = ""; cardSig = "-"; bossK = ""; bq.length = 0; hidePick(); showLife(null); $("qSay").textContent = ""; $("fxl").innerHTML = "";
    paused = false; $("bPause").textContent = "暂停"; sel = 4; setTimer(); render();
    feed("news", "<time>提示</time>开盘前有 20 秒，可以先看图、先挂单。", true);
  }
  function setTimer() {
    clearInterval(timer); const iv = Math.max(100, 500 / speed), n = Math.max(1, Math.round(speed * iv / 500));
    timer = setInterval(() => { if (!S || paused || S.over) return; for (let i = 0; i < n && !S.over; i++) E.tick(); render(); }, iv);
  }

  /* ---------- 每一步刷新 ---------- */
  function hud() {
    const ph = E.PH[S.ph], left = Math.ceil((ph.n - S.pt) / 2);
    $("days").innerHTML = ["一", "二", "三", "四", "五"].map((d, i) => '<i class="' + (i < S.day ? "done" : i === S.day ? "now" : "") + '">' + d + "</i>").join("");
    $("phase").textContent = S.over ? "已结束" : ph.t; $("clock").textContent = E.clock(); $("left").textContent = left + " 秒";
    $("tl").innerHTML = E.PH.map((p, i) => '<i style="flex:' + p.n + '" class="' + (S.over || i < S.ph ? "done" : i === S.ph ? "now" : "") + '">' + (i === S.ph && !S.over ? '<b style="width:' + Math.round(S.pt / p.n * 100) + '%"></b>' : "") + "<span>" + PHS[i] + "</span></i>").join("");
    spark($("spB"), S.big); spark($("spS"), S.small);
    if (S.ph !== lastPh) { if (lastPh >= 0 && speed <= 6 && !S.over) { banner(S.ph === 0 ? "第 " + (S.day + 1) + " 天 · 盘前" : ["", "开盘", "午休", "下午开盘", "收盘"][S.ph]); snd(S.ph === 1 || S.ph === 4 ? "bell" : "click"); } lastPh = S.ph; }
    if (pickOn === "bty" && ph.k !== "PRE") hidePick();
    if (pickOn === "guess" && !(ph.k === "NOON" || (ph.k === "PM" && S.pt < 12))) hidePick();
    /* 尾盘最后 10 秒：滴答声 */
    if (ph.k === "PM" && S.t >= 220 && S.t !== lastTk) { lastTk = S.t; if (S.t % 2 === 0) snd(S.t % 4 ? "tock" : "tick"); }
    $("tl").classList.toggle("tail", ph.k === "PM" && S.t >= 220 && !S.over);
    $("sumry").classList.toggle("on", sumOn && ph.k === "POST" && !S.over);
    [["ixB", S.big], ["ixS", S.small]].forEach(a => { const r = a[1].price / a[1].prev - 1, el = $(a[0]); el.textContent = f2(a[1].price) + (r >= 0 ? " ▲" : " ▼") + Math.abs(r * 100).toFixed(2) + "%"; el.className = "v " + cls(r); });
    const g = E.goal(S.me); $("rGoal").textContent = "目标 " + g.items.filter(x => x[1]).length + "/" + g.items.length + " 条达成";
  }
  const PHS = ["盘前", "上午", "午休", "下午", "盘后"];
  let hov = null;
  let lastPh = -1, sumOn = false, lastPx = {}, bt, lastTk = -1, pickOn = null, botKey = "", cardSig = "-", bossK = "";
  function banner(t) { const el = $("banner"); el.textContent = t; el.className = "banner"; void el.offsetWidth; el.className = "banner on"; clearTimeout(bt); bt = setTimeout(() => el.className = "banner", 1500); }
  /* 顶上两个指数旁边的小走势线 */
  function spark(cv, I) {
    const x = cv.getContext("2d"), w = cv.width, h = cv.height, intra = I.p.length > 1, a = intra ? I.p : I.days.slice(-30).map(d => d.c);
    x.clearRect(0, 0, w, h); if (a.length < 2) return;
    const lo = Math.min(I.prev, Math.min.apply(null, a)), hi = Math.max(I.prev, Math.max.apply(null, a)), sp = hi - lo || 1, Y = v => h - 4 - (v - lo) / sp * (h - 8), n = intra ? 240 : a.length;
    x.strokeStyle = "#444"; x.lineWidth = 1; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(0, Y(I.prev)); x.lineTo(w, Y(I.prev)); x.stroke(); x.setLineDash([]);
    x.strokeStyle = I.price >= I.prev ? "#FF3B3B" : "#00D060"; x.lineWidth = 3; x.beginPath(); a.forEach((v, i) => { const px = i / (n - 1) * w; if (i) x.lineTo(px, Y(v)); else x.moveTo(px, Y(v)); }); x.stroke();
  }
  /* 行情列表每一行里的迷你走势线 */
  function sline(I) {
    const a = I.p; if (a.length < 2) return '<svg class="sl" viewBox="0 0 46 18"></svg>';
    const n = a.length, st = Math.max(1, Math.floor(n / 24)), lo = Math.min(I.prev, Math.min.apply(null, a)), hi = Math.max(I.prev, Math.max.apply(null, a)), sp = hi - lo || 1; let pts = "";
    const pt = i => (i / 239 * 46).toFixed(1) + "," + (17 - (a[i] - lo) / sp * 16).toFixed(1) + " ";
    for (let i = 0; i < n - 1; i += st) pts += pt(i); pts += pt(n - 1);
    return '<svg class="sl ' + cls(I.price - I.prev) + '" viewBox="0 0 46 18"><polyline points="' + pts + '"/></svg>';
  }
  /* 顶上那条滚动的行情带 */
  function buildTape() { const h = [15, 16, 17, 18].concat(S.stocks.map(s => s.id)).map(i => '<span class="ti" data-i="' + i + '"><b>' + S.ins[i].name + '</b><i class="tp' + i + '"></i></span>').join(""); $("tapeIn").innerHTML = h + h; }
  function tape() { S.ins.forEach(I => { const r = I.price / I.prev - 1, t = f2(I.price) + (r >= 0 ? " ▲" : " ▼") + Math.abs(r * 100).toFixed(2) + "%", c = "tp" + I.id + " " + cls(r); document.querySelectorAll(".tp" + I.id).forEach(el => { if (el.textContent !== t) { el.textContent = t; el.className = c; } }); }); }
  function showSum(d) {
    const card = (k, v, c) => '<div class="c"><small>' + k + '</small><b class="' + c + '">' + v + "</b></div>", li = a => a.map(x => '<li data-i="' + x[2] + '"><span>' + x[0] + '</span><b class="' + cls(x[1]) + '">' + pc(x[1]) + "</b></li>").join("");
    $("sumry").innerHTML = '<button class="x" data-x="1">关掉</button><h3>第 ' + (d.day + 1) + " 天收盘</h3><div class=\"g\">" +
      card("大盘指数", pc(d.ir), cls(d.ir)) + card("小盘指数", pc(d.sr), cls(d.sr)) + card("你今天 · 只有你看得到", (d.my >= 0 ? "+" : "") + M(d.my) + " 元", cls(d.my)) + card("你的目标", d.goal + " 条达成", "") + card("量化盘今天", (d.qd >= 0 ? "赚 " : "亏 ") + M(Math.abs(d.qd)) + " 元", cls(d.qd)) + "</div>" +
      (d.bty || d.guess ? '<p class="rs">' + (d.bty ? "悬赏：" + (d.bty.ok ? '<b class="ok">完成</b>，得到 ' + d.bty.card + "卡" : "今天没成，明天还有") + "　" : "") + (d.guess ? "午休竞猜：" + (d.guess.ok ? '<b class="ok">猜对了</b>，得到 ' + d.guess.card + "卡" : "没猜中，不扣东西") : "") + "</p>" : "") + "<div class=\"g\">" +
      '<div class="c"><small>今天涨得最多</small><ul>' + li(d.top) + '</ul></div><div class="c"><small>今天跌得最多</small><ul>' + li(d.bot) + "</ul></div>" +
      '<div class="c"><small>涨停 ' + d.lu.length + " 只 · 跌停 " + d.ld.length + " 只 · 成交 " + M(d.amt) + ' 元</small><p>' + (d.lu.length ? '<span class="up">涨停：' + d.lu.join("、") + "</span><br>" : "") + (d.ld.length ? '<span class="down">跌停：' + d.ld.join("、") + "</span>" : "") + (!d.lu.length && !d.ld.length ? "今天没有涨停和跌停。" : "") + "</p></div></div><p>" + (d.last ? "这是最后一天，马上结算。" : "明天开盘前有 20 秒，可以先看图、先挂单。") + "</p>";
    sumOn = true;
    if (d.guess) { if (d.guess.ok) { snd("bounty"); note("午休竞猜猜对了，得到“" + d.guess.card + "”卡", "竞猜"); } else note("午休竞猜没猜中，不扣东西", "竞猜"); }
  }
  /* ---------- 好玩的部分 ---------- */
  /* 量化盘那一条：机器人脸、今天赚了亏了、散户怒气、举报按钮 */
  function vil() {
    const qd = E.qDay(), off = S.qOff > 0, idle = !off && E.qIdle(), me = S.me, full = S.rage >= 100 && !off, key = off || idle ? "botOff" : qd >= 0 ? "botUp" : "botDn";
    if (key !== botKey) { botKey = key; sprite($("bot"), key); }
    $("qd").textContent = off ? "被停了，还要 " + Math.ceil(S.qOff / 2) + " 秒" : idle ? "上午不许开机" : (qd >= 0 ? "赚 " : "亏 ") + M(Math.abs(qd)) + " 元"; $("qd").className = off || idle ? "off" : cls(qd);
    $("rage").style.width = (off ? 0 : Math.floor(S.rage)) + "%"; $("vil").classList.toggle("full", full); $("vil").classList.toggle("off", off);
    $("rageT").textContent = off ? "量化停了：现在下单几乎没有冲击成本" : full ? (me.g === "散户" ? "怒气满了，可以举报了" : "怒气满了，散户随时会举报") : "散户怒气 " + Math.floor(S.rage) + "%";
    $("bRep").classList.toggle("hide", me.g !== "散户"); $("bRep").disabled = !(full && E.isT());
  }
  /* 悬赏、竞猜、透视镜、内参：正在生效的东西都列在这一条里 */
  function fun() {
    const a = S.me, k = E.PH[S.ph].k, b = E.btyNow(), g = S.guess, x = E.xray(), h = [];
    if (b) h.push("<em>悬赏</em> " + esc(b.t) + ' <b class="' + (b.done ? "ok" : "") + '">（' + esc(b.pg) + "）</b> 奖：" + b.card + "卡");
    else if (S.bty && S.bty.d === S.day && k === "PRE") h.push('<em>悬赏</em> <a data-o="bty">今天的悬赏还没选，点这里选</a>');
    if (g && g.d === S.day && !g.res) {
      if (g.pick) h.push("<em>竞猜</em> 你猜下午收盘比 <b>" + f2(g.base) + "</b> " + (g.pick > 0 ? "高" : "低") + '，现在 <b class="' + cls(S.big.price - g.base) + '">' + f2(S.big.price) + "</b>");
      else if (k === "NOON" || (k === "PM" && S.pt < 12)) h.push('<em>竞猜</em> <a data-o="guess">午休竞猜还没猜，点这里</a>');
    }
    if (x) h.push('<em>透视镜</em> <a data-i="' + x.id + '">' + x.name + "</a> 今天谁在买卖（还剩 " + x.left + " 秒）：" + x.rows.map(r => r[0] + ' <b class="' + cls(r[1]) + '">' + (r[1] > 0 ? "买 " + M(r[1]) : r[1] < 0 ? "卖 " + M(-r[1]) : "没动") + "</b>").join(" · "));
    if (a.tipN > 0) h.push("<em>内参</em> 接下来 <b>" + a.tipN + "</b> 条消息你会早 3 秒看到");
    if (a.fast > 0) h.push("<em>极速通道</em> 还剩 <b>" + Math.ceil(a.fast / 2) + "</b> 秒：下单几乎没有冲击成本，免手续费");
    const t = h.join("<br>"); if ($("fun").innerHTML !== t) $("fun").innerHTML = t;
  }
  function cards() {
    const c = S.me.cards, ks = ["tip", "undo", "xray"].filter(k => c[k] > 0), sig = ks.map(k => k + c[k]).join(); if (sig === cardSig) return; cardSig = sig;
    $("gCards").innerHTML = ks.length ? '<span class="lb2">道具卡</span>' + ks.map(k => '<button class="btn sm cd" data-c="' + k + '">' + E.CARD[k] + " ×" + c[k] + "</button>").join("") + '<span class="lb2 ct">' + ks.map(k => E.CARD[k] + "：" + E.CARDT[k]).join("；") + "</span>" : "";
  }
  function hidePick() { pickOn = null; $("pick").classList.remove("on"); }
  function showPick() {
    const b = S.bty; if (!b || b.pick >= 0) return;
    $("pick").innerHTML = '<button class="x" data-x="1">先看图</button><h3>今日悬赏 · 三选一</h3><p>挑一个今天顺手做的。做成了给一张道具卡，没做成也不扣东西。不选的话开盘时自动接第一个。</p><div class="opts">' +
      b.opts.map((o, i) => '<button class="opt2" data-b="' + i + '"><b>' + esc(o.t) + "</b><i>奖：" + o.card + "卡</i><small>" + E.CARDT[o.ck] + "</small></button>").join("") + "</div>";
    pickOn = "bty"; $("pick").classList.add("on");
  }
  function showGuess() {
    const g = S.guess; if (!g || g.pick) return;
    $("pick").innerHTML = '<button class="x" data-x="1">不猜了</button><h3>午休竞猜</h3><p>下午 3 点收盘时，大盘指数比现在（<b>' + f2(g.base) + '</b>）高还是低？猜对给一张道具卡，猜错不扣东西。</p><div class="opts two">' +
      '<button class="opt2 gu" data-g="1"><b>高</b><i>这一桌另外 9 个人里，' + g.up + ' 个猜高</i></button><button class="opt2 gd" data-g="-1"><b>低</b><i>' + g.dn + " 个猜低</i></button></div><p>别人的票有一点参考价值，但也经常猜错。</p>";
    pickOn = "guess"; $("pick").classList.add("on"); snd("guess");
  }
  function showLife(d) {
    const el = $("life"); if (!d) { el.className = "life"; return; }
    el.innerHTML = '<small>突发小事 · 8 秒内选一个，不选就当没发生</small><div class="lt">' + esc(d.t) + '</div><div class="grp">' + d.a.map((x, i) => '<button class="btn sm' + (i ? "" : " on") + '" data-l="' + i + '">' + esc(x) + "</button>").join("") + '</div><div class="lbar"><i style="animation-duration:' + (d.left / 2 / speed).toFixed(2) + 's"></i></div>';
    el.className = "life on"; snd("life");
  }
  /* 腾不出手的时候盖在图表上的那一层（老板来了就是一张假表格） */
  const LOCKT = { boss: ["2026 年四季度工作计划.xls", ""], meet: ["会议室 B · 季度总结会", "你在开会，手机扣在桌上。"], ad: ["广告", "三天学会稳赚不赔，名额只剩最后 3 个……"], chg: ["找充电器", "充电器呢……"], off: ["手机关机了", "正在开机。"], call: ["通话中", "电话还没讲完。"], read: ["看报告", "正在一页一页翻。"], food: ["下楼拿外卖", "电梯好慢……"] };
  const FAKE = [["项目", "负责人", "进度", "备注"], ["年度总结", "我", "12%", "明天一定"], ["客户回访", "我", "0%", "等对方回电话"], ["报销单", "我", "80%", "差一张发票"], ["周报", "我", "100%", "复制上周的"], ["团建方案", "我", "5%", "先放着"]];
  function boss() {
    const a = S.me, on = a.lock > 0 && !S.over; $("boss").classList.toggle("on", on); document.querySelector(".trade").classList.toggle("locked", on); if (!on) { bossK = ""; return; }
    const k = LOCKT[a.lockK] ? a.lockK : "call";
    if (bossK !== k) { bossK = k; const T = LOCKT[k]; $("boss").className = "boss on k-" + k; $("boss").innerHTML = '<div class="bt">' + T[0] + "</div>" + (k === "boss" ? "<table>" + FAKE.map((r, i) => "<tr>" + r.map(c => (i ? "<td>" : "<th>") + c + (i ? "</td>" : "</th>")).join("") + "</tr>").join("") + "</table>" : '<div class="bm">' + T[1] + "</div>") + '<div class="bn">' + (k === "boss" ? "装忙中，" : "") + '还要 <b id="bossN"></b> 秒才能下单</div>'; }
    $("bossN").textContent = Math.ceil(a.lock / 2);
  }
  const bq = []; let bOn = false;
  function showBadge() {
    if (bOn || !bq.length) return; bOn = true; const B = G.BADGES[bq.shift()];
    $("bdg").innerHTML = "<i></i><div><small>拿到徽章 · 只有你看得到</small><b>" + B[0] + "</b><span>" + B[1] + "</span></div>"; $("bdg").className = "bdg on"; snd("badge");
    setTimeout(() => { $("bdg").className = "bdg"; bOn = false; setTimeout(showBadge, 250); }, speed > 2 ? 500 : 2800);
  }
  /* 卖出赚了亏了，账户上方飘一个数字 */
  let popAcc = 0, popT = null;
  function pop(v) {
    popAcc += v; if (popT) return;
    popT = setTimeout(() => {
      popT = null; const x = popAcc; popAcc = 0; if (Math.abs(x) < 1 || speed > 2) return;
      const el = document.createElement("div"), r = $("sum").getBoundingClientRect(); el.className = "pop " + cls(x); el.textContent = (x > 0 ? "+" : "") + M(x) + " 元";
      el.style.left = Math.round(r.left + 12) + "px"; el.style.top = Math.round(Math.max(10, r.top - 6)) + "px"; $("pops").append(el); setTimeout(() => el.remove(), 1700);
      snd(x > 0 ? "coin" : "sell", 900);
    }, 450);
  }
  function confetti(cols, big) {
    if ((speed > 2 && !big) || reduce) return; const L = $(big ? "pops" : "fxl");
    for (let i = 0; i < 30; i++) { const d = document.createElement("i"); d.style.cssText = "left:" + (Math.random() * 100).toFixed(1) + "%;background:" + cols[i % cols.length] + ";animation-delay:" + (Math.random() * .35).toFixed(2) + "s;animation-duration:" + (.9 + Math.random() * .8).toFixed(2) + "s"; L.append(d); setTimeout(() => d.remove(), 2400); }
  }
  function shake() { if (reduce) return; const c = document.querySelector(".chart"); c.classList.remove("shake"); void c.offsetWidth; c.classList.add("shake"); }
  function fx(d) {
    const nm = d.id != null ? S.ins[d.id].name : "";
    if (d.k === "lu") { if (speed <= 6) banner("你的 " + nm + " 涨停了"); snd("lu"); confetti(["#FF3B3B", "#FFFF55", "#FF5555"]); note("你手里的 " + nm + " 封上了涨停。", "涨停"); }
    else if (d.k === "boom") { toast("你手里的 " + nm + " 涨停板被砸开了"); snd("boom"); shake(); }
    else if (d.k === "ld") { toast("你手里的 " + nm + " 跌停了，现在卖单只能排队"); snd("ld"); }
    else if (d.k === "goal") { if (d.r === S.me.role) { toast("目标进度 +1"); snd("goal"); } }
    else if (d.k === "pl") pop(d.v);
    else if (d.k === "report") { if (speed <= 6) banner("量化被停了"); snd("report"); confetti(["#55FF55", "#FFFF55", "#55FFFF"]); }
    else if (d.k === "tail") { if (speed <= 6) banner("尾盘 · 最后 10 秒"); }
    else if (d.k === "streak") { toast("连赚 " + d.n + " 笔，手感来了"); }
  }
  const GROUPS = [["指数", [15, 16]], ["期货", [17, 18]], ["大盘股", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]], ["微小盘股", [10, 11, 12, 13, 14]]];
  function list() {
    $("list").innerHTML = GROUPS.map(g => "<h3>" + g[0] + "</h3>" + g[1].map(i => {
      const I = S.ins[i], r = I.price / I.prev - 1, c = cls(r), was = lastPx[i], fl = was != null && Math.abs(I.price / was - 1) >= .004 ? (I.price > was ? " fu" : " fd") : ""; lastPx[i] = I.price;
      const t = I.lu ? '<b class="lu">涨停</b>' : I.ld ? '<b class="ld">跌停</b>' : I.kind === "stock" ? I.tag : I.kind === "fut" ? "可买涨买跌" : "不能直接买";
      return '<button class="row' + (i === sel ? " sel" : "") + fl + (I.lu ? " lu" : I.ld ? " ld" : "") + '" data-i="' + i + '"><span class="n">' + I.name + "</span>" + sline(I) + '<span class="p ' + c + '">' + f2(I.price) + '</span><span class="t">' + t + '</span><span class="c ' + c + '">' + pc(r) + "</span></button>";
    }).join("")).join("");
  }
  function head() {
    const I = S.ins[sel], r = I.price / I.prev - 1, c = cls(r);
    $("nm").textContent = I.name;
    $("tg").textContent = I.kind === "stock" ? I.code + " · " + I.tag + " · " + I.type + " · 涨跌停 " + Math.round(I.lim * 100) + "%" : I.kind === "fut" ? "股指期货 · 每点 " + I.mult + " 元 · 当天可平仓" : "指数";
    $("px").textContent = f2(I.price); $("px").className = "px " + c; $("pc").textContent = pc(r); $("pc").className = "pc " + c;
    const n = I.p.length, o = n ? I.p[0] : null, hi = n ? Math.max.apply(null, I.p) : null, lo = n ? Math.min.apply(null, I.p) : null, v = k => k == null ? "--" : f2(k);
    let s = "昨收 <b>" + f2(I.prev) + "</b>今开 <b>" + v(o) + "</b>最高 <b>" + v(hi) + "</b>最低 <b>" + v(lo) + "</b>";
    if (I.kind === "stock") s += '涨停 <b class="up">' + f2(I.up) + '</b>跌停 <b class="down">' + f2(I.dn) + "</b>成交额 <b>" + M(I.cumA || 0) + "</b>";
    $("st").innerHTML = s;
  }
  function f10() {
    const I = S.ins[sel]; let h = "";
    if (I.kind === "stock") {
      const cap = I.price * I.shares * 1e8, np = I.eps * I.shares, row = (a, b, c, d) => "<tr><td>" + a + "</td><td>" + b + "</td><td>" + c + "</td><td>" + d + "</td></tr>";
      const g = x => x == null ? "--" : '<span class="' + cls(x) + '">' + (x >= 0 ? "+" : "") + x + "%</span>";
      h = "<p>" + I.biz + "</p><table>" +
        row("总市值", M(cap) + " 元", "流通市值", M(I.floatCap / I.ref * I.price) + " 元") +
        row("市盈率", I.eps > 0 ? f2(I.price / I.eps) + " 倍" : "亏损", "市净率", f2(I.price / I.bvps) + " 倍") +
        row("每股收益", f2(I.eps) + " 元", "每股净资产", f2(I.bvps) + " 元") +
        row("营业收入", I.rev + " 亿 " + g(I.revG), "净利润", f2(np) + " 亿 " + g(I.npG)) +
        row("毛利率", I.gross == null ? "不适用" : I.gross + "%", "净资产收益率", (I.eps / I.bvps * 100).toFixed(1) + "%") +
        row("资产负债率", I.debt + "%", "股息率", I.div ? (I.div * I.ref / I.price).toFixed(2) + "%" : "不分红") +
        row("总股本", I.shares + " 亿股", "流通比例", Math.round(I.floatR * 100) + "%") +
        row("涨跌停幅度", Math.round(I.lim * 100) + "%", "买一手要", M(I.price * 100) + " 元") +
        row("连续涨停", (I.luStreak || 0) + " 天", "指数权重", I.big ? Math.round(I.w * 100) + "%（大盘指数）" : "20%（小盘指数）") + "</table>";
    } else if (I.kind === "idx") {
      h = "<p>" + (I.id === 15 ? "大盘指数由 10 只大盘股按权重算出来，开局在 3000 点附近。" : "小盘指数由 5 只微小盘股平均算出来。") + "指数不能直接买卖，想押它涨跌要去买对应的期货。</p><table>" +
        I.m.map((id, j) => { const s = S.ins[id], r = s.price / s.prev - 1; return "<tr><td>" + s.name + "</td><td>权重 " + Math.round(I.w[j] * 100) + '%</td><td>今日</td><td><span class="' + cls(r) + '">' + pc(r) + "</span></td></tr>"; }).join("") + "</table>";
    } else {
      const per = I.price * I.mult * I.mr * (S.me.lev ? .5 : 1);
      h = "<p>" + I.name + "跟着" + I.u.name + "走。买涨：指数涨你赚钱；买跌：指数跌你赚钱。当天就能平仓。</p><table>" +
        "<tr><td>对应指数</td><td>" + I.u.name + " " + f2(I.u.price) + "</td><td>期货比指数</td><td>" + (I.price >= I.u.price ? "高 " : "低 ") + f2(Math.abs(I.price - I.u.price)) + " 点</td></tr>" +
        "<tr><td>每点价值</td><td>" + I.mult + " 元</td><td>一手合约价值</td><td>" + M(I.price * I.mult) + " 元</td></tr>" +
        "<tr><td>保证金比例</td><td>" + Math.round(I.mr * (S.me.lev ? .5 : 1) * 100) + "%</td><td>一手保证金</td><td>" + M(per) + " 元</td></tr>" +
        "<tr><td>涨跌 1%</td><td>一手盈亏 " + M(I.price * I.mult * .01) + " 元</td><td>强制平仓</td><td>亏到保证金不够时</td></tr></table>";
    }
    $("f10").innerHTML = h;
  }
  function chart() {
    const I = S.ins[sel]; $("f10").classList.toggle("on", mode === "F");
    if (mode === "F") f10(); else if (mode === "T") C.T($("cv"), I, hov); else C.K($("cv"), I, S.closed, hov);
  }
  function book() {
    const I = S.ins[sel]; let h = "";
    const pr = p => '<span class="' + cls(p - I.prev) + '">' + f2(p) + "</span>";
    if (bkTab === "book") {
      if (I.kind === "idx") h = '<div class="br note">指数没有买卖盘口。看“明细”可以看它每分钟的点位。</div>';
      else {
        const b = E.book(I), nm = ["一", "二", "三", "四", "五"];
        for (let i = 4; i >= 0; i--) h += '<div class="br"><span class="lb">卖' + nm[i] + "</span>" + (b.ask[i] ? pr(b.ask[i][0]) + '<span class="vol">' + vol(b.ask[i][1]) + "</span>" : "<span>--</span><span>--</span>") + "</div>";
        h += '<div class="br mid"><span class="lb">现价</span>' + pr(I.price) + "</div>";
        for (let i = 0; i < 5; i++) h += '<div class="br"><span class="lb">买' + nm[i] + "</span>" + (b.bid[i] ? pr(b.bid[i][0]) + '<span class="vol">' + vol(b.bid[i][1]) + "</span>" : "<span>--</span><span>--</span>") + "</div>";
        if (I.lu) h += '<div class="br note">涨停中：没人卖，买单在排队。封单约 ' + M(I.seal) + " 元。</div>";
        else if (I.ld) h += '<div class="br note">跌停中：没人买，卖单在排队。封单约 ' + M(I.seal) + " 元。</div>";
        else h += '<div class="br note">数量单位：' + (I.kind === "fut" ? "手（合约）" : "手（1 手 = 100 股）") + "</div>";
      }
    } else if (bkTab === "tr") {
      h = I.tr.length ? I.tr.slice().reverse().map(t => '<div class="br"><span class="lb">' + t[0] + "</span>" + pr(t[1]) + '<span class="' + (t[3] > 0 ? "up" : "down") + '">' + (I.kind === "idx" ? t[2] + "亿" : vol(t[2])) + "</span></div>").join("") : '<div class="br note">还没开盘，没有成交。</div>';
    } else {
      const ks = Object.keys(I.dist).sort((a, b) => b - a);
      if (!ks.length) h = '<div class="br note">' + (I.kind === "idx" ? "指数没有分价表。" : "还没开盘。分价表会显示今天每个价位成交了多少。") + "</div>";
      else { const mx = Math.max.apply(null, ks.map(k => I.dist[k])), near = ks.reduce((a, k) => Math.abs(k - I.price) < Math.abs(a - I.price) ? k : a, ks[0]); h = ks.map(k => '<div class="dr' + (k === near ? " now" : "") + '"><i style="width:' + Math.round(I.dist[k] / mx * 100) + '%"></i>' + pr(+k) + "<span>" + vol(I.dist[k]) + "</span></div>").join(""); }
    }
    $("bk").innerHTML = h;
  }
  function order() {
    const I = S.ins[sel], a = S.me, k = I.kind, T = E.isT(); let h = "";
    $("gStock").classList.toggle("hide", k !== "stock"); $("gFut").classList.toggle("hide", k !== "fut");
    if (k === "stock") {
      const p = a.pos[sel], can = Math.floor(Math.max(0, E.avail(a)) / (I.price * 1.001) / 100);
      const cs = p ? (a.t0 ? p.q : p.av) : 0, nb = Math.floor(can * frac), ns = frac >= 1 ? cs : Math.floor(cs * frac / 100) * 100;
      h = "按“" + (frac >= 1 ? "全部" : frac === .5 ? "一半" : "1/4") + "”下单：买 <b>" + nb + "</b> 手，约 <b>" + M(nb * 100 * I.price) + "</b> 元；卖 <b>" + ns + "</b> 股<br>一手 <b>" + M(I.price * 100) + "</b> 元 · 最多可买 <b>" + can + "</b> 手 · 持有 <b>" + (p ? p.q : 0) + "</b> 股（可卖 <b>" + cs + "</b>）";
      if (a.st.ban[sel]) h += "<br><em>今天你被监管限制买入这只股票，明天解除。</em>";
      if (S.qOff > 0 || a.fast > 0) h += "<br><em>" + (a.fast > 0 ? "极速通道开着" : "量化被停了") + "：现在下单几乎没有冲击成本。</em>";
      if (I.lu) h += "<br><em>涨停中：" + (a.dare ? "别人买不进，你能买进。" : "买单只能排队，现在买不进。") + "</em>";
      else if (I.ld) h += "<br><em>跌停中：卖单只能排队，现在卖不出。</em>";
      else if (I.halt > 0) h += "<br><em>被问询中：量化和游资暂时不能动它。</em>";
      else if (!T && !S.over) h += "<br><em>现在不是交易时间，下的单开盘后成交。</em>";
    } else if (k === "fut") {
      const c = a.fut[sel], per = I.price * I.mult * I.mr * (a.lev ? .5 : 1), pl = c ? (I.price - c.entry) * c.q * I.mult : 0;
      h = "一手保证金 <b>" + M(per) + "</b> 元 · 最多可开 <b>" + E.futMax(I) + "</b> 手<br>持仓 <b>" + (c ? (c.q > 0 ? "买涨 " : "买跌 ") + Math.abs(c.q) + " 手" : "无") + "</b>" + (c ? ' · 浮动盈亏 <b class="' + cls(pl) + '">' + M(pl) + "</b> 元" : "");
      if (!T && !S.over) h += "<br><em>期货只能在交易时间买卖。</em>";
    } else h = "指数不能直接买卖。想押大盘涨跌，在左边点“大盘期货”或“小盘期货”。";
    $("oInfo").innerHTML = h;
    const lab = { essayUp: "小作文：吹它（剩 " + a.essays + "）", essayDn: "小作文：黑它（剩 " + a.essays + "）", shoutUp: "喊话：提振（剩 " + a.shouts + "）", shoutDn: "喊话：降温（剩 " + a.shouts + "）", inquiry: "问询函（剩 " + a.inq + "）", research: "调研这只股票（剩 " + a.res + "）", advance: "预支 2 万工资（剩 " + a.adv + "）", rally: "喊兄弟一起买它（剩 " + a.rally + "）" };
    document.querySelectorAll("#gSkill .btn").forEach(b => b.textContent = lab[b.dataset.k]);
    if (G.ROLES[a.role].pick) $("bankInfo").innerHTML = "场外 <b>" + M(a.bank) + "</b> 元（每次转四分之一）";
  }
  /* 每个角色自己的“外挂”提示条：告诉玩家现在这个外挂能干什么、做到哪了 */
  function perk() {
    const a = S.me, st = a.st, e = E.eq(a), lk = s => '<a data-i="' + s.id + '">' + s.name + "</a>", ir = S.big.price / S.big.prev - 1; let h = "";
    switch (a.role) {
      case "big": h = "你的钱是普通散户的 40 倍，还请得起人去公司调研：能知道一只股票现在是贵了还是便宜了。大单要分几次才成交。最大回撤 <b>" + (st.dd * 100).toFixed(2) + "%</b>（红线 10%）"; break;
      case "t0": h = "今天买的今天就能卖，别人要等明天。已做成 <b>" + st.t0 + "/5</b> 次（每次要赚 0.5% 以上才算）。" + (() => { const rd = E.radar(); return S.qOff > 0 ? "雷达：量化被停了。" : rd.length ? "雷达：追涨的量化现在手里拿着 " + rd.map(lk).join("、") + "。" : "雷达：追涨的量化现在空着手。"; })(); break;
      case "info": h = "带【早知道】的消息，你比别人早 3 秒看到，这时价格还没动。股吧里的小作文，你能直接看到（真）还是（假）。"; break;
      case "dare": { const lu = S.stocks.filter(s => s.lu); h = (lu.length ? "现在涨停、只有你买得进的：" + lu.map(lk).join("、") + "。" : "现在没有涨停的股票。等哪只封了板，别人买不进，你能买进。") + "已做成 <b>" + st.dare + "/2</b> 次"; break; }
      case "lev": { const m = E.fmar(a), room = a.cash + E.fpnl(a) - m * .5; h = "期货保证金减半，同样的钱能开两倍的仓，亏起来也是两倍。" + (m > 0 ? "保证金占用 <b>" + M(m) + "</b> 元，再亏 <b>" + M(Math.max(0, room)) + "</b> 元会被强制平仓。" : "") + "赚钱平仓 <b>" + st.fw + "/3</b> 次"; break; }
      case "pay": h = "每天开盘到账 2 万元工资，直接进场内可用；急用可以预支，之后有一天不发。现在股票占总资产 <b>" + (e ? E.val(a) / e * 100 : 0).toFixed(0) + "%</b>（目标 50% 以上）"; break;
      case "hot": {
        const mine = S.stocks.filter(s => (st.buy[s.id] || 0) > 0).sort((x, y) => st.buy[y.id] / y.floatCap - st.buy[x.id] / x.floatCap).slice(0, 3);
        h = mine.length ? "你点过火的：" + mine.map(s => lk(s) + " 买了流通盘的 <b>" + (st.buy[s.id] / s.floatCap * 100).toFixed(1) + "%</b>，连板 <b>" + (s.luStreak || 0) + "</b> 天" + (s.lu ? "（封着）" : "")).join("；") + "。要买到 2% 以上才算你做的。一天买超过 4% 监管会来电话，超过 8% 当天不许再买。" + (st.warns ? "已被限制 <b>" + st.warns + "</b> 次。" : "") : "挑一只微小盘股，买到涨停并封住，连着两天收盘涨停。你买的量要占流通盘 2% 以上才算你做的。一个人钱不够，可以喊另一个游资一起买。";
        break;
      }
      case "org": case "spy": { const my = e / a.eqPrev - 1; h = "今天你 <b class=\"" + cls(my) + "\">" + pc(my) + "</b>，大盘 <b class=\"" + cls(ir) + "\">" + pc(ir) + "</b>。收盘时跑赢大盘，客户加钱；跑输，客户把钱抽走。" + (a.role === "spy" ? "你潜伏在散户群里，他们说的话你都看得到；午休时还能看到游资群上午的聊天。" : ""); break; }
      case "gov": { const warn = S.stocks.filter(s => s.ldStreak >= 1 || s.ld); h = "大盘今天 <b class=\"" + cls(ir) + "\">" + pc(ir) + "</b>（收盘红线 ±2%）。现金还剩开局的 <b>" + (a.cash / a.cash0 * 100).toFixed(0) + "%</b>（红线 50%）。" + (warn.length ? "要盯的跌停股：" + warn.map(lk).join("、") + "。" : ""); break; }
    }
    $("perk").innerHTML = h ? "<em>外挂</em> " + h : "";
  }
  function acct() {
    const a = S.me, e = E.eq(a), d = e - a.eqPrev, t = e - a.init;
    const cell = (k, v, c) => "<span><i>" + k + '</i><b class="' + (c || "") + '">' + v + "</b></span>";
    $("sum").innerHTML = cell("总资产", M(e)) + cell("今日", (d >= 0 ? "+" : "") + M(d), cls(d)) + cell("累计", (t >= 0 ? "+" : "") + M(t), cls(t)) + cell("收益率", pc(t / a.init), cls(t)) + cell("场内可用", M(E.avail(a))) + (G.ROLES[a.role].pick ? cell("场外", M(a.bank)) : "");
    let h = "";
    if (aTab === "pos") {
      const rows = [];
      Object.keys(a.pos).forEach(id => { const p = a.pos[id], s = S.ins[id], pl = (s.price - p.cost) * p.q; rows.push('<tr data-i="' + id + '"><td>' + s.name + "</td><td>" + p.q + "</td><td>" + (a.t0 ? p.q : p.av) + "</td><td>" + f2(p.cost) + "</td><td>" + f2(s.price) + '</td><td class="' + cls(pl) + '">' + M(pl) + "</td></tr>"); });
      Object.keys(a.fut).forEach(id => { const c = a.fut[id], f = S.ins[id], pl = (f.price - c.entry) * c.q * f.mult; rows.push('<tr data-i="' + id + '"><td>' + f.name + "</td><td>" + (c.q > 0 ? "买涨 " : "买跌 ") + Math.abs(c.q) + " 手</td><td>随时</td><td>" + f2(c.entry) + "</td><td>" + f2(f.price) + '</td><td class="' + cls(pl) + '">' + M(pl) + "</td></tr>"); });
      h = rows.length ? "<table><tr><th>名称</th><th>持有</th><th>可卖</th><th>成本</th><th>现价</th><th>盈亏</th></tr>" + rows.join("") + "</table>" : '<div class="empty">现在是空仓。在左边选一只股票，点“买入”。</div>';
    } else if (aTab === "ord") {
      h = a.orders.length ? "<table><tr><th>名称</th><th>方向</th><th>还剩</th><th>总数</th><th></th></tr>" + a.orders.map(o => "<tr><td>" + S.ins[o.id].name + '</td><td class="' + (o.side > 0 ? "up" : "down") + '">' + (o.side > 0 ? "买入" : "卖出") + "</td><td>" + o.rem + "</td><td>" + o.tot + '</td><td><button class="x" data-c="' + o.oid + '">撤单</button></td></tr>').join("") + "</table>" : '<div class="empty">没有还在排队的单子。小单一般马上成交，大单会分几次成交。</div>';
    } else h = "<ul>" + E.goal(a).items.map(x => '<li class="' + (x[1] ? "ok" : "") + '"><b>' + (x[1] ? "✓" : "□") + "</b>" + x[0] + "</li>").join("") + "</ul>";
    $("acctBody").innerHTML = h;
  }
  function render() { if (!S) return; hud(); vil(); list(); head(); chart(); book(); order(); perk(); fun(); cards(); boss(); acct(); tape(); }

  /* ---------- 结算 ---------- */
  function showEnd(r) {
    const a = S.me;
    $("endSub").textContent = "你这局扮演的是：" + G.ROLES[a.role].name;
    $("res").innerHTML =
      '<section class="win c-lime"><h2>你的目标</h2><div class="verdict ' + (r.goal.ok ? "up" : "flat") + '">' + (r.goal.ok ? "目标达成" : "这局没达成") + "</div><ul>" + r.goal.items.map(x => '<li class="' + (x[1] ? "ok" : "") + '"><b>' + (x[1] ? "✓" : "×") + "</b>" + x[0] + "</li>").join("") + "</ul></section>" +
      '<section class="win c-yel"><h2>你的盈亏 <small>只有你看得到</small></h2><div class="num ' + cls(r.pnl) + '">' + (r.pnl >= 0 ? "+" : "") + M(r.pnl) + " 元</div><div>" + pc(r.pct) + "　大盘这 5 天 " + pc(S.big.price / 3000 - 1) + "</div></section>" +
      '<section class="win c-mag"><h2>量化盘的盈亏</h2><table>' + r.quants.map(q => "<tr><td>" + q.name + "</td><td>" + q.typ + '</td><td class="' + cls(q.pnl) + '">' + (q.pnl >= 0 ? "+" : "") + M(q.pnl) + "</td></tr>").join("") + (() => { const t = r.quants.reduce((x, q) => x + q.pnl, 0); return '<tr class="you"><td>合计</td><td>' + (t >= 0 ? "这局机器赢了" : "这局机器输了") + '</td><td class="' + cls(t) + '">' + (t >= 0 ? "+" : "") + M(t) + "</td></tr>"; })() + "</table></section>" +
      '<section class="win c-yel"><h2>这局的行情剧本 <small>开局时没人知道</small></h2><div class="verdict">' + r.script.k + "</div><div>" + r.script.say + (r.mut ? "<br>本局特别规则：" + r.mut.n + "。" + r.mut.t : "") + "</div></section>" +
      '<section class="win c-lime"><h2>你拿到的徽章 <small>只有你看得到</small></h2>' + (r.badges.length ? '<div class="bds">' + r.badges.map(k => "<span><b>" + G.BADGES[k][0] + "</b>" + G.BADGES[k][1] + "</span>").join("") + "</div>" : "<div>这局没拿到徽章。徽章只记做得漂亮的事，比如卖在最高点、亲手举报量化。</div>") + '<div class="st2">悬赏完成 ' + r.stat.bty + " 次 · 竞猜猜对 " + r.stat.gz + " 次 · 亲手举报量化 " + r.stat.rep + " 次</div></section>" +
      '<section class="win c-gray"><h2>这 5 天 <small>你和大盘每天的涨跌</small></h2><table><tr><td>第几天</td><td>大盘</td><td>小盘</td><td>你</td></tr>' + (S.hist || []).map(d => "<tr><td>第 " + (d.day + 1) + ' 天</td><td class="' + cls(d.ir) + '">' + pc(d.ir) + '</td><td class="' + cls(d.sr) + '">' + pc(d.sr) + '</td><td class="' + cls(d.myPct) + '">' + pc(d.myPct) + "</td></tr>").join("") + "</table></section>" +
      '<section class="win c-blue"><h2>这一桌谁是谁 <small>只亮身份，不亮盈亏</small></h2><table>' + S.agents.filter(x => !x.quant).map(x => { const ok = x === a ? r.goal.ok : E.goal(x).ok; return '<tr class="' + (x === a ? "you" : "") + '"><td>' + esc(x.name) + "</td><td>" + G.ROLES[x.role].name + '</td><td class="' + (ok ? "ok" : "") + '">' + (ok ? "达成目标" : "") + "</td></tr>"; }).join("") + "</table></section>";
    $("end").classList.add("on"); hidePick(); showLife(null); if (r.goal.ok) { SFX.play("goal"); confetti(["#55FF55", "#FFFF55", "#FF5555", "#55FFFF"], true); }
  }

  /* ---------- 引擎发来的事 ---------- */
  E.on((t, d) => {
    if (!S) return;
    if (t === "news") { feed("news", newsHtml(d), true, true, { i: d.id, hot: d.hot }); if (d.hot) { snd("hot"); if (!reduce && speed <= 2) { document.body.classList.add("alarm"); setTimeout(() => document.body.classList.remove("alarm"), 700); } } else snd("news", 600); }
    else if (t === "close") showSum(d);
    else if (t === "bar" && d.q) { feed("bar2", '<span class="tag t-r">量化盘</span><span class="who">' + esc(d.who) + "</span>" + esc(d.x)); $("qSay").textContent = d.who + "：“" + d.x + "”"; }
    else if (t === "bar") feed("bar2", '<span class="who' + (d.zw ? " zw" : "") + '">' + esc(d.who) + "</span>" + esc(d.x) + (d.zw && S.me.role === "info" ? (d.truth ? ' <span class="up">（真）</span>' : ' <span class="down">（假）</span>') : ""));
    else if (t === "chat") { if (d.grp === S.me.grp) feed("chat", '<span class="who">' + esc(d.who) + "</span>" + esc(d.x)); else if (S.me.role === "spy" && d.grp === "散户群") feed("chat", '<span class="tag t-m">潜伏·散户群</span><span class="who">' + esc(d.who) + "</span>" + esc(d.x)); }
    else if (t === "peek") { feed("chat", '<span class="who zw">【午休偷看：游资群上午的聊天】</span>' + (d.length ? "" : "他们上午没说话。")); d.forEach(m => feed("chat", '<span class="who zw">' + esc(m.who) + "</span>" + esc(m.x))); toast("午休了，偷看到游资群上午的聊天"); }
    else if (t === "toast") toast(d);
    else if (t === "fill") { toast((d.side > 0 ? "买入 " : "卖出 ") + d.name + " " + d.sh + " 股，成交价 " + f2(d.px)); if (d.side > 0) snd("buy", 1200); else pop(d.pl); }
    else if (t === "bty") { if (d.pick < 0) showPick(); else hidePick(); }
    else if (t === "guess") showGuess();
    else if (t === "bounty") { if (d.ok) { const c = (d.n > 1 ? "两张" : "") + "“" + d.card + "”卡"; toast("悬赏完成！得到" + c); snd("bounty"); note("悬赏完成：" + d.t + "。得到" + c + "，在下单框里用。", "悬赏"); } else note("今天的悬赏没成：" + d.t + "。明天还有。", "悬赏"); }
    else if (t === "life") showLife(d);
    else if (t === "lock") snd("lock");
    else if (t === "badge") { bq.push(d); showBadge(); note("拿到徽章“" + G.BADGES[d][0] + "”：" + G.BADGES[d][1], "徽章"); }
    else if (t === "fx") fx(d);
    else if (t === "end") showEnd(d);
  });

  /* ---------- 点击 ---------- */
  const on = (id, ev, f) => $(id).addEventListener(ev, f);
  function tabs(id, attr, f) { on(id, "click", e => { const b = e.target.closest("button"); if (!b || b.dataset[attr] == null) return; $(id).querySelectorAll("button").forEach(q => q.classList.toggle("on", q === b)); f(b.dataset[attr]); }); }
  on("bDraw", "click", draw);
  on("inPct", "input", inTxt);
  on("bStart", "click", start);
  on("bAgain", "click", () => { $("end").classList.remove("on"); resetDraw(); $("setup").classList.add("on"); });
  on("bNew", "click", () => { paused = true; resetDraw(); $("setup").classList.add("on"); });
  on("bPause", "click", () => { paused = !paused; $("bPause").textContent = paused ? "继续" : "暂停"; });
  tabs("speed", "s", v => { speed = +v; setTimer(); });
  on("list", "pointerdown", e => { const b = e.target.closest(".row"); if (!b || !S) return; sel = +b.dataset.i; render(); });
  tabs("ctabs", "m", v => { mode = v; if (S) chart(); });
  tabs("btabs", "b", v => { bkTab = v; if (S) book(); });
  tabs("atabs", "a", v => { aTab = v; if (S) acct(); });
  tabs("size", "f", v => { frac = +v; });
  tabs("lots", "n", v => { lots = v; });
  const act = f => () => { if (!S) return; const m = f(); if (m) toast(m); else snd("click"); render(); };
  on("bBuy", "click", act(() => E.order(sel, 1, frac) || (E.isT() ? "" : "已挂买单，开盘后成交")));
  on("bSell", "click", act(() => E.order(sel, -1, frac) || (E.isT() ? "" : "已挂卖单，开盘后成交")));
  const nLots = () => lots === "max" ? Math.max(1, E.futMax(S.ins[sel])) : +lots;
  on("bLong", "click", act(() => E.fut(sel, "long", nLots())));
  on("bShort", "click", act(() => E.fut(sel, "short", nLots())));
  on("bClose", "click", act(() => E.fut(sel, "close")));
  on("gSkill", "click", e => { const b = e.target.closest("button"); if (b && S) { const m = E.skill(b.dataset.k, sel); toast(m); if (/^调研回来了|^预支了/.test(m)) { note(m, "外挂"); snd("card"); } render(); } });
  on("gCards", "click", e => { const b = e.target.closest("[data-c]"); if (!b || !S) return; const m = E.useCard(b.dataset.c, sel); toast(m); if (/生效|对准/.test(m)) { note(m, "道具"); snd("card"); } render(); });
  on("pick", "click", e => {
    if (!S) return; const b = e.target.closest("[data-b]"), g = e.target.closest("[data-g]");
    if (b) { toast(E.pickBty(+b.dataset.b)); snd("click"); hidePick(); render(); } else if (g) { toast(E.guess(+g.dataset.g)); snd("click"); hidePick(); render(); } else if (e.target.closest("[data-x]")) hidePick();
  });
  on("fun", "pointerdown", e => { if (!S) return; const o = e.target.closest("a[data-o]"), l = e.target.closest("a[data-i]"); if (o) { if (o.dataset.o === "bty") showPick(); else showGuess(); if (window.innerWidth > 760) $("pick").scrollIntoView({ block: "nearest" }); } else if (l) { sel = +l.dataset.i; render(); } });
  on("life", "click", e => { const b = e.target.closest("[data-l]"); if (!b || !S) return; const r = E.life(+b.dataset.l, sel), m = r && r.m ? r.m : r; if (r && r.go != null) sel = r.go; toast(m); note(m, "小事"); render(); });
  on("bRep", "click", () => { if (!S) return; const m = E.report(); toast(m); if (/^举报成功/.test(m)) note(m, "举报"); render(); });
  on("bSfx", "click", () => { $("bSfx").textContent = "声音：" + (SFX.toggle() ? "开" : "关"); });
  $("bSfx").textContent = "声音：" + (SFX.on ? "开" : "关");
  on("bIn", "click", act(() => E.transfer(1)));
  on("bOut", "click", act(() => E.transfer(-1)));
  const jump = e => { const l = e.target.closest("[data-i]"); if (l && S && l.dataset.i !== "undefined") { sel = +l.dataset.i; render(); } };
  on("news", "click", jump); on("tape", "click", jump); document.querySelectorAll(".ix").forEach(el => el.addEventListener("click", jump));
  on("sumry", "click", e => { if (e.target.closest("[data-x]")) { sumOn = false; $("sumry").classList.remove("on"); } else jump(e); });
  on("cv", "pointermove", e => { const r = $("cv").getBoundingClientRect(); hov = { x: e.clientX - r.left, y: e.clientY - r.top }; if (S && mode !== "F") chart(); });
  on("cv", "pointerleave", () => { hov = null; if (S && mode !== "F") chart(); });
  on("perk", "pointerdown", e => { const l = e.target.closest("a[data-i]"); if (l && S) { sel = +l.dataset.i; render(); } });
  on("acctBody", "pointerdown", e => {
    if (!S) return; const c = e.target.closest("[data-c]"); if (c) { E.cancel(+c.dataset.c); toast("已撤单"); acct(); return; }
    const r = e.target.closest("tr[data-i]"); if (r) { sel = +r.dataset.i; render(); }
  });
  document.querySelectorAll(".say").forEach(f => f.addEventListener("submit", e => { e.preventDefault(); const i = f.querySelector("input"), v = i.value.trim(); if (!v) return; feed(f.dataset.to, '<span class="who me">你</span>' + esc(v)); i.value = ""; if (S) E.post(f.dataset.to, v); }));
  on("mtabs", "click", e => { const b = e.target.closest("button"); if (!b) return; $("mtabs").querySelectorAll("button").forEach(q => q.classList.toggle("on", q === b));["w0", "w1", "w2"].forEach(w => $(w).classList.toggle("on", w === b.dataset.w)); unread[b.dataset.w] = 0; badges(); });
  new ResizeObserver(() => { if (S && mode !== "F") chart(); }).observe($("cv").parentElement);

  buildBook(); resetDraw();
  /* 只给自测用：网址里带 ?role=xx 可以跳过抽签直接开局 */
  if (Q.get("role") && G.ROLES[Q.get("role")]) { setRole(Q.get("role")); start(); }
  window.GAME.UI = { get S() { return S; }, render };
})();
