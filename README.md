# krunker-cheat

Bookmarklet cheat untuk krunker.io — v2.

## Pakai

Buka krunker.io, **masuk match dulu**, lalu klik bookmark:

```javascript
javascript:(function(){var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/gh/charlotte8iyc/krunker-cheat@main/krunker.js';document.body.appendChild(s);})();
```

Loader menarik script dari jsdelivr, jadi update cheat cukup push ke repo - bookmark tidak perlu diganti.

## Fitur

- Aimbot (FOV lock 45 derajat + smoothing, hanya musuh: skip tim/mati/diri sendiri)
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
- Insert hide menu
- Tombol `-` di header menu: minimize (cilin, tidak menutupi layar)
- Menu bisa di-drag

## v2 changelog

- Hook per-frame `render(scale, game, controls, renderer, me)` - handle game/renderer/controls/me diadopsi otomatis
- Targeting dari `game.players.list` (bukan nebak scene graph) - tidak ada lagi lock tim/mati
- Autofire menulis input packet langsung (index `gameInputIndices`), jadi benar-benar menembak
- ESP pakai world-to-screen projection asli
- FOV di-restore saat toggle off
