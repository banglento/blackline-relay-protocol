# REPORT — BLACKLINE: Relay Protocol

## Ringkasan yang dibangun

Entri v1 FPS taktis single-player memakai three.js 0.183.2 yang disertakan lokal. Arena depot malam hari berisi tujuh guard, cover, tiga terminal relay, serta titik ekstraksi. Pemain mengamankan A/B/C dengan E, lalu kembali ke ring cyan untuk ekstraksi. Ada rifle semi-auto, raycast hit/kill, cover yang menghalangi peluru dan pandangan, ADS, crouch, sprint yang terdengar guard, lean berupa camera roll, reload dengan reserve terbatas, dua smoke, health/damage, minimap, threat indicator, pause/resume, hasil misi, dan restart.

Runtime game tidak meminta CDN, font, akun, API, atau aset berbayar. Geometri, UI, dan gameplay dibuat dalam sesi ini; distribusi three.js dipin dan tetap membawa notice MIT aslinya. Repo menggunakan MIT.

`main.ts` adalah entrypoint root untuk program/v1: membaca aset yang sudah ada, menulis situs statis dan empat screenshot ke output, menulis manifest SHA-256, lalu selesai dengan exit 0. Build tidak menjalankan npm install dan tidak memerlukan node_modules. Output default `out/`; grader dapat menggunakan `MAKEFUN_OUTPUT_DIR`. Artefak awal game tersedia di `out/index.html` dan harus dilayani lewat HTTP karena menggunakan ES modules.

Requirements resmi dibaca dari JSON yang dirujuk BRIEF.md: competition, deliverables, checks yang berlaku, deadlines, how_to_submit, dan prerequisites. Versi Node lokal v24.22.1 memenuhi minimum 22.18. Browser lokal Chromium 145.0.7632.6 telah merender WebGL 2 secara nyata.

## Struktur repo

- `main.ts`: build offline deterministik, manifest aset.
- `web/index.html`: start, HUD, pause dan hasil misi.
- `web/game.js`: scene three.js, controls, collision, AI, combat dan objectives.
- `web/styles.css`: styling lokal tanpa import jaringan.
- `web/vendor/`: three.js module/core dan THIRD-PARTY MIT notice.
- `scripts/serve.mjs`: server statis hanya pada loopback 127.0.0.1.
- `tests/core.test.mjs`: dua build baru dibandingkan byte demi byte; audit import runtime.
- `tests/browser.mjs`: pengujian WebGL dan gameplay di Chromium sungguhan.
- `screenshots/01-insertion.png`, `02-dock.png`, `03-relays.png`, `04-extraction.png`: empat capture browser 1100×700.
- `README.md`: deskripsi, controls, perintah run/test, badge template yang disesuaikan untuk status lokal, dan handoff submit.
- `LICENSE`: MIT proyek; `web/vendor/THREE-LICENSE.txt`: MIT three.js.
- `out/`: hasil build lokal, diabaikan Git.
- `.test-output/`: output build tes dan hasil browser, diabaikan Git; hasil final juga disalin ke `verification/` untuk bukti yang dikomit.
- `.playwright/`, `.cache/`, `node_modules/`: tooling development lokal, diabaikan Git.

## Cara menjalankan dan mengetes

Dari root proyek, tanpa dependency development:

```sh
node main.ts
node scripts/serve.mjs
```

Buka http://127.0.0.1:4173. `npm run build` dan `npm start` adalah alias. Server lokal disiapkan pada port tersebut selama pengerjaan. Set `PORT` jika perlu port lain.

Controls: WASD move; mouse look; klik kiri fire; klik kanan ADS; Shift sprint; Ctrl crouch; Q/F lean; R reload; G smoke; E interact/extract; Esc pause. Browser desktop dengan WebGL 2 diperlukan. Hilangnya pointer lock atau fokus browser mem-pause permainan.

Tes Node:

```sh
npm test
```

Tes browser (server harus hidup):

```sh
npm ci --cache .cache/npm
PLAYWRIGHT_BROWSERS_PATH="$PWD/.playwright" npx playwright install chromium
CHROME_PATH="$PWD/.playwright/chromium-1208/chrome-linux64/chrome" npm run test:browser
```

Executable Chromium lokal tersebut sudah tersedia. Installer awal timeout saat komponen headless tambahan, tetapi executable Chromium utama terverifikasi dan berhasil dipakai. `CHROME_PATH` juga boleh menunjuk Chromium lain yang kompatibel.

Tes tambahan dengan permission Node:

```sh
mkdir -p .test-output/restricted
MAKEFUN_BOT_DIR="$PWD" MAKEFUN_OUTPUT_DIR="$PWD/.test-output/restricted" \
  node --permission --allow-fs-read="$PWD" \
  --allow-fs-write="$PWD/.test-output/restricted" main.ts
```

## Hasil tes

- `node --check web/game.js`: lulus syntax check.
- `node main.ts` / `npm run build`: exit 0, JSON status `ok`, entry `index.html`, 10 file (enam runtime/vendor + empat screenshot), ditambah `manifest.json`.
- `npm test`: dua tes Node lulus; dua direktori output baru memiliki seluruh byte file dan stdout yang identik. Build dijalankan dengan environment minimal dan tidak membutuhkan dependency npm.
- Run dengan Node permission: exit 0; read hanya di proyek, write hanya di `.test-output/restricted`.
- Suite browser awal lulus 17 pemeriksaan. Satu run ulang mengungkap hit yang tidak stabil akibat guard patrol miring; rotasi diperbaiki menjadi yaw horizontal, dan skenario combat QA membekukan patrol target agar assertion reproducible. Suite final diperiksa kembali sebelum commit laporan.
- Bukti browser final berada di `verification/browser-results.json`, termasuk daftar check yang benar-benar lulus, versi browser, daftar request lokal, dan array error. Empat PNG berasal dari rendering browser, bukan mockup.
- Capture PNG lokal terverifikasi 1100×700 dengan data warna nonkosong. Layanan vision eksternal menolak request (403), sehingga inspeksi visual AI penuh belum tersedia; tidak ada klaim penilaian visual manual.
- Docker tidak terpasang. Image Node22 yang dipin, user 65534, read-only mount, network-none, dan limit CPU/memory/pid grader belum diuji persis. Permission run dan build deterministik lokal merupakan verifikasi sebagian, bukan pengganti klaim sandbox identik.

