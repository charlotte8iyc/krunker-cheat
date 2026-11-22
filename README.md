# krunker-cheat

Bookmarklet cheat untuk krunker.io — v4.

## Pakai

Buka krunker.io, **masuk match dulu**, lalu klik bookmark:

```javascript
javascript:(function(){var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/gh/charlotte8iyc/krunker-cheat@main/krunker.js?v='+Date.now();document.body.appendChild(s);})();
```

Loader menaruh script dari jsdelivr, jadi update cheat cukup push ke repo — bookmark tidak perlu diganti.

`?v='+Date.now()` itu **cache-buster**: jsdelivr ngirim `max-age=604800`, jadi HP bisa nyimpen script lama sampai 7 hari. Tanpa buster, push baru nggak kebaca sampai cache expired. Dengan buster, setiap inject selalu ambil file terbaru — dan karena buster-nya dibikin waktu jalan, **bookmark-nya tetap sama selamanya**.

Kalau menu muncul tapi versinya bukan `v4` (lihat badge di header), artinya halaman masih nyala script lama — **reload dulu halaman krunker-nya**, baru inject ulang. Guard `window.__KRU` bikin inject kedua jadi no-op, jadi script lama nggak bisa ditimpa selama satu sesi.

Pakai **Firefox Android** (Chrome Android tidak bisa ngedit URL bookmark).

## Panel diagnostik

Sudut kanan-atas ada baris kecil — alat baca, bukan bagian menu:

```
v4 m1 g1 t12 f3 e0 | kru-t | <pesan error terakhir>
```

| Field | Arti |
|---|---|
| `v4` | versi build yang sedang jalan |
| `m1` | `1` = menu ada di halaman, `0` = build gagal pasang menu |
| `g1` | `1` = guard window-capture terpasang |
| `t` | event yang **masuk** ke area menu |
| `f` | event yang **diteruskan** ke tombol |
| `e` | runtime error milik cheat sendiri |
| ketiga kolom | elemen yang benar-benar menempati titik pusat menu |

Cara baca saat tombol tidak bisa dipencet:

- **`t` tidak naik** saat tap → event tidak pernah sampai. Elemen di kolom ketiga itulah yang menutupi.
- **`t` naik tapi `f` diam** → event sampai tapi tidak ada `onclick` cocok (menu belum ter-wire atau `kruGameSwallow` menahan).
- **`m0`** atau **`e > 0`** → kirim baris ini, lengkap dengan pesan errornya.

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

## v2.3 changelog

Regresi setelah v2.2: **tombol mati total di in-game** (tak bisa dipencet, tak bisa minimize) dan **ESP tak kelihatan**. Tiga akar:

1. **Game menelan event di `document` capture.** Handler game jalan saat `controls.enabled && !window.locked` — kondisi persis in-game pas menu ESC kebuka. `stopPropagation()` di `document` capture bikin event **tidak pernah sampai ke menu** (lobby `controls.enabled=false`, makanya dulu cuma in-game yang mati). Sekarang ada **guard di `window` capture** (`pointerdown/mousedown/touchstart/click`) — `window` capture jalan **sebelum** `document` capture, jadi event keburu distop + tombol dipanggil langsung lewat `onclick`, bukan `dispatchEvent` (yang bikin rekursi tak hingga karena event baru ikut kena guard yang sama).
2. **Guard juga nangani overlay di atas menu.** Kalau `elementFromPoint` bukan elemen kita (`target` di luar `#kru-menu`), event diteruskan ke elemen menu terkecil yang memuat titik tap. Kalau `target` masih milik kita dan game **tidak** menelan, guard diam — jalur alami dipakai, jadi drag header + slider FOV tetap jalan normal.
3. **ESP `z-index:9999990` < `#mobileUI` `9999999`** → ESP tertutup selamanya di in-game. Naik jadi `2147483646`. `ensureEsp()` juga berhenti nge-cache `espBuilt` — kalau game buang host-nya, sekarang dibikin ulang (dulu `espBuilt=true` bikin ESP mati permanen setelah UI rebuild).

Tambahan: interval rebuild menu (1,5 dtk) sekarang cek `menuEl` masih elemen yang sama, re-assert `z-index`/`pointer-events`, dan pindahin menu ke atas kalau ada sibling dengan `z-index >= 2147483647`. `kru-min` juga di-guard biar `wireMenu` nggak nge-throw kalau tombolnya belum ada.

## v4 changelog

- **Panel diagnostik on-screen** (`#kru-dbg`, sudut kanan atas, `pointer-events:none`, `z-index:2147483647`): `v` versi · `m` menu ada · `g` guard terpasang · `t` event masuk · `f` event diteruskan · `e` error cheat · elemen penutup titik pusat menu · pesan error terakhir. Dipanggil `safe()` di boot + tiap 700 ms, jadi tetap terbaca walau menu rusak.
- **Counter di `kruGuard`**: `K.dbg.t++` setelah `kruXY()` (titik tap di dalam area menu), `K.dbg.f++` tepat sebelum `onclick` dipanggil. Beda `t - f` = event sampai tapi gagal diteruskan.
- **`window` `error` listener capture di baris paling awal IIFE** — error boot yang meledak sebelum menu sempat dibangun tetap terekam.
- Badge versi naik jadi **v4** (bukti visual build mana yang jalan di perangkat).

## Test

```
node mock_test.js
```

39 assertion, 0 fail — cakup: hook render, paket input, filter tim/mati, ESP projection, semua toggle, keyboard, minimize, z-index menu di atas `#mobileUI`, shield gesture, respawn `C.me`, ikatan kamera, normalisasi AimFov, guard re-inject, **guard window-capture (4 event), tembus saat game menelan, tembus saat overlay menutupi, touchstart tanpa `preventDefault`, z-index ESP, ESP host hidup lagi setelah dibuang**.

Browser test (Playwright, chromium, viewport 412×915 `hasTouch`, krunker.io asli): **11 ok / 0 fail milik cheat** — cakup boot, tap minimize (lipat + buka), tap toggle, **tap saat `#mobileUI` dipaksa `display:block` + `controls.enabled=true`**, **panel diagnostik tampil + counter `t`/`f` naik benar**. Sisa error di log berasal dari game/OneTrust (`WeakMap`, `<svg> attribute width`) dan sudah muncul **sebelum** script diinjeksi.

Diagnostik v4 divalidasi di match asli: `t0 → 12`, `f0 → 3` (tepat = minimize ×2 + toggle ×1).

## v2 changelog

- Hook per-frame `render(scale, game, controls, renderer, me)` — handle game/renderer/controls/me diadopsi otomatis
- Targeting dari `game.players.list` (bukan nebak scene graph) — tidak ada lagi lock tim/mati
- Autofire menulis input packet langsung (index `gameInputIndices`), jadi benar-benar menembak
- ESP pakai world-to-screen projection asli
- FOV di-restore saat toggle off
