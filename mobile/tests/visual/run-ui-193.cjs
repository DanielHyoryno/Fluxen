// 95 scenarios in two languages + three browser XLSX downloads. No production writes.
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const playwright=process.argv.includes('--report-only')?null:require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'../../..');
const out=process.env.UI_EVIDENCE_DIR || path.join(root,'output/testing/2026-10-29/ui-193');
const load=(file)=>Function(`return (${fs.readFileSync(file,'utf8').replace(/export default/,'').replace(/;\s*$/,'')})`)();
const messages=Object.fromEntries(['id','en'].map(l=>[l,load(path.join(root,`mobile/src/constants/messages/${l}.js`))]));
const phrases=load(path.join(root,'mobile/src/constants/messages/ui.js'));
const cases=[], results=[];
function add(group,title,expected,run,options={}) {cases.push({group,title,expected,run,options,number:cases.filter(c=>c.group===group).length+1});}
const apiCORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS'};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safe=value=>Array.isArray(value)?value.map(safe):value && typeof value==='object' ? Object.fromEntries(Object.entries(value).map(([k,v])=>[k,/password|token/i.test(k)?'[redacted]':typeof v==='object'?safe(v):v])):value;

async function session(browser,backend,c,locale,index) {
  const token=await backend.seed(c.options);
  const context=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:1,acceptDownloads:true,timezoneId:'Asia/Jakarta'});
  await context.addInitScript(({token,locale,auth,seen})=>{
    if(sessionStorage.getItem('ui_fixture_initialized')) return;
    localStorage.clear(); localStorage.setItem('wm_app_locale',locale);
    if(auth) localStorage.setItem('wm_access_token',token);
    if(seen) localStorage.setItem('wm_device_tutorial_seen_v1','true');
    sessionStorage.setItem('ui_fixture_initialized','true');
  },{token,locale,auth:c.options.auth!==false,seen:!c.options.tutorial});
  const audit=[], runtimeErrors=[]; let fault=null;
  await context.route('**/*',async route=>{
    const r=route.request(),u=new URL(r.url());
    if(u.origin==='http://localhost:8081')return route.continue();
    if(u.origin!=='http://localhost:8099')return route.abort();
    if(r.method()==='OPTIONS')return route.fulfill({status:204,headers:apiCORS});
    const row={method:r.method(),path:u.pathname,query:Object.fromEntries(u.searchParams),input:safe(r.postDataJSON?.())}; audit.push(row);
    if(fault && u.pathname.endsWith(fault.path) && (!fault.method || fault.method===r.method())) {row.fault='transport aborted';return route.abort();}
    try {
      const response=await route.fetch({url:backend.base+u.pathname+u.search,headers:{...r.headers(),'x-forwarded-for':`198.18.${Math.floor(index/250)}.${index%250+1}`}});
      row.status=response.status();
      if((response.headers()['content-type']||'').includes('json')) row.response=safe(await response.json());
      await route.fulfill({response,headers:{...response.headers(),...apiCORS}});
    } catch(error) {row.error=error.message; if(!page.isClosed())await route.abort().catch(()=>{});}
  });
  const page=await context.newPage();page.setDefaultTimeout(7000);
  // Advance time normally: a frozen Date.now prevents RN Animated callbacks.
  await page.clock.install({time:new Date(backend.now)});
  page.on('pageerror',e=>runtimeErrors.push(e.message));
  const m=messages[locale], t=(key,vars={})=>{let s=phrases[key]?.[locale==='id'?1:0] || key;for(const [k,v]of Object.entries(vars))s=s.replace(`{${k}}`,v);return s;};
  const visible=l=>l.and(page.locator(':visible:not([aria-hidden="true"]):not([aria-hidden="true"] *)'));
  const originalTestId=page.getByTestId.bind(page);page.getByTestId=id=>visible(originalTestId(id));
  const text=s=>visible(page.getByText(s,{exact:true}));
  const input=s=>visible(page.getByPlaceholder(s,{exact:true})).first();
  const say=async s=>{await text(s).first().waitFor(); notes.push(s);};
  const click=async(s,last=false)=>{const l=text(s).or(visible(page.getByRole('button',{name:s,exact:true})));await(last?l.last():l.first()).click();};
  const button=async(s)=>{await visible(page.getByRole('button',{name:s,exact:true})).first().click();};
  const notes=[];
  const a={page,context,m,t,text,input,say,click,button,audit,notes,backend,locale,
    fault:(v)=>{fault=v;},
    count:(suffix,method)=>audit.filter(r=>r.path.endsWith(suffix)&&(!method||r.method===method)).length,
    async until(fn,message='UI condition'){await page.waitForFunction(()=>true);for(let n=0;n<70;n++){if(await fn())return;await page.waitForTimeout(100);}throw Error(message);},
    async back(){await visible(page.getByRole('link',{name:/, back$/i})).first().click();},
    async tab(name){await visible(page.getByRole('tab',{name:t(name),exact:true})).click();},
    async devices(manage=false){await a.tab('Devices');await say(m.devices.pageTitle);if(manage)await click(m.devices.manageTab);},
    async categories(){await a.devices(true);await click(m.devices.manageCategory);await input(m.categories.categoryNameExamplePlaceholder).waitFor();},
    row(name){return text(name).first().locator('..');},
    async dashboard(name='Kitchen Meter'){await text(m.home.deviceStatus).first().locator('..').getByText(name,{exact:true}).click();await say(m.dashboard.currentStatus);},
    async history(){await a.dashboard();await click(m.dashboard.viewMoreDetailIoT);await button(t('Date Range'));await button(t('Date Range'));await page.getByTestId('usage-bar-2026-10-29').waitFor();},
    async limits(){await a.dashboard();await text(m.dashboard.edit).nth(1).click();await input(t('e.g. 500')).waitFor();},
    async bill(){await click(m.home.billingEstimateThisMonth);await say(m.billing.selectDevices);await input(m.billingSettings.placeholder).isVisible().catch(()=>false);},
    async price(){await a.bill();await click(m.billing.manageWaterPrice);await input(m.billingSettings.placeholder).waitFor();},
    async register(){if(!await input(m.auth.fullNamePlaceholder).isVisible())await click(m.auth.noAccount);await input(m.auth.fullNamePlaceholder).waitFor();},
    async fillRegister(d={}){const v={name:'New User',email:'new@ui.test',password:'password123',...d};await input(m.auth.fullNamePlaceholder).fill(v.name);await input(m.auth.emailPlaceholder).fill(v.email);await input(m.auth.passwordMinPlaceholder).fill(v.password);return v;},
    async login(d={}){await input(m.auth.emailPlaceholder).fill(d.email??'owner@ui.test');await input(m.auth.passwordPlaceholder).fill(d.password??'password123');await click(m.auth.loginButton);},
    async dropdown(label,value){await button(label);await visible(page.getByRole('button',{name:value,exact:false})).last().click();},
    async createDevice(d={}){await input(m.devices.deviceCodePlaceholder).fill(d.code??'UI-NEW');await input(m.devices.deviceNamePlaceholder).fill(d.name??'New Meter');await input(m.devices.locationPlaceholder).fill(d.location??'');await click(m.devices.createDevice);},
    async closeError(){const l=visible(page.getByRole('button',{name:t('close'),exact:true}));if(await l.count())await l.last().click();},
    async calendarDay(day){await visible(page.locator(`[data-testid$=".day_${day}"]`)).click();},
    async homeRange(from,to){await click(m.home.custom);await click(m.home.from);await a.calendarDay(from);await click(m.home.to);await a.calendarDay(to);},
    async historyRange(from,to){await click(t('Custom'));await click(t('From'));await a.calendarDay(from);if(to!==from)await a.calendarDay(to);await click(t('Apply'),true);},
    async billApply(){const n=a.count('/billing/estimate','POST');await click(m.billing.apply);await a.until(()=>a.count('/billing/estimate','POST')>n);await a.until(()=>audit.filter(r=>r.path.endsWith('/billing/estimate')&&r.method==='POST').at(-1)?.status);return audit.filter(r=>r.path.endsWith('/billing/estimate')&&r.method==='POST').at(-1);},
    async bars(n){await a.until(async()=>await visible(page.locator('[data-testid^="usage-bar-"]')).count()===n,`Expected ${n} rendered bars`);notes.push(`${n} batang grafik dirender`);},
    async metric(label,value){const card=text(label).first().locator('../..');await card.getByText(value,{exact:true}).waitFor();notes.push(`${label}: ${value}`);},
    num(n,d=3){return new Intl.NumberFormat(locale==='id'?'id-ID':'en-US',{minimumFractionDigits:d,maximumFractionDigits:d}).format(n);}
  };
  await page.goto('http://localhost:8081');
  if(c.options.auth===false||c.options.expired)await input(m.auth.emailPlaceholder).waitFor();
  else if(c.options.tutorial)await page.getByTestId('iot-tutorial').waitFor();
  else await say(m.home.overallUsageTrend);
  return {...a,runtimeErrors};
}

