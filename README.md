# krunker-cheat

Bookmarklet cheat untuk krunker.io — v9.

Bookmarklet cheat untuk krunker.io — v8.

## Pakai

Buka krunker.io, lalu **segera klik bookmark begitu halaman muncul** (±3 detik pertama). Setelah menu muncul, masuk match:

```javascript
javascript:(function(){var u=['https://cdn.jsdelivr.net/gh/charlotte8iyc/krunker-cheat@f053abb702722405daf6b70c4a7965b92f4abcfb/krunker.js','https://cdn.jsdelivr.net/gh/charlotte8iyc/krunker-cheat@main/krunker.js?v='+Date.now()];var i=0;function go(){if(i>=u.length)return;var s=document.createElement('script');s.src=u[i++];s.onerror=go;document.body.appendChild(s);}go();})();
```

Loader menaruh script dari jsdelivr, jadi update cheat cukup push ke repo — bookmark tidak perlu diganti.

`?v='+Date.now()` itu **cache-buster**: jsdelivr ngirim `max-age=604800`, jadi HP bisa nyimpen script lama sampai 7 hari. Tanpa buster, push baru nggak kebaca sampai cache expired. Dengan buster, setiap inject selalu ambil file terbaru — dan karena buster-nya dibikin waktu jalan, **bookmark-nya tetap sama selamanya**.

Kalau menu muncul tapi versinya bukan `v8` (lihat badge di header), artinya halaman masih nyala script lama — **reload dulu halaman krunker-nya**, baru inject ulang. Guard `window.__KRU` bikin inject kedua jadi no-op, jadi script lama nggak bisa ditimpa selama satu sesi.

Pakai **Firefox Android** (Chrome Android tidak bisa ngedit URL bookmark).

## Panel diagnostik

Sudut kanan-atas ada baris kecil — alat baca, bukan bagian menu:

```
v8 m1 g1 t12 f3 e0 r1 | kru-t | <pesan error terakhir>
```

| Field | Arti |
|---|---|
| `v8` | versi build yang sedang jalan |
| `m1` | `1` = menu ada di halaman, `0` = build gagal pasang menu |
| `g1` | `1` = guard window-capture terpasang |
| `t` | event yang **masuk** ke area menu |
| `f` | event yang **diteruskan** ke tombol |
| `e` | runtime error milik cheat sendiri |
| `r` | `1` = objek game ketemu dan frame jalan (cheat aktif). `0:FRZ-...` = **terlambat** — `Object.prototype` sudah dibekukan Krunker; `0:game/me/render/ctrls` = objek tertentu belum ketemu |
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

## v5 changelog

**Box cheat melompat ke titik tap di layar mana pun** — patokannya header `Yukakoo`. Akar: shield menu (`stopPropagation` di kontainer, dibuat biar tap nggak bocor ke game) **juga memakan `touchend`/`mouseup` yang kita butuh sendiri**. Urutan di HP: tekan header → `touchstart` jalan (`drag=true`) → lepas → `touchend`/`mouseup` targetnya header, naik ke kontainer, **distop shield, `document` nggak pernah dapet → `end()` tak pernah jalan → `drag` nyangkut `true` selamanya**. Begitu jari goyang dikit pas tap berikutnya, `touchmove` masuk → `move()` → box lompat persis ke titik jari. Headless `tap()` nggak pernah gerakin `touchmove`, makanya test lama selalu lolos.

Perbaikan:

1. **Drag dipindah ke modul + `window` capture.** `mouseup`/`touchend`/`touchcancel`/`pointerup`/`blur` diikat ke `window` **capture** — jalan **sebelum** shield kontainer, jadi `kruDragEnd()` selalu kepanggil. `kruDragBound` bikin ikatan cuma sekali walau menu di-rebuild.
2. **Sapuan pengaman:** `touchstart`/`mousedown` yang targetnya **di luar `#kru-head`** langsung `kruDragEnd()` — drag cuma boleh hidup selama jari menempel di header.
3. **`mousemove`/`touchmove` juga di `window` capture** biar nggak bisa distop handler game.
4. **`K.getDrag()`** dibuka buat test — status drag bisa diukur langsung, bukan ditebak dari gerak box.
5. Badge **v5**.

Bukti: di v4, satu tap header lalu suntik `touchmove(350,800)` → box **(10,10) → (273,787)**. Di v5: `getDrag()` = `false` setelah tap header, box tetap **(10,10)** setelah dua suntik, drag dari header tetap jalan → **(223,587)**.

