// App-Werkstatt – Cloudflare Worker
// Speichert pro Klasse + Vorname + PIN alle Apps (Oberfläche + Blöcke), Fortschritt und Versionen.
// Freigegebene Apps sind unter /a/<code>/<app> fürs iPad/Handy erreichbar. Lehrkraft-Zugriff nur mit TEACHER_KEY.

const MAX_DATA = 600_000;
const MAX_VERSIONS = 60;
const VERSION_GAP_MIN = 10;
// PIN-Sperre (zeitlich, ohne Schema-Änderung): Die ersten FREE_FAILS Fehlversuche sind folgenlos. Danach muss man
// nach jedem weiteren Fehlversuch warten (30 s, 1, 2, 4 Min., höchstens 5 Min.). Während der Wartezeit werden ALLE
// Anmeldungen abgelehnt (auch mit richtiger PIN) und zählen nicht weiter. Eine richtige PIN nach der Wartezeit setzt
// den Zähler zurück; die Lehrkraft kann jederzeit „PIN zurücksetzen“ (setzt fails = 0).
// Ablage in der vorhandenen Spalte `fails`: Zeitstempel (Sekunden) * 100 + Anzahl Fehlversuche (0–99).
// Alte Werte (0–10) bleiben gültig (Zeit = 0 → nicht gesperrt). Grenze: Wer ein Konto dauernd beschießt, kann es
// jeweils bis zu 5 Minuten blockieren – aber nicht mehr dauerhaft.
const FREE_FAILS = 5;
const waitSec = n => n < FREE_FAILS ? 0 : Math.min(300, 30 * 2 ** (n - FREE_FAILS));
const decodeFails = f => ({ count: (f || 0) % 100, at: Math.floor((f || 0) / 100) });
const lockLeft = f => { const { count, at } = decodeFails(f); return Math.max(0, Math.ceil(at + waitSec(count) - Date.now() / 1000)); };

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const fail = (msg, status = 400) => json({ error: msg }, status);
const now = () => new Date().toISOString();
const kurse = env => (env.KURSE || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
const cleanNick = n => String(n || "").trim().replace(/\s+/g, " ").slice(0, 20);
const nickKey = n => cleanNick(n).toLowerCase();

// Ohne Secret PIN_SALT gilt der alte Standard-Salt. Ihn jetzt abzuschalten, würde alle bestehenden PINs ungültig
// machen (die Hashes wurden damit erzeugt) – deshalb nur eine laute Warnung im Log (siehe LIESMICH.md, „Betrieb“).
let saltWarned = false;
async function hashPin(env, kurs, key, pin) {
  if (!env.PIN_SALT && !saltWarned) { saltWarned = true; console.warn("PIN_SALT ist nicht gesetzt – unsicherer Standard-Salt aktiv. Bitte `wrangler secret put PIN_SALT` (setzt alle PINs neu!)."); }
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${env.PIN_SALT || "werkstatt"}|${kurs}|${key}|${pin}`));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
// Zeitkonstanter Vergleich zweier gleich langer Zeichenketten (hier: SHA-256-Hex)
function sameHash(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const sha = async t => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))].map(b => b.toString(16).padStart(2, "0")).join("");
const validAppId = id => typeof id === "string" && /^[a-z0-9_-]{1,32}$/i.test(id);
async function body(request) { try { return await request.json(); } catch { return {}; } }

async function auth(env, b) {
  const kurs = String(b.kurs || "").trim().toLowerCase(), key = nickKey(b.nick), pin = String(b.pin || "");
  if (!kurse(env).includes(kurs)) return { err: fail("Diese Klasse gibt es nicht. Schreib sie so: 8a, 8b, 8c …", 404) };
  if (!key || !/^\d{4}$/.test(pin)) return { err: fail("Vorname und vierstellige PIN eingeben.") };
  const row = await env.DB.prepare("SELECT * FROM students WHERE kurs = ? AND nick_key = ?").bind(kurs, key).first();
  if (!row) return { err: fail("Diesen Namen gibt es in deiner Klasse noch nicht.", 404) };
  const left = lockLeft(row.fails);
  if (left > 0) return { err: fail(`Zu viele falsche PINs. Bitte warte ${left > 90 ? Math.ceil(left / 60) + " Minuten" : left + " Sekunden"} und versuche es dann noch einmal (oder bitte deine Lehrkraft, die PIN zurückzusetzen).`, 429) };
  if (!sameHash(row.pin_hash, await hashPin(env, kurs, key, pin))) {
    const n = Math.min(99, decodeFails(row.fails).count + 1);
    await env.DB.prepare("UPDATE students SET fails = ? WHERE kurs = ? AND nick_key = ?").bind(Math.floor(Date.now() / 1000) * 100 + n, kurs, key).run();
    return { err: fail("Die PIN stimmt nicht.", 401) };
  }
  if (row.fails) await env.DB.prepare("UPDATE students SET fails = 0 WHERE kurs = ? AND nick_key = ?").bind(kurs, key).run();
  return { row, kurs, key };
}
const pub = row => ({ nick: row.nick, apps: JSON.parse(row.apps || "{}"), progress: JSON.parse(row.progress || "{}"), share: row.share || null, updated_at: row.updated_at });

async function student(request, env, path) {
  const b = await body(request);
  if (path === "/api/register") {
    const kurs = String(b.kurs || "").trim().toLowerCase(), nick = cleanNick(b.nick), key = nickKey(b.nick), pin = String(b.pin || "");
    if (!kurse(env).includes(kurs)) return fail("Diese Klasse gibt es nicht. Schreib sie so: 8a, 8b, 8c …", 404);
    if (nick.length < 2 || !/^[\p{L}][\p{L} .'-]*$/u.test(nick)) return fail("Bitte nur deinen Vornamen eintragen (Buchstaben, bei Doppelten z. B. „Lena M.“).");
    if (!/^\d{4}$/.test(pin)) return fail("Die PIN muss genau 4 Ziffern haben.");
    if (await env.DB.prepare("SELECT 1 FROM students WHERE kurs = ? AND nick_key = ?").bind(kurs, key).first())
      return fail("Diesen Namen gibt es in deiner Klasse schon. Wenn das nicht du bist: Hänge den ersten Buchstaben deines Nachnamens an, z. B. „Lena M.“.", 409);
    const t = now();
    await env.DB.prepare("INSERT INTO students (kurs, nick_key, nick, pin_hash, apps, progress, fails, created_at, updated_at) VALUES (?,?,?,?,?,?,0,?,?)")
      .bind(kurs, key, nick, await hashPin(env, kurs, key, pin), "{}", "{}", t, t).run();
    return json(pub(await env.DB.prepare("SELECT * FROM students WHERE kurs = ? AND nick_key = ?").bind(kurs, key).first()));
  }
  const a = await auth(env, b);
  if (a.err) return a.err;
  const { row, kurs, key } = a;
  if (path === "/api/login") return json(pub(row));
  if (path === "/api/save") {
    // App-Kennungen (a1 … a7, eigen) werden geprüft; ungültige Einträge fliegen raus (Schutz vor Schadcode in Adressen)
    const given = b.apps && typeof b.apps === "object" && !Array.isArray(b.apps) ? Object.fromEntries(Object.entries(b.apps).filter(([id]) => validAppId(id))) : null;
    const apps = JSON.stringify(given || JSON.parse(row.apps || "{}"));
    const progress = JSON.stringify(b.progress && typeof b.progress === "object" ? b.progress : JSON.parse(row.progress || "{}"));
    if (apps.length > MAX_DATA || progress.length > 60_000) return fail("Zu viele Daten.", 413);
    const t = now();
    await env.DB.prepare("UPDATE students SET apps = ?, progress = ?, updated_at = ? WHERE kurs = ? AND nick_key = ?").bind(apps, progress, t, kurs, key).run();
    const last = await env.DB.prepare("SELECT saved_at, apps FROM versions WHERE kurs = ? AND nick_key = ? ORDER BY id DESC LIMIT 1").bind(kurs, key).first();
    const old = last ? (Date.now() - Date.parse(last.saved_at)) / 60000 : Infinity;
    if (!last || (old >= VERSION_GAP_MIN && last.apps !== apps) || b.forceVersion) {
      await env.DB.prepare("INSERT INTO versions (kurs, nick_key, apps, saved_at) VALUES (?,?,?,?)").bind(kurs, key, apps, t).run();
      await env.DB.prepare(`DELETE FROM versions WHERE kurs = ? AND nick_key = ? AND id NOT IN (SELECT id FROM versions WHERE kurs = ? AND nick_key = ? ORDER BY id DESC LIMIT ?)`)
        .bind(kurs, key, kurs, key, MAX_VERSIONS).run();
    }
    return json({ ok: true, updated_at: t });
  }
  if (path === "/api/share") {
    const token = b.on ? (row.share || [...crypto.getRandomValues(new Uint8Array(6))].map(x => "abcdefghjkmnpqrstuvwxyz23456789"[x % 31]).join("")) : null;
    await env.DB.prepare("UPDATE students SET share = ? WHERE kurs = ? AND nick_key = ?").bind(token, kurs, key).run();
    return json({ share: token });
  }
  if (path === "/api/versions") {
    const { results } = await env.DB.prepare("SELECT id, saved_at FROM versions WHERE kurs = ? AND nick_key = ? ORDER BY id DESC").bind(kurs, key).all();
    return json({ versions: results });
  }
  if (path === "/api/version") {
    const v = await env.DB.prepare("SELECT id, apps, saved_at FROM versions WHERE kurs = ? AND nick_key = ? AND id = ?").bind(kurs, key, Number(b.id)).first();
    return v ? json({ ...v, apps: JSON.parse(v.apps) }) : fail("Version nicht gefunden.", 404);
  }
  return fail("Unbekannt.", 404);
}

// Lehrkraft-Bremse: Passwort wird per Hash zeitkonstant verglichen; jeder Fehlversuch kostet 1 s Wartezeit
// (ab 10 Fehlversuchen in 15 Min. 4 s). Grenzen: Der Zähler liegt nur im Speicher EINER Worker-Instanz, parallele
// Anfragen und mehrere Instanzen umgehen ihn. Echtes Rate-Limiting gehört in eine Cloudflare-Regel (siehe LIESMICH.md).
const tFails = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function teacherOk(request, env) {
  const given = request.headers.get("x-teacher-key") || "";
  const ok = !!env.TEACHER_KEY && sameHash(await sha("tk|" + given), await sha("tk|" + env.TEACHER_KEY));
  if (ok) return true;
  const t = Date.now();
  while (tFails.length && t - tFails[0] > 900_000) tFails.shift();
  tFails.push(t); if (tFails.length > 1000) tFails.shift();
  await sleep(tFails.length >= 10 ? 4000 : 1000);
  return false;
}

async function teacher(request, env, url, path) {
  if (!await teacherOk(request, env)) return fail("Falsches Lehrkraft-Passwort.", 401);
  if (path === "/api/t/kurse") return json({ kurse: kurse(env) });
  if (path === "/api/t/kurs") {
    const kurs = String(url.searchParams.get("kurs") || "").toLowerCase();
    const { results } = await env.DB.prepare(`SELECT s.nick, s.nick_key, s.apps, s.progress, s.updated_at, s.fails, r.data AS rating
      FROM students s LEFT JOIN ratings r ON r.kurs = s.kurs AND r.nick_key = s.nick_key WHERE s.kurs = ? ORDER BY s.nick_key`).bind(kurs).all();
    return json({ students: results.map(r => ({ ...r, fails: decodeFails(r.fails).count, locked: lockLeft(r.fails) > 0, apps: JSON.parse(r.apps || "{}"), progress: JSON.parse(r.progress || "{}"), rating: r.rating ? JSON.parse(r.rating) : null })) });
  }
  const b = await body(request);
  const kurs = String(b.kurs || "").toLowerCase(), key = nickKey(b.nick);
  if (path === "/api/t/rating") {
    await env.DB.prepare(`INSERT INTO ratings (kurs, nick_key, data, updated_at) VALUES (?,?,?,?)
      ON CONFLICT (kurs, nick_key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`).bind(kurs, key, JSON.stringify(b.data || {}).slice(0, 50_000), now()).run();
    return json({ ok: true });
  }
  if (path === "/api/t/pin") {
    const pin = String(b.pin || "");
    if (!/^\d{4}$/.test(pin)) return fail("PIN: 4 Ziffern.");
    await env.DB.prepare("UPDATE students SET pin_hash = ?, fails = 0 WHERE kurs = ? AND nick_key = ?").bind(await hashPin(env, kurs, key, pin), kurs, key).run();
    return json({ ok: true });
  }
  if (path === "/api/t/delete") {
    await env.DB.batch(["students", "versions", "ratings"].map(t => env.DB.prepare(`DELETE FROM ${t} WHERE kurs = ? AND nick_key = ?`).bind(kurs, key)));
    return json({ ok: true });
  }
  if (path === "/api/t/clear") {
    if (b.confirm !== "LÖSCHEN") return fail("Bestätigung fehlt.");
    const all = b.scope === "alle";
    if (!all && !kurse(env).includes(kurs)) return fail("Unbekannte Klasse.");
    const res = await env.DB.batch(["students", "versions", "ratings"].map(t => all ? env.DB.prepare(`DELETE FROM ${t}`) : env.DB.prepare(`DELETE FROM ${t} WHERE kurs = ?`).bind(kurs)));
    return json({ ok: true, geloescht: res[0].meta.changes });
  }
  return fail("Unbekannt.", 404);
}

// Freigegebene App als JSON für /play.html
async function shared(env, token, appId) {
  if (!/^[a-z0-9]{6}$/.test(token) || (appId && !validAppId(appId))) return fail("Nicht gefunden.", 404);
  const row = await env.DB.prepare("SELECT apps, nick FROM students WHERE share = ?").bind(token).first();
  if (!row) return fail("Diese App ist nicht (mehr) freigegeben.", 404);
  const apps = JSON.parse(row.apps || "{}");
  // ohne App-Kennung: Liste aller gebauten Apps (für die kurze Adresse /a/<code>)
  if (!appId) return json({ apps: Object.entries(apps).filter(([id, a]) => validAppId(id) && a && a.ui && a.ui.length).map(([id, a]) => ({ id, titel: String((a.screen || {}).titel || id).slice(0, 40) })) });
  if (!Object.prototype.hasOwnProperty.call(apps, appId) || !apps[appId]) return fail("Diese App gibt es nicht.", 404);
  return json({ app: apps[appId] });
}

// Sicherheits-Header für alle Antworten. Bewusst KEINE strenge CSP: Blockly und die Seiten nutzen Inline-Skripte/-Styles,
// die Vorschau (srcdoc-iframes mit sandbox) erbt eine CSP von der Elternseite. Nur das Einbetten wird verboten
// (die iframes der Werkstatt sind srcdoc und davon nicht betroffen).
function secure(res) {
  const r = new Response(res.body, res);
  r.headers.set("x-content-type-options", "nosniff");
  r.headers.set("referrer-policy", "no-referrer");
  r.headers.set("x-frame-options", "DENY");
  r.headers.set("content-security-policy", "frame-ancestors 'none'");
  r.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  return r;
}

export default {
  async fetch(request, env) {
    return secure(await handle(request, env));
  }
};

async function handle(request, env) {
  const url = new URL(request.url), path = url.pathname;
  try {
    if (path.startsWith("/api/shared/")) { const [, , , t, a] = path.split("/"); return await shared(env, t, a); }
    if (path.startsWith("/a/")) return env.ASSETS.fetch(new Request(new URL("/play", url), request));
    if (!path.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (path.startsWith("/api/t/")) return await teacher(request, env, url, path);
    if (request.method !== "POST") return fail("Nur POST.", 405);
    return await student(request, env, path);
  } catch (e) { console.error("Serverfehler", path, e); return fail("Serverfehler. Bitte versuche es gleich noch einmal.", 500); }
}
