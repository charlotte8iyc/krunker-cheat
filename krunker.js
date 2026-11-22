(function () {
  'use strict';
  if (window.__KRU) return;
  var K = { v: 9, dbg: { g: 0, t: 0, f: 0, e: 0, last: '' } };
  window.__KRU = K;
  window.addEventListener('error', function (ev) {
    try { K.dbg.e++; K.dbg.last = String((ev && ev.message) || 'err').slice(0, 34); } catch (e) { }
  }, true);

  var S = {
    aimbot: true, autofire: true, espBox: true, espTracer: false,
    chams: false, wireframe: false, god: true, bhop: false,
    autorun: false, teamCheck: true, third: false,
    fovIdx: 0, aimFov: 45, aimOffset: 0, menuOpen: true, min: false
  };
  var FOVS = [0, 90, 110, 130];
  var IDX = { frame: 0, delta: 1, xdir: 2, ydir: 3, moveDir: 4, shoot: 5, scope: 6, jump: 7, reload: 8, crouch: 9, weaponScroll: 10, weaponSwap: 11, moveLock: 12 };

  var C = {
    game: null, controls: null, renderer: null, me: null,
    overlay: null, ctx: null, scale: null, spaceDown: false,
    by: '', ready: false, fovApplied: -1, baseCam: null, thirdOn: false
  };

  function isFn(v) { return typeof v === 'function'; }
  function safe(fn) { try { fn(); } catch (e) { try { K.dbg.e++; K.dbg.last = (e && e.message) ? e.message : String(e); } catch (x) { } } }
  function plist() {
    var g = C.game;
    if (!g || !g.players) return null;
    var l = g.players.list;
    return (l && typeof l.length === 'number') ? l : null;
  }
  function listPlayers() {
    var l = plist();
    if (!l) return [];
    var out = [];
    for (var i = 0; i < l.length; i++) if (l[i]) out.push(l[i]);
    return out;
  }

  var KRU_STORES = {};
  var KRU_DEFINE_FAILED = {};
  function defineProto(name, onSet) {
    safe(function () {
      var key = '__kru_' + name;
      var st = null;
      try { st = (typeof WeakMap === 'function') ? (KRU_STORES[name] || (KRU_STORES[name] = new WeakMap())) : null; } catch (e) { }
      try {
        Object.defineProperty(Object.prototype, name, {
          configurable: true,
          enumerable: false,
          get: function () {
            try { if (st && st.has(this)) return st.get(this); } catch (e) { }
            return this[key];
          },
          set: function (v) {
            try { if (st) st.set(this, v); } catch (e) { }
            safe(function () { Object.defineProperty(this, key, { value: v, writable: true, configurable: true, enumerable: false }); }.bind(this));
            safe(function () { onSet.call(this, v); }.bind(this));
            safe(function () {
              var s = this;
              if (s && s.players && s.players.list && typeof s.players.list.length === 'number') {
                C.gameCand = s;
                if (!C.game) C.game = s;
                validate();
              }
            }.bind(this));
          }
        });
        delete KRU_DEFINE_FAILED[name];
      } catch (e) {
        KRU_DEFINE_FAILED[name] = true;
      }
    });
  }

  // Fallback adoption when Object.prototype is frozen and defineProto could not install setters.
  function kruAdoptFromWindow() {
    if (C.ready) return;
    try {
      var names = Object.getOwnPropertyNames(window);
      for (var i = 0; i < names.length; i++) {
        try { var o = window[names[i]]; } catch (e) { continue; }
        if (!o || (typeof o !== 'object' && typeof o !== 'function')) continue;
        if (o === window || o.nodeType) continue;
        safe(function () {
          if (!C.game && o.players && o.players.list && typeof o.players.list.length === 'number') {
            C.gameCand = o;
            if (!C.game) C.game = o;
            validate();
          }
          if (!C.controls && o.keys && (o.binds || o.object)) {
            C.controlsCand = o;
            if (!C.controls) C.controls = o;
            validate();
          }
          if (!C.renderer && o.camera && o.camera.matrixWorldInverse && o.camera.projectionMatrix) {
            C.rendererCand = o;
            if (!C.renderer) C.renderer = o;
            validate();
          }
          if (!C.me && o.isYou && typeof o.x === 'number' && typeof o.health === 'number') {
            if (!C.me) C.me = o;
            validate();
          }
        });
        if (C.ready) break;
      }
    } catch (e) { }
  }

  function hookRenderOn(obj) {
    if (!obj || obj.__kruRenderHooked) return;
    var existing;
    safe(function () { existing = obj.render; });
    if (isFn(existing) && existing.__kru) return;
    var cur;
    function wrap(fn) {
      if (!isFn(fn) || fn.__kru) return fn;
      var wrapped = function () {
        var a = arguments;
        safe(function () { adopt(a[0], a[1], a[2], a[3], a[4]); });
        var r = fn.apply(this, arguments);
        safe(frame);
        return r;
      };
      wrapped.__kru = true;
      return wrapped;
    }
    safe(function () {
      Object.defineProperty(obj, 'render', {
        configurable: true,
        enumerable: false,
        get: function () { return cur; },
        set: function (fn) { cur = wrap(fn); }
      });
      obj.__kruRenderHooked = true;
      if (isFn(existing)) cur = wrap(existing);
    });
  }

  function adopt(scale, game, controls, renderer, me) {
    if (game && game.players && typeof game.players.list !== 'undefined') { C.game = game; C.by = 'render'; }
    if (controls && (controls.keys || controls.binds)) C.controls = controls;
    if (renderer && renderer.camera) C.renderer = renderer;
    if (me) C.me = me;
    if (scale) C.scale = scale;
    validate();
  }

  function hydrate() {
    var g = C.game;
    if (!g) return;
    var ks;
    try { ks = Object.getOwnPropertyNames(g); } catch (e) { return; }
    if (!ks || ks.length > 400) return;
    for (var i = 0; i < ks.length; i++) {
      var v;
      try { v = g[ks[i]]; } catch (e) { continue; }
      if (!v || (typeof v !== 'object' && typeof v !== 'function')) continue;
      if (!C.renderer && v.camera && v.camera.matrixWorldInverse) C.renderer = v;
      if (!C.controls && (v.keys || v.binds)) C.controls = v;
      if (C.renderer && C.controls) break;
    }
  }

  function validate() {
    if (C.game && !(C.game.players && typeof C.game.players.list !== 'undefined')) {
      try {
        K.dbg.nullWhy = { had: !!C.gameCand, same: C.game === C.gameCand,
          pl: (function () { try { return typeof C.game.players; } catch (e) { return 'throw'; } })(),
          lst: (function () { try { var p = C.game.players; return p ? typeof p.list : 'noplayer'; } catch (e) { return 'throw'; } })(),
          own: (function () { try { return Object.getOwnPropertyNames(C.game).slice(0, 8).join(','); } catch (e) { return 'throw'; } })(),
          wm: (function () { try { return KRU_STORES.players ? KRU_STORES.players.has(C.game) : 'nostore'; } catch (e) { return 'throw'; } })() };
      } catch (e) { }
      C.game = null;
    }
    if (!C.game && C.gameCand && C.gameCand.players && typeof C.gameCand.players.list !== 'undefined') C.game = C.gameCand;
    if (C.game) {
      var l = plist();
      if (l) {
        var found = null;
        for (var i = 0; i < l.length; i++) { if (l[i] && l[i].isYou) { found = l[i]; break; } }
        if (found && found !== C.me) C.me = found;
      }
    }
    if ((!C.renderer || !C.renderer.camera) && C.game && C.game.renderer && C.game.renderer.camera) C.renderer = C.game.renderer;
    if ((!C.controls || !(C.controls.keys || C.controls.binds)) && C.game && C.game.controls && (C.game.controls.keys || C.game.controls.binds)) C.controls = C.game.controls;
    if ((!C.controls || !(C.controls.keys || C.controls.binds)) && C.controlsCand && (C.controlsCand.keys || C.controlsCand.binds)) C.controls = C.controlsCand;
    if ((!C.renderer || !C.renderer.camera) && C.rendererCand && C.rendererCand.camera) C.renderer = C.rendererCand;
    if (C.game && (!C.renderer || !C.controls)) safe(hydrate);
    if (C.game && C.me && C.renderer && !C.ready) { C.ready = true; ensureProcHook(); refreshStatus(); }
    if (C.game && !C.ready) refreshStatus();
  }

  function adoptIfGame(o) {
    try {
      if (o && typeof o === 'object' && o.players && o.players.list && typeof o.players.list.length === 'number') {
        C.gameCand = o;
        if (!C.game) C.game = o;
        validate();
      }
    } catch (e) { }
  }

  function installLateFallback() {
    var names = ['hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', 'toString', 'valueOf'];
    for (var i = 0; i < names.length; i++) {
      (function (n) {
        var fn;
        try { fn = Object.prototype[n]; } catch (e) { return; }
        if (typeof fn !== 'function') return;
        try {
          Object.defineProperty(Object.prototype, n, {
            value: function () { adoptIfGame(this); return fn.apply(this, arguments); },
            writable: true, configurable: true, enumerable: false
          });
        } catch (e) { }
      })(names[i]);
    }
  }

  function installHooks() {
    defineProto('canvas', function (v) {
      if (v && v.id === 'game-overlay') {
        C.overlay = this;
        safe(function () { C.ctx = v.getContext('2d'); });
        hookRenderOn(this);
      }
    });
    defineProto('players', function (v) {
      if (v && typeof v.list !== 'undefined' && v.list && typeof v.list.length === 'number') C.gameCand = this;
      validate();
    });
    defineProto('renderer', function (v) { if (v && v.camera) { C.rendererCand = v; validate(); } });
    defineProto('controls', function (v) { if (v && (v.keys || v.binds)) { C.controlsCand = v; validate(); } });
    safe(installLateFallback);
    safe(function () {
      var g = document.getElementById('game-overlay');
      if (g) { C.overlay = C.overlay || {}; C.ctx = C.ctx || g.getContext('2d'); }
    });
  }

  function ensureProcHook() {
    var me = C.me;
    if (!me || !isFn(me.procInputs) || me.procInputs.__kru) return;
    var orig = me.procInputs;
    var wrapped = function (pk) {
      safe(function () { onPacket(pk); });
      return orig.apply(this, arguments);
    };
    wrapped.__kru = true;
    safe(function () { me.procInputs = wrapped; });
  }

  function effH(p) {
    var h = (typeof p.height === 'number' && p.height > 0) ? p.height : 11;
    return h - (p.crouchVal || 0) * 3;
  }
  function halfW() { return 2; }

  function cam() {
    if (C.renderer && C.renderer.camera) return C.renderer.camera;
    if (C.renderer && C.renderer.fpsCamera) return C.renderer.fpsCamera;
    return null;
  }
  function vpSize() {
    if (C.overlay && C.overlay.canvas) return { w: C.overlay.canvas.width, h: C.overlay.canvas.height };
    return { w: window.innerWidth || 1280, h: window.innerHeight || 720 };
  }

  function w2s(x, y, z) {
    var c = cam();
    if (!c || !c.matrixWorldInverse || !c.projectionMatrix) return null;
    var vm = c.matrixWorldInverse.elements, pm = c.projectionMatrix.elements;
    if (!vm || !pm) return null;
    var vx = vm[0] * x + vm[4] * y + vm[8] * z + vm[12];
    var vy = vm[1] * x + vm[5] * y + vm[9] * z + vm[13];
    var vz = vm[2] * x + vm[6] * y + vm[10] * z + vm[14];
    var cx = pm[0] * vx + pm[4] * vy + pm[8] * vz + pm[12];
    var cy = pm[1] * vx + pm[5] * vy + pm[9] * vz + pm[13];
    var cw = pm[3] * vx + pm[7] * vy + pm[11] * vz + pm[15];
    if (!cw) return null;
    var nx = cx / cw, ny = cy / cw;
    if (cw <= 0 || nx < -1.05 || nx > 1.05 || ny < -1.05 || ny > 1.05) return null;
    var s = vpSize();
    return { x: (nx + 1) / 2 * s.w, y: (1 - ny) / 2 * s.h };
  }

  function isTeammate(p) {
    var me = C.me;
    if (!me || !p) return false;
    return !!(me.team && p.team === me.team);
  }
  function validEnemy(p) {
    if (!p || p === C.me || p.isYou) return false;
    if (p.active === false) return false;
    if (typeof p.health === 'number' && p.health <= 0) return false;
    if (p.dead === true) return false;
    if (S.teamCheck && isTeammate(p)) return false;
    return true;
  }

  function pickTarget(needCenter) {
    var list = plist();
    if (!list) return null;
    var me = C.me;
    if (!me) return null;
    var s = vpSize(), cx = s.w / 2, cy = s.h / 2;
    var r = Math.max(5, Math.min(100, S.aimFov || 45)) / 100;
    var r2 = r * r;
    var inner = needCenter ? r2 * 0.22 : r2;
    var best = null, bestD = Infinity;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!validEnemy(p)) continue;
      var mid = p.y + effH(p) * 0.55;
      var sp = w2s(p.x, mid, p.z);
      if (!sp) continue;
      var ax = (sp.x - cx) / (cx || 1), ay = (sp.y - cy) / (cy || 1);
      var d = ax * ax + ay * ay;
      if (d > r2) continue;
      if (needCenter && d > inner) continue;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  function onPacket(pk) {
    if (!pk || typeof pk.length !== 'number') return;
    var me = C.me;
    if (!me) return;
    var target = null;
    if (S.aimbot || S.autofire) target = pickTarget(false);
    if (S.aimbot && target) {
      var predX = target.x, predZ = target.z;
      var targetY = target.y - (target.crouchVal || 0) * 3 + (me.crouchVal || 0) * 3 + (S.aimOffset || 0);
      var yDire = Math.atan2(me.x - predX, me.z - predZ);
      var dx = predX - me.x, dy = targetY - me.y, dz = predZ - me.z;
      var dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      var asin = Math.asin(Math.max(-1, Math.min(1, dy / dist)));
      var xDire = asin - 0.3 * (me.recoilAnimY || 0);
      if (!isFinite(xDire)) xDire = isFinite(me.xDire) ? me.xDire : 0;
      if (!isFinite(yDire)) yDire = isFinite(me.yDire) ? me.yDire : 0;
      pk[IDX.xdir] = xDire * 1000;
      pk[IDX.ydir] = yDire * 1000;
      safe(function () { lookDir(xDire, yDire); });
    }
    if (S.autofire) {
      var t = target || pickTarget(true);
      if (t && (typeof me.reloadTimer !== 'number' || me.reloadTimer === 0)) pk[IDX.shoot] = 1;
      if (!t && !C.ready) synthFire();
    }
  }

  function lookDir(xDire, yDire) {
    var c = C.controls;
    if (!c) return;
    var pitch = (c.pchObjc && c.pchObjc.rotation) ? c.pchObjc : findPitch(c);
    if (c.object && c.object.rotation) c.object.rotation.y = yDire;
    if (pitch && pitch.rotation) pitch.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, xDire));
    if (typeof c.xDr === 'number') c.xDr = yDire;
    if (typeof c.yDr === 'number') c.yDr = xDire;
    if (C.renderer && C.renderer.camera && C.renderer.camera.updateProjectionMatrix) C.renderer.camera.updateProjectionMatrix();
    if (C.renderer && typeof C.renderer.updateFrustum === 'function') safe(function () { C.renderer.updateFrustum(); });
  }

  function findPitch(c) {
    if (c.__kruPitch) return c.__kruPitch;
    var keys;
    safe(function () { keys = Object.keys(c); });
    if (!keys) return null;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = null;
      safe(function () { v = c[k]; });
      if (v && v !== c && v !== c.object && v.rotation &&
        typeof v.rotation.x === 'number' && typeof v.rotation.y === 'number' &&
        typeof v.rotation.z === 'number') {
        safe(function () { c.__kruPitch = v; });
        return v;
      }
    }
    return null;
  }

  var lastSynth = 0;
  function synthFire() {
    var now = Date.now();
    if (now - lastSynth < 90) return;
    lastSynth = now;
    safe(function () {
      var el = document.getElementById('mainCanvas') || document.querySelector('canvas') || document.body;
      var opt = { bubbles: true, cancelable: true, button: 0, clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 };
      el.dispatchEvent(new MouseEvent('mousedown', opt));
      setTimeout(function () { safe(function () { el.dispatchEvent(new MouseEvent('mouseup', opt)); }); }, 30);
      el.dispatchEvent(new PointerEvent('pointerdown', opt));
      setTimeout(function () { safe(function () { el.dispatchEvent(new PointerEvent('pointerup', opt)); }); }, 30);
    });
  }

  function frame() {
    validate();
    var me = C.me;
    ensureProcHook();
    if (S.bhop && C.controls && C.controls.binds && C.controls.binds.jump && C.controls.keys) {
      safe(function () {
        var k = C.controls.binds.jump.val;
        if (C.spaceDown || C.controls.keys[k]) {
          C.controls.keys[k] = C.controls.keys[k] ? 0 : 1;
          if (C.controls.keys[k]) C.controls.didPressed[k] = 1;
        }
      });
    }
    if (S.autorun && C.controls && C.controls.binds && C.controls.binds.move && C.controls.keys) {
      safe(function () {
        var f = C.controls.binds.move[0];
        if (f && typeof f.val === 'number') { C.controls.keys[f.val] = 1; }
      });
    }
    if (S.god && me) {
      safe(function () {
        if (typeof me.maxHealth === 'number' && me.maxHealth > 0) {
          if (typeof me.__kruMax !== 'number' || me.maxHealth > me.__kruMax) me.__kruMax = me.maxHealth;
        } else if (typeof me.health === 'number' && me.health > 0 && (typeof me.__kruMax !== 'number' || me.health > me.__kruMax)) {
          me.__kruMax = me.health;
        }
        if (typeof me.__kruMax === 'number' && typeof me.health === 'number' && me.health < me.__kruMax) me.health = me.__kruMax;
      });
    }
    safe(fovTick);
    safe(thirdTick);
    safe(chamsTick);
    safe(wireTick);
    safe(espTick);
  }
  K.kruFrame = frame;

  function fovTick() {
    var c = cam();
    if (!c || typeof c.fov !== 'number') return;
    var want = FOVS[S.fovIdx] || 0;
    if (want === 0) {
      if (C.fovApplied > 0 && typeof C.baseFov === 'number' && c.fov !== C.baseFov) {
        c.fov = C.baseFov;
        if (c.updateProjectionMatrix) c.updateProjectionMatrix();
      }
      C.fovApplied = -1;
      return;
    }
    var adsFree = !C.me || typeof C.me.aimVal !== 'number' || C.me.aimVal >= 1;
    if (!adsFree) return;
    if (typeof C.baseFov !== 'number') C.baseFov = c.fov;
    if (C.fovApplied === want && c.fov === want) return;
    if (c.updateProjectionMatrix) {
      c.fov = want;
      c.updateProjectionMatrix();
      C.fovApplied = want;
    }
  }

  function thirdTick() {
    var c = cam();
    if (!c || !c.position) return;
    if (!S.third) {
      if (C.thirdOn && C.baseCam) { c.position.x = C.baseCam.x; c.position.y = C.baseCam.y; c.position.z = C.baseCam.z; }
      C.thirdOn = false;
      return;
    }
    if (!C.thirdOn || !C.baseCam) {
      C.baseCam = { x: c.position.x, y: c.position.y, z: c.position.z };
      C.thirdOn = true;
    }
    c.position.z = C.baseCam.z + 16;
    c.position.y = C.baseCam.y + 4;
  }

  function paint(o, color, depthOff) {
    if (!o || !isFn(o.traverse)) return;
    o.traverse(function (n) {
      if (!n || !n.material) return;
      var ms = Array.isArray(n.material) ? n.material : [n.material];
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        if (!m) continue;
        if (m.__kruOrig === undefined) m.__kruOrig = { c: null, d: m.depthTest, o: m.opacity, t: m.transparent };
        if (m.__kruOrig.c === null && m.color) m.__kruOrig.c = m.color.getHexString ? m.color.getHexString() : null;
        if (color && m.color && m.color.set) m.color.set(color);
        if (depthOff) { m.depthTest = false; m.transparent = true; m.opacity = 0.9; }
        m.needsUpdate = true;
      }
    });
  }

  function restore(o) {
    if (!o || !isFn(o.traverse)) return;
    o.traverse(function (n) {
      if (!n || !n.material) return;
      var ms = Array.isArray(n.material) ? n.material : [n.material];
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        if (!m || !m.__kruOrig) continue;
        if (m.__kruOrig.c !== null && m.color && m.color.set) m.color.set('#' + m.__kruOrig.c);
        m.depthTest = m.__kruOrig.d;
        m.opacity = m.__kruOrig.o;
        m.transparent = m.__kruOrig.t;
        m.needsUpdate = true;
      }
    });
  }

  function chamsTick() {
    var list = listPlayers();
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p || !p.objInstances) continue;
      if (S.chams) paint(p.objInstances, isTeammate(p) ? '#39ff14' : '#ff2b2b', true);
      else restore(p.objInstances);
    }
  }

  function wireTick() {
    var sc = C.renderer && C.renderer.scene;
    if (!sc || !isFn(sc.traverse)) return;
    sc.traverse(function (n) {
      if (!n || !n.material || n.type !== 'Mesh') return;
      var ms = Array.isArray(n.material) ? n.material : [n.material];
      for (var i = 0; i < ms.length; i++) if (ms[i]) ms[i].wireframe = !!S.wireframe;
    });
  }

  var espBox = null, espLine = null, espBuilt = false;
  function ensureEsp() {
    var host = document.getElementById('kru-esp');
    if (!host || !document.body.contains(host)) {
      host = document.createElement('div');
      host.id = 'kru-esp';
      host.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:2147483646;overflow:hidden;';
      (document.body || document.documentElement).appendChild(host);
    }
    espBox = host;
    espBuilt = true;
  }

  function espTick() {
    ensureEsp();
    if (!S.espBox && !S.espTracer) { if (espBox) espBox.innerHTML = ''; return; }
    var list = listPlayers();
    var me = C.me;
    var s = vpSize();
    var boxes = [];
    var lines = [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p || p === me || p.isYou) continue;
      if (p.active === false) continue;
      if (typeof p.health === 'number' && p.health <= 0) continue;
      if (S.teamCheck && isTeammate(p)) continue;
      var hw = halfW(), eh = effH(p);
      var pts = [
        w2s(p.x - hw, p.y, p.z - hw), w2s(p.x + hw, p.y, p.z - hw),
        w2s(p.x - hw, p.y, p.z + hw), w2s(p.x + hw, p.y, p.z + hw),
        w2s(p.x - hw, p.y + eh, p.z - hw), w2s(p.x + hw, p.y + eh, p.z - hw),
        w2s(p.x - hw, p.y + eh, p.z + hw), w2s(p.x + hw, p.y + eh, p.z + hw)
      ];
      var xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity, on = false;
      for (var j = 0; j < 8; j++) {
        var q = pts[j];
        if (!q) continue;
        on = true;
        if (q.x < xmin) xmin = q.x;
        if (q.x > xmax) xmax = q.x;
        if (q.y < ymin) ymin = q.y;
        if (q.y > ymax) ymax = q.y;
      }
      if (!on) continue;
      if (xmin < 0) xmin = 0;
      if (ymin < 0) ymin = 0;
      if (xmax > s.w) xmax = s.w;
      if (ymax > s.h) ymax = s.h;
      if (xmax - xmin < 2) continue;
      if (ymax - ymin < 2) continue;
      var hp = (typeof p.health === 'number' && typeof p.maxHealth === 'number' && p.maxHealth > 0) ? Math.max(0, Math.min(1, p.health / p.maxHealth)) : null;
      var col = '#ff2b2b';
      if (hp !== null) col = hp > 0.66 ? '#ff2b2b' : (hp > 0.33 ? '#ff9e2b' : '#ff2b64');
      if (S.espBox) {
        boxes.push('<div style="position:absolute;left:' + xmin.toFixed(1) + 'px;top:' + ymin.toFixed(1) + 'px;width:' + (xmax - xmin).toFixed(1) + 'px;height:' + (ymax - ymin).toFixed(1) + 'px;border:1.5px solid ' + col + ';box-shadow:0 0 4px rgba(0,0,0,.85);"></div>');
        if (hp !== null) {
          boxes.push('<div style="position:absolute;left:' + (xmin - 7).toFixed(1) + 'px;top:' + ymin.toFixed(1) + 'px;width:4px;height:' + (ymax - ymin).toFixed(1) + 'px;background:rgba(0,0,0,.55);"></div>');
          var hh = ((ymax - ymin) * hp);
          var hy = ymax - hh;
          boxes.push('<div style="position:absolute;left:' + (xmin - 7).toFixed(1) + 'px;top:' + hy.toFixed(1) + 'px;width:4px;height:' + hh.toFixed(1) + 'px;background:' + (hp > 0.66 ? '#39ff14' : (hp > 0.33 ? '#ffcf39' : '#ff2b2b')) + ';"></div>');
        }
        var nm = p.name ? String(p.name) : '';
        var meta = '';
        if (me) {
          var d = Math.sqrt((p.x - me.x) * (p.x - me.x) + (p.y - me.y) * (p.y - me.y) + (p.z - me.z) * (p.z - me.z)) / 10;
          meta = ' [' + Math.round(d) + 'm]';
        }
        var label = nm + (typeof p.health === 'number' ? ' ' + Math.round(p.health) + 'hp' : '') + meta;
        var ly = ymax + 4;
        if (ly > s.h - 14) ly = ymin - 16;
        boxes.push('<div style="position:absolute;left:' + ((xmin + xmax) / 2).toFixed(1) + 'px;top:' + ly.toFixed(1) + 'px;transform:translateX(-50%);font:600 11px system-ui,sans-serif;color:#fff;text-shadow:0 0 3px #000,0 0 3px #000;white-space:nowrap;">' + label + '</div>');
      }
      if (S.espTracer) {
        lines.push('<line x1="' + (s.w / 2) + '" y1="' + s.h + '" x2="' + ((xmin + xmax) / 2).toFixed(1) + '" y2="' + ((ymin + ymax) / 2).toFixed(1) + '" stroke="' + col + '" stroke-width="1.5" opacity="0.75"/>');
      }
    }
    var svg = '';
    if (lines.length) {
      svg = '<svg style="position:absolute;left:0;top:0;width:100%;height:100%;" xmlns="http://www.w3.org/2000/svg">' + lines.join('') + '</svg>';
    }
    if (espBox) espBox.innerHTML = svg + boxes.join('');
  }

