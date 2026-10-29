// Build the thesis-facing table from execution evidence, never from code inspection alone.
// Run tests first; this command only reads their results and creates MD/HTML reports.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const out = process.env.BLACKBOX_EVIDENCE_DIR || path.join(root, "output/testing/2026-10-29");
const read = name => JSON.parse(fs.readFileSync(path.join(out, name), "utf8"));
const mobile = read("mobile-final.json");
const api = read("api-observations.json").results;
const observations = read("ui-observations.json");
const testResults = mobile.testResults.flatMap(suite => suite.assertionResults.map(test => ({ ...test, file: path.basename(suite.name) })));
const oldestRun = read("mobile-baseline.json").startTime;
const J = (file, fragment, minimum = 1) => {
    const matches = testResults.filter(test => test.file === file && test.fullName.includes(fragment));
    return { source: `Jest: ${file} :: ${fragment}`, type: "ui", passed: matches.length >= minimum && matches.every(test => test.status === "passed"), missing: !matches.length, count: matches.length };
};
const U = (id, minimum = 1) => J("blackbox-expanded.test.js", `${id} |`, minimum);
const A = id => {
    const record = api.find(row => row.id === id);
    return { source: `HTTP lokal: ${id}`, type: "api", passed: record?.status === "passed", missing: !record, actual: record?.actual };
};
const V = (name, count) => {
    const file = path.join(root, "mobile/coverage/ui-review", name);
    if (process.env.BLACKBOX_SKIP_VISUAL === "1") return { source: `Browser: ${name}`, type: "browser", passed: false, missing: true };
    if (!fs.existsSync(file) || fs.statSync(file).mtimeMs < oldestRun) return { source: `Browser: ${name}`, type: "browser", passed: false, missing: true };
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return { source: `Browser: ${name}`, type: "browser", passed: Array.isArray(data.results) && data.results.length >= count && !(data.runtimeErrors?.length), missing: false, count: data.results?.length };
};
const rows = [];
function add(group, id, scenario, expected, refs, actual, note = "") {
    const missing = refs.length === 0 || refs.some(ref => ref.missing);
    const failed = refs.some(ref => !ref.passed && !ref.missing);
    const onlyApi = refs.length > 0 && refs.every(ref => ref.type === "api");
    const status = failed ? "Gagal" : missing ? "Belum diuji" : onlyApi ? "Parsial (API lokal)" : "Lulus simulasi";
    const ui = observations.filter(record => record.id === id);
    // Merge identical observed responses, but retain distinct required/min/max messages.
    const byMessage = new Map();
    for (const record of ui) {
        const message = record.actual.replace(/[.;]+$/, "");
        byMessage.set(message, [...(byMessage.get(message) || []), record.variation]);
    }
    const observed = [...byMessage].map(([message, variations]) => `${variations.join(" / ")}: ${message}`).join("; ") + (ui.length ? "." : "");
    const apiActual = refs.filter(ref => ref.type === "api").map(ref => ref.actual).filter(Boolean).join(" ");
    rows.push({ group, id, scenario, expected, actual: failed ? "Ada assertion yang gagal; lihat bukti eksekusi." : missing ? "Belum tersedia bukti lengkap untuk kasus ini." : [observed || actual, apiActual].filter(Boolean).join(" "), status, note, evidence: refs });
}
function skip(group, id, scenario, expected, reason) {
    rows.push({ group, id, scenario, expected, actual: `Dilewati: ${reason}`, status: "Dilewati", evidence: [] });
}

const reg = "A. Registrasi pengguna";
add(reg,"BB-REG-001","Registrasi valid dan perapian spasi nama/email.","Pesan berhasil dan halaman Login muncul; data tepi dirapikan.",[J("register-screen.test.js","submits normalized data"),A("BB-REG-001")],"UI mengirim nama/email tanpa spasi tepi dan mengarahkan ke Login setelah respons berhasil.");
add(reg,"BB-REG-002","Registrasi menggunakan email terdaftar.","Registrasi ditolak; pesan email telah digunakan muncul.",[J("register-screen.test.js","maps duplicate email"),A("BB-REG-002")],"UI menampilkan This email is already registered.");
add(reg,"BB-REG-003","Nama kosong, 1 karakter, atau lebih dari 120 karakter.","Registrasi ditolak; pesan dibedakan sesuai kesalahan.",[U("BB-REG-003",3)]);
add(reg,"BB-REG-004","Nama tepat pada batas valid: 2 dan 120 karakter.","Masukan diterima dan alur registrasi dilanjutkan.",[U("BB-REG-004",2)]);
add(reg,"BB-REG-005","Email kosong, format salah, atau lebih dari 150 karakter.","Registrasi ditolak dengan pesan email sesuai pelanggaran.",[U("BB-REG-005",3)]);
add(reg,"BB-REG-006","Kata sandi kosong, kurang dari 8, atau lebih dari 100 karakter.","Registrasi ditolak dengan pesan kata sandi sesuai pelanggaran.",[U("BB-REG-006",3)]);
add(reg,"BB-REG-007","Kata sandi tepat 8 dan 100 karakter.","Masukan diterima dan alur registrasi dilanjutkan.",[U("BB-REG-007",2)]);