**Loader dipin ke commit.** Ketemu juga kenapa update sebelumnya nggak pernah nyampe: jsdelivr `@main` itu **resolusi branch yang di-cache berlapis** — setelah purge, ia balik menyajikan salinan lama (terekam melompat `v2.3 → v4`, padahal main sudah `v5`), dan `?v=` dari loader cuma memecah cache edge, bukan cache resolusi branch-nya. Jadi test lama jalan di build terbaru, tapi perangkat Yukakoo ngambil build lama.

Loader sekarang memakai **URL commit-pin** `@a9a6519827ad37f3de6726f9febbd4bcdc0c67b3…` (selalu menghasilkan isi yang sama, dibuktikan md5 `b191d8c07c83b303d17757a3cbd2e5ff`) lalu jatuh ke `@main?v=` kalau pin gagal. Tiap rilis baru, pin diganti ke commit rilis itu.

> **Penting:** bookmarklet yang tersimpan di Firefox masih versi lama. Hapus yang lama, salin ulang dari `loader-bookmarklet.txt`.



## v9 changelog

**Keluhan: injeksi telat setelah `Object.prototype` dibekukan → cheat mati total (`r0:FRZ-game`, `e4` / `Cannot set property`).** V8 gagal di lapangan karena `installLateFallback()` ikut diam saat frozen dan `adoptIfGame()` tak pernah terpanggil.

### Jalur akuisisi game bebas `Object.prototype`

Berempat ke empat jaring pengaman yang **tidak menyentuh `Object.prototype` sama sekali**:

1. **`kruHookWebGL()`** — hook `WebGLRenderingContext.prototype` / `WebGL2RenderingContext.prototype` (`getUniformLocation`, `uniformMatrix4fv`, `drawArrays`, `drawElements`, `useProgram`, `createProgram`). Setiap panggilan GL mencoba menemukan `Three.js` renderer dari konteks GL miliknya (`o.context === gl && o.camera && o.camera.matrixWorldInverse`). Works because `WebGL2RenderingContext.prototype` stays extensible even after `Object.prototype` is frozen.

2. **`kruHookCanvasLate()`** — hook `HTMLCanvasElement.prototype.getContext`. Saat `getContext('webgl')` atau `getContext('webgl2')` dipanggil pada kanvas game-overlay, renderer dicari langsung dari konteks GL yang baru dibuat.

3. **`kruAcquireLate()`** — pemeriksaan paksa: ambil elemen `#game-overlay`, ambil konteks GL-nya, panggil `kruFindRendererFromGL()`. Dijalankan di boot dan setiap 700 ms bersama `resolveScan()`.

4. **`kruFindRendererFromGL(gl)`** — menyelam `window` (maks 40 nama properti per objek) mencari objek yang punya `.context === gl ` dan `.camera.matrixWorldInverse`. Ketemu → `C.renderer` diisi → `validate()` mengisi sisa (`C.game`, `C.controls`, `C.me`).

Hasil: `WHEN=late` (inject setelah freeze) menghasilkan `r1 f>0 e0` — cheat aktif walau `Object.prototype` sudah dibekukan Krunker.

Test: `mock_test` **39/39**, `node --check` lolos, syntax valid.

## v8 changelog

**Keluhan: `Cannot define property controls, object is not extensible`, panel `e4 r0`, cheat tetap mati.** Dua akar.

### 1. `Object.prototype` Krunker dibekukan ±3–7 detik setelah halaman dibuka

Diagnosa langsung dari halaman asli (`Object.isExtensible(Object.prototype)` dipantau tiap tahap):

| waktu sejak commit | `Object.prototype` |
|---|---|
| 0 / 300 / 1000 / 3000 ms | **extensible** |
| 6000 ms | **frozen** |

`Array.prototype` dan `Function.prototype` tetap extensible — **hanya `Object.prototype`** yang dikunci. Akibatnya `defineProto()` gagal total (`e4`) begitu inject jatuh setelah jendela itu, dan **tidak ada** global `window` yang memegang objek game (disisir 1596 nama → nol). Setter `players`/`renderer`/`controls` tidak pernah terpasang → `C.ready` selamanya `false`.

**Konsekuensinya wajib: bookmarklet dijalankan segera setelah halaman muncul.** Panel sekarang melaporkan kondisi ini sendiri — `r0:FRZ-game` artinya *frozen*, `proto:FROZEN` muncul di status line.

### 2. Store WeakMap dipakai bersama oleh semua nama properti (bug v8 sendiri, ketemu saat diagnosa)