function kruFindRendererFromGL(gl) {
  try {
    if (!gl) return;
    if (C.renderer && C.renderer.camera) return;
    var names = Object.getOwnPropertyNames(window);
    for (var i = 0; i < names.length; i++) {
      try {
        var o = window[names[i]];
        if (!o || (typeof o !== 'object' && typeof o !== 'function')) continue;
        if (o === window || o.nodeType) continue;
        if (o.context === gl && o.camera && o.camera.matrixWorldInverse && o.camera.projectionMatrix) {
          if (!C.renderer) { C.renderer = o; validate(); return; }
        }
        var ks = Object.getOwnPropertyNames(o);
        for (var j = 0; j < Math.min(ks.length, 40); j++) {
          try {
            var v = o[ks[j]];
            if (v && v !== o && v.context === gl && v.camera && v.camera.matrixWorldInverse) {
              if (!C.renderer) { C.renderer = v; validate(); return; }
            }
          } catch (e) { }
        }
      } catch (e) { }
    }
  } catch (e) { }
}

function kruHookWebGL() {
  try {
    var protos = [];
    if (typeof WebGLRenderingContext !== 'undefined') protos.push(WebGLRenderingContext.prototype);
    if (typeof WebGL2RenderingContext !== 'undefined') protos.push(WebGL2RenderingContext.prototype);
    for (var pi = 0; pi < protos.length; pi++) {
      var p = protos[pi];
      if (!p || p.__kruGLHooked) continue;
      var names = ['getUniformLocation','uniformMatrix4fv','drawArrays','drawElements','useProgram','createProgram'];
      for (var hi = 0; hi < names.length; hi++) {
        (function(proto, name){
          var orig = proto[name];
          if (!orig || orig.__kru) return;
          proto[name] = function() {
            try {
              if (!C.renderer || !C.renderer.camera) {
                kruFindRendererFromGL(this);
              }
            } catch (e) { }
            return orig.apply(this, arguments);
          };
          proto[name].__kru = true;
        })(p, names[hi]);
      }
      p.__kruGLHooked = true;
    }
  } catch (e) { }
}