const auth = "B. Login dan sesi";
add(auth,"BB-AUT-001","Login valid, termasuk email dengan spasi tepi.","Kredensial dirapikan dan sesi akun yang benar diperoleh.",[J("login-screen.test.js","trims email"),A("BB-AUT-001")],"UI mengirim email tanpa spasi tepi.");
add(auth,"BB-AUT-002","Login dengan kredensial salah.","Login ditolak dan pesan kredensial salah ditampilkan.",[J("login-screen.test.js","shows backend or connectivity errors"),A("BB-AUT-002")],"UI dapat menampilkan pesan penolakan login yang dikembalikan transport simulasi.");
add(auth,"BB-AUT-003","Email kosong/salah format atau kata sandi kosong saat login.","Login ditolak tanpa membentuk sesi baru.",[U("BB-AUT-003",3),A("BB-AUT-003")]);
add(auth,"BB-AUT-004","Kegagalan koneksi dan timeout permintaan.","Permintaan berhenti dan pesan koneksi/timeout ditampilkan.",[J("api-service.test.js","maps a network failure"),J("api-service.test.js","aborts a request"),J("login-screen.test.js","shows backend or connectivity errors")],"Kegagalan jaringan dipetakan ke pesan koneksi; request timeout dibatalkan; pesan error terlihat pada Login.");
add(auth,"BB-AUT-005","Pemulihan sesi valid ketika aplikasi dimulai kembali.","Sesi dapat dipulihkan tanpa login ulang.",[J("auth-push-lifecycle.test.js","keeps the session until"),J("startup-navigation.test.js","authenticated user")],"Sesi tersimpan dipulihkan dan navigasi pengguna terautentikasi tersedia.");
add(auth,"BB-AUT-006","Pemulihan sesi dengan JWT ditolak.","Sesi lokal dibersihkan dan pengguna dianggap belum login.",[J("auth-push-lifecycle.test.js","a rejected JWT")],"Status signed-out muncul dan clearAccessToken dipanggil.");
add(auth,"BB-AUT-007","Gangguan sementara saat pemulihan sesi.","Gangguan koneksi tidak langsung menghapus sesi tersimpan.",[J("auth-push-lifecycle.test.js","temporary restoration failures")],"Sesi tetap signed-in; token lokal tidak dihapus.");
add(auth,"BB-AUT-008","Logout berhasil dan penekanan Logout berulang.","Sesi dibersihkan setelah pencabutan push selesai; operasi logout tidak digandakan.",[J("auth-push-lifecycle.test.js","keeps the session until")],"Pencabutan dipanggil sekali; sesi berubah signed-out setelah proses selesai.");
add(auth,"BB-AUT-009","Logout gagal karena pencabutan langganan tidak selesai.","Sesi dipertahankan agar pengguna dapat mencoba lagi.",[J("auth-push-lifecycle.test.js","a revocation failure")],"Sesi tetap aktif dan token lokal tidak dihapus.");

const cat = "C. Kategori";
add(cat,"BB-KAT-001","Tambah kategori valid; nama 2 dan 80 karakter.","Kategori diterima dan daftar diperbarui.",[U("BB-KAT-001"),A("BB-KAT-001")]);
add(cat,"BB-KAT-002","Nama kategori kosong/spasi, 1 karakter, atau 81 karakter.","Kategori ditolak dengan pesan kesalahan yang sesuai.",[U("BB-KAT-002",3),A("BB-KAT-002")],"","Kosong/spasi/minimum diuji di UI; batas maksimum juga diuji pada API lokal.");
add(cat,"BB-KAT-003","Duplikasi nama dengan kapitalisasi atau spasi berbeda.","Kategori duplikat tidak dibuat.",[U("BB-KAT-003"),A("BB-KAT-003")]);
add(cat,"BB-KAT-004","Mengubah nama kategori.","Nama baru disimpan dan terlihat pada daftar.",[U("BB-KAT-004"),A("BB-KAT-004")]);
add(cat,"BB-KAT-005","Mengubah nama menjadi kategori yang sudah ada.","Perubahan ditolak dan data lama tetap berlaku.",[U("BB-KAT-005"),A("BB-KAT-005")]);
add(cat,"BB-KAT-006","Membatalkan pengubahan kategori.","Form ditutup tanpa menyimpan perubahan.",[U("BB-KAT-006")]);
add(cat,"BB-KAT-007","Menyetujui penghapusan kategori.","Dialog konfirmasi diikuti hilangnya kategori dari daftar.",[U("BB-KAT-007")]);
add(cat,"BB-KAT-008","Menghapus kategori yang dipakai perangkat.","Perangkat tetap ada dengan kategori kosong/Uncategorized.",[U("BB-KAT-008"),A("BB-KAT-008")]);
add(cat,"BB-KAT-009","Membatalkan penghapusan kategori.","Kategori tetap tersedia.",[U("BB-KAT-009")]);

