/* 图表：分时图和日 K 线，按正规炒股软件的画法（红涨绿跌）。 */
window.GAME = window.GAME || {};
(function (G) {
  const C = G.C = {}, UP = "#FF3B3B", DN = "#00D060", GRID = "rgba(170,0,0,.5)";
  const f2 = n => n.toFixed(2);
  function setup(cv) {
    const d = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    cv.width = Math.round(w * d); cv.height = Math.round(h * d);
    const x = cv.getContext("2d"); x.setTransform(d, 0, 0, d, 0, 0); x.fillStyle = "#000"; x.fillRect(0, 0, w, h);
    x.font = "11px Menlo,Consolas,monospace"; x.textBaseline = "middle"; return [x, w, h];
  }
  function hline(x, x0, x1, y, col, dash) { x.save(); x.strokeStyle = col; x.setLineDash(dash || []); x.beginPath(); x.moveTo(x0, Math.round(y) + .5); x.lineTo(x1, Math.round(y) + .5); x.stroke(); x.restore(); }
  function vline(x, X, y0, y1, col, dash) { x.save(); x.strokeStyle = col; x.setLineDash(dash || []); x.beginPath(); x.moveTo(Math.round(X) + .5, y0); x.lineTo(Math.round(X) + .5, y1); x.stroke(); x.restore(); }
  function box(x, X, Y, W, H) { x.strokeStyle = "#7a0000"; x.strokeRect(Math.round(X) + .5, Math.round(Y) + .5, Math.round(W), Math.round(H)); }
  function path(x, pts, col, lw) { x.save(); x.strokeStyle = col; x.lineWidth = lw || 1; x.lineJoin = "round"; x.beginPath(); let on = false; pts.forEach(q => { if (q == null) { on = false; return; } on ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]); on = true; }); x.stroke(); x.restore(); }
  function labels(x, X, Y, items) { items.forEach(it => { x.fillStyle = it[1]; x.textAlign = "left"; x.fillText(it[0], X, Y); X += x.measureText(it[0]).width + 12; }); }

  /* 分时图 */
  C.T = function (cv, I, hov) {
    const r = setup(cv), x = r[0], W = r[1], H = r[2], cur = I.p.length, L = 8, R = 58, T = 20, B = 16, pw = W - L - R;
    if (pw < 40 || H < 120) return;
    const hP = (H - T - B - 18) * .74, yV = T + hP + 18, hV = H - B - yV;
    let dev = .01; for (let i = 0; i < cur; i++) dev = Math.max(dev, Math.abs(I.p[i] / I.prev - 1)); dev = Math.min(I.lim, dev * 1.15);
    const X = i => L + i / 239 * pw, Y = p => T + (I.prev * (1 + dev) - p) / (2 * I.prev * dev) * hP;
    box(x, L, T, pw, hP); box(x, L, yV, pw, hV);
    [-1, -.5, 0, .5, 1].forEach(k => {
      const p = I.prev * (1 + dev * k), y = Y(p);
      if (Math.abs(k) < 1) hline(x, L, L + pw, y, k === 0 ? "#aa0000" : GRID, k === 0 ? [] : [2, 3]);
      x.textAlign = "left"; x.fillStyle = k > 0 ? UP : k < 0 ? DN : "#ddd";
      x.fillText((k > 0 ? "+" : "") + (dev * k * 100).toFixed(2) + "%", L + pw + 5, Math.min(Math.max(y, T + 6), T + hP - 6));
    });
    [60, 120, 180].forEach(i => { vline(x, X(i), T, T + hP, i === 120 ? "#aa0000" : GRID, i === 120 ? [] : [2, 3]); vline(x, X(i), yV, yV + hV, GRID, [2, 3]); });
    x.fillStyle = "#888";
    [[0, "9:30"], [60, "10:30"], [120, "11:30/13:00"], [180, "14:00"], [239, "15:00"]].forEach(a => { x.textAlign = a[0] === 0 ? "left" : a[0] === 239 ? "right" : "center"; x.fillText(a[1], X(a[0]), H - B / 2); });
    labels(x, L, yV - 8, [["成交量", "#888"]]);
    if (!cur) { labels(x, L, 10, [["分时", "#888"], ["昨收 " + f2(I.prev), "#888"]]); x.fillStyle = "#666"; x.textAlign = "center"; x.fillText("还没开盘", L + pw / 2, T + hP / 2 - 14); return; }
    let sv = 0, spv = 0, vm = 1e-9; const pr = [], av = [];
    for (let i = 0; i < cur; i++) vm = Math.max(vm, I.v[i]);
    for (let i = 0; i < cur; i++) {
      sv += I.v[i]; spv += I.v[i] * I.p[i]; pr.push([X(i), Y(I.p[i])]); av.push([X(i), Y(sv ? spv / sv : I.p[i])]);
      const up = i === 0 ? I.p[0] >= I.prev : I.p[i] >= I.p[i - 1]; vline(x, X(i), yV + hV - I.v[i] / vm * (hV - 3), yV + hV, up ? UP : DN);
    }
    path(x, av, "#FFFF55", 1); path(x, pr, "#fff", 1.4);
    const last = pr[cur - 1]; x.fillStyle = "#fff"; x.fillRect(last[0] - 2, last[1] - 2, 5, 5);
    /* 消息标记：这只股票今天什么时候出过消息，在价格图底边画一个小黄三角 */
    (I.nm || []).forEach(q => { if (q[0] > cur) return; const mx = X(Math.min(239, q[0])), my = T + hP - 1; x.fillStyle = "#FFFF55"; x.beginPath(); x.moveTo(mx, my - 8); x.lineTo(mx - 4, my); x.lineTo(mx + 4, my); x.closePath(); x.fill(); });
    /* 十字光标：鼠标（或手指）移到哪一分钟，就显示那一分钟的时间、价格、涨幅 */
    if (hov && hov.x >= L - 6 && hov.x <= L + pw + 6) {
      const i = Math.max(0, Math.min(cur - 1, Math.round((hov.x - L) / pw * 239))), p = I.p[i], hx = X(i), hy = Y(p), m = i < 120 ? 570 + i : 780 + (i - 120), rr = p / I.prev - 1, col = rr >= 0 ? UP : DN;
      vline(x, hx, T, yV + hV, "#bbb", [3, 3]); hline(x, L, L + pw, hy, "#bbb", [3, 3]);
      x.fillStyle = "#fff"; x.fillRect(L + pw + 1, hy - 8, R - 3, 16); x.fillStyle = "#000"; x.textAlign = "left"; x.fillText(f2(p), L + pw + 5, hy);
      labels(x, L, 10, [[Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0"), "#fff"], ["价 " + f2(p), col], [(rr >= 0 ? "+" : "") + (rr * 100).toFixed(2) + "%", col], ["量 " + (I.v[i] >= 1e4 ? (I.v[i] / 1e4).toFixed(1) + "万" : Math.round(I.v[i])), "#888"]]);
      const mk = (I.nm || []).filter(q => Math.abs(q[0] - i) <= 3)[0];
      if (mk) { const t = "消息：" + mk[1], mxc = Math.max(8, Math.floor((pw - 12) / 12)); x.fillStyle = "rgba(0,0,0,.9)"; x.fillRect(L + 1, T + 1, pw - 1, 18); x.fillStyle = "#FFFF55"; x.textAlign = "left"; x.font = "12px -apple-system,PingFang SC,sans-serif"; x.fillText(t.length > mxc ? t.slice(0, mxc) + "…" : t, L + 5, T + 10); }
    } else labels(x, L, 10, [["分时", "#888"], ["现价 " + f2(I.p[cur - 1]), "#fff"], ["均价 " + f2(sv ? spv / sv : I.p[cur - 1]), "#FFFF55"], ["昨收 " + f2(I.prev), "#888"]]);
  };

  const ma = (a, n) => a.map((_, i) => i < n - 1 ? null : a.slice(i - n + 1, i + 1).reduce((s, q) => s + q, 0) / n);
  const ema = (a, n) => { const k = 2 / (n + 1), o = [a[0]]; for (let i = 1; i < a.length; i++) o.push(a[i] * k + o[i - 1] * (1 - k)); return o; };

  /* 日 K 线（带均线、成交量、MACD）。closed=true 表示今天已收盘，今天那根已经在历史里了 */
  C.K = function (cv, I, closed, hov) {
    const r = setup(cv), x = r[0], W = r[1], H = r[2], L = 8, R = 58, T = 20, pw = W - L - R;
    if (pw < 40 || H < 160) return;
    let D = I.days.slice(-110);
    if (!closed && I.p.length) { let h = -1e18, l = 1e18, v = 0; I.p.forEach((p, i) => { h = Math.max(h, p); l = Math.min(l, p); v += I.v[i]; }); D = D.concat([{ o: I.p[0], c: I.p[I.p.length - 1], h, l, v }]); }
    const n = D.length, A = H - T - 18 - 18 - 6, hP = A * .58, hV = A * .15, hM = A * .27, yV = T + hP + 18, yM = yV + hV + 18, cw = pw / n, bw = Math.max(1, Math.floor(cw * .68));
    const cl = D.map(d => d.c), m5 = ma(cl, 5), m10 = ma(cl, 10), m20 = ma(cl, 20), m60 = ma(cl, 60);
    let hi = -1e18, lo = 1e18; D.forEach(d => { hi = Math.max(hi, d.h); lo = Math.min(lo, d.l); }); const pad = (hi - lo) * .05 || 1; hi += pad; lo -= pad;
    const X = i => L + (i + .5) * cw, Y = p => T + (hi - p) / (hi - lo) * hP;
    box(x, L, T, pw, hP); box(x, L, yV, pw, hV); box(x, L, yM, pw, hM);
    for (let k = 0; k <= 4; k++) { const p = hi - (hi - lo) * k / 4, y = Y(p); if (k > 0 && k < 4) hline(x, L, L + pw, y, GRID, [2, 3]); x.fillStyle = "#999"; x.textAlign = "left"; x.fillText(f2(p), L + pw + 5, Math.min(Math.max(y, T + 6), T + hP - 6)); }
    for (let i = 20; i < n; i += 20) { const X0 = L + i * cw; vline(x, X0, T, T + hP, GRID, [2, 3]); vline(x, X0, yV, yV + hV, GRID, [2, 3]); vline(x, X0, yM, yM + hM, GRID, [2, 3]); }
    const vm = Math.max.apply(null, D.map(d => d.v)) || 1;
    D.forEach((d, i) => {
      const up = d.c >= d.o, col = up ? UP : DN, cx = Math.round(X(i)), x0 = cx - Math.floor(bw / 2);
      vline(x, cx, Y(d.h), Y(d.l), col);
      const yt = Math.round(Y(Math.max(d.o, d.c))), yb = Math.round(Y(Math.min(d.o, d.c))), bh = Math.max(1, yb - yt);
      if (up && bw >= 3 && bh >= 3) { x.fillStyle = "#000"; x.fillRect(x0, yt, bw, bh); x.strokeStyle = col; x.strokeRect(x0 + .5, yt + .5, bw - 1, bh - 1); }
      else { x.fillStyle = col; x.fillRect(x0, yt, bw, bh); }
      const vh = d.v / vm * (hV - 3); x.fillStyle = col; x.fillRect(x0, yV + hV - vh, bw, vh);
    });
    const ln = (arr, c) => path(x, arr.map((q, i) => q == null ? null : [X(i), Y(q)]), c, 1);
    ln(m60, "#55FF55"); ln(m20, "#FF55FF"); ln(m10, "#FFFF55"); ln(m5, "#fff");
    const e = n - 1, lp = D[e].c, ly = Y(lp), lc = lp >= I.prev ? UP : DN; hline(x, L, L + pw, ly, lc, [4, 3]);
    x.fillStyle = lc; x.fillRect(L + pw + 1, ly - 8, R - 3, 16); x.fillStyle = "#000"; x.textAlign = "left"; x.fillText(f2(lp), L + pw + 5, ly);
    const mv = (a, t) => a[e] == null ? t + " --" : t + " " + f2(a[e]);
    const hi0 = hov && hov.x >= L && hov.x <= L + pw ? Math.max(0, Math.min(n - 1, Math.floor((hov.x - L) / cw))) : -1;
    if (hi0 >= 0) { const d = D[hi0], pc0 = hi0 ? D[hi0 - 1].c : d.o, rr = d.c / pc0 - 1, col = rr >= 0 ? UP : DN; vline(x, X(hi0), T, yM + hM, "#bbb", [3, 3]);
      labels(x, L, 10, [[hi0 === n - 1 ? "最新一天" : "往前第 " + (n - 1 - hi0) + " 天", "#fff"], ["开 " + f2(d.o), "#ddd"], ["高 " + f2(d.h), UP], ["低 " + f2(d.l), DN], ["收 " + f2(d.c), col], [(rr >= 0 ? "+" : "") + (rr * 100).toFixed(2) + "%", col]]); }
    else labels(x, L, 10, [["日K", "#888"], [mv(m5, "MA5"), "#fff"], [mv(m10, "MA10"), "#FFFF55"], [mv(m20, "MA20"), "#FF55FF"], [mv(m60, "MA60"), "#55FF55"]]);
    labels(x, L, yV - 8, [["成交量", "#888"]]);
    const e12 = ema(cl, 12), e26 = ema(cl, 26), dif = cl.map((_, i) => e12[i] - e26[i]), dea = ema(dif, 9), hs = dif.map((q, i) => 2 * (q - dea[i]));
    let mm = 1e-9; for (let i = 0; i < n; i++) mm = Math.max(mm, Math.abs(dif[i]), Math.abs(dea[i]), Math.abs(hs[i]));
    const YM = q => yM + hM / 2 - q / mm * (hM / 2 - 3); hline(x, L, L + pw, YM(0), GRID, [2, 3]);
    hs.forEach((q, i) => vline(x, Math.round(X(i)), Math.min(YM(0), YM(q)), Math.max(YM(0), YM(q)), q >= 0 ? UP : DN));
    path(x, dif.map((q, i) => [X(i), YM(q)]), "#fff", 1); path(x, dea.map((q, i) => [X(i), YM(q)]), "#FFFF55", 1);
    labels(x, L, yM - 8, [["MACD(12,26,9)", "#888"], ["DIF " + dif[e].toFixed(2), "#fff"], ["DEA " + dea[e].toFixed(2), "#FFFF55"], ["MACD " + hs[e].toFixed(2), hs[e] >= 0 ? UP : DN]]);
  };
})(window.GAME);
