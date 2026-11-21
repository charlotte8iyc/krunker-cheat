(function () {
  'use strict';
  if (window.__KRU) { window.__KRU.uiToggle(); return; }

  var S = { scene: null, me: null, cam: null, foes: [], camBase: null, baseFov: 0, fireAt: 0, upAt: 0 };

  var cfg = {
    aimbot: false, autofire: false,
    esp: false, espLine: false,
    chams: false, wire: false,
    godmode: false, bhop: false, autorun: false,
    fov: 0, third: false, menu: true
  };

  var FOVS = [0, 90, 110, 130];

  function clone3(v) { return v.clone(); }

  function wpos(o, x, y, z) {
    var v = S.cam.position.clone();
    v.set(x, y, z);
    o.localToWorld(v);
    return v;
  }

  function camPos() { return S.cam.getWorldPosition(S.cam.position.clone()); }

  function aDiff(a, b) {
    var d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function probe(o, keys) {
    if (!o) return null;
    var i, k;
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      if (o[k] !== undefined && o[k] !== null && typeof o[k] !== 'object') return o[k];
    }
    if (o.userData) {
      for (i = 0; i < keys.length; i++) {
        k = keys[i];
        if (o.userData[k] !== undefined && o.userData[k] !== null && typeof o.userData[k] !== 'object') return o.userData[k];
      }
    }
    if (o.children && o.children[0]) return probe(o.children[0], keys);
    return null;
  }

  var origPush = Array.prototype.push;
  Array.prototype.push = function () {
    try {
      var o = arguments[0];
      if (o && o.parent && o.parent.type === 'Scene' && o.parent.name === 'Main') S.scene = o.parent;
    } catch (e) {}
    return origPush.apply(this, arguments);
  };

  function scan() {
    var s = S.scene;
    if (!s || !s.children) { S.me = null; S.cam = null; S.foes = []; return; }
    var me = null, cam = null, foes = [], i, c, k;
    for (i = 0; i < s.children.length; i++) {
      c = s.children[i];
      if (!c || c.type !== 'Object3D') continue;
      k = c.children && c.children[0] && c.children[0].children && c.children[0].children[0];
      if (k && k.type === 'PerspectiveCamera') { me = c; cam = k; }
      else if (c.children && c.children[0]) foes.push(c);
    }
    S.me = me; S.cam = cam; S.foes = foes;
    if (cam && !S.baseFov) S.baseFov = cam.fov || 75;
    if (me && !S.camBase) S.camBase = cam.position.clone();
  }

  function pickTarget() {
    if (!S.me || !S.cam) return null;
    var cpos = camPos();
    var fwd = S.cam.getWorldDirection(S.cam.position.clone());
    var limit = 45 * Math.PI / 180;
    var best = null, bestDist = 1e9;
    for (var i = 0; i < S.foes.length; i++) {
      var f = S.foes[i];
      if (f === S.me || !f.children || !f.children[0]) continue;
      var node = f.children[0].children && f.children[0].children[0] ? f.children[0].children[0] : f;
      var head;
      try { head = wpos(node, 0, 2, 0); } catch (e) { continue; }
      var to = head.clone().sub(cpos);
      var dist = to.length();
      if (dist < 2 || dist > 300) continue;
      to.normalize();
      var ang = Math.acos(Math.max(-1, Math.min(1, fwd.dot(to))));
      if (ang < limit && dist < bestDist) { bestDist = dist; best = f; }
    }
    return best;
  }

  function applyAim(t) {
    var node = t.children[0].children && t.children[0].children[0] ? t.children[0].children[0] : t;
    var goal = wpos(node, 0, 1.5, 0);
    var o = new (S.me.constructor)();
    o.rotation.order = 'YXZ';
    o.position.copy(S.me.position);
    o.lookAt(goal);
    var camNode = S.me.children[0];
    var sm = 0.4;
    var goalX = -o.rotation.x;
    var goalY = o.rotation.y + Math.PI;
    camNode.rotation.x = camNode.rotation.x + (goalX - camNode.rotation.x) * sm;
    S.me.rotation.y = S.me.rotation.y + aDiff(S.me.rotation.y, goalY) * sm;
  }

  function fire(on) {
    var cv = document.querySelector('canvas');
    if (!cv) return;
    var type = on ? 'mousedown' : 'mouseup';
    var ev;
    try {
      ev = new MouseEvent(type, { button: 0, buttons: on ? 1 : 0, bubbles: true, cancelable: true });
    } catch (e) {
      ev = document.createEvent('MouseEvents');
      ev.initMouseEvent(type, true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
    }
    cv.dispatchEvent(ev);
    if (typeof PointerEvent !== 'undefined') {
      try {
        cv.dispatchEvent(new PointerEvent(type, { button: 0, buttons: on ? 1 : 0, pointerId: 1, isPrimary: true, bubbles: true, cancelable: true }));
      } catch (e2) {}
    }
  }

  function fireCycle() {
    var now = Date.now();
    if (now >= S.fireAt) {
      fire(true);
      S.fireAt = now + 140;
      S.upAt = now + 50;
    }
    if (S.upAt && now >= S.upAt) {
      fire(false);
      S.upAt = 0;
    }
  }

  var espCv = null, espCtx = null;

  function espCanvas() {
    if (espCv) return espCv;
    espCv = document.createElement('canvas');
    espCv.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:999998;';
    (document.body || document.documentElement).appendChild(espCv);
    espCtx = espCv.getContext('2d');
    return espCv;
  }

  function drawEsp() {
    var cv = espCanvas();
    var dpr = window.devicePixelRatio || 1;
    var W = window.innerWidth, H = window.innerHeight;
    if (cv.width !== Math.floor(W * dpr)) { cv.width = Math.floor(W * dpr); cv.height = Math.floor(H * dpr); }
    var g = espCtx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    if (!S.cam) return;
    var cpos = camPos();
    var lines = [];
    for (var i = 0; i < S.foes.length; i++) {
      var f = S.foes[i];
      if (f === S.me) continue;
      var feet, head;
      try {
        feet = wpos(f, 0, 0, 0);
        head = wpos(f, 0, 11, 0);
      } catch (e) { continue; }
      var pf = feet.project(S.cam);
      var ph = head.project(S.cam);
      if (pf.z >= 1 || ph.z >= 1) continue;
      var x1 = (pf.x * 0.5 + 0.5) * W;
      var y1 = (-pf.y * 0.5 + 0.5) * H;
      var x2 = (ph.x * 0.5 + 0.5) * W;
      var y2 = (-ph.y * 0.5 + 0.5) * H;
      var bh = y1 - y2;
      if (bh < 6 || bh > H * 2) continue;
      var bw = bh * 0.45;
      var cx = (x1 + x2) / 2;
      var dist = Math.round(feet.distanceTo(cpos));
      g.strokeStyle = '#ff3b3b';
      g.lineWidth = 2;
      g.strokeRect(cx - bw / 2, y2, bw, bh);
      g.font = '12px monospace';
      g.fillStyle = '#ffffff';
      g.textAlign = 'center';
      var name = f.name || probe(f, ['username', 'playerName', 'nick']) || 'Enemy';
      g.fillText(String(name), cx, y2 - 16);
      g.fillStyle = '#ffd166';
      g.fillText(dist + 'm', cx, y2 - 3);
      var hp = probe(f, ['health', 'hp']);
      var mx = probe(f, ['maxHealth', 'maxHp', 'hpMax']);
      if (typeof hp === 'number') {
        var max = typeof mx === 'number' && mx > 0 ? mx : 100;
        var frac = Math.max(0, Math.min(1, hp / max));
        g.fillStyle = '#222';
        g.fillRect(cx - bw / 2, y1 + 4, bw, 5);
        g.fillStyle = frac > 0.5 ? '#4caf50' : frac > 0.25 ? '#ff9800' : '#f44336';
        g.fillRect(cx - bw / 2, y1 + 4, bw * frac, 5);
      }
      if (cfg.espLine) lines.push([cx, y1]);
    }
    if (cfg.espLine) {
      g.strokeStyle = 'rgba(255,59,59,0.6)';
      g.lineWidth = 1;
      g.beginPath();
      for (var j = 0; j < lines.length; j++) {
        g.moveTo(W / 2, H);
        g.lineTo(lines[j][0], lines[j][1]);
      }
      g.stroke();
    }
  }

  function clearEsp() {
    if (espCtx) espCtx.clearRect(0, 0, espCv.width, espCv.height);
  }

  function eachMat(root, fn) {
    if (!root || !root.traverse) return;
    root.traverse(function (o) {
      if (!o.material) return;
      var ms = Array.isArray(o.material) ? o.material : [o.material];
      for (var i = 0; i < ms.length; i++) fn(ms[i]);
    });
  }

  function applyMats(on) {
    for (var i = 0; i < S.foes.length; i++) {
      (function (f) {
        eachMat(f, function (m) {
          if (on) {
            if (!m.__kru) m.__kru = { dt: m.depthTest, dw: m.depthWrite, tr: m.transparent, op: m.opacity, wf: m.wireframe, col: m.color ? m.color.getHex() : null };
            if (cfg.chams) {
              m.depthTest = false;
              m.depthWrite = false;
              m.transparent = true;
              m.opacity = 0.7;
              if (m.color) m.color.setHex(0xff2b2b);
            } else if (m.__kru) {
              m.depthTest = m.__kru.dt;
              m.depthWrite = m.__kru.dw;
              m.transparent = m.__kru.tr;
              m.opacity = m.__kru.op;
              if (m.color && m.__kru.col !== null) m.color.setHex(m.__kru.col);
            }
            m.wireframe = cfg.wire;
          } else if (m.__kru) {
            m.depthTest = m.__kru.dt;
            m.depthWrite = m.__kru.dw;
            m.transparent = m.__kru.tr;
            m.opacity = m.__kru.op;
            m.wireframe = m.__kru.wf;
            if (m.color && m.__kru.col !== null) m.color.setHex(m.__kru.col);
            m.__kru = null;
          }
        });
      })(S.foes[i]);
    }
  }

  function restoreMats() {
    for (var i = 0; i < S.foes.length; i++) {
      (function (f) {
        eachMat(f, function (m) {
          if (!m.__kru) return;
          m.depthTest = m.__kru.dt;
          m.depthWrite = m.__kru.dw;
          m.transparent = m.__kru.tr;
          m.opacity = m.__kru.op;
          m.wireframe = m.__kru.wf;
          if (m.color && m.__kru.col !== null) m.color.setHex(m.__kru.col);
          m.__kru = null;
        });
      })(S.foes[i]);
    }
  }

  function godTick() {
    if (!cfg.godmode) return;
    var p = window.player;
    if (p) {
      var mx = probe(p, ['maxHealth', 'maxHp', 'hpMax']);
      if (typeof p.health === 'number' && typeof mx === 'number') p.health = mx;
      else if (typeof p.hp === 'number' && typeof mx === 'number') p.hp = mx;
    }
    var el = document.querySelector('#hpVal, #hp, .hpVal, [id*="hpVal"], [class*="hpVal"]');
    if (el) {
      if (el.textContent && /^\d+$/.test(el.textContent.trim()) && el.textContent.trim() !== '100') el.textContent = '100';
      if (el.style) {
        if (el.style.width && el.style.width !== '100%') el.style.width = '100%';
      }
    }
  }

  function fovTick() {
    if (!S.cam) return;
    var want = cfg.fov ? FOVS[cfg.fov] : (S.baseFov || 75);
    if (S.cam.fov !== want) {
      S.cam.fov = want;
      if (S.cam.updateProjectionMatrix) S.cam.updateProjectionMatrix();
    }
  }

  function thirdTick() {
    if (!S.cam || !S.camBase) return;
    if (cfg.third) {
      S.cam.position.copy(S.camBase);
      S.cam.position.z += 16;
      S.cam.position.y += 4;
    } else if (S.cam.position.z !== S.camBase.z || S.cam.position.y !== S.camBase.y) {
      S.cam.position.copy(S.camBase);
    }
  }

  function kbd(type, code, kc) {
    var ev;
    try {
      ev = new KeyboardEvent(type, { code: code, bubbles: true, cancelable: true });
    } catch (e) {
      ev = document.createEvent('Event');
      ev.initEvent(type, true, true);
      ev.code = code;
    }
    try {
      Object.defineProperty(ev, 'keyCode', { value: kc });
      Object.defineProperty(ev, 'which', { value: kc });
    } catch (e2) {}
    (document.activeElement && document.activeElement !== document.body ? document.body : document).dispatchEvent(ev);
  }

  function typing() {
    var a = document.activeElement;
    return a && a !== document.body && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
  }

  setInterval(function () {
    if (typing()) return;
    if (cfg.bhop) {
      kbd('keydown', 'Space', 32);
      setTimeout(function () { kbd('keyup', 'Space', 32); }, 55);
    }
    if (cfg.autorun) kbd('keydown', 'KeyW', 87);
  }, 90);

  var FEATURES = [
    ['aimbot', 'Aimbot'],
    ['autofire', 'Auto Fire'],
    ['esp', 'ESP Box'],
    ['espLine', 'ESP Tracer'],
    ['chams', 'Chams'],
    ['wire', 'Wireframe'],
    ['godmode', 'Godmode'],
    ['bhop', 'Auto Bhop'],
    ['autorun', 'Auto Run'],
    ['fov', 'FOV Cycle'],
    ['third', 'Third Person']
  ];

  var menuEl = null, btns = {};

  function toast(msg) {
    var t = document.getElementById('kru-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'kru-toast';
      t.style.cssText = 'position:fixed;left:50%;bottom:14%;transform:translateX(-50%);background:rgba(0,0,0,.85);color:#7CFC9B;font:600 14px monospace;padding:8px 16px;border-radius:6px;z-index:1000001;pointer-events:none;border:1px solid #2b7';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t.__h);
    t.__h = setTimeout(function () { t.style.opacity = '0'; }, 1400);
  }

  function fmt(k) {
    if (k === 'fov') return ['OFF', '90', '110', '130'][cfg.fov];
    return cfg[k] ? 'ON' : 'OFF';
  }

  function refresh() {
    for (var k in btns) {
      if (!btns.hasOwnProperty(k)) continue;
      var on = k === 'fov' ? cfg.fov > 0 : cfg[k];
      btns[k].textContent = btns[k].__label + '  [' + fmt(k) + ']';
      btns[k].style.color = on ? '#7CFC9B' : '#888';
      btns[k].style.borderColor = on ? '#2b7' : '#444';
    }
  }

  function toggle(k) {
    if (k === 'fov') cfg.fov = (cfg.fov + 1) % FOVS.length;
    else cfg[k] = !cfg[k];
    if (k === 'esp' && !cfg.esp) clearEsp();
    if ((k === 'chams' || k === 'wire') && !cfg.chams && !cfg.wire) restoreMats();
    if (k === 'autorun' && !cfg.autorun) kbd('keyup', 'KeyW', 87);
    refresh();
    toast(document.getElementById('kru-title').textContent.split(' ')[0] + ' ' + k + ' = ' + fmt(k));
  }

  function buildMenu() {
    menuEl = document.createElement('div');
    menuEl.id = 'kru-menu';
    menuEl.style.cssText = 'position:fixed;top:8px;left:8px;z-index:1000000;background:rgba(8,12,10,.92);border:1px solid #2b7;border-radius:8px;padding:8px;font:12px monospace;color:#ccc;user-select:none;min-width:170px;';
    var title = document.createElement('div');
    title.id = 'kru-title';
    title.textContent = 'KRU CHEAT v1';
    title.style.cssText = 'color:#7CFC9B;font-weight:700;font-size:13px;cursor:move;padding:2px 4px 6px;letter-spacing:1px;';
    menuEl.appendChild(title);
    for (var i = 0; i < FEATURES.length; i++) {
      (function (pair) {
        var b = document.createElement('div');
        b.__label = pair[1];
        b.textContent = pair[1] + '  [OFF]';
        b.style.cssText = 'padding:6px 8px;margin:3px 0;border:1px solid #444;border-radius:5px;cursor:pointer;text-align:left;background:#111a16;font-size:12px;';
        b.addEventListener('click', function () { toggle(pair[0]); });
        b.addEventListener('touchstart', function (e) { e.preventDefault(); toggle(pair[0]); }, { passive: false });
        btns[pair[0]] = b;
        menuEl.appendChild(b);
      })(FEATURES[i]);
    }
    var hide = document.createElement('div');
    hide.textContent = '[ Sembunyikan ]';
    hide.style.cssText = 'padding:5px;text-align:center;color:#666;cursor:pointer;margin-top:4px;border-top:1px solid #233;';
    hide.addEventListener('click', function () { menuEl.style.display = 'none'; cfg.menu = false; toast('menu tersembunyi — tekan Insert / klik KRU untuk buka'); });
    menuEl.appendChild(hide);
    document.body.appendChild(menuEl);

    var drag = false, ox = 0, oy = 0;
    function down(x, y) { drag = true; var r = menuEl.getBoundingClientRect(); ox = x - r.left; oy = y - r.top; }
    function move(x, y) {
      if (!drag) return;
      menuEl.style.left = Math.max(0, Math.min(window.innerWidth - 100, x - ox)) + 'px';
      menuEl.style.top = Math.max(0, Math.min(window.innerHeight - 60, y - oy)) + 'px';
      menuEl.style.right = 'auto';
    }
    title.addEventListener('mousedown', function (e) { down(e.clientX, e.clientY); e.preventDefault(); });
    title.addEventListener('touchstart', function (e) { down(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    window.addEventListener('mousemove', function (e) { move(e.clientX, e.clientY); });
    window.addEventListener('touchmove', function (e) { if (drag) { move(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); } }, { passive: false });
    window.addEventListener('mouseup', function () { drag = false; });
    window.addEventListener('touchend', function () { drag = false; });
    refresh();
  }

  window.addEventListener('keydown', function (e) {
    if (typing()) return;
    if (e.code === 'Insert') {
      if (!menuEl) buildMenu();
      cfg.menu = !cfg.menu;
      menuEl.style.display = cfg.menu ? '' : 'none';
      e.preventDefault();
      return;
    }
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9 && FEATURES[n - 1]) toggle(FEATURES[n - 1][0]);
  });

  function loop() {
    requestAnimationFrame(loop);
    if (!S.scene) return;
    scan();
    if (!S.me || !S.cam) return;
    var t = cfg.aimbot ? pickTarget() : null;
    if (t) {
      applyAim(t);
      if (cfg.autofire) fireCycle();
    } else if (cfg.autofire && S.upAt) {
      fire(false);
      S.upAt = 0;
    }
    if (cfg.chams || cfg.wire) applyMats(true);
    if (cfg.esp) drawEsp(); else clearEsp();
    godTick();
    fovTick();
    thirdTick();
  }

  window.__KRU = {
    cfg: cfg,
    state: S,
    toggle: toggle,
    uiToggle: function () {
      if (!menuEl) { buildMenu(); cfg.menu = true; return; }
      cfg.menu = !cfg.menu;
      menuEl.style.display = cfg.menu ? '' : 'none';
    },
    rescan: scan
  };

  buildMenu();
  toast('KRU loaded — scene menunggu game mulai');
  requestAnimationFrame(loop);
})();