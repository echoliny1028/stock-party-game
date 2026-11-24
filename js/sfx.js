/* 声音：全部用浏览器现场合成的老游戏机“哔哔”声，不带任何音频文件。 */
window.GAME = window.GAME || {};
(function (G) {
  const X = G.SFX = { on: true };
  let ctx = null, last = {};
  try { if (localStorage.getItem("sfx") === "0") X.on = false; } catch (e) { /* 存不了就算了 */ }
  /* 浏览器规定：必须等玩家点过一下页面，才能出声 */
  function wake() { try { if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (A) ctx = new A(); } if (ctx && ctx.state === "suspended") ctx.resume(); } catch (e) { ctx = null; } }
  ["pointerdown", "keydown"].forEach(ev => window.addEventListener && window.addEventListener(ev, wake, { passive: true }));
  /* 一个音：频率、从第几秒开始、响多久、波形、音量、滑到的频率 */
  function tone(f, at, len, type, vol, to) {
    const t0 = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || "square"; o.frequency.setValueAtTime(f, t0); if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + len);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol || .05, t0 + .005); g.gain.exponentialRampToValueAtTime(.0001, t0 + len);
    o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0 + len + .02);
  }
  const seq = (fs, step, len, type, vol) => fs.forEach((f, i) => f && tone(f, i * step, len, type, vol));
  const S = {
    click: () => tone(880, 0, .04),
    buy: () => seq([523, 784], .06, .07),
    sell: () => seq([784, 523], .06, .07),
    coin: () => { tone(988, 0, .07); tone(1319, .07, .22); },
    news: () => tone(1245, 0, .03, "square", .03),
    hot: () => seq([880, 0, 880, 0, 880], .09, .08, "square", .06),
    lu: () => seq([523, 659, 784, 1047, 784, 1047], .09, .12, "square", .06),
    boom: () => { tone(400, 0, .25, "sawtooth", .06, 90); tone(300, .12, .25, "sawtooth", .05, 70); },
    ld: () => seq([196, 0, 165], .12, .16, "triangle", .09),
    bell: () => { [0, .32].forEach(t => { tone(1568, t, .5, "triangle", .08); tone(3136, t, .3, "sine", .03); }); },
    goal: () => seq([392, 523, 659, 784, 1047], .08, .12, "square", .06),
    badge: () => seq([1047, 1319, 1568, 2093], .06, .1, "triangle", .08),
    bounty: () => seq([659, 784, 988, 1319], .08, .12, "square", .06),
    miss: () => tone(220, 0, .12, "triangle", .07),
    report: () => { tone(900, 0, .7, "sawtooth", .06, 60); seq([0, 0, 0, 0, 0, 0, 0, 0, 392, 523, 784], .08, .12, "square", .06); },
    life: () => seq([1319, 1047, 1319, 1047], .11, .09, "square", .05),
    tick: () => tone(1000, 0, .025, "square", .04),
    tock: () => tone(700, 0, .025, "square", .04),
    card: () => tone(300, 0, .22, "square", .05, 1400),
    lock: () => tone(140, 0, .16, "square", .07),
    step: () => tone(660, 0, .03, "square", .04),
    reveal: () => seq([523, 659, 784, 1047], .07, .2, "square", .05),
    guess: () => seq([587, 880], .07, .08, "triangle", .08)
  };
  X.play = function (k) {
    if (!X.on || !ctx || !S[k]) return;
    const now = Date.now(); if (last[k] && now - last[k] < 80) return; last[k] = now;   // 同一个声音别在 0.08 秒里叠着响
    try { S[k](); } catch (e) { /* 出不了声不影响玩 */ }
  };
  X.toggle = function () { X.on = !X.on; try { localStorage.setItem("sfx", X.on ? "1" : "0"); } catch (e) { /* 存不了就算了 */ } if (X.on) { wake(); X.play("click"); } return X.on; };
})(window.GAME);