const dev = "D. Perangkat";
add(dev,"BB-DEV-001","Menambah perangkat dengan kategori.","Perangkat dibuat dan token baru tersedia.",[J("devices-screen.test.js","carries a newly created"),A("BB-DEV-001")],"Dialog token terlihat setelah respons create berhasil.");
add(dev,"BB-DEV-002","Menambah perangkat tanpa kategori/lokasi.","Perangkat dibuat dengan kategori dan lokasi kosong.",[U("BB-DEV-002"),A("BB-DEV-002")]);
add(dev,"BB-DEV-003","Kode kosong, 2, atau 51 karakter.","Kode di luar 3–50 karakter ditolak.",[U("BB-DEV-003",2),A("BB-DEV-003")],"","Kode minimum diuji di UI; maksimum melalui API lokal.");
add(dev,"BB-DEV-004","Kode tepat 3 dan 50 karakter.","Perangkat dapat dibuat dengan kode pada batas valid.",[U("BB-DEV-004",2),A("BB-DEV-004")]);
add(dev,"BB-DEV-005","Nama kosong, 1, atau 101 karakter.","Nama di luar 2–100 karakter ditolak.",[U("BB-DEV-005",2),A("BB-DEV-005")]);
add(dev,"BB-DEV-006","Nama tepat 2 dan 100 karakter.","Nama pada batas valid diterima.",[U("BB-DEV-006",2),A("BB-DEV-006")]);
add(dev,"BB-DEV-007","Lokasi tepat 150 karakter.","Lokasi diterima.",[U("BB-DEV-007"),A("BB-DEV-007")]);
add(dev,"BB-DEV-008","Lokasi 151 karakter.","Lokasi ditolak dan pesan batas panjang muncul.",[U("BB-DEV-008"),A("BB-DEV-008")]);
add(dev,"BB-DEV-009","Kode perangkat sudah terdaftar.","Perangkat duplikat tidak dibuat.",[U("BB-DEV-009"),A("BB-DEV-009")]);
add(dev,"BB-DEV-010","Ubah nama/kategori dan kosongkan lokasi.","Perubahan disimpan, lokasi dapat dikosongkan.",[U("BB-DEV-010"),A("BB-DEV-010")]);
add(dev,"BB-DEV-011","Mengubah kategori ke Uncategorized.","Perangkat disimpan tanpa kategori.",[U("BB-DEV-011"),A("BB-DEV-011")]);
add(dev,"BB-DEV-012","Menyetujui penghapusan perangkat.","Penghapusan diantrekan dan perangkat tidak lagi ada pada daftar.",[J("devices-screen.test.js","confirms deletion"),A("BB-DEV-012")],"UI menampilkan Removal queued; reset ESP32 fisik tidak diuji.");
add(dev,"BB-DEV-013","Membatalkan penghapusan perangkat.","Perangkat tetap tersedia; tidak ada permintaan delete.",[U("BB-DEV-013")]);
add(dev,"BB-DEV-014","Menyalin token perangkat.","Token dikirim ke clipboard dan dialog tetap dapat ditutup/dibuka kembali.",[J("devices-screen.test.js","carries a newly created"),V("token-dialog-results.json",8)],"Clipboard mock menerima token dummy; dialog diuji pada dua bahasa dan dua ukuran layar.");
add(dev,"BB-DEV-015","Melanjutkan dari dialog token ke halaman BLE.","Halaman BLE menerima token dan kode perangkat.",[J("devices-screen.test.js","carries a newly created")],"Navigasi BLEScan menerima apiToken dan deviceCode dummy; koneksi fisik tidak dijalankan.");
add(dev,"BB-DEV-016","Filter All/Online/Offline.","Daftar mengikuti status yang dipilih.",[U("BB-DEV-016")]);
add(dev,"BB-DEV-017","Filter kategori termasuk Uncategorized.","Hanya perangkat kategori terpilih ditampilkan.",[J("devices-screen.test.js","filters devices by category"),U("BB-DEV-017")]);
add(dev,"BB-DEV-018","Kombinasi status/kategori tanpa hasil.","Daftar kosong dengan informasi yang sesuai.",[U("BB-DEV-018")]);

const ble = "E. BLE provisioning";
add(ble,"BB-BLE-001","Izin Bluetooth ditolak.","Pemindaian tidak dimulai dan pesan izin muncul.",[J("ble-provision-screen.test.js","denied permission")],"Handler scan tidak dipanggil saat izin native yang disimulasikan ditolak.");
add(ble,"BB-BLE-002","Kolom konfigurasi wajib belum lengkap.","Tombol kirim belum aktif sampai data wajib tersedia.",[J("ble-provision-screen.test.js","shared panels retain")],"Alur formulir, prefill token, dan pemanggilan write diuji dengan BLE mock.");
skip(ble,"BB-BLE-003","Pemindaian tanpa perangkat dan penghentian sekitar 15 detik.","Pemindaian selesai tanpa perangkat ditemukan.","memerlukan perilaku adapter Bluetooth nyata untuk klaim APK.");
skip(ble,"BB-BLE-004","Bluetooth ponsel mati atau perangkat tidak dapat dijangkau.","Pesan kegagalan koneksi sesuai kondisi muncul.","memerlukan ponsel/adapter Bluetooth nyata.");
skip(ble,"BB-BLE-005","Menghubungkan ESP32 dan membaca kode perangkat.","Koneksi berhasil dan kode ESP32 tampil.","memerlukan ESP32 fisik.");
skip(ble,"BB-BLE-006","Mengirim konfigurasi, memutus koneksi, dan mencoba kembali.","ESP32 menerima konfigurasi; UI menampilkan status sesuai hasil.","pengiriman dan penerimaan BLE fisik tidak diuji.");
skip(ble,"BB-BLE-007","Wi-Fi tanpa kata sandi.","Konfigurasi jaringan terbuka dapat digunakan ESP32.","keberhasilan jaringan pada ESP32 perlu pengujian IoT.");