`KRU_STORE` adalah **satu** WeakMap untuk `canvas`/`players`/`renderer`/`controls`. Setter menulis `KRU_STORE.set(this, v)` tanpa kunci nama, jadi penulisan `.controls` **menimpa** `.players`. Getter `players` lalu mengembalikan nilai `controls` → `players.list` `undefined` → `validate()` membatalkan `C.game` (`C.game = null`) **setelah** `C.ready` sempat `true`.

Bukti pembekuan (`K.dbg.nullWhy`):

```
had:true  same:true   ← C.game === C.gameCand, objeknya benar
pl:"object"  lst:"undefined"   ← players terbaca, tapi .list hilang
wm:true   ← WeakMap memang punya entri... untuk nama yang salah
```

**Fix:** `KRU_STORES[name]` — satu WeakMap per nama, dipakai di getter dan setter.

### 3. Jaring cadangan bila sudah frozen

Properti `Object.prototype` yang **sudah ada** tetap bisa didefinisikan ulang walau `preventExtensions` sudah jalan. `hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable`, `toLocaleString`, `toString`, `valueOf` di-wrap agar, saat `this` ternyata objek game (`players.list` ber-`length` angka), ia langsung diadopsi. Nol risiko performa — delegasi ke fungsi asli.

### 4. `players` gate dilonggarkan

`Array.isArray(v.list)` → `typeof v.list.length === 'number'`. Objek `players` di lapangan bukan array murni.

### 5. `hydrate()`

Saat `C.game` ada tapi `renderer`/`controls` belum, propertinya disisir (maks 400) — `renderer` dikenali dari `.camera.matrixWorldInverse`, `controls` dari `.keys`/`.binds`.

### Bukti A/B (objek game di closure, `players` sudah ada sebelum inject, `controls` di-assign setelah)

| | awal (sebelum freeze) | telat (setelah freeze) |
|---|---|---|
| **v7** | `e4 r0`, `scan:3175` — box/tracer kosong | `e4 r0`, error sama |
| **v8** | **`ready:true, e0, r1, listLen:2, hasBox:true, hasLine:true`** | `e4`, `r0:FRZ-game` (jelas: frozen) |

Test: `mock_test` **39/39**, `diag5` **12/12**, `diag9` **8/8**, `diag11` **7 ok + 2 lobby** (baseline).

## v7 changelog

**Semua cheat tidak berefek di match nyata** — keluhan: aimbot, wire, box, line, god semuanya mati total walau tombol sudah hidup-mati. Penyebabnya di `frame()`: `if (!C.ready) return;` — dan `C.ready` hanya bisa jadi `true` kalau `C.game`, `C.me`, `C.renderer` ketemu. Ketiganya diisi **hanya** lewat setter di `Object.prototype` (`defineProto`) yang menyala saat game *meng-assign* properti itu. Kalau objek game sudah dibuat sebelum bookmarklet diinjeksi — atau propertinya ditaruh sebagai *own property* sejak awal — setter itu **tidak pernah kepanggil**, `C.ready` selamanya `false`, dan seluruh jalur aimbot/ESP/FOV/third-person mati. Tombol menu tetap jalan karena jalurnya terpisah, makanya kelihatannya "cuma tombolnya doang yang merespons".

Bukti A/B (objek game disuntik *setelah* cheat terpasang, meniru kondisi inject telat):

- **v6 (lama):** `ready:false, game:false, renderer:false, espLen:-1` → box & tracer **tidak ada satu pun** yang tergambar.
- **v7 (baru):** `ready:true, game:true, renderer:true, me:true, controls:true, scan:hit`, `espLen:794`, `hasBox:true, hasLine:true`.

Perbaikan:

1. **Pemburu aktif `resolveScan()`** — jalan tiap 700ms selama `C.ready` masih `false`. Fase 1 menyisir seluruh global `window` (`Object.getOwnPropertyNames(window)`, ±1600 nama) murah tanpa anggaran; fase 2 menyelam satu level ke dalam tiap objek dengan anggaran 6000 pembacaan, melewati DOM node dan `window` sendiri. Kandidat cocok kalau ada `obj.players.list` ber-`length` angka → dijadikan `C.game`, lalu `validate()` mengisi renderer/controls/me seperti biasa.
2. **Pemburu pemilik canvas** — fase yang sama mencari objek yang `obj.canvas === #game-overlay`; kalau ketemu, `C.overlay` diganti (jadi `vpSize()` baca ukuran canvas asli, bukan `window`) dan `hookRenderOn()` dipasang telat — ini jaring pengaman kalau setter `canvas` kelewat.
3. **Guard lintas-origin** — `o.nodeType` dibaca di luar `try`. Krunker menaruh iframe lintas-origin bernama di `window`; begitu disentuh, `resolveScan` **keluar seluruhnya** sebelum `C.scanN` sempat diisi (terbaca sebagai `scan:0`, padahal loop-nya gagal di tengah jalan). Sekarang dibungkus `try/catch` → iframe langsung dilewati.
4. **`safe()` sekarang mencatat** — dulu `catch (e) { }` menelan semua error tanpa jejak, jadi `e0` di panel itu bohong: kegagalan nyata tidak pernah tercatat. Sekarang `K.dbg.e++` dan `K.dbg.last` diisi, jadi `e` benar-benar berarti.
5. **Flag `r` di panel diagnostik** — `r1` = objek game ketemu dan frame jalan. Ini angka yang menentukan cheat hidup atau mati, bukan `t`/`f` (itu urusan tombol).
6. **Status line bertambah `scan:`** — `scan:hit` = pemburu nemu objek, `scan:<n>` = berapa objek sudah dibaca.

## v6 changelog

**Slider `AimFov` nongol keluar kotak** — keluhan: tombol bernomor yang digeser itu melebihi menu. Penyebabnya `input[type=range]` punya lebar bawaan **129px** dan sebagai flex item ia memakai `min-width:auto`, jadi **tidak bisa menyusut**. Barisnya jadi 199px di dalam kotak 152px → `scrollWidth 205` vs `clientWidth 152`, slider nongol 30px dan angkanya 52px melewati tepi kanan.

Perbaikan: kedua baris (`AimFov` + `ScreenFOV`) diberi `min-width:0; overflow:hidden`, `input` di-set `flex:1 1 0; min-width:0; width:0` (dipaksa ikut sisa ruang), `label` di-ellipsis, tombol `ScreenFOV` `flex:none`. Tinggi slider naik 12px → 14px biar enak di-JP.

Bukti: `scrollWidth 205 → ≤152`, nol elemen keluar kotak, 11/11 tombol tetap berada di dalam kotak dan berubah state saat ditap.

## Test


```
node mock_test.js
```

39 assertion, 0 fail — cakup: hook render, paket input, filter tim/mati, ESP projection, semua toggle, keyboard, minimize, z-index menu di atas `#mobileUI`, shield gesture, respawn `C.me`, ikatan kamera, normalisasi AimFov, guard re-inject, **guard window-capture (4 event), tembus saat game menelan, tembus saat overlay menutupi, touchstart tanpa `preventDefault`, z-index ESP, ESP host hidup lagi setelah dibuang**.

Browser test (Playwright, chromium, viewport 412×915 `hasTouch`, krunker.io asli): **11 ok / 0 fail milik cheat** — cakup boot, tap minimize (lipat + buka), tap toggle, **tap saat `#mobileUI` dipaksa `display:block` + `controls.enabled=true`**, **panel diagnostik tampil + counter `t`/`f` naik benar**. Sisa error di log berasal dari game/OneTrust (`WeakMap`, `<svg> attribute width`) dan sudah muncul **sebelum** script diinjeksi.

Diagnostik v4 divalidasi di match asli: `t0 → 12`, `f0 → 3` (tepat = minimize ×2 + toggle ×1).

Tes regresi teleport box (`diag9.js`, Playwright + CDP `Input.dispatchTouchEvent`): **7 ok / 0 fail milik cheat** — tap header lalu suntik `touchmove`/`mousemove` sintetis ke titik jauh, box wajib diam; `K.getDrag()` wajib `false` setelah lepas; drag dari header wajib tetap jalan. **A/B**: build v4 lama gagal di assertion teleport (box pindah ke 273,787), build v5 lolos semua.

Sisa `pageerror` di log browser (`WeakMap`, `<svg> attribute width`) berasal dari game/OneTrust dan sudah muncul **sebelum** script diinjeksi — bukan milik cheat.

## v2 changelog

- Hook per-frame `render(scale, game, controls, renderer, me)` — handle game/renderer/controls/me diadopsi otomatis
- Targeting dari `game.players.list` (bukan nebak scene graph) — tidak ada lagi lock tim/mati
- Autofire menulis input packet langsung (index `gameInputIndices`), jadi benar-benar menembak
- ESP pakai world-to-screen projection asli
- FOV di-restore saat toggle off
