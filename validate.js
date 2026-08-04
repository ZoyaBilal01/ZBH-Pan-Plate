'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');
const URL = require('url').URL;

const ROOT = __dirname;
let passed = 0;
let failed = 0;
const failures = [];

function record(name, ok, detail) {
  if (detail === undefined) detail = '';
  if (ok) {
    passed++;
    console.log('  PASS: ' + name);
  } else {
    failed++;
    failures.push(name + (detail ? ' -> ' + detail : ''));
    console.error('  FAIL: ' + name + (detail ? ' -> ' + detail : ''));
  }
}

function syncCheck(name, fn) {
  try {
    fn();
    record(name, true);
  } catch (e) {
    record(name, false, e && e.message ? e.message : String(e));
  }
}

function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function exists(p) { return fs.existsSync(path.join(ROOT, p)); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// ---- 1. Config JSON validity ----
function jsonOk(p) { try { JSON.parse(read(p)); return true; } catch (e) { return false; } }
syncCheck('firebase.json is valid JSON', () => assert(jsonOk('firebase.json')));
syncCheck('database.rules.json is valid JSON', () => assert(jsonOk('database.rules.json')));
syncCheck('.firebaserc is valid JSON', () => assert(jsonOk('.firebaserc')));
syncCheck('functions/package.json is valid JSON', () => assert(jsonOk('functions/package.json')));

// ---- 2. Syntax check (new Function parses but does not execute) ----
const jsFiles = ['js/main.js', 'js/common.js', 'js/firebase-config.js', 'js/admin.js', 'js/data.js', 'js/recipes.js', 'js/recipeImages.js', 'js/certification.js', 'js/certification-admin.js', 'js/emailjs-config.js', 'functions/index.js'];
for (const f of jsFiles) {
  if (!exists(f)) continue;
  syncCheck(f + ' parses without syntax errors', () => { try { new Function(read(f)); } catch (e) { throw e; } });
}

// ---- 3. auth.js loads & exposes a working Auth API (VM smoke test) ----
syncCheck('auth.js loads and exposes Auth API (VM smoke)', () => {
  const win = { Auth: {}, location: { pathname: '/pages/index.html', href: '' }, navigator: {} };
  function stubEl(id) {
    return { id, value: '', style: {}, classList: { add() {}, remove() {}, contains() { return false; } },
      querySelector() { return null; }, querySelectorAll() { return []; }, appendChild() {}, remove() {}, addEventListener() {} };
  }
  const fakeDoc = { getElementById: (id) => stubEl(id), querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, body: { style: {} } };
  const fakeAuth = {
    currentUser: null,
    signInWithEmailAndPassword() { return Promise.resolve({ user: { uid: 'u1', email: 'a@b.com', displayName: 'A' } }); },
    createUserWithEmailAndPassword() { return Promise.resolve({ user: { uid: 'u1', email: 'a@b.com', displayName: 'A' } }); },
    signInWithRedirect() { return Promise.resolve(); },
    getRedirectResult() { return Promise.resolve({ user: null }); },
    onAuthStateChanged(cb) { cb(null); },
    signOut() { return Promise.resolve(); },
    setPersistence() { return Promise.resolve(); }
  };
  const fakeDb = { ref() { return { once() { return Promise.resolve({ val: () => null }); }, update() { return Promise.resolve(); }, set() { return Promise.resolve(); }, on() {} }; } };
  const fakeFb = { auth: () => fakeAuth, database: () => fakeDb, apps: [], initializeApp() {}, database: { ServerValue: { TIMESTAMP: 'sv' } }, app: () => ({}) };
  const ctx = { window: win, document: fakeDoc, firebase: fakeFb, localStorage: {}, console };
  vm.createContext(ctx);
  vm.runInContext(read('js/auth.js'), ctx);
  const Auth = win.Auth;
  assert(typeof Auth.isLoggedIn === 'function', 'Auth.isLoggedIn exposed');
   assert(Auth.isLoggedIn() === false, 'Auth.isLoggedIn() is false with no user');
   assert(Auth.getUser() === null, 'Auth.getUser() is null with no user');
   assert(Auth.getUserName() === null, 'Auth.getUserName() is null with no user');
   assert(typeof Auth.logout === 'function', 'Auth.logout exposed');
});

// ---- 4. auth.js source / auth logic assertions ----
const authSrc = read('js/auth.js');
syncCheck('auth.js defines handleLogin', () => assert(/function handleLogin\b/.test(authSrc)));
syncCheck('auth.js defines handleSignup', () => assert(/function handleSignup\b/.test(authSrc)));
syncCheck('auth.js defines handleGoogleSignIn', () => assert(/function handleGoogleSignIn\b/.test(authSrc)));
syncCheck('auth.js defines handleLogout', () => assert(/function handleLogout\b/.test(authSrc)));
syncCheck('auth.js logs error.code + error.message on login error', () => assert(/logAuth\('Login error'.*code: error\.code, message: error\.message/.test(authSrc)));
syncCheck('auth.js logs error.code + error.message on signup error', () => assert(/logAuth\('Signup auth error'.*code: error\.code, message: error\.message/.test(authSrc)));
syncCheck('auth.js logs error.code + error.message on forgot password', () => assert(/logAuth\('Forgot password error'.*code: error\.code, message: error\.message/.test(authSrc)));
syncCheck('auth.js logs error.code + error.message on google redirect', () => assert(/logAuth\('Google redirect sign-in error'.*code: error\.code, message: error\.message/.test(authSrc)));
syncCheck('auth.js logs logout errors', () => assert(/console\.error\('Logout error:'.test(authSrc) || /logAuth\('Logout error'/.test(authSrc)));
syncCheck('no generic "An error occurred. Please try again." in auth.js', () => assert(!/An error occurred\. Please try again/.test(authSrc)));
syncCheck('getAuthErrorMessage accepts the full error object', () => assert(/function getAuthErrorMessage\(error\)/.test(authSrc)));
syncCheck('getAuthErrorMessage surfaces real Firebase code+message for unknown errors', () => assert(/Authentication error.*code: ' \+ code/.test(authSrc)));
syncCheck('signup writes users/{uid}/profile via .set() (triggers notification)', () => assert(/'users\/' \+ user\.uid \+ '\/profile'\)\.set\(/.test(authSrc)));
syncCheck('google new-user writes profile via .set() (triggers notification)', () => assert(/profileRef\.set\(\{/.test(authSrc)));
(function () {
  const ids = ['loginEmail', 'loginPassword', 'loginSubmitBtn', 'loginGoogleBtn', 'signupName', 'signupEmail', 'signupRegion', 'signupPassword', 'signupConfirmPassword', 'signupSubmitBtn', 'signupGoogleBtn', 'forgotEmail', 'forgotSubmitBtn'];
  for (const id of ids) {
    syncCheck('auth.js references form field id: ' + id, () => {
      assert(authSrc.indexOf('"' + id + '"') !== -1 || authSrc.indexOf("'" + id + "'") !== -1, 'missing form id: ' + id);
    });
  }
})();

// ---- 5. functions/index.js notification ----
const fnSrc = read('functions/index.js');
syncCheck('functions/index.js exports sendNewUserNotification', () => assert(/exports\.sendNewUserNotification/.test(fnSrc)));
syncCheck('notification triggers on users/{uid}/profile onCreate', () => assert(/ref\('users\/\{uid\}\/profile'\)/.test(fnSrc) && /onCreate/.test(fnSrc)));
syncCheck('notification emails zoyabilal01@gmail.com by default', () => assert(/DEFAULT_ADMIN_EMAIL = 'zoyabilal01@gmail.com'/.test(fnSrc)));
syncCheck('notification email includes all required fields', () => {
  assert(/Name:/i.test(fnSrc) && /Email:/i.test(fnSrc) && /Country\/Region/i.test(fnSrc));
  assert(/Authentication Provider/i.test(fnSrc));
  assert(/Sign-up date|Registration Date/i.test(fnSrc));
});
syncCheck('SendGrid key read from firebase env config (secure)', () => assert(/appCfg\.sendgrid_key/.test(fnSrc)));
syncCheck('no SendGrid API key hardcoded in functions source', () => assert(!/SG\.[A-Za-z0-9_.-]{20,}/.test(fnSrc)));
syncCheck('functions/index.js exports listUsersAdmin (admin panel callable)', () => assert(/exports\.listUsersAdmin/.test(fnSrc)));

// ---- 6. No secrets in client JS ----
syncCheck('no SendGrid/Gmail SMTP secrets in client js/', () => {
  let found = false;
  const files = ['js/auth.js', 'js/firebase-config.js', 'js/main.js', 'js/common.js', 'js/admin.js'];
  for (const f of files) { if (exists(f) && /SG\.[A-Za-z0-9_.-]{16,}|sendgrid|smtp\.gmail|nodemailer|app_password/i.test(read(f))) found = true; }
  assert(!found, 'client JS must not contain email-service secrets');
});

// ---- 7. Database rules security ----
syncCheck('database rules restrict user writes to authenticated owner', () => {
  const r = JSON.parse(read('database.rules.json'));
  assert(r.rules.users && r.rules.users.$uid && r.rules.users.$uid['.write'] && r.rules.users.$uid['.write'].indexOf('auth.uid === $uid') !== -1, 'users/$uid write restricted to owner');
  assert(r.rules.users.$uid.profile && r.rules.users.$uid.profile['.validate'], 'profile writes are validated');
});

// ---- 8. HTML asset references all exist ----
const HTML_FILES = ['index.html', 'pages/index.html', 'pages/admin.html', 'pages/favorites.html', 'pages/fridge.html', 'pages/diet-plans.html', 'pages/about.html', 'pages/contact.html', 'pages/cooking-certification.html', 'pages/certification-admin.html'];
let totalRefs = 0;
for (const p of HTML_FILES) {
  if (!exists(p)) continue;
  const html = read(p);
  const dir = path.dirname(path.join(ROOT, p));
  const matches = html.matchAll(/(?:src|href)="([^"]+)"/g);
  for (const m of matches) {
    const ref = m[1];
    if (/^(https?:)?\/\/|mailto:|^#|data:/i.test(ref)) continue;
    const target = path.resolve(dir, (ref.split('?')[0].split('#')[0]).replace(/^\.\//, ''));
    totalRefs++;
    syncCheck(p + ' references existing asset: ' + ref, () => assert(exists(target) || (fs.existsSync(target) && fs.statSync(target).isDirectory()), ref));
  }
}
syncCheck('all HTML asset references resolve (' + totalRefs + ' refs)', () => { assert(totalRefs > 0); });

// ---- 9. Localhost deployment: real HTTP serve + fetch ----
function runHttpTests(done) {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://l/');
    let f = u.pathname === '/' ? '/index.html' : u.pathname;
    let fp = path.join(ROOT, f);
    if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) fp = path.join(fp, 'index.html');
    if (!fs.existsSync(fp)) { res.writeHead(404); res.end('Not Found'); return; }
    const body = fs.readFileSync(fp);
    const ct = f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8';
    res.writeHead(200, { 'Content-Type': ct, 'Access-Control-Allow-Origin': '*' });
    res.end(body);
  });
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    const urls = ['/', '/js/main.js', '/js/firebase-config.js', '/js/common.js', '/js/certification.js', '/js/certification-admin.js', '/js/emailjs-config.js', '/css/style.css', '/pages/admin.html', '/pages/cooking-certification.html', '/pages/certification-admin.html'];
    let pending = urls.length;
    const finish = () => { if (--pending === 0) { server.close(); done(); } };
    urls.forEach((u) => {
      const r = http.get({ host: '127.0.0.1', port, path: u, headers: { Host: 'localhost' } }, (res) => {
        let data = ''; res.setEncoding('utf8'); res.on('data', (c) => data += c);
        res.on('end', () => {
          record('localhost serves ' + u + ' (status ' + res.statusCode + ')', res.statusCode === 200, res.statusCode !== 200 ? 'expected 200' : '');
          if (res.statusCode === 200) {
             if (u === '/' || u === '/pages/cooking-certification.html' || u === '/pages/certification-admin.html') {
              record('  ' + u + ' is HTML + loads firebase SDK', data.indexOf('<html') !== -1 && data.indexOf('firebase') !== -1, 'missing html/firebase marker');
            }
             if (u === '/js/main.js') record('  /js/main.js has fixed render hook', data.indexOf('currentPageRender') !== -1, 'missing currentPageRender');
          }
          finish();
        });
      });
      r.on('error', () => { record('localhost fetch ' + u, false, 'request error'); finish(); });
    });
  });
}

runHttpTests(() => {
  console.log('\n=== SUMMARY: ' + passed + ' passed, ' + failed + ' failed ===');
  if (failed) { console.error('\nFailures:\n' + failures.map(f => '  - ' + f).join('\n')); }
  process.exit(failed ? 1 : 0);
});