const home = "F. Home dan grafik";
add(home,"BB-HOM-001","Home dengan data dummy online/offline dalam dua bahasa.","Ringkasan, status dan grafik terlihat tanpa overflow.",[V("results.json",8)],"Browser dummy lulus 8 kombinasi bahasa/viewport; tidak ada runtime error yang tercatat.");
add(home,"BB-HOM-002","Rentang 10, 11, dan 30 hari; volume nol/non-nol.","Grafik tetap terlihat dan dapat digeser.",[V("home-chart-results.json",1),J("home-usage-chart.test.js","switching between short and long ranges")],"Grafik rentang pendek/panjang diuji melalui komponen dan browser dummy.");
add(home,"BB-HOM-003","Tekan batang, ganti pilihan dan pilih hari bernilai nol.","Tanggal serta volume yang dipilih tampil tepat.",[V("daily-usage-interaction-results.json",8),J("daily-usage-bar-chart.test.js","zero-volume day")],"Home: 27 Oktober 2026 menampilkan 8.700 L atau 0.000 L pada fixture EN; format ID juga diverifikasi.");
add(home,"BB-HOM-004","Ganti periode atau perbarui nilai setelah batang dipilih.","Pergantian periode membersihkan pilihan; pembaruan nilai memperbarui readout.",[J("daily-usage-bar-chart.test.js","changing the date range"),J("daily-usage-bar-chart.test.js","refreshing totals")],"Pilihan dibersihkan saat rentang berubah; nilai baru 13.125 L muncul tanpa kehilangan hari pada rentang sama.");

const dash = "G. Detail perangkat";
for (const [id,title,expected,actual] of [
    ["BB-DAS-001","Ringkasan perangkat online dari data dummy.","Status, debit saat ini, total, rata-rata dan puncak sesuai fixture.","Online; 1.25 L/min; total 13.000 L; rata-rata 2.00 L/min; puncak 3.00 L/min."],
    ["BB-DAS-002","Ringkasan perangkat offline.","Debit saat ini nol; riwayat penggunaan tetap tersedia.","Offline dan 0.00 L/min; total historis tetap 13.000 L."],
    ["BB-DAS-003","Perangkat tanpa pembacaan.","Informasi belum ada pembacaan dan nilai nol, tanpa error.","No readings yet; 0.000 L; No data to chart dan No readings today."],
    ["BB-DAS-004","Accordion dan pilihan Batang/Garis debit.","Bagian dapat dibuka/ditutup dan jenis grafik berganti.","Komponen grafik batang, garis, dan pemakaian per jam dirender sesuai pilihan."],
    ["BB-DAS-005","Riwayat per jam dan View More/View Less.","Riwayat diperluas/diringkas; seri per jam sesuai data.","Show 3 more/Show less berganti; 24 bucket jam berjumlah 13 L."],
    ["BB-DAS-006","Navigasi History, Edit, dan Limits.","Halaman tujuan menerima perangkat yang sama.","UsageHistory, DeviceEdit, dan UsageLimits menerima objek perangkat yang sesuai."],
]) add(dash,id,title,expected,[J("blackbox-dashboard.test.js",`${id} |`)],actual);

const history = "H. Riwayat penggunaan";
add(history,"BB-HIS-001","Riwayat periode dengan data dummy yang diketahui.","Penggunaan sesuai perangkat dan periode.",[A("BB-HIS-001"),V("daily-usage-interaction-results.json",8)],"Browser History menampilkan 4.350 L untuk tanggal fixture yang dipilih; API lokal memverifikasi data dummy berbeda secara terpisah.");
add(history,"BB-HIS-002","Memilih periode 30 hari.","Permintaan riwayat mencakup 30 hari inklusif.",[J("usage-history-export.test.js","loads the selected 30-day")],"Selisih tanggal inklusif pada permintaan adalah 30 hari.");
add(history,"BB-HIS-003","Custom valid kurang dari 30 hari.","Rentang yang dipilih diterapkan.",[J("usage-history-export.test.js","BB-HIS-003 |")],"Permintaan berisi 1–15 Januari 2026; tidak ada peringatan pembatasan.");
add(history,"BB-HIS-004","Custom tepat 30 hari dan melebihi 30 hari.","Tepat 30 diterima; melebihi 30 dibatasi dan diberi pemberitahuan.",[J("usage-history-export.test.js","BB-HIS-004 |"),J("usage-history-export.test.js","warns and caps")],"1–30 Januari diterima; pilihan hingga 15 Februari menampilkan Range limited.");
add(history,"BB-HIS-005","Custom satu hari.","Tanggal awal dan akhir sama digunakan.",[J("usage-history-export.test.js","BB-HIS-005 |")],"Permintaan memakai from dan to 2026-01-01.");
add(history,"BB-HIS-006","Membatalkan kalender.","Periode sebelum membuka kalender tetap digunakan.",[J("usage-history-export.test.js","BB-HIS-006 |")],"Argumen periode tidak berubah setelah Cancel.");
add(history,"BB-HIS-007","Pilihan Batang/Garis dan interaksi tanggal-volume.","Jenis grafik berganti dan readout sesuai batang.",[J("usage-history-export.test.js","BB-HIS-007 |"),V("daily-usage-interaction-results.json",8)],"Grafik batang dapat diganti garis lalu kembali; tanggal-volume pada History diverifikasi di browser.");
add(history,"BB-HIS-008","Rincian harian tetap tersedia pada periode panjang.","Rincian dapat dibuka dengan pilihan untuk menampilkan baris tambahan.",[V("daily-usage-interaction-results.json",8)],"Daily Details dapat dibuka dan tombol Show 20 more terlihat; penekanan View Less khusus halaman ini belum dicakup.","Cakupan terbatas: tidak menyatakan seluruh tombol rincian telah diuji.");