// Registration: same business cases, independently exercised in each language.
add('REG','Registrasi valid dengan spasi tepi','Akun lokal dibuat, kembali ke login dengan konfirmasi.',async a=>{await a.register();await a.fillRegister({name:'  New User  ',email:'  NEW@ui.test  '});await a.click(a.m.auth.registerButton);await a.say(a.m.auth.registerSuccess);assert.equal((await a.backend.pool.query("SELECT full_name,email FROM users WHERE id=2")).rows[0].email,'new@ui.test');},{auth:false});
add('REG','Email sudah digunakan','Pesan email sudah terdaftar tampil.',async a=>{await a.register();await a.fillRegister({email:'owner@ui.test'});await a.click(a.m.auth.registerButton);await a.say(a.m.auth.emailAlreadyUsed);},{auth:false});
for(const [title,field,value,key]of[
 ['Nama kosong','name','','fullNameRequired'],['Nama satu karakter','name','A','fullNameMinLength'],['Nama 121 karakter','name','A'.repeat(121),'fullNameMaxLength'],
 ['Email kosong','email','','emailRequired'],['Format email salah','email','invalid','emailInvalid'],['Email 151 karakter','email','a'.repeat(139)+'@example.com','emailMaxLength'],
 ['Password kosong','password','','passwordRequired'],['Password tujuh karakter','password','1234567','passwordMinLength'],['Password 101 karakter','password','a'.repeat(101),'passwordMaxLength']])
 add('REG',title,'Validasi spesifik muncul tanpa request registrasi.',async a=>{await a.register();await a.fillRegister({[field]:value});await a.click(a.m.auth.registerButton);await a.say(a.m.auth[key]);assert.equal(a.count('/auth/register','POST'),0);},{auth:false});
for(const length of[2,120])add('REG',`Nama tepat ${length} karakter`,'Registrasi diterima dan konfirmasi tampil.',async a=>{await a.register();await a.fillRegister({name:'A'.repeat(length)});await a.click(a.m.auth.registerButton);await a.say(a.m.auth.registerSuccess);},{auth:false});
add('REG','Password tepat 8 dan 100 karakter','Kedua batas valid diterima melalui formulir.',async a=>{for(const length of[8,100]){await a.register();await a.fillRegister({email:`pass${length}@ui.test`,password:'a'.repeat(length)});await a.click(a.m.auth.registerButton);await a.say(a.m.auth.registerSuccess);}},{auth:false});

