# krunker-cheat

Bookmarklet cheat untuk krunker.io — 11 fitur.

## Pakai

Buka krunker.io, jalan ke match, lalu klik bookmark ini:

```javascript
javascript:(function(){var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/gh/charlotte8iyc/krunker-cheat@main/krunker.js';document.body.appendChild(s);})();
```

Menu muncul di kiri atas (bisa digeser). Keyboard: angka 1-9 toggle cepat, Insert sembunyikan menu.

## Fitur

- Aimbot (lock FOV 45 derajat + smoothing)
- Auto Fire
- ESP Box (nama, jarak, HP bar)
- ESP Tracer
- Chams (tembus dinding)
- Wireframe
- Godmode (client-side)
- Auto Bhop
- Auto Run
- FOV Cycle (90/110/130)
- Third Person

Catatan: godmode itu kunci HP lokal, server tetap ngitung damage.

## URL loader

- Utama (jsdelivr, content-type application/javascript): `https://cdn.jsdelivr.net/gh/charlotte8iyc/krunker-cheat@main/krunker.js`
- Cadangan (githack): `https://raw.githack.com/charlotte8iyc/krunker-cheat/main/krunker.js`
- raw.githubusercontent.com TIDAK bisa dipakai untuk script.src (nosniff + text/plain = diblokir browser)