const limits = "I. Batas penggunaan";
add(limits,"BB-LIM-001","Simpan dan baca kembali batas positif.","Nilai batas tersimpan.",[J("usage-limits.test.js","BB-LIM-001 |"),A("BB-LIM-001")],"UI mengirim kedua nilai batas yang diisi.");
add(limits,"BB-LIM-002","Aktifkan harian saja atau bulanan saja.","Batas lain dapat dinonaktifkan tanpa mengganggu batas aktif.",[J("usage-limits.test.js","saves positive limits"),A("BB-LIM-002")],"UI mengirim nilai desimal harian dan null untuk bulanan.");
add(limits,"BB-LIM-003","Kosongkan kedua batas.","Kedua batas nonaktif.",[J("usage-limits.test.js","BB-LIM-003 |"),A("BB-LIM-003")],"UI mengirim null untuk kedua batas.");
add(limits,"BB-LIM-004","Batas nol, negatif, dan nonangka.","Masukan ditolak; pesan validasi muncul.",[J("usage-limits.test.js","rejects invalid limit",3),A("BB-LIM-004")],"UI menampilkan pesan batas harus positif atau dikosongkan; API simpan tidak dipanggil untuk input invalid.");
add(limits,"BB-LIM-005","Batas desimal positif.","Nilai desimal diterima.",[J("usage-limits.test.js","saves positive limits"),A("BB-LIM-005")],"UI mengirim 25.5 tanpa pembulatan ke bilangan bulat.");

const notices = "J. Peringatan dan notifikasi";
add(notices,"BB-NTF-001","Tampilkan dan tutup peringatan aktif dari fixture.","Peringatan hilang dari daftar setelah ditutup.",[J("blackbox-dashboard.test.js","BB-NTF-001 |")],"Dismiss memanggil API untuk alert 99; No active alerts tampil setelah respons berhasil.");
add(notices,"BB-NTF-002","Tekan notifikasi perangkat sendiri/akun lain.","Hanya perangkat milik akun aktif boleh dibuka.",[J("notification-navigation.test.js","opens only an owned"),J("notification-navigation.test.js","another account")],"Payload notifikasi sintetis membuka DeviceDashboard sekali; payload akun lain tidak membuka perangkat.");
skip(notices,"BB-NTF-003","Push ketika aplikasi terbuka/background/layar terkunci.","Android menampilkan notifikasi sesuai izin dan pengaturan perangkat.","penerimaan push nyata membutuhkan APK dan ponsel; provider mock bukan bukti penerimaan.");
skip(notices,"BB-NTF-004","Push setelah aplikasi disingkirkan dari recent apps.","Notifikasi tetap diterima sesuai kebijakan Android.","memerlukan pengujian ponsel nyata; bukan Force stop.");
add(notices,"BB-NTF-005","Izin push ditolak atau dicabut.","Token tidak diminta tanpa izin; langganan lama dilepas ketika izin dicabut.",[J("push-registration.test.js","denied permission"),J("push-registration.test.js","permission revoked")],"Dengan izin native mock ditolak, Expo token tidak diminta; pencabutan izin memicu pelepasan token tersimpan.","Tidak mengklaim notifikasi pada tray Android sudah diperiksa.");