add('AUT','Login valid','Beranda tampil untuk akun lokal yang benar.',async a=>{await a.login({email:'  OWNER@ui.test  '});await a.say(a.m.home.overallUsageTrend);},{auth:false});
add('AUT','Kredensial salah','Pesan email atau kata sandi salah tampil.',async a=>{await a.login({password:'wrong-password'});await a.say(a.t('invalidCredentials'));},{auth:false});
add('AUT','Input login tidak valid','Input kosong atau format salah ditolak.',async a=>{for(const d of[{email:''},{email:'invalid'},{password:''}]){await a.login(d);await a.say(a.t('invalidInput'));}},{auth:false});
add('AUT','Koneksi login terputus','Pesan server tidak terjangkau tampil.',async a=>{a.fault({path:'/auth/login'});await a.login();await a.say(a.m.auth.unableToReachServer);},{auth:false});
add('AUT','Sesi kedaluwarsa','Pengguna kembali ke halaman login.',async a=>{await a.say(a.m.auth.loginButton);assert.ok(a.audit.some(r=>r.path.endsWith('/auth/me')&&r.status===401));},{expired:true});

add('KAT','Tambah kategori valid dan batas','Nama 2 dan 80 karakter tampil di daftar.',async a=>{await a.categories();for(const name of['  AB  ','X'.repeat(80)]){await a.input(a.m.categories.categoryNameExamplePlaceholder).fill(name);await a.click(a.m.categories.addButton);await a.say(name.trim());}});
add('KAT','Nama kategori tidak valid','Kosong, spasi, 1 dan 81 karakter ditolak.',async a=>{await a.categories();for(const name of['',' ','A','X'.repeat(81)]){await a.input(a.m.categories.categoryNameExamplePlaceholder).fill(name);await a.click(a.m.categories.addButton);await a.say(name.length>80?a.t('invalidInput'):name.trim()?a.m.categories.nameTooShort:a.m.categories.nameRequired);}});
add('KAT','Kategori duplikat','Duplikasi kapital/spasi ditolak.',async a=>{await a.categories();for(const name of['kitchen',' Kitchen ']){await a.input(a.m.categories.categoryNameExamplePlaceholder).fill(name);await a.click(a.m.categories.addButton);await a.say(a.m.categories.duplicateName);}});
add('KAT','Ubah kategori','Nama kategori baru tampil di daftar.',async a=>{await a.categories();await a.row('Kitchen').getByText(a.m.categories.editButton,{exact:true}).click();await a.input(a.m.categories.categoryNamePlaceholder).fill('Kitchen Updated');await a.click(a.m.categories.saveButton);await a.say('Kitchen Updated');});
add('KAT','Ubah menjadi duplikat','Perubahan ke nama kategori lain ditolak.',async a=>{await a.categories();await a.row('Kitchen').getByText(a.m.categories.editButton,{exact:true}).click();await a.input(a.m.categories.categoryNamePlaceholder).fill('Garden');await a.click(a.m.categories.saveButton);await a.say(a.m.categories.duplicateName);});
add('KAT','Batalkan edit','Kategori awal tetap tampil dan editor ditutup.',async a=>{await a.categories();await a.row('Kitchen').getByText(a.m.categories.editButton,{exact:true}).click();await a.input(a.m.categories.categoryNamePlaceholder).fill('Not Saved');await a.click(a.m.categories.cancelButton);await a.say('Kitchen');assert.equal(await a.input(a.m.categories.categoryNamePlaceholder).count(),0);});
for(const name of['Empty','Kitchen'])add('KAT',`Hapus kategori ${name}`,'Kategori hilang; perangkat tidak ikut dihapus.',async a=>{await a.categories();await a.row(name).getByText(a.m.categories.deleteButton,{exact:true}).click();await a.say(a.m.categories.deleteDialogTitle);await a.click(a.m.categories.deleteButton,true);await a.until(async()=>await a.text(name).count()===0);a.notes.push(`${name} tidak lagi muncul`);if(name==='Kitchen'){await a.back();await a.click(a.m.devices.listTab);await a.say('Kitchen Meter');assert.equal((await a.backend.pool.query('SELECT category_id FROM devices WHERE id=1')).rows[0].category_id,null);}});

