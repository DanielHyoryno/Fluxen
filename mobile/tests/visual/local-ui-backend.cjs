// Test infrastructure only: real backend, fresh schema, localhost only, no push.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../..');
const req = createRequire(path.join(root, 'backend/package.json'));

exports.start = async function start() {
  const url = new URL(process.env.TEST_DATABASE_URL || 'postgresql://fluxen_test@127.0.0.1:55439/postgres');
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Test database must be localhost');
  const schema = `fluxen_ui_${process.pid}_test`;
  assert.match(schema, /^fluxen_ui_[0-9]+_test$/);
  Object.assign(process.env, {NODE_ENV:'test', DATABASE_URL:url.toString(), DB_SCHEMA:schema, DB_SSL:'false',
    JWT_SECRET:'local-ui-only-not-production', JWT_EXPIRES_IN:'7d', BUSINESS_TIMEZONE:'Asia/Jakarta',
    PUSH_NOTIFICATIONS_ENABLED:'false', EXPO_ACCESS_TOKEN:''});
  const { Pool } = req('pg');
  const bootstrap = new Pool({connectionString:url.toString(), ssl:false});
  await bootstrap.query(`CREATE SCHEMA ${schema}`);
  const pool = req('./src/config/db');
  await pool.query(fs.readFileSync(path.join(root,'backend/tests/fixtures/schema.sql'),'utf8'));
  const app = req('./src/app');
  // Give each test a reserved synthetic client IP; the real limiter remains on.
  app.set('trust proxy', 'loopback');
  const server = await new Promise(resolve => {const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const hash = await req('bcrypt').hash('password123', 10);
  const jwt = req('jsonwebtoken');
  const now = '2026-10-29T23:45:00+07:00';
  return {
    base:`http://127.0.0.1:${server.address().port}`,
    now, pool, ExcelJS:req('exceljs'),
    async seed(options={}) {
      await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
      await pool.query('INSERT INTO users(full_name,email,password_hash) VALUES($1,$2,$3)', ['UI Test User','owner@ui.test',hash]);
      await pool.query("INSERT INTO device_categories(user_id,name) VALUES(1,'Kitchen'),(1,'Garden'),(1,'Empty')");
      if (!options.noPrice) await pool.query("INSERT INTO billing_settings(user_id,price_per_liter) VALUES(1,10)");
      if (!options.noDevices) {
        await pool.query(`INSERT INTO devices(user_id,device_code,device_name,api_token_hash,status,category_id,install_location,last_seen_at)
          VALUES(1,'METER-01','Kitchen Meter','local-only','online',1,NULL,$1),
          (1,'METER-02','Garden Meter','local-only','offline',2,NULL,'2026-09-01'),
          (1,'METER-03','Spare Meter','local-only','offline',NULL,NULL,NULL)`,[now]);
        await pool.query('INSERT INTO device_thresholds(device_id,daily_usage_limit_l,monthly_usage_limit_l) VALUES(1,100,1000)');
        if (!options.noReadings) {
          await pool.query(`INSERT INTO measurements(device_id,measured_at,flow_rate_lpm,volume_delta_l,cumulative_volume_l,pulse_count)
            SELECT d, ('2026-10-'||LPAD(day::text,2,'0')||'T01:00:00+07:00')::timestamptz, 1,
            CASE WHEN d=1 THEN 2.5 ELSE 1.5 END, 10, 100 FROM generate_series(1,28) day CROSS JOIN generate_series(1,2) d
            WHERE NOT ($1::boolean AND day=27)`,[!!options.zeroDay]);
          await pool.query(`INSERT INTO measurements(device_id,measured_at,flow_rate_lpm,volume_delta_l,cumulative_volume_l,pulse_count) VALUES
            (1,'2026-10-29T01:00:00+07:00',2,1,11,100),
            (1,'2026-10-29T02:00:00+07:00',4,2,13,200),
            (1,'2026-10-29T23:44:00+07:00',1.25,0,13,0),
            (2,'2026-10-29T01:00:00+07:00',1,4,14,400)`);
          if(options.longHistory) await pool.query(`INSERT INTO measurements(device_id,measured_at,flow_rate_lpm,volume_delta_l)
            SELECT 1,('2026-10-29T'||LPAD(h::text,2,'0')||':00:00+07:00')::timestamptz, 1,0.1 FROM generate_series(3,15) h`);
        }
        if(options.alert) await pool.query(`INSERT INTO alerts(device_id,alert_type,title,message,triggered_at) VALUES
          (1,'USAGE_LIMIT_DAILY','Local test alert','Daily limit exceeded in local fixture',$1)`,[now]);
      }
      return jwt.sign({sub:'1',role:'user'},process.env.JWT_SECRET,{expiresIn:options.expired?'-1h':'7d'});
    },
    async stop(){await new Promise(resolve=>server.close(resolve)); await pool.end(); await bootstrap.query(`DROP SCHEMA ${schema} CASCADE`); await bootstrap.end();}
  };
};