const bill = "K. Harga air dan Bill Estimation";
add(bill,"BB-BIL-001","Harga positif termasuk desimal.","Harga tersimpan dan dapat dibaca kembali.",[U("BB-BIL-001",2),A("BB-BIL-001")]);
add(bill,"BB-BIL-002","Harga kosong, nol, negatif, nonangka.","Harga tidak disimpan.",[U("BB-BIL-002",4),A("BB-BIL-002")]);
add(bill,"BB-BIL-003","Estimasi satu dan beberapa perangkat.","Total dan biaya sesuai penggunaan serta harga.",[J("billing-estimation.test.js","BB-BIL-003 |"),A("BB-BIL-003")],"Ringkasan dan hasil per perangkat di UI sama-sama menampilkan 3 L dan nominal Rp30 dalam format locale fixture.");
add(bill,"BB-BIL-004","Filter kategori dan perpindahan kategori.","Perangkat kategori lain tidak ikut dihitung.",[J("billing-estimation.test.js","only submits selected devices"),A("BB-BIL-004")],"UI hanya mengirim ID perangkat kategori aktif.");
add(bill,"BB-BIL-005","Tanpa pilihan perangkat atau periode tanpa data.","Tanpa pilihan: daftar kosong; tanpa data: perangkat dipertahankan dengan nilai nol.",[J("billing-estimation.test.js","submits an empty device list"),A("BB-BIL-005")],"UI mengirim device_ids kosong saat seluruh centang dihapus.");
add(bill,"BB-BIL-006","Akun belum mengatur harga air.","Estimasi ditolak dengan informasi harga belum diatur.",[J("billing-estimation.test.js","BB-BIL-006 |"),A("BB-BIL-006")],"UI menampilkan pesan harga belum diatur setelah Apply.");
add(bill,"BB-BIL-007","Periode Day, Month, Year.","Tanggal permintaan sesuai preset sampai hari ini.",[J("billing-estimation.test.js","BB-BIL-007 |",3)],"Day: hari ini; Month: tanggal 1 bulan ini; Year: 1 Januari; ketiganya berakhir hari ini.");
add(bill,"BB-BIL-008","Harga diubah lalu estimasi dihitung ulang.","Nominal mengikuti harga terbaru.",[J("billing-estimation.test.js","BB-BIL-008 |"),A("BB-BIL-008")],"UI mengganti nominal Rp30 menjadi Rp60 setelah Apply ulang.");
add(bill,"BB-BIL-009","Custom dan navigasi Manage Water Price.","Periode custom dapat diterapkan dan halaman harga dapat dibuka.",[J("billing-estimation.test.js","BB-BIL-009 |")],"Navigasi ke BillingSettings dipanggil; pilihan tanggal custom 2026-01-01 diteruskan saat Apply.");

const exportGroup = "L. Ekspor XLSX";
add(exportGroup,"BB-EXP-001","Ekspor periode berisi data dan buka workbook.","Workbook valid, dua sheet tersedia, penggunaan sesuai data.",[A("BB-EXP-001"),J("usage-history-export.test.js","shows a visible success")],"UI menampilkan pesan berkas siap setelah alur berbagi native simulasi.");
add(exportGroup,"BB-EXP-002","Ekspor periode tanpa pembacaan.","Workbook tetap dapat dibuka tanpa baris data palsu.",[J("usage-history-export.test.js","shows a visible success"),A("BB-EXP-002")],"UI fixture history kosong tetap dapat menyelesaikan alur berbagi simulasi; isi workbook kosong diverifikasi terpisah melalui HTTP lokal.");
add(exportGroup,"BB-EXP-003","Pilih All terpisah dari periode grafik.","Ekspor memakai 1 Januari–31 Desember tahun berjalan.",[J("usage-history-export.test.js","BB-EXP-003 |")],"Permintaan export memakai rentang setahun penuh walau riwayat tetap pada periode grafik sebelumnya.");
add(exportGroup,"BB-EXP-004","Ekspor gagal dan Retry.","Pesan gagal muncul; Retry mengulang ekspor tanpa memuat ulang riwayat.",[J("usage-history-export.test.js","shows a visible failure"),J("usage-history-export.test.js","retrying a failed export")],"Pesan kegagalan terlihat; percobaan kedua berhasil; jumlah pemuatan history tidak bertambah.");
add(exportGroup,"BB-EXP-005","Penulisan berkas dan native sharing.","Byte XLSX disimpan dan layanan berbagi dipanggil.",[J("xlsx-export.test.js","writes binary XLSX")],"Byte fixture diteruskan ke file cache mock dan shareAsync; belum diuji melalui Android sungguhan.");
add(exportGroup,"BB-EXP-006","Native sharing tidak tersedia.","Berkas cache dipertahankan tanpa mengklaim telah dibagikan.",[J("xlsx-export.test.js","sharing is unavailable")],"Helper mengembalikan shared:false dan URI cache pada native service mock.");
add(exportGroup,"BB-EXP-007","Filter Daily Records pada aplikasi spreadsheet.","Filter tanggal/kategori dapat dipakai pada workbook.",[],null,"Struktur filter diperiksa tes backend, tetapi interaksi Excel/Sheets nyata belum dilakukan.");

const profile = "M. Profil dan bahasa";
add(profile,"BB-PRO-001","Nama dan email pada Profil.","Identitas akun aktif ditampilkan.",[U("BB-PRO-001")]);
add(profile,"BB-PRO-002","Pergantian bahasa tanpa mengubah nama pengguna.","Teks antarmuka diterjemahkan; nama buatan pengguna tetap.",[J("ui-feedback.test.js","changing language updates"),V("results.json",8)],"Connected: Kitchen 01 menjadi Terhubung: Kitchen 01; format angka ID ikut berubah.");
add(profile,"BB-PRO-003","Bahasa tersimpan setelah aplikasi dimulai kembali.","Pilihan bahasa dipulihkan dari penyimpanan.",[J("auth-push-lifecycle.test.js","BB-PRO-003 |")],"saveAppLocale menerima id; provider baru memulihkan locale id dari storage mock.");