add('DEV','Tambah perangkat berkategori','Dialog token muncul dan kategori/lokasi tersimpan.',async a=>{await a.devices(true);await a.dropdown(a.m.devices.assignCategory,'Garden');await a.createDevice({location:'Room A'});await a.page.getByTestId('device-token-card').waitFor();await a.say(a.m.devices.tokenSubtitle);const row=(await a.backend.pool.query("SELECT category_id,install_location FROM devices WHERE device_code='UI-NEW'")).rows[0];assert.equal(String(row.category_id),'2');assert.equal(row.install_location,'Room A');});
add('DEV','Tambah tanpa kolom opsional','Token muncul; kategori dan lokasi kosong.',async a=>{await a.devices(true);await a.createDevice();await a.say(a.m.devices.tokenTitle);const row=(await a.backend.pool.query("SELECT category_id,install_location FROM devices WHERE device_code='UI-NEW'")).rows[0];assert.equal(row.category_id,null);assert.equal(row.install_location,null);});
for(const [field,invalids,msg]of[['code',['','AB','C'.repeat(51)],'minDeviceCodeError'],['name',['','A','N'.repeat(101)],'minDeviceNameError']])add('DEV',`Validasi ${field} perangkat`,'Input di luar batas ditolak dan pesan tampil.',async a=>{await a.devices(true);for(const value of invalids){await a.createDevice({[field]:value});await a.say(value.length>50?a.t('invalidInput'):a.m.devices[msg]);await a.closeError();}});
for(const [field,lengths]of[['code',[3,50]],['name',[2,100]]])add('DEV',`Batas valid ${field}`,'Kedua nilai batas diterima dan token tampil.',async a=>{await a.devices(true);for(const n of lengths){await a.createDevice({code:`CODE-${n}`,[field]:'A'.repeat(n)});await a.say(a.m.devices.tokenTitle);await a.click(a.m.devices.tokenClose);}});
add('DEV','Batas panjang lokasi','150 karakter diterima; 151 ditolak.',async a=>{await a.devices(true);await a.createDevice({location:'L'.repeat(150)});await a.say(a.m.devices.tokenTitle);await a.click(a.m.devices.tokenClose);await a.createDevice({code:'LOC-151',location:'L'.repeat(151)});await a.say(a.m.devices.maxLocationError);});
add('DEV','Kode sudah dipakai','Pesan kode perangkat sudah digunakan tampil.',async a=>{await a.devices(true);await a.createDevice({code:'METER-01'});await a.say(a.m.devices.duplicateDeviceCodeError);});
add('DEV','Edit identitas perangkat','Nama terbaru terlihat setelah kembali ke detail.',async a=>{
  await a.dashboard();await a.click(a.m.dashboard.edit);
  await a.input(a.t('e.g. Kitchen Faucet')).fill('Kitchen Renamed');
  await a.input(a.t('e.g. Building A, 2nd Floor')).fill('Room B');
  await a.dropdown(a.t('Category'),'Garden');await a.click(a.t('Save Changes'));
  await a.say(a.t('Device updated successfully'));await a.page.waitForTimeout(1400);await a.say('Kitchen Renamed');
  await a.click(a.m.dashboard.edit);
  assert.equal(await a.input(a.t('e.g. Kitchen Faucet')).inputValue(),'Kitchen Renamed');
  assert.equal(await a.input(a.t('e.g. Building A, 2nd Floor')).inputValue(),'Room B');
  await a.page.getByRole('button',{name:a.t('Category'),exact:true}).getByText('Garden',{exact:true}).waitFor();
  a.notes.push('Form edit dibuka ulang: nama Kitchen Renamed, lokasi Room B, kategori Garden');
  await a.back();await a.say('Kitchen Renamed');
});
add('DEV','Hapus kategori pada edit','Pilihan tanpa kategori tersimpan.',async a=>{await a.dashboard();await a.click(a.m.dashboard.edit);await a.dropdown(a.t('Category'),a.t('Uncategorized'));await a.click(a.t('Save Changes'));await a.say(a.t('Device updated successfully'));assert.equal((await a.backend.pool.query('SELECT category_id FROM devices WHERE id=1')).rows[0].category_id,null);});
for(const confirm of[true,false])add('DEV',confirm?'Jadwalkan hapus perangkat':'Batalkan hapus perangkat',confirm?'Perangkat hilang dari daftar dan reset dijadwalkan.':'Perangkat masih terlihat, tidak ada request hapus.',async a=>{await a.devices();const row=a.text('Garden Meter').first().locator('../../..');await row.getByText(a.m.devices.deleteButton,{exact:true}).click();await a.say(a.m.devices.deleteDialogTitle);await a.click(confirm?a.m.devices.confirmYes:a.m.devices.confirmNo,true);if(confirm){await a.until(async()=>await a.text('Garden Meter').count()===0);assert.equal((await a.backend.pool.query('SELECT pending_command FROM devices WHERE id=2')).rows[0].pending_command,'REPROVISION');a.notes.push('Garden Meter hilang dari daftar; reset baru dijadwalkan, bukan diuji pada ESP32');}else{await a.say('Garden Meter');assert.equal(a.count('/devices/2','DELETE'),0);}});
add('DEV','Filter status','Online dan Offline menampilkan perangkat yang sesuai.',async a=>{await a.devices();await a.button('Online');await a.say('Kitchen Meter');assert.equal(await a.text('Garden Meter').count(),0);await a.button('Offline');await a.say('Garden Meter');await a.say('Spare Meter');assert.equal(await a.text('Kitchen Meter').count(),0);});
add('DEV','Filter kategori gabungan','Tanpa kategori lalu Online menghasilkan daftar kosong; reset memulihkan daftar.',async a=>{await a.devices();await a.dropdown(a.m.devices.categoryFilterLabel,a.m.devices.uncategorized);await a.say('Spare Meter');assert.equal(await a.text('Kitchen Meter').count(),0);await a.button('Online');await a.say(a.m.devices.noDevicesYet);await a.button(a.m.home.all);await a.dropdown(a.m.devices.categoryFilterLabel,a.m.home.all);await a.say('Kitchen Meter');});

add('HOM','Ringkasan awal mingguan','Total 31 L dan status 1 online / 2 offline.',async a=>{await a.metric(a.m.home.total,a.num(31)+' L');await a.say('1 / 2');});
add('HOM','Pemakaian hari ini','Total penggunaan 7 L.',async a=>{await a.click(a.m.home.day);await a.metric(a.m.home.total,a.num(7)+' L');});
add('HOM','Grafik mingguan','Tujuh batang ditampilkan.',async a=>{await a.click(a.m.home.week);await a.bars(7);});
add('HOM','Grafik bulanan lebih dari 10 hari','29 batang tetap tampil; total 119 L.',async a=>{await a.click(a.m.home.month);await a.bars(29);await a.metric(a.m.home.total,a.num(119)+' L');});
add('HOM','Rentang kustom','1–15 Oktober menampilkan 15 batang dan total 60 L.',async a=>{await a.homeRange('2026-10-01','2026-10-15');await a.bars(15);await a.metric(a.m.home.total,a.num(60)+' L');});
add('HOM','Tekan batang harian','27 Oktober menampilkan 4 L pada pilihan hari.',async a=>{await a.page.getByTestId('usage-bar-2026-10-27').click();await a.page.getByTestId('usage-selection').getByText(a.num(4)+' L',{exact:true}).waitFor();a.notes.push('27 Oktober: '+a.num(4)+' L');});
add('HOM','Geser grafik panjang','Batang terakhir dapat ditekan dan menampilkan 7 L.',async a=>{await a.click(a.m.home.month);await a.bars(29);await a.page.getByTestId('usage-bar-2026-10-29').click();await a.page.getByTestId('usage-selection').getByText(a.num(7)+' L',{exact:true}).waitFor();a.notes.push('29 Oktober: '+a.num(7)+' L');});
add('HOM','Akun tanpa perangkat','Total nol dan pesan perangkat kosong tampil.',async a=>{await a.metric(a.m.home.total,a.num(0)+' L');await a.say(a.m.home.noDevicesInFilter);},{noDevices:true});
add('HOM','Filter status beranda','Filter online/offline berubah dan dapat dikembalikan.',async a=>{const row=a.text(a.m.home.deviceStatus).first().locator('..');await row.getByText('Online',{exact:true}).first().click();await row.getByText('Kitchen Meter',{exact:true}).waitFor();assert.equal(await row.getByText('Garden Meter',{exact:true}).count(),0);await row.getByText('Offline',{exact:true}).first().click();await row.getByText('Garden Meter',{exact:true}).waitFor();a.notes.push('Daftar status beralih Online → Offline');});