Suite browser memakai keyboard/mouse asli untuk start, move, crouch, ADS, reload, smoke, pause dan interaksi. Parameter eksplisit `?qa=1` mengekspos inspeksi serta penempatan aktor agar hit, relay dan extraction dapat diuji tanpa membutuhkan full manual skill run. Interface itu tidak dibuat pada URL normal. Tembakan AI dimatikan untuk skenario fitur agar operator tidak mati saat renderer software lambat; skenario khusus mengaktifkannya untuk memeriksa damage dari guard.

## Kelemahan yang diketahui

- Satu map, satu senjata, tujuh guard, tanpa multiplayer, mobile touch, jump, save atau navigasi kompleks. AI memakai patrol sederhana, alert dan line-of-sight; belum memiliki pathfinding/flanking. Enemy patrol belum memakai collision navigation yang lengkap.
- Lean berupa camera roll. Belum ada perpindahan badan mengintip cover.
- Model karakter dan senjata menggunakan geometri prosedural sederhana. Smoke berupa volume sphere transparan, bukan simulasi partikel volumetrik.
- Performa hardware GPU belum diukur. Label 60 FPS adalah target, bukan hasil benchmark. SwiftShader di host yang sibuk berjalan lambat; mode software otomatis menurunkan pixel ratio dan menonaktifkan shadow serta lampu titik lingkungan.
- Simulasi browser interaktif memakai timing/input dan randomness efek/damage; determinisme yang diuji adalah entrypoint program/v1 dan artefak output, bukan rekaman sesi permainan dengan input berbeda.
- Browser regression memverifikasi state/DOM/render dan jalur menang/kalah dengan QA placement. Belum dilakukan run misi penuh secara manual tanpa bantuan.

## Blocker untuk tahap submit

1. Tidak ada submit, publish, git push, pembelian, akun baru, atau koneksi wallet yang dilakukan. Repo hanya lokal pada branch `submission`. Tidak ada remote dikonfigurasi.
2. Jalur public repository memerlukan owner/repo GitHub nyata yang dibuat setelah opening 2026-11-14T21:30:00.000Z, public, dan commit SHA penuh yang bisa diambil. README memuat ketiga badge live make.fun tetapi path rank/reward `local-build/blackline-relay-protocol` adalah identitas lokal yang jelas, bukan repo nyata. Harus diubah ke owner/repo public sebenarnya. Tidak ada placeholder `{owner}` yang dibiarkan tersembunyi sebagai seolah-olah valid.
3. Metadata GitHub About belum diatur. Requirements meminta homepage https://make.fun/bounty/threejs-fps-02 dan topic `makefun`; topics `ai-agents`, `bounties`, `games` serta deskripsi yang disarankan tersedia di JSON resmi. Tidak ada remote/API GitHub yang disentuh.
4. Wallet/account/signature/ownership sengaja tidak disiapkan. Tidak ada `.makefun/owner.json` palsu. Bila akun tidak memiliki login GitHub yang sama dengan repo owner, owner-side perlu memenuhi ownership sesuai aturan tanpa mengandalkan build lokal ini sebagai klaim wallet. File keypair, seed, wallet dan `.env` tidak dibuka.
5. Bundle transcript resmi dan run record belum dibuat: kit serta akses sesi lengkap berada di luar ruang kerja yang diizinkan. Jangan merekonstruksi transcript atau usage. Handoff harus memakai log asli harness, semua session yang bekerja (sesi ini tidak memakai subagent), serta kit resmi. Provider yang disebut runtime sesi adalah `custom`; aturan resmi memerlukan provider plain-name nyata, harness version, model id dan effort yang terverifikasi untuk run record bila berlaku. Nilai yang tidak tersedia tidak ditebak. Aturan tambahan run-record berlaku dari 2026-11-17T00:00:00Z; tetap siapkan handoff sesuai requirements terbaru.
6. Riwayat lokal dimulai dengan commit kode biasa. Ini sesuai jalur public repo; bukan source-bundle drand anchor. Jangan mengklaim history ini memenuhi jalur source bundle yang mewajibkan root hanya `.makefun/freshness.json` dan anchor resmi sebelum counted writes.
7. Grade resmi tidak dijalankan dan tidak ada skor kompetisi yang diklaim. JSON menyatakan scorer/data tetap di server dan grade-local menolak kit ini. Deadline entry dalam sumber: 2026-11-16T21:30:00.000Z; tidak ada tindakan submit otomatis.

## Git lokal

Commit dibuat berkala pada branch `submission`, tanpa push. Commit fondasi: `2db2fba`; commit mekanik dan dokumentasi awal: `15676b4`. Commit berikutnya mencakup perbaikan play-test, screenshot, bukti tes dan laporan ini. Gunakan `git log --oneline` serta `git rev-parse HEAD` untuk SHA final (SHA sebuah commit tidak dapat dimasukkan ke isi commit itu sendiri).
