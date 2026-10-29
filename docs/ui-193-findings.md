# Hasil pengujian UI — 29 Oktober 2026

Katalog: 95 skenario fungsional dalam bahasa Indonesia dan Inggris (190 kombinasi), ditambah 3 unduhan XLSX. Hasil awal sebelum perbaikan: **193 eksekusi UI, 191 lulus, 2 gagal**. Setelah pengulangan bahasa digabung, hasil awal tersebut mencakup **98 skenario unik, 97 Valid dan satu Tidak valid**. Ini bukan 193 fitur berbeda atau penghitungan ulang tes Jest.

Uji ulang lengkap setelah perbaikan BB-DEV-009: **193 dari 193 eksekusi UI lulus**, mencakup **98 skenario unik yang seluruhnya Valid**. Tidak ada uncaught runtime error browser. Bukti baru beserta 193 screenshot disimpan di `output/testing/2026-10-29/ui-after-device-fix/`; hasil awal tidak ditimpa. Catatan tata letak kategori panjang tetap terbuka dan tidak otomatis dianggap selesai oleh keberhasilan fungsional ini.

Pengujian memakai UI Expo web yang dirender oleh Edge headless pada 393 × 852, backend Express asli dan skema PostgreSQL sementara di localhost. Data fixture dikembalikan melalui HTTP asli; kegagalan koneksi tertentu disimulasikan dengan memutus request. Tidak ada perubahan data produksi, komunikasi ESP32 atau pengiriman push eksternal.

Laporan lengkap: `output/testing/2026-10-29/ui-193/results.md`, `results.json` dan galeri `index.html`. Terdapat 193 ID unik dan 193 screenshot. Berkas `month.xlsx`, `all.xlsx`, dan `empty.xlsx` benar-benar diunduh oleh browser. Folder bukti tidak masuk Git.

## UI-DEF-001 — nama detail perangkat belum diperbarui

- Kasus: `UI-DEV-009-ID` dan `UI-DEV-009-EN`.
- Langkah: buka Kitchen Meter → Ubah → isi Kitchen Renamed, lokasi Room B dan kategori Garden → Simpan → tunggu kembali ke detail.
- Hasil: konfirmasi berhasil tampil dan PATCH lokal mengembalikan 200 dengan data baru. Halaman detail tetap menampilkan **Kitchen Meter** setelah kembali, termasuk setelah beberapa siklus refresh telemetry.
- Penyebab yang sesuai dengan implementasi: `DeviceDashboardScreen` membaca identitas dari `route.params.device`; proses refresh mengambil telemetry/batas/peringatan, bukan identitas terbaru. `DeviceEditScreen` menyimpan lalu `goBack()` tanpa memperbarui parameter detail.
- Arah perbaikan: segarkan identitas perangkat saat halaman detail kembali fokus atau propagasikan hasil pembaruan ke state/parameter detail. Jangan hanya mengubah tampilan nama tanpa memperbarui metadata lain.
- Status: **sudah diperbaiki secara lokal**. Detail perangkat memanggil endpoint autentikasi `GET /devices/:id` saat kembali fokus dan saat penyegaran manual, lalu memperbarui seluruh objek perangkat pada parameter navigasi. Nama, lokasi, dan kategori diteruskan dengan data terbaru ke halaman berikutnya. Pengambilan identitas tidak ditambahkan ke polling telemetry empat detik.
- Uji ulang terfokus: `output/testing/2026-10-29/device-edit-fix/results.json`; kedua bahasa lulus. Form edit dibuka ulang untuk memeriksa nama Kitchen Renamed, lokasi Room B dan kategori Garden. Screenshot hasil tersedia pada direktori yang sama. Hasil awal tetap disimpan sebagai catatan sebelum perbaikan.
- Regresi mobile: seluruh **198 tes pada 25 suite lulus**, termasuk empat tes regresi dashboard dan tes endpoint identitas perangkat. Bukti: `device-edit-fix/mobile-regression.json`. Harness Jest masih mengeluarkan peringatan `act` dari VirtualizedList; tidak ada tes yang gagal pada run regresi final.
- Perubahan belum dipush atau dideploy sebagai APK. Backend, database produksi dan firmware tidak diubah oleh perbaikan ini.

## UI-UX-001 — nama kategori panjang

- Bukti: `UI-KAT-001-ID.png` dan `UI-KAT-001-EN.png`.
- Nama valid 80 karakter tanpa spasi diterima, tetapi pada layar 393 px dapat mendorong kontrol Ubah/Hapus keluar area kartu. Ini temuan pemeriksaan visual tambahan, terpisah dari 193 assertion fungsional.
- Arah perbaikan: batasi lebar teks secara fleksibel dan pertahankan area aksi; beri pembungkusan/ellipsis yang sesuai tanpa menghilangkan akses ke tindakan.
- Status: **belum diperbaiki**.

## Batas bukti

Ini bukan pengujian APK Android fisik. BLE, reset ESP32, izin native, push saat aplikasi ditutup/layar terkunci, tombol Back Android dan inset sistem belum dibuktikan oleh katalog browser ini. Pembacaan berasal dari fixture database lokal, bukan sensor air nyata. Pengunduhan XLSX membuktikan jalur UI → backend → berkas valid dan periode yang dipilih, bukan interaksi filter di aplikasi Excel eksternal.

Lihat `blackbox-selftest.md` untuk menjalankan ulang. Kegagalan setup/selector pada tahap diagnosis dibedakan dari hasil final dan tidak dilaporkan sebagai bug aplikasi.