add('DAS','Detail perangkat online','Debit 1,25; volume 3 L; puncak 4 L/menit.',async a=>{await a.dashboard();await a.say(a.num(1.25,2)+' '+a.t('L/min'));await a.metric(a.m.dashboard.todayTotal,a.num(3)+' L');await a.say(a.num(4,2)+' '+a.t('L/min'));});
add('DAS','Detail perangkat offline','Debit saat ini nol, volume historis 4 L dipertahankan.',async a=>{await a.dashboard('Garden Meter');await a.say(a.num(0,2)+' '+a.t('L/min'));await a.metric(a.m.dashboard.todayTotal,a.num(4)+' L');});
add('DAS','Perangkat tanpa pembacaan','Status belum ada pembacaan dan volume nol.',async a=>{await a.dashboard('Spare Meter');await a.say(a.m.dashboard.noTelemetryYet);await a.metric(a.m.dashboard.todayTotal,a.num(0)+' L');});
add('DAS','Buka/tutup section','Ringkasan dapat dilipat dan dibuka kembali.',async a=>{await a.dashboard();await a.button(a.m.dashboard.overview);assert.equal(await a.text(a.m.dashboard.currentStatus).count(),0);await a.button(a.m.dashboard.overview);await a.say(a.m.dashboard.currentStatus);});
add('DAS','Grafik debit batang/garis','Grafik garis muncul setelah pilihan Garis.',async a=>{await a.dashboard();await a.button(a.m.dashboard.telemetryDetails);await a.say(a.m.dashboard.flowRateChart);const before=await a.page.locator('svg').count();await a.click(a.m.dashboard.line);await a.until(async()=>await a.page.locator('svg').count()>before,'Line chart not rendered');a.notes.push('Grafik debit berubah menjadi garis');});
add('DAS','Perluas catatan per jam','Catatan tambahan tampil dan bisa diringkas.',async a=>{await a.dashboard();await a.button(a.m.dashboard.telemetryDetails);await a.click(a.t('moreRecords',{count:6}));await a.say(a.m.dashboard.viewLess);await a.click(a.m.dashboard.viewLess);await a.say(a.t('moreRecords',{count:6}));},{longHistory:true});
add('DAS','Navigasi riwayat','Riwayat terbuka untuk METER-01.',async a=>{await a.history();await a.say(a.t('Code:')+' METER-01');await a.bars(7);});
add('DAS','Tutup peringatan aktif','Peringatan lokal menjadi selesai dan hilang dari daftar aktif.',async a=>{await a.dashboard();await a.say(a.t('dailyAlert'));await a.click(a.m.dashboard.dismiss);await a.say(a.m.dashboard.noActiveAlerts);},{alert:true});

add('HIS','Periode 7 hari','Tujuh batang muncul.',async a=>{await a.history();await a.bars(7);});
add('HIS','Periode 30 hari','30 batang muncul, tidak kosong di atas 10 hari.',async a=>{await a.history();await a.click(a.t('Last 30 days'));await a.bars(30);});
add('HIS','Rentang kustom 15 hari','15 batang dan total 37,5 L.',async a=>{await a.history();await a.historyRange('2026-10-01','2026-10-15');await a.bars(15);await a.metric(a.t('Total Usage'),a.num(37.5)+' L');});
add('HIS','Batas rentang maksimal','Tanggal ke-31 diabaikan; rentang 30 hari masih bisa diterapkan.',async a=>{await a.history();await a.click(a.t('Custom'));await a.click(a.t('From'));await a.page.getByTestId('undefined.header.leftArrow').click();await a.calendarDay('2026-09-01');await a.calendarDay('2026-10-01');await a.calendarDay('2026-09-30');await a.click(a.t('Apply'),true);await a.bars(30);const r=a.audit.filter(r=>r.path.endsWith('/telemetry/history')).at(-1);assert.equal(r.query.from,'2026-09-01');assert.equal(r.query.to,'2026-09-30');a.notes.push('Pilihan 1 Oktober (hari ke-31) diabaikan; 1–30 September dapat diterapkan');});
add('HIS','Rentang satu hari','Satu batang menampilkan data tanggal tersebut.',async a=>{await a.history();await a.historyRange('2026-10-27','2026-10-27');await a.bars(1);await a.metric(a.t('Total Usage'),a.num(2.5)+' L');});
add('HIS','Batalkan kalender','Periode awal tujuh hari tetap berlaku.',async a=>{await a.history();await a.click(a.t('Custom'));await a.click(a.t('From'));await a.calendarDay('2026-10-01');await a.click(a.t('Cancel'),true);await a.bars(7);});
add('HIS','Grafik batang dan garis','Pilihan garis menghilangkan batang, lalu batang dapat dipulihkan.',async a=>{await a.history();await a.click(a.t('Line'));await a.bars(0);await a.click(a.t('Bars'));await a.bars(7);});
add('HIS','Tanggal tanpa pemakaian','Batang tanggal kosong menampilkan 0 L.',async a=>{await a.history();await a.page.getByTestId('usage-bar-2026-10-27').click();await a.page.getByTestId('usage-selection').getByText(a.num(0)+' L',{exact:true}).waitFor();a.notes.push('27 Oktober: '+a.num(0)+' L');},{zeroDay:true});
add('HIS','Perluas rincian harian','20 baris tambahan dapat ditampilkan dan diringkas.',async a=>{await a.history();await a.click(a.t('Last 30 days'));await a.bars(30);await a.button(a.t('Daily Details'));await a.click(a.t('moreRecords',{count:20}));await a.say(a.t('View Less'));await a.click(a.t('View Less'));await a.say(a.t('moreRecords',{count:20}));});