function kruHookCanvasLate() {
  try {
    var orig = HTMLCanvasElement.prototype.getContext;
    if (orig && !orig.__kruCanvasHooked) {
      HTMLCanvasElement.prototype.getContext = function(type, attrs) {
        var ctx = orig.call(this, type, attrs);
        if ((type === 'webgl' || type === 'webgl2') && ctx) {
          try { kruFindRendererFromGL(ctx); } catch (e) { }
          try {
            if (!C.overlay && this.id === 'game-overlay') {
              C.overlay = this;
              C.ctx = ctx;
              safe(function() { hookRenderOn(this); });
            }
          } catch (e) { }
        }
        return ctx;
      };
      orig.__kruCanvasHooked = true;
    }
  } catch (e) { }
}

function kruAcquireLate() {
  if (C.ready) return;
  safe(kruAdoptFromWindow);
  safe(kruHookWebGL);
  safe(kruHookCanvasLate);
  try {
    var ge = document.getElementById('game-overlay');
    if (ge && !C.overlay) {
      C.overlay = ge;
      try { C.ctx = ge.getContext('2d'); } catch (e) { }
      safe(function() { hookRenderOn(ge); });
      var gl = ge.getContext('webgl') || ge.getContext('webgl2');
      if (gl) safe(function() { kruFindRendererFromGL(gl); });
    }
  } catch (e) { }
  safe(validate);
}

  function resolveScan() {
    if (C.game && C.ready) return;
    var names;
    try { names = Object.getOwnPropertyNames(window); } catch (e) { return; }
    var ge = null;
    try { ge = document.getElementById('game-overlay'); } catch (e) { }
    var game = null, owner = null, n = 0, i, j, o, ks, v;
    function test(x) {
      if (!x || (typeof x !== 'object' && typeof x !== 'function')) return;
      n++;
      try { if (!game && x.players && x.players.list && typeof x.players.list.length === 'number') game = x; } catch (e) { }
      try { if (ge && !owner && x.canvas === ge) owner = x; } catch (e) { }
    }
    for (i = 0; i < names.length; i++) {
      try { o = window[names[i]]; } catch (e) { continue; }
      test(o);
      if (game && owner) break;
    }
    if (!(game && owner)) {
      var budget = 6000;
      for (i = 0; i < names.length && budget > 0; i++) {
        try { o = window[names[i]]; } catch (e) { continue; }
        if (!o) continue;
        var ot = typeof o;
        if (ot !== 'object' && ot !== 'function') continue;
        try { if (o === window || o.nodeType) continue; } catch (e) { continue; }
        try { ks = Object.getOwnPropertyNames(o); } catch (e) { continue; }
        if (ks.length > 300) continue;
        for (j = 0; j < ks.length && budget > 0; j++) {
          try { v = o[ks[j]]; } catch (e) { continue; }
          budget--;
          test(v);
          if (game && owner) break;
        }
      }
    }
    C.scanN = n;
    if (game) { C.gameCand = game; if (!C.game) C.game = game; }
    if (owner && owner !== C.overlay) {
      C.overlay = owner;
      try { C.ctx = owner.canvas.getContext('2d'); } catch (e) { }
      safe(function () { hookRenderOn(owner); });
    }
    if (game || owner) { C.scanHit = 1; validate(); }
    else C.scanHit = 0;
  }

  function refreshStatus() {
    var el = document.getElementById('kru-status');
    if (!el) return;
    var l = plist();
    var protoOK = true; try { protoOK = Object.isExtensible(Object.prototype); } catch (e) { protoOK = true; }
    el.textContent = 'proto:' + (protoOK ? 'OK' : 'FROZEN') + ' · game:' + (C.game ? 'OK' : 'wait') + ' · me:' + (C.me ? 'OK' : 'wait') + ' · render:' + (C.renderer ? 'OK' : 'wait') + ' · ctrls:' + (C.controls ? 'OK' : 'wait') + ' · players:' + (l ? l.length : 0) + ' · scan:' + (C.scanHit ? 'hit' : (C.scanN || 0));
  }

  var menuEl = null, bodyEl = null;
  function buildMenu() {
    if (menuEl && document.body.contains(menuEl)) return;
    var old = document.getElementById('kru-menu');
    if (old) old.parentNode.removeChild(old);
    var m = document.createElement('div');
    m.id = 'kru-menu';
    m.style.cssText = 'position:fixed;left:10px;top:10px;width:152px;background:rgba(10,9,14,.93);border:1px solid rgba(255,120,180,.38);border-radius:8px;font:10px/1.35 system-ui,-apple-system,sans-serif;color:#f2e9f5;z-index:2147483647;box-shadow:0 6px 18px rgba(0,0,0,.5);backdrop-filter:blur(6px);user-select:none;pointer-events:auto;touch-action:manipulation;-webkit-tap-highlight-color:transparent;';
    var h = document.createElement('div');
    h.id = 'kru-head';
    h.style.cssText = 'display:flex;align-items:center;gap:5px;padding:4px 6px;cursor:move;border-bottom:1px solid rgba(255,120,180,.25);border-radius:8px 8px 0 0;background:linear-gradient(180deg,rgba(255,110,170,.2),rgba(255,110,170,.04));';
    h.innerHTML = '<span style="font-weight:700;font-size:10px;letter-spacing:.2px;">🦊 Yukakoo</span><span id="kru-v" style="opacity:.5;font-size:8px;">v9</span>';
    var minBtn = document.createElement('button');
    minBtn.id = 'kru-min';
    minBtn.textContent = '—';
    minBtn.title = 'Minimize';
    minBtn.style.cssText = 'margin-left:auto;width:18px;height:15px;border-radius:4px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.07);color:#ffd9ea;font:700 10px/1 system-ui;cursor:pointer;padding:0;';
    h.appendChild(minBtn);
    m.appendChild(h);

    var b = document.createElement('div');
    b.id = 'kru-body';
    b.style.cssText = 'padding:5px 6px 6px;';
    var items = [
      ['aimbot', 'Aim'], ['autofire', 'Fire'], ['teamCheck', 'Team'],
      ['espBox', 'Box'], ['espTracer', 'Line'], ['chams', 'Cham'],
      ['wireframe', 'Wire'], ['god', 'God'], ['bhop', 'Bhop'],
      ['autorun', 'Run'], ['third', '3rd']
    ];
    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px;';
    items.forEach(function (it) {
      var btn = document.createElement('button');
      btn.className = 'kru-t';
      btn.dataset.k = it[0];
      btn.textContent = it[1];
      btn.title = it[1];
      btn.style.cssText = 'padding:4px 2px;border-radius:4px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#e8dcea;font:600 9px system-ui;cursor:pointer;text-align:center;transition:.12s;';
      grid.appendChild(btn);
    });
    b.appendChild(grid);

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:4px;margin-top:5px;min-width:0;overflow:hidden;';
    row.innerHTML = '<label style="flex:1 1 0;min-width:0;font-size:9px;opacity:.75;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">AimFov</label>';
    var fovIn = document.createElement('input');
    fovIn.type = 'range'; fovIn.min = 10; fovIn.max = 160; fovIn.step = 5; fovIn.value = S.aimFov;
    fovIn.style.cssText = 'flex:1 1 0;min-width:0;width:0;accent-color:#ff6eaa;height:14px;margin:0;';
    var fovVal = document.createElement('span');
    fovVal.style.cssText = 'flex:none;width:20px;text-align:right;font-size:9px;';
    fovVal.textContent = S.aimFov;
    fovIn.oninput = function () { S.aimFov = +fovIn.value; fovVal.textContent = fovIn.value; };
    row.appendChild(fovIn); row.appendChild(fovVal);
    b.appendChild(row);

    var row2 = document.createElement('div');
    row2.style.cssText = 'display:flex;align-items:center;gap:4px;margin-top:4px;min-width:0;overflow:hidden;';
    row2.innerHTML = '<label style="flex:1 1 0;min-width:0;font-size:9px;opacity:.75;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">ScreenFOV</label>';
    var fovBtn = document.createElement('button');
    fovBtn.id = 'kru-fovcycle';
    fovBtn.style.cssText = 'flex:none;min-width:46px;padding:2px 4px;border-radius:4px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#ffd9ea;font:600 9px system-ui;cursor:pointer;';
    row2.appendChild(fovBtn);
    b.appendChild(row2);

    var st = document.createElement('div');
    st.id = 'kru-status';
    st.style.cssText = 'margin-top:5px;font-size:8px;opacity:.55;word-break:break-all;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    b.appendChild(st);

    var hint = document.createElement('div');
    hint.style.cssText = 'margin-top:3px;font-size:8px;opacity:.4;';
    hint.textContent = '1-9 · 0 fov · Ins minimize';
    b.appendChild(hint);

    m.appendChild(b);
    (document.body || document.documentElement).appendChild(m);
    menuEl = m; bodyEl = b;
    paintMenu();
    wireMenu();
    refreshStatus();
  }

  function paintMenu() {
    var btns = document.querySelectorAll('#kru-menu .kru-t');
    for (var i = 0; i < btns.length; i++) {
      var k = btns[i].dataset.k;
      var on = !!S[k];
      btns[i].style.background = on ? 'linear-gradient(90deg,rgba(255,110,170,.4),rgba(255,110,170,.16))' : 'rgba(255,255,255,.05)';
      btns[i].style.borderColor = on ? 'rgba(255,140,190,.7)' : 'rgba(255,255,255,.16)';
      btns[i].style.color = on ? '#fff0f7' : '#c9bed1';
      btns[i].style.boxShadow = on ? '0 0 8px rgba(255,110,170,.3)' : 'none';
    }
    var f = document.getElementById('kru-fovcycle');
    if (f) f.textContent = FOVS[S.fovIdx] === 0 ? 'Default' : FOVS[S.fovIdx] + '°';
    if (menuEl) { menuEl.style.width = S.min ? 'auto' : '152px'; menuEl.style.padding = '0'; menuEl.style.minWidth = S.min ? '0' : ''; }
    if (bodyEl) bodyEl.style.display = S.min ? 'none' : 'block';
    var mb = document.getElementById('kru-min');
    if (mb) mb.textContent = S.min ? '▢' : '—';
    try { localStorage.setItem('kru_min', S.min ? '1' : '0'); } catch (e) { }
  }

  function toggle(k) { S[k] = !S[k]; paintMenu(); }

  var kruGuardOn = false;
  function kruXY(ev) {
    if (ev && typeof ev.clientX === 'number' && (ev.clientX || ev.clientY)) return [ev.clientX, ev.clientY];
    var t = ev && ((ev.touches && ev.touches[0]) || (ev.changedTouches && ev.changedTouches[0]));
    return t ? [t.clientX, t.clientY] : null;
  }
  function kruPick(x, y) {
    if (!menuEl || !document.body.contains(menuEl)) return null;
    var r = menuEl.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
    var all = menuEl.querySelectorAll('*');
    var best = null, bestA = Infinity;
    for (var i = 0; i < all.length; i++) {
      var b = all[i].getBoundingClientRect();
      if (!b.width || !b.height) continue;
      if (x < b.left || x > b.right || y < b.top || y > b.bottom) continue;
      var a = b.width * b.height;
      if (a < bestA) { bestA = a; best = all[i]; }
    }
    return best || menuEl;
  }
  function kruGameSwallow() {
    try {
      var c = C.controls;
      if (!c || !c.enabled) return false;
      if (window.locked || window.noMouseInp) return false;
      return true;
    } catch (e) { return false; }
  }
  function kruGuard(ev) {
    try {
      if (!menuEl || !document.body.contains(menuEl)) return;
      var xy = kruXY(ev);
      if (!xy) return;
      K.dbg.t++;
      var el = kruPick(xy[0], xy[1]);
      if (!el) return;
      var ours = !!(ev.target && ev.target.closest && ev.target.closest('#kru-menu'));
      if (ours && !kruGameSwallow()) return;
      ev.stopPropagation();
      if (ev.type !== 'click') return;
      var host = null, fn = null, cur = el;
      while (cur) {
        if (typeof cur.onclick === 'function') { host = cur; fn = cur.onclick; break; }
        if (cur === menuEl) break;
        cur = cur.parentNode;
      }
      if (!fn) return;
      K.dbg.f++;
      fn.call(host, {
        type: 'click', clientX: xy[0], clientY: xy[1], button: 0, buttons: 1,
        detail: 1, isTrusted: false, view: window, target: host, currentTarget: host,
        stopPropagation: function () { }, stopImmediatePropagation: function () { },
        preventDefault: function () { }, preventDefault: function () { }
      });
    } catch (e) { }
  }
  function kruInstallGuard() {
    if (kruGuardOn) return;
    kruGuardOn = true;
    K.dbg.g = 1;
    var evs = ['pointerdown', 'mousedown', 'touchstart', 'click'];
    for (var i = 0; i < evs.length; i++) window.addEventListener(evs[i], kruGuard, true);
  }

  var kruDrag = false, kruOx = 0, kruOy = 0, kruDragBound = false;
  function kruDragStart(cx, cy) {
    if (!menuEl) return;
    var r = menuEl.getBoundingClientRect();
    kruOx = cx - r.left; kruOy = cy - r.top; kruDrag = true;
    menuEl.style.transition = 'none';
  }
  function kruDragMove(cx, cy) {
    if (!kruDrag || !menuEl) return;
    var x = Math.max(0, Math.min(window.innerWidth - 60, cx - kruOx));
    var y = Math.max(0, Math.min(window.innerHeight - 24, cy - kruOy));
    menuEl.style.left = x + 'px'; menuEl.style.top = y + 'px';
  }
  function kruDragEnd() { kruDrag = false; }
  K.getDrag = function () { return kruDrag; };
  function kruDragBind() {
    if (kruDragBound) return;
    kruDragBound = true;
    window.addEventListener('mousemove', function (e) { kruDragMove(e.clientX, e.clientY); }, true);
    window.addEventListener('touchmove', function (e) { if (!kruDrag) return; var t = e.touches[0]; if (t) kruDragMove(t.clientX, t.clientY); }, true);
    window.addEventListener('mouseup', kruDragEnd, true);
    window.addEventListener('touchend', kruDragEnd, true);
    window.addEventListener('touchcancel', kruDragEnd, true);
    window.addEventListener('pointerup', kruDragEnd, true);
    window.addEventListener('blur', kruDragEnd, true);
    window.addEventListener('touchstart', function (e) {
      if (!kruDrag) return;
      var t = e.target;
      if (!t || !t.closest || !t.closest('#kru-head')) kruDragEnd();
    }, true);
    window.addEventListener('mousedown', function (e) {
      if (!kruDrag) return;
      var t = e.target;
      if (!t || !t.closest || !t.closest('#kru-head')) kruDragEnd();
    }, true);
  }

  function wireMenu() {
    ['touchstart','touchend','mousedown','mouseup','click','pointerdown','pointerup','contextmenu'].forEach(function (ev) {
      menuEl.addEventListener(ev, function (e) { if (e && e.stopPropagation) e.stopPropagation(); }, false);
    });
    menuEl.addEventListener('pointerdown', function () {
      try { if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); } catch (err) { }
    }, false);
    var btns = menuEl.querySelectorAll('.kru-t');
    for (var i = 0; i < btns.length; i++) {
      (function (b) { b.onclick = function () { toggle(b.dataset.k); }; })(btns[i]);
    }
    var f = document.getElementById('kru-fovcycle');
    if (f) f.onclick = function () { S.fovIdx = (S.fovIdx + 1) % FOVS.length; paintMenu(); };
    var minEl = document.getElementById('kru-min');
    if (minEl) minEl.onclick = function (e) { e.stopPropagation(); S.min = !S.min; paintMenu(); };

    var head = document.getElementById('kru-head');
    head.addEventListener('mousedown', function (e) { if (e.target.id === 'kru-min') return; kruDragStart(e.clientX, e.clientY); e.preventDefault(); });
    head.addEventListener('touchstart', function (e) { if (e.target.id === 'kru-min') return; var t = e.touches[0]; if (t) kruDragStart(t.clientX, t.clientY); }, { passive: true });
  }

  var TOGGLES = ['aimbot', 'autofire', 'espBox', 'espTracer', 'chams', 'wireframe', 'god', 'bhop', 'autorun', 'third'];
  document.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k === ' ') C.spaceDown = true;
    if (k === 'Insert') { S.min = !S.min; paintMenu(); }
    if (k === '0') { S.fovIdx = (S.fovIdx + 1) % FOVS.length; paintMenu(); }
    if (k === '1') { S.teamCheck = !S.teamCheck; paintMenu(); }
    var n = parseInt(k, 10);
    if (n >= 2 && n <= 9 && TOGGLES[n - 2]) { toggle(TOGGLES[n - 2]); }
  }, true);
  document.addEventListener('keyup', function (e) { if (e.key === ' ') C.spaceDown = false; }, true);

  function kruDbgMount() {
    var el = document.getElementById('kru-dbg');
    if (el) return;
    el = document.createElement('div');
    el.id = 'kru-dbg';
    el.style.cssText = 'position:fixed;right:0;top:0;z-index:2147483647;pointer-events:none;' +
      'font:9px/1.45 ui-monospace,monospace;color:#ffd9ea;background:rgba(0,0,0,.78);' +
      'padding:2px 5px;border-radius:0 0 0 6px;max-width:78vw;white-space:nowrap;' +
      'overflow:hidden;text-overflow:ellipsis;';
    document.body.appendChild(el);
  }
  function kruDbgPaint() {
    try {
      var el = document.getElementById('kru-dbg');
      if (!el) return;
      var d = K.dbg, m = document.getElementById('kru-menu');
      var hit = 'noMenu';
      if (m) {
        var r = m.getBoundingClientRect();
        if (r.width > 0) {
          var h = document.elementFromPoint(r.left + r.width / 2, r.top + 14);
          hit = h ? String(h.id || h.className || h.tagName || '?').slice(0, 14) : 'null';
        } else hit = 'hidden';
      }
      var line = 'v' + K.v + ' m' + (m ? 1 : 0) + ' g' + d.g + ' t' + d.t +
        ' f' + d.f + ' e' + d.e + ' ' + (C.ready ? 'r1' : 'r0:' + ((function(){ try { return Object.isExtensible(Object.prototype); } catch (e) { return true; } })() ? '' : 'FRZ-') + (!C.game ? 'game' : (!C.me ? 'me' : (!C.renderer ? 'render' : 'ctrls')))) + ' | ' + hit + (d.last ? ' | ' + d.last : '');
      if (el.textContent !== line) el.textContent = line;
    } catch (e) { }
  }

  function boot() {
    safe(installHooks);
    safe(resolveScan);
    safe(kruAcquireLate);
    safe(function () {
      try { S.min = localStorage.getItem('kru_min') === '1'; } catch (e) { }
    });
    safe(buildMenu);
    safe(kruDbgMount);
    safe(refreshStatus);
    safe(kruDbgPaint);
    setInterval(function () { safe(resolveScan); safe(kruAcquireLate); safe(kruAdoptFromWindow); safe(validate); safe(refreshStatus); safe(kruDbgPaint); }, 700);
    kruInstallGuard();
    kruDragBind();
    setInterval(function () {
      var cur = document.getElementById('kru-menu');
      if (!cur || !menuEl || cur !== menuEl || !document.body.contains(menuEl)) { safe(buildMenu); return; }
      cur.style.zIndex = '2147483647';
      cur.style.pointerEvents = 'auto';
      var kids = document.body.children, idx = -1, i;
      for (i = 0; i < kids.length; i++) if (kids[i] === cur) { idx = i; break; }
      if (idx >= 0 && idx < kids.length - 1) {
        for (i = idx + 1; i < kids.length; i++) {
          var st = window.getComputedStyle(kids[i]);
          if (st.display !== 'none' && st.visibility !== 'hidden' && (parseInt(st.zIndex, 10) || 0) >= 2147483647) {
            document.body.appendChild(cur);
            break;
          }
        }
      }
    }, 1500);
    var last = 0;
    function loop(ts) {
      if (ts - last > 33) { last = ts; if (C.ready) safe(frame); }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    K.state = S; K.cap = C;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
