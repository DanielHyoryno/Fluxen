# Self-test black-box Fluxen

Pengujian ini tidak memakai ESP32, akun produksi, atau Supabase. Kode aplikasi tidak diubah. Hasil dibedakan antara simulasi komponen React Native, browser Expo web dengan API dummy, dan HTTP backend nyata dengan PostgreSQL localhost.

## Isi

- `mobile/tests/blackbox-expanded.test.js`: variasi nama/email/password, kategori, perangkat, filter, profil, dan harga air. Respons layanan/native yang di-mock bukan bukti eksekusi APK fisik.
- `mobile/tests/blackbox-dashboard.test.js`: ringkasan online/offline/tanpa data, grafik, riwayat per jam, navigasi dan penutupan alert dengan data dummy.
- `backend/tools/blackbox-local.cjs`: HTTP nyata ke backend lokal, database sementara, CRUD, validasi, batas penggunaan, estimasi dan berkas XLSX nyata.
- `tools/blackbox-report.cjs`: menggabungkan bukti terstruktur menjadi tabel Markdown/HTML dengan keterlacakan per ID. Status tidak dibuat dari pembacaan kode.
- `tools/run-blackbox-selftest.cjs`: entry point untuk mengulang pengujian dan pembuatan laporan.

## Syarat keselamatan

Backend CJS menolak host database non-localhost. Ia membuat skema unik yang berakhiran `_test`, lalu menghapus hanya skema yang dibuatnya. Push eksternal dimatikan. Semua token/alamat email dalam fixture bersifat sintetis. Jangan menjalankan simulator IoT terhadap URL produksi untuk mengulang tes ini.

Kebutuhan: Node.js, dependencies mobile/backend yang sudah terpasang, PostgreSQL lokal khusus pengujian pada port 55439 dengan user `fluxen_test`. Cluster pengujian sesi ini berada di `output/testing/runtime/pgdata`; cluster tersebut bukan database Supabase atau database aplikasi utama.

Untuk cluster yang sudah dibuat pada sesi ini, dari root proyek:

```powershell
$root = (Get-Location).Path
& 'C:/Program Files/PostgreSQL/18/bin/pg_ctl.exe' -D "$root/output/testing/runtime/pgdata" -l "$root/output/testing/runtime/postgres.log" -o '-h 127.0.0.1 -p 55439' -w start
node tools/run-blackbox-selftest.cjs
& 'C:/Program Files/PostgreSQL/18/bin/pg_ctl.exe' -D "$root/output/testing/runtime/pgdata" -m fast -w stop
```

Cluster yang belum ada harus diinisialisasi terlebih dahulu sebagai cluster khusus tes, bukan menggunakan folder database lain.

Mode default tidak mengulang browser; baris yang memerlukan bukti browser tidak boleh dianggap lulus dari bukti lama. Untuk pengulangan browser, jalankan preview terlebih dahulu di terminal terpisah:

```powershell
cd mobile
$env:EXPO_PUBLIC_API_BASE_URL_WEB='http://localhost:8099/api/v1'
$env:CI='1'
node node_modules/expo/bin/cli start --web --port 8081 --offline
```

Kemudian pada root proyek, dengan PostgreSQL pengujian masih aktif:

```powershell
$env:PLAYWRIGHT_MODULE='C:/Users/danie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:CHROME_EXECUTABLE='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
node tools/run-blackbox-selftest.cjs --visual
```

Setiap harness browser memblokir jaringan selain preview localhost dan endpoint fixture localhost. Tidak ada perangkat nyata yang dibuat.

Untuk menyusun ulang laporan dari bukti yang sudah tersedia tanpa menjalankan tes lagi:

```powershell
node tools/run-blackbox-selftest.cjs --report-only
```

Laporan dan bukti mentah disimpan di `output/testing/2026-10-29/`, screenshot browser di `mobile/coverage/ui-review/`. Keduanya diabaikan Git. Salin/arsipkan laporan terpilih bila diperlukan untuk lampiran skripsi.

Untuk bukti UI registrasi/login tambahan, dengan Expo lokal masih aktif dan variabel Playwright/Edge di atas terpasang:

```powershell
cd mobile
node tests/visual/run-auth-ui-proof.cjs
```

Script ini menguji input melalui UI browser yang benar-benar dirender, merekam screenshot dan jumlah request registrasi. Respons akun duplikat/login gagal/sukses menggunakan fixture API, bukan akun produksi. Galeri disimpan di `output/testing/2026-10-29/ui-proof/index.html`. Temuan UX dicatat terpisah dari status assertion dan tidak otomatis diperbaiki.

## Kampanye 193 kasus UI browser

`mobile/tests/visual/run-ui-193.cjs` menjalankan katalog baru: **95 skenario fungsional × 2 bahasa (Indonesia/Inggris), ditambah 3 pengujian unduhan XLSX**. Angka 193 adalah kombinasi kasus-bahasa, bukan 193 fitur unik dan bukan angka dari Jest. Setiap kasus dimulai dengan fixture database baru, interaksi klik/isian pada UI Expo asli, assertion keluaran UI, serta screenshot browser tanpa modifikasi.

Berbeda dari harness visual terdahulu, respons bisnis berasal dari **backend Express dan PostgreSQL lokal asli** melalui `local-ui-backend.cjs`. Hanya kasus gangguan koneksi yang membatalkan transport jaringan secara sengaja. Push eksternal dimatikan dan jaringan browser di luar preview/API localhost diblokir. Middleware rate limit tetap aktif, dengan alamat klien sintetis berbeda per kasus agar tes tidak saling menghabiskan kuota.

Dengan PostgreSQL pengujian dan Expo web localhost di atas sudah aktif:

```powershell
$env:PLAYWRIGHT_MODULE='C:/Users/danie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:CHROME_EXECUTABLE='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
node mobile/tests/visual/run-ui-193.cjs
```

Laporan Markdown, JSON, galeri HTML, 193 screenshot, dan berkas XLSX disimpan pada `output/testing/2026-10-29/ui-193/`. Hasil `failed` harus ditinjau: kesalahan selector/setup alat uji perlu dibedakan dari kegagalan aplikasi, kemudian kasus terkait diulang. Jangan mengubah kode produksi untuk membuat tes terlihat lulus. Jam browser berjalan normal pada tanggal fixture agar callback animasi tidak membeku.

Opsi diagnosis: `--only=HIS --case=3 --limit=1`; gunakan `UI_EVIDENCE_DIR` berbeda agar tidak menimpa laporan lengkap. `UI_PROBE=1` menyimpan DOM untuk diagnosis selector. DOM dan screenshot hanya berisi data lokal sintetis. Audit JSON menyamarkan password/token. Katalog ini tidak menguji ESP32, pairing BLE, notifikasi native/background, tampilan APK Android, atau interaksi filter di aplikasi Excel eksternal.

## Penulisan pada skripsi dan batas klaim hasil

Jangan menyebut seluruh hasil ini sebagai uji manual APK. Gunakan penjelasan bahwa pengujian otomatis dilakukan pada komponen antarmuka dengan layanan simulasi, didukung pemeriksaan backend-database lokal. Hasil browser web tidak membuktikan izin Bluetooth Android, penerimaan push saat layar terkunci, tombol Back sistem, insets Android atau reset ESP32.

`Parsial (API lokal)` berarti perilaku server telah diperiksa tetapi keluaran antarmuka untuk kasus tersebut belum lengkap. `Dilewati` dan `Belum diuji` tidak dihitung sebagai lulus. Banyak variasi yang digabung dalam satu baris tetap dijalankan terpisah; pesan required/minimum/maximum tidak disamakan.