for(const [title,daily,monthly]of[['Dua batas positif','10','100'],['Hanya batas harian','10',''],['Hanya batas bulanan','','100'],['Nonaktifkan kedua batas','',''],['Batas desimal','10.5','100.5']])add('LIM',title,'Nilai diterima dan konfirmasi tersimpan tampil.',async a=>{await a.limits();await a.input(a.t('e.g. 500')).fill(daily);await a.input(a.t('e.g. 15000')).fill(monthly);await a.click(a.t('Save Limits'));await a.say(a.t('Limits updated successfully'));const row=(await a.backend.pool.query('SELECT daily_usage_limit_l,monthly_usage_limit_l FROM device_thresholds WHERE device_id=1')).rows[0];assert.equal(row.daily_usage_limit_l===null?null:Number(row.daily_usage_limit_l),daily?Number(daily):null);assert.equal(row.monthly_usage_limit_l===null?null:Number(row.monthly_usage_limit_l),monthly?Number(monthly):null);});
add('LIM','Batas nol, negatif, nonangka','Pesan validasi tampil dan tidak ada PUT.',async a=>{await a.limits();for(const v of['0','-1','abc']){await a.input(a.t('e.g. 500')).fill(v);await a.click(a.t('Save Limits'));await a.say(a.t('Limits must be positive numbers or left empty.'));await a.closeError();}assert.equal(a.count('/usage/limits','PUT'),0);});
add('LIM','Muat batas sebelumnya','Kolom menampilkan batas 100 dan 1000.',async a=>{await a.limits();assert.equal(Number(await a.input(a.t('e.g. 500')).inputValue()),100);assert.equal(Number(await a.input(a.t('e.g. 15000')).inputValue()),1000);a.notes.push('Kolom harian 100; bulanan 1000');});

add('BIL','Estimasi satu perangkat','Kitchen hari ini: 3 L, Rp30.',async a=>{await a.bill();await a.click(a.m.billing.day);await a.dropdown(a.m.billing.categoryFilter,'Kitchen');const r=await a.billApply();assert.equal(Number(r.response.data.summary.total_liters),3);await a.metric(a.m.billing.usage,a.num(3)+' L');});
add('BIL','Filter kategori Garden','Hanya Garden dihitung: 4 L.',async a=>{await a.bill();await a.click(a.m.billing.day);await a.dropdown(a.m.billing.categoryFilter,'Garden');const r=await a.billApply();assert.equal(Number(r.response.data.summary.estimated_cost),40);await a.metric(a.m.billing.usage,a.num(4)+' L');});
add('BIL','Tanpa pilihan perangkat','Jumlah perangkat, volume, biaya nol; hasil perangkat kosong.',async a=>{await a.bill();const card=a.text(a.m.billing.selectDevices).first().locator('..');for(const name of['Kitchen Meter','Garden Meter','Spare Meter'])await card.getByText(name,{exact:true}).click();const r=await a.billApply();assert.equal(r.response.data.summary.device_count,0);await a.metric(a.m.billing.usage,a.num(0)+' L');assert.equal(r.response.data.items.length,0);});
add('BIL','Periode tanpa data','Perangkat terpilih tetap ada; pemakaian nol.',async a=>{await a.bill();await a.click(a.m.billing.custom);await a.click(a.m.billing.from);await a.calendarDay('2026-10-27');await a.click(a.m.billing.to);await a.calendarDay('2026-10-27');const r=await a.billApply();assert.equal(r.response.data.summary.device_count,3);assert.equal(Number(r.response.data.summary.total_liters),0);await a.metric(a.m.billing.usage,a.num(0)+' L');},{zeroDay:true});
add('BIL','Harga air belum diatur','Apply menampilkan permintaan mengatur harga air.',async a=>{await a.bill();await a.billApply();await a.say(a.t('priceNotSet'));},{noPrice:true});
add('BIL','Preset hari/bulan/tahun','Rentang pada request mengikuti tombol periode.',async a=>{await a.bill();for(const [label,from]of[[a.m.billing.day,'2026-10-29'],[a.m.billing.month,'2026-10-01'],[a.m.billing.year,'2026-01-01']]){await a.click(label);const r=await a.billApply();assert.equal(r.input.from,from);assert.equal(r.input.to,'2026-10-29');await a.say(label);}});
add('BIL','Perbarui harga lalu hitung','Harga 20 diterapkan pada penggunaan hari ini 7 L.',async a=>{await a.bill();await a.click(a.m.billing.manageWaterPrice);await a.input(a.m.billingSettings.placeholder).fill('20');await a.click(a.m.billingSettings.save);await a.say(a.m.billingSettings.saveSuccess);await a.back();await a.click(a.m.billing.day);const r=await a.billApply();assert.equal(Number(r.response.data.summary.estimated_cost),140);await a.metric(a.m.billing.usage,a.num(7)+' L');});
add('BIL','Rentang kustom satu hari','27 Oktober menghitung 4 L dan Rp40.',async a=>{await a.bill();await a.click(a.m.billing.custom);await a.click(a.m.billing.from);await a.calendarDay('2026-10-27');await a.click(a.m.billing.to);await a.calendarDay('2026-10-27');const r=await a.billApply();assert.equal(Number(r.response.data.summary.estimated_cost),40);await a.metric(a.m.billing.usage,a.num(4)+' L');});

for(const value of['15','0.5'])add('PRC',`Simpan harga ${value}`,'Harga valid tersimpan dan konfirmasi tampil.',async a=>{await a.price();await a.input(a.m.billingSettings.placeholder).fill(value);await a.click(a.m.billingSettings.save);await a.say(a.m.billingSettings.saveSuccess);assert.equal(Number((await a.backend.pool.query('SELECT price_per_liter FROM billing_settings')).rows[0].price_per_liter),Number(value));});
add('PRC','Harga kosong/nol/negatif/nonangka','Nilai ditolak dan pesan validasi tampil.',async a=>{await a.price();for(const v of['','0','-1','abc']){await a.input(a.m.billingSettings.placeholder).fill(v);await a.click(a.m.billingSettings.save);await a.say(a.t('invalidInput'));}});
add('PRC','Muat harga tersimpan','Kolom harga menampilkan 10.',async a=>{await a.price();assert.equal(Number(await a.input(a.m.billingSettings.placeholder).inputValue()),10);a.notes.push('Kolom harga: 10');});
add('PRC','Koneksi gagal saat menyimpan','Pesan server tidak terjangkau tampil.',async a=>{await a.price();a.fault({path:'/billing/settings',method:'PUT'});await a.input(a.m.billingSettings.placeholder).fill('15');await a.click(a.m.billingSettings.save);await a.say(a.m.auth.unableToReachServer);});

