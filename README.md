# krunker-cheat

Bookmarklet cheat untuk krunker.io — v2.2.

## Pakai

Buka krunker.io, **masuk match dulu**, lalu klik bookmark:

```javascript
javascript:(function(){var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/gh/charlotte8iyc/krunker-cheat@main/krunker.js';document.body.appendChild(s);})();
```

Loader menaruh script dari jsdelivr, jadi update cheat cukup push ke repo — bookmark tidak perlu diganti.

Pakai **Firefox Android** (Chrome Android tidak bisa ngedit URL bookmark).

## Fitur

- Aimbot (FOV lock + smoothing, hanya musuh: skip tim/mati/diri sendiri)
- Auto Fire (lewat proxy `procInputs` input packet, bukan click sintetis)
- ESP Box (nama, jarak, HP bar) + ESP Tracer
- Chams + Wireframe
- Godmode (kunci HP lokal, server tetap ngitung damage)
- Auto Bhop + Auto Run
- FOV Cycle (90/110/130)
- Third Person
- Team check toggle

## Kontrol

- Keyboard 1-9 toggle cepat
- `0` cycle FOV
- Insert hide menu
- Tombol `—` di header menu: minimize (cilin, tidak menutupi layar)
- Menu bisa di-drag (seret header-nya)

## v2.2 changelog

- **Menu bisa dipencet pas in-game.** `#mobileUI` game (`z-index:9999999`, full-screen, cuma muncul in-game) nutupin menu lama (`z-index:999999`) — makanya di lobby jalan, di match nggak. Menu sekarang `z-index:2147483647` + `pointer-events:auto` + `touch-action:manipulation`.
- **Menu menelan gesture sendiri.** `stopPropagation` untuk `touchstart/touchend/mousedown/mouseup/click/pointerdown/pointerup/contextmenu` di kontainer menu, jadi tap nggak bocor ke handler game. `pointerdown` juga `document.exitPointerLock()` biar kursor lepas dari lock pas buka menu; klik kanvas lagi buat ngunci ulang.
- **Aimbot nge-aim kucing — 3 akar:**
  1. `validate()` cuma jalan sekali → `C.me` / `C.renderer` / `C.controls` beku setelah respawn atau round baru → asal-arah aim pakai posisi lawas. Sekarang `validate()` dipanggil tiap `frame()`, plus `C.me` nyari objek terbaru dari `game.players.list` (objek lama udah dibuang game).
  2. `S.aimFov` disimpen sebagai **px mentah** padahal dibandingin ke overlay `innerWidth × innerHeight` → `45` px ≈ 2-5° dari tengah layar, jadi aimbot hampir nggak pernah lock. Sekarang dinormalisasi jadi **fraksi setengah layar** (`clamp(aimFov,5,100)/100`), jadi 45 = 45% dari setengah layar.
  3. `lookDir()` cuma dipanggil saat mode third person → kamera nggak ngikut. Sekarang selalu jalan, plus sinkron `xDr`/`yDr` dan pilih `pitchObject` kalau ada.
- Guard tambahan: `found !== C.me` (target nol), `isFinite(xDire)` (sudut NaN bikin arah ngaco), cek `pchObjc.rotation` sebelum ditimpa.
- `validate()` sekarang re-run tiap frame (bukan sekali doang).

## Test

```
node mock_test.js
```

33 assertion, 0 fail — cakup: hook render, paket input, filter tim/mati, ESP projection, semua toggle, keyboard, minimize, z-index menu di atas `#mobileUI`, shield gesture, respawn `C.me`, ikatan kamera, normalisasi AimFov, guard re-inject.

## v2 changelog

- Hook per-frame `render(scale, game, controls, renderer, me)` — handle game/renderer/controls/me diadopsi otomatis
- Targeting dari `game.players.list` (bukan nebak scene graph) — tidak ada lagi lock tim/mati
- Autofire menulis input packet langsung (index `gameInputIndices`), jadi benar-benar menembak
- ESP pakai world-to-screen projection asli
- FOV di-restore saat toggle off