const guide = "N. Tutorial";
add(guide,"BB-TUT-001","Tutorial pertama menunggu login.","Tutorial baru tampil setelah autentikasi pada instalasi yang belum melihatnya.",[J("device-tutorial.test.js","first-use guide waits")],"enabled:false tidak membaca status panduan; enabled:true menampilkan tutorial pada fixture instalasi baru.");
add(guide,"BB-TUT-002","Next, Back, enam langkah dan Done dalam dua bahasa.","Langkah serta tombol berfungsi sampai tutorial ditutup.",[J("device-tutorial.test.js","all six steps",2),V("device-tutorial-results.json",4)],"Seluruh langkah, Back dan Done lulus; browser memeriksa navigasi dan tampilan di dua ukuran layar.");
add(guide,"BB-TUT-003","Skip dan tidak otomatis terbuka lagi.","Status penutupan disimpan dan tutorial tidak berulang otomatis.",[J("device-tutorial.test.js","first-use guide waits"),V("device-tutorial-results.json",4)],"Skip menyimpan dismissal; reload browser tetap tidak memunculkan tutorial otomatis.");
add(guide,"BB-TUT-004","Buka ulang dari Profil.","Panduan terbuka kembali pada langkah pertama.",[J("device-tutorial.test.js","manual reopening"),V("device-tutorial-results.json",4)],"Tombol di atas Logout membuka ulang langkah 1/6.");

const navigation = "O. Splash dan navigasi";
add(navigation,"BB-NAV-001","Tekan splash ketika animasi masih berlangsung.","Animasi dapat dilewati tanpa menunggu selesai.",[J("start-gate.test.js","tap immediately skips"),J("startup-navigation.test.js","authenticated user")],"Aksi start dijalankan pada frame awal; pemulihan sesi tetap dihormati.");
add(navigation,"BB-NAV-002","Lewati splash tanpa login.","Splash tidak memberikan akses melewati autentikasi.",[J("startup-navigation.test.js","never bypasses login"),J("startup-navigation.test.js","restoration is not bypassed")],"Pengguna tanpa sesi tetap menuju alur Login; pemulihan sesi tidak dilewati.");
add(navigation,"BB-NAV-003","Navigasi tab dan keselarasan navbar dalam dua bahasa.","Tab dapat dipakai dan navbar tidak melampaui layar.",[V("results.json",8),V("device-tutorial-results.json",4)],"Home, Profile dan Devices digunakan pada browser; inset dan keselarasan ikon diverifikasi.","Tombol Back sistem Android masih memerlukan APK fisik.");

const errors = "P. Kegagalan dan umpan balik";
add(errors,"BB-ERR-001","Popup kegagalan ditutup lalu Retry.","Alasan tetap tersedia dan Retry memanggil ulang tindakan.",[J("ui-feedback.test.js","failure popup explains")],"Connection lost terlihat; Close menutup popup; Try again memanggil callback sekali.");
add(errors,"BB-ERR-002","Kegagalan polling yang sama berulang.","Popup tidak muncul terus-menerus untuk error identik dalam interval penahanan.",[J("ui-feedback.test.js","background polling does not repeatedly")],"Setelah ditutup, error identik tidak membuka popup lagi dalam skenario tes.");
add(errors,"BB-ERR-003","Validasi formulir tanpa menghapus masukan lain.","Pesan inline muncul dan permintaan tidak dikirim untuk masukan invalid.",[J("register-screen.test.js","rejects a short name"),U("BB-DEV-003",2),J("ui-feedback.test.js","validation stays inline")],"Pesan validasi inline terlihat; tidak ada popup pada komponen validasi; API create tidak dipanggil.");