add('PRO','Identitas profil','Nama dan email akun yang login tampil.',async a=>{await a.tab('Profile');await a.say('UI Test User');await a.say('owner@ui.test');});
add('PRO','Ganti bahasa dan muat ulang','Pilihan bahasa tersimpan setelah reload.',async a=>{await a.tab('Profile');const other=a.locale==='id'?'en':'id';await a.click(other==='en'?'English':'Bahasa Indonesia');await a.say(messages[other].profile.subtitle);await a.page.reload();await a.say(messages[other].home.overallUsageTrend);assert.equal(await a.page.evaluate(()=>localStorage.getItem('wm_app_locale')),other);});
add('PRO','Logout dan muat ulang','Login tetap tampil dan token tidak dipulihkan.',async a=>{await a.tab('Profile');await a.click(a.m.profile.logout);await a.input(a.m.auth.emailPlaceholder).waitFor();await a.page.reload();await a.input(a.m.auth.emailPlaceholder).waitFor();assert.equal(await a.page.evaluate(()=>localStorage.getItem('wm_access_token')),null);a.notes.push('Login tampil setelah logout dan reload');});

add('TUT','Tutorial hanya setelah login','Login pertama memunculkan panduan, bukan sebelum login.',async a=>{assert.equal(await a.page.getByTestId('iot-tutorial').count(),0);await a.login();await a.page.getByTestId('iot-tutorial').waitFor();await a.say(a.t('tutorialScanTitle'));},{auth:false,tutorial:true});
add('TUT','Lanjut dan kembali','Langkah 1 → 2 → 1 tampil sesuai tombol.',async a=>{await a.button(a.t('tutorialNext'));await a.say(a.t('tutorialCodeTitle'));await a.button(a.t('tutorialBack'));await a.say(a.t('tutorialScanTitle'));},{tutorial:true});
add('TUT','Selesaikan enam langkah','Langkah terakhir menutup tutorial dan membuka beranda.',async a=>{for(let n=0;n<5;n++)await a.button(a.t('tutorialNext'));await a.say(a.t('tutorialMonitorTitle'));await a.button(a.t('tutorialDone'));await a.say(a.m.home.overallUsageTrend);},{tutorial:true});
add('TUT','Lewati dan muat ulang','Tutorial tidak otomatis muncul lagi.',async a=>{await a.button(a.t('tutorialSkip'));await a.say(a.m.home.overallUsageTrend);await a.page.reload();await a.say(a.m.home.overallUsageTrend);assert.equal(await a.page.getByTestId('iot-tutorial').count(),0);},{tutorial:true});
add('TUT','Buka ulang melalui profil','Panduan terbuka kembali pada langkah pertama.',async a=>{await a.tab('Profile');await a.button(a.t('deviceTutorialTitle'));await a.say(a.t('tutorialScanTitle'));await a.say('1 / 6');});

assert.equal(cases.length,95,'The functional catalog must contain 95 scenarios');
const functionalCount=cases.length;
for(const [period,label,from,to]of[['month','October','2026-10-01','2026-10-31'],['all','All','2026-01-01','2026-12-31'],['empty','September','2026-09-01','2026-09-30']])add('XLS',`Unduh XLSX ${period}`,'Unduhan browser valid dengan dua sheet dan periode yang dipilih.',async a=>{
  await a.history();const month=a.text(a.t('Month')).last();await month.click();await a.click(a.t(label),true);
  const pending=a.page.waitForEvent('download');await a.button(a.t('Export XLSX file'));const download=await pending;
  const file=path.join(out,`${period}.xlsx`);await download.saveAs(file);assert.equal(await download.failure(),null);
  const book=new a.backend.ExcelJS.Workbook();await book.xlsx.readFile(file);assert.deepEqual(book.worksheets.map(s=>s.name),['Dashboard','Daily Records']);
  const r=a.audit.filter(r=>r.path.endsWith('/telemetry/export-xlsx')).at(-1);assert.equal(r.query.from,from);assert.equal(r.query.to,to);assert.equal(r.query.device_code,'METER-01');
  assert.equal(book.getWorksheet('Daily Records').rowCount,period==='empty'?1:30);a.notes.push(`Browser mengunduh ${download.suggestedFilename()}; Dashboard + Daily Records, ${book.getWorksheet('Daily Records').rowCount-1} hari data`);
});