const summary = rows.reduce((acc,row) => { acc[row.status] = (acc[row.status] || 0) + 1; return acc; }, {});
const intro = [
    "# Tabel Black-Box Fluxen - Self-Test 29 Oktober 2026",
    "",
    "Tabel ini diringkas per aturan/fitur. Variasi input tetap dieksekusi terpisah; pesan berbeda dicatat dalam satu baris. ID merupakan revisi katalog ringkas dan tidak boleh dicampur dengan nomor katalog 191 kasus sebelumnya tanpa memperhatikan judul kasus.",
    "",
    "## Lingkungan dan batas bukti",
    "",
    "- Jest menjalankan komponen React Native dengan API/native services yang di-mock. Ini simulasi komponen, bukan pengujian APK Android langsung.",
    "- CJS HTTP menjalankan backend nyata dengan PostgreSQL localhost, skema sementara, data dummy dan push eksternal dimatikan. Skema uji dihapus setelah selesai.",
    "- CJS browser menjalankan aplikasi Expo web dengan API dummy yang dicegat dan akses eksternal diblokir. Hasil web tidak membuktikan perilaku native Android.",
    "- Lulus simulasi: assertion UI/browser yang disebutkan pada lampiran berhasil. Komponen UI dan API dapat diuji terpisah, bukan selalu sebagai satu alur end-to-end.",
    "- Parsial (API lokal): perilaku server berhasil diuji, tetapi hasil antarmuka untuk kasus itu belum lengkap. Jangan ubah menjadi Lulus APK/manual.",
    "- Belum diuji/Dilewati tidak dihitung sebagai lulus. Bukti penerimaan push di ponsel, BLE nyata, Force stop, dan reset ESP32 tidak dibuat-buat.",
    "- Kalimat hasil adalah pengamatan dari fixture/assertion yang dijalankan, bukan pembacaan kode semata. Pesan EN dan ID mengikuti bahasa fixture.",
    "- Tidak ada perubahan kode produksi, push GitHub, redeploy, atau mutasi Supabase dalam pekerjaan ini.",
    "",
    `Tes mobile: ${mobile.numPassedTests} lulus, ${mobile.numFailedTests} gagal, ${mobile.numPendingTests} dilewati; ${mobile.numPassedTestSuites}/${mobile.numTotalTestSuites} suite lulus.`,
    `Pemeriksaan API tambahan: ${api.filter(x=>x.status==='passed').length} lulus, ${api.filter(x=>x.status==='failed').length} gagal.`,
    `Jumlah baris ringkas: ${rows.length}. Rekap: ${Object.entries(summary).map(([k,v])=>`${k}: ${v}`).join('; ')}.`,
    "",
];
const escapeMd = text => String(text || "").replace(/\|/g, "\\|").replace(/\r?\n/g," ");
const md = [...intro];
for (const group of [...new Set(rows.map(row=>row.group))]) {
    md.push(`## ${group}`, "", "| ID | Kasus Uji / Masukan | Hasil yang Diharapkan | Hasil Aktual | Status |", "|---|---|---|---|---|");
    for (const row of rows.filter(row=>row.group===group)) md.push(`| ${[row.id,row.scenario,row.expected,row.actual + (row.note ? ` Catatan: ${row.note}` : ""),row.status].map(escapeMd).join(" | ")} |`);
    md.push("");
}
const proofPath = path.join(out, "ui-proof/ui-proof-results.json");
const proof = fs.existsSync(proofPath) ? JSON.parse(fs.readFileSync(proofPath, "utf8")) : null;
if (proof) {
    const actions = proof.results.filter(row => typeof row.apiRequests === "number");
    md.push("## Bukti UI tambahan", "", `[Buka galeri screenshot UI](ui-proof/index.html). ${actions.filter(row=>row.status==='passed').length}/${actions.length} aksi registrasi/login lulus melalui browser Expo web. API tetap menggunakan fixture dummy, bukan akun produksi.`, "");
    for (const finding of proof.findings || []) md.push(`- Catatan UX ${finding.id}: ${finding.observed} Tidak ada perbaikan kode aplikasi yang diterapkan.`, "");
}
md.push("## Lampiran keterlacakan", "", "Setiap ID di bawah menunjuk bukti assertion; tidak ada status Lulus yang diberikan hanya karena fitur ditemukan di kode.", "");
for (const row of rows) md.push(`- ${row.id}: ${row.evidence.length ? row.evidence.map(ref=>`${ref.source} [${ref.missing ? 'tidak tersedia' : ref.passed ? 'lulus' : 'gagal'}]`).join('; ') : row.status}.`);
const esc = value => String(value || "").replace(/[&<>\"]/g, char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));
const html = `<!doctype html><html lang="id"><meta charset="utf-8"><title>Hasil Black-Box Fluxen</title><style>body{font-family:'Times New Roman',serif;max-width:1250px;margin:30px auto;color:#111;padding:16px}table{border-collapse:collapse;width:100%;font-size:11pt;margin-bottom:24px}th,td{border:1px solid #222;padding:7px;vertical-align:top}th{background:#f1f1f1}td:first-child{white-space:nowrap;font-size:10pt}h2{margin-top:30px}p,li{line-height:1.5}@media print{thead{display:table-header-group}tr{break-inside:avoid}body{margin:0;padding:0}}</style><h1>Tabel Black-Box Fluxen</h1><p>Self-test 29 Oktober 2026. Lulus simulasi bukan hasil uji APK fisik. Parsial (API lokal) belum membuktikan antarmuka. IoT fisik dan penerimaan push nyata dilewati.</p><p>${esc(intro.slice(-4,-1).join(" "))}</p>${[...new Set(rows.map(row=>row.group))].map(group=>`<h2>${esc(group)}</h2><table><thead><tr>${['ID','Kasus Uji / Masukan','Hasil yang Diharapkan','Hasil Aktual','Status'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.filter(row=>row.group===group).map(row=>`<tr>${[row.id,row.scenario,row.expected,row.actual+(row.note?` Catatan: ${row.note}`:''),row.status].map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`).join('')}<p>Catatan lingkungan dan lampiran keterlacakan lengkap tersedia pada laporan Markdown dan evidence-index.json.</p></html>`;
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out,"blackbox-ringkas-hasil.md"),md.join("\n"));
fs.writeFileSync(path.join(out,"blackbox-ringkas-hasil.html"), proof ? html.replace("</html>", '<p><a href="ui-proof/index.html">Buka galeri bukti UI tambahan: registrasi, login, grafik, token dan tutorial</a></p></html>') : html);
fs.writeFileSync(path.join(out,"evidence-index.json"),JSON.stringify({ reportDate:"2026-10-29", generatedAt:new Date().toISOString(), mobile:{passed:mobile.numPassedTests,failed:mobile.numFailedTests,total:mobile.numTotalTests}, summary, rows },null,2));
console.log(JSON.stringify({ rows:rows.length,summary,mobilePassed:mobile.numPassedTests,mobileFailed:mobile.numFailedTests,output:out },null,2));