function report(){
  for(const row of results)if(row.status==='failed' && row.id.startsWith('UI-DEV-009-') && row.audit?.some(r=>r.method==='PATCH'&&r.path.endsWith('/devices/1')&&r.status===200) && row.visibleText?.includes('Kitchen Meter') && !row.visibleText.includes('Kitchen Renamed')){
    row.diagnostic ||= row.actual;row.classification='confirmed-product-defect';
    row.actual='Nama baru tersimpan dan konfirmasi berhasil muncul, tetapi setelah kembali halaman Detail perangkat masih menampilkan "Kitchen Meter", bukan "Kitchen Renamed".';
  }
  const counts={planned:193,executed:results.length,passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length};
  const findings=[{id:'UI-DEF-001',kind:'functional',cases:['UI-DEV-009-ID','UI-DEV-009-EN'],observed:'Nama perangkat di detail tidak diperbarui setelah edit, meskipun penyimpanan berhasil.',fixed:false},
    {id:'UI-UX-001',kind:'visual-review',cases:['UI-KAT-001-ID','UI-KAT-001-EN'],observed:'Nama kategori sintetis 80 karakter tanpa spasi diterima, tetapi pada lebar 393 px dapat mendorong kontrol Ubah/Hapus keluar area kartu. Ini catatan visual terpisah, bukan tambahan kasus lulus/gagal.',fixed:false}];
  for(let i=findings.length-1;i>=0;i--)if(!results.some(r=>findings[i].cases.includes(r.id)&&(findings[i].kind!=='functional'||r.classification==='confirmed-product-defect')))findings.splice(i,1);
  const groups=Object.fromEntries([...new Set(results.map(r=>r.id.split('-')[1]))].map(g=>[g,{executed:results.filter(r=>r.id.split('-')[1]===g).length,passed:results.filter(r=>r.id.split('-')[1]===g&&r.status==='passed').length,failed:results.filter(r=>r.id.split('-')[1]===g&&r.status==='failed').length}]));
  const meta={generatedAt:new Date().toISOString(),environment:'Expo web 393×852, Edge headless, real local Express backend and disposable PostgreSQL schema; no production data, BLE, ESP32, native push or Android install tested',catalog:'95 functional scenarios × Indonesian/English + 3 XLSX browser downloads. Language variants are not separate features.',counts,groups,findings,results};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(meta,null,2));
  fs.writeFileSync(path.join(out,'results.md'),`# Pengujian UI Fluxen\n\n${meta.environment}\n\n${meta.catalog}\n\n${counts.passed} lulus, ${counts.failed} gagal, ${counts.executed}/193 dijalankan.\n\n## Temuan\n\n${findings.map(f=>`- ${f.id}: ${f.observed} Belum diperbaiki.`).join('\n')}\n\n## Hasil per kasus\n\n| ID | Skenario | Hasil diharapkan | Hasil aktual UI | Status |\n|---|---|---|---|---|\n`+results.map(r=>`| ${r.id} | ${r.title} | ${r.expected} | ${r.actual.replace(/\n/g,' ').replace(/\|/g,'/')} | ${r.status} |`).join('\n'));
  fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="id"><meta charset="utf-8"><title>193 UI tests — Fluxen</title><style>body{font:15px system-ui;margin:24px;background:#f4f8ff;color:#173448}h1{font-size:26px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}article{background:white;padding:16px;border:1px solid #dbe6f5;border-radius:12px}img{width:100%;max-width:393px;display:block;margin:auto}.failed{border:2px solid #bd2727}small{color:#586c7c}input{padding:12px;width:min(80%,500px);margin:20px 0}</style><h1>193 pengujian UI Fluxen</h1><p>${escape(meta.catalog)}</p><p>${escape(meta.environment)}</p><p>${counts.passed} passed · ${counts.failed} failed · ${counts.executed}/193 executed</p><input placeholder="Cari ID atau fitur" oninput="for(const a of document.querySelectorAll('article'))a.hidden=!a.innerText.toLowerCase().includes(this.value.toLowerCase())"><div class="grid">${results.map(r=>`<article class="${r.status}"><h2>${escape(r.id)}</h2><p>${escape(r.title)}</p><p><b>${escape(r.status)}</b>: ${escape(r.actual)}</p><small>Expected: ${escape(r.expected)}</small><a href="${escape(r.screenshot)}"><img loading="lazy" src="${escape(r.screenshot)}" alt="${escape(r.id)}"></a></article>`).join('')}</div></html>`);
}
async function main(){
  fs.mkdirSync(out,{recursive:true});
  const backend=await require('./local-ui-backend.cjs').start();
  let browser;try{
    browser=await playwright.chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
    let plan=cases.flatMap((c,i)=>i<functionalCount?['id','en'].map(locale=>({c,locale})): [{c,locale:'id'}]);
    const only=process.argv.find(v=>v.startsWith('--only='))?.split('=')[1];if(only)plan=plan.filter(({c})=>c.group===only);
    const number=Number(process.argv.find(v=>v.startsWith('--case='))?.split('=')[1]||0);if(number)plan=plan.filter(({c})=>c.number===number);
    const limit=Number(process.argv.find(v=>v.startsWith('--limit='))?.split('=')[1]||0);if(limit)plan=plan.slice(0,limit);
    let index=0,stopping=false; process.on('SIGINT',()=>{stopping=true;});
    for(const {c,locale}of plan){const id=`UI-${c.group}-${String(c.number).padStart(3,'0')}-${locale.toUpperCase()}`;const row={id,title:c.title,locale,expected:c.expected,screenshot:`${id}.png`};let a;const start=Date.now();
      try{a=await session(browser,backend,c,locale,++index);a.notes.length=0;await c.run(a);assert.deepEqual(a.runtimeErrors,[],'No uncaught browser runtime error');row.status='passed';row.actual=a.notes.join(' · ')||'UI assertions passed';}
      catch(error){row.status='failed';row.actual=error.message;row.stack=error.stack;if(a)row.visibleText=(await a.page.locator('body').innerText()).slice(-10000);}
      finally{if(a){await a.page.clock.runFor(450).catch(()=>{});await a.page.screenshot({path:path.join(out,row.screenshot)}).catch(()=>{});if(process.env.UI_PROBE)fs.writeFileSync(path.join(out,`${id}.html`),await a.page.content());row.audit=a.audit;row.runtimeErrors=a.runtimeErrors;await a.context.close();}row.ms=Date.now()-start;results.push(row);report();console.log(`${results.length}/${plan.length} ${row.status.toUpperCase()} ${id} ${c.title}${row.status==='failed'?' :: '+row.actual.slice(0,180):''}`);}
      if(stopping || fs.existsSync(path.join(out,'stop-requested')))break;
    }
  }finally{if(browser)await browser.close();await backend.stop();}
  console.log(JSON.stringify({executed:results.length,passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length,report:out}));
}
if(process.argv.includes('--report-only')) {results.push(...JSON.parse(fs.readFileSync(path.join(out,'results.json'),'utf8')).results);report();}
else main().catch(e=>{console.error(e.stack);process.exitCode=1;});
