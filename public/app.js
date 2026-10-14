/* App-Werkstatt – Schülerseite */
(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const ORIGIN = location.origin;
  const time = d => new Date(d).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  async function api(path, data) {
    let r; try { r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) }); }
    catch (e) { throw new Error("Keine Verbindung zum Server. Ist das Internet da?"); }
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Fehler " + r.status); return j;
  }
  function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2600); }

  let me = null, apps = {}, dirty = false, saveT = null, shareToken = null;
  const P0 = () => ({ manual: {}, done: {}, stage: {}, quiz: {}, last: "e1", training: 0, wahl7: "", idee: "" });
  let progress = P0();
  let stIdx = 0, view = "station", tab = "design", selId = null, ws = null, wsAppId = null, runtimeErr = null;

  /* ================= Anmeldung ================= */
  let mode = "new";
  function setMode(m) {
    mode = m; $("#m-new").classList.toggle("on", m === "new"); $("#m-old").classList.toggle("on", m === "old");
    $("#l-pin2-wrap").hidden = m !== "new"; $("#l-pin-lbl").textContent = m === "new" ? "Denk dir eine PIN aus (4 Ziffern)" : "Deine PIN (4 Ziffern)";
    $("#l-go").textContent = m === "new" ? "Konto anlegen" : "Anmelden"; $("#l-msg").textContent = "";
  }
  $("#m-new").onclick = () => setMode("new"); $("#m-old").onclick = () => setMode("old");
  try { const l = JSON.parse(localStorage.getItem("aw-last") || "{}"); $("#l-kurs").value = l.kurs || ""; $("#l-nick").value = l.nick || ""; setMode(l.nick ? "old" : "new"); } catch (e) { setMode("new"); }
  $("#login-form").addEventListener("submit", async e => {
    e.preventDefault();
    const f = { kurs: $("#l-kurs").value.trim(), nick: $("#l-nick").value.trim(), pin: $("#l-pin").value.trim() }, reg = mode === "new", msg = $("#l-msg");
    msg.textContent = "";
    if (!f.kurs || !f.nick || !/^\d{4}$/.test(f.pin)) { msg.textContent = "Bitte Klasse, Vorname und eine vierstellige PIN eingeben."; return; }
    if (reg && $("#l-pin2").value.trim() !== f.pin) { msg.textContent = "Die beiden PINs sind nicht gleich. Bitte noch einmal eingeben."; return; }
    try {
      const d = await api(reg ? "/api/register" : "/api/login", f);
      try { localStorage.setItem("aw-last", JSON.stringify({ kurs: f.kurs, nick: d.nick })); sessionStorage.setItem("aw-session", JSON.stringify({ ...f, nick: d.nick })); } catch (e) {}
      start({ ...f, nick: d.nick }, d);
      if (reg) toast(`👋 Willkommen, ${d.nick}! Merk dir deine PIN.`);
    } catch (e) {
      if (!reg && /PIN stimmt nicht/.test(e.message)) msg.textContent = `Die PIN stimmt nicht. Falls du neu bist: Den Namen „${f.nick}“ gibt es in dieser Klasse schon – wähle oben „Ich bin neu“ und hänge den ersten Buchstaben deines Nachnamens an.`;
      else if (!reg && /noch nicht/.test(e.message)) msg.textContent = `Den Namen „${f.nick}“ gibt es in dieser Klasse noch nicht. Bist du neu? Dann wähle oben „Ich bin neu“.`;
      else msg.textContent = e.message;
    }
  });
  (async () => { let s = null; try { s = JSON.parse(sessionStorage.getItem("aw-session") || "null"); } catch (e) {} if (!s) return; try { start(s, await api("/api/login", s)); } catch (e) { sessionStorage.removeItem("aw-session"); } })();

  /* ================= Start & Speichern ================= */
  function start(who, d) {
    me = { kurs: who.kurs, nick: who.nick, pin: who.pin };
    apps = d.apps || {}; shareToken = d.share || null;
    progress = Object.assign(P0(), d.progress || {}); ["manual", "done", "stage", "quiz"].forEach(k => progress[k] = progress[k] || {});
    $("#login").hidden = true; $("#app").hidden = false; $("#me-name").textContent = me.nick;
    stIdx = Math.max(0, STATIONEN.findIndex(s => s.id === progress.last));
    initWork();
    show("station");
    setInterval(() => { if (dirty) save(); }, 30000);
  }
  function setSave(t, bad) { const s = $("#save-state"); s.textContent = t; s.classList.toggle("bad", !!bad); }
  function touch() { dirty = true; setSave("✏️ geändert"); clearTimeout(saveT); saveT = setTimeout(save, 2500); }
  async function save(force, extra = {}) {
    if (!me || (!dirty && !force)) return;
    clearTimeout(saveT); setSave("💾 speichert …");
    try { await api("/api/save", { ...me, apps, progress, ...extra }); dirty = false; setSave("✓ gespeichert " + new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })); if (force === true) toast("✓ Gespeichert"); }
    catch (e) { setSave("⚠️ nicht gespeichert!", true); toast("⚠️ " + e.message); saveT = setTimeout(save, 15000); }
  }
  $("#logout").onclick = async () => { await save(true); sessionStorage.removeItem("aw-session"); location.reload(); };
  // Notfall-Speichern beim Verlassen: auch bei Tab-Wechsel/Schließen (iPad-Safari feuert oft nur pagehide/visibilitychange).
  // keepalive-Anfragen sind vom Browser auf ca. 64 KB begrenzt; größere Stände werden dann beim nächsten Autosave gesichert.
  function flush() { if (!dirty || !me) return; try { fetch("/api/save", { method: "POST", keepalive: true, headers: { "content-type": "application/json" }, body: JSON.stringify({ ...me, apps, progress }) }).catch(() => {}); } catch (e) {} }
  window.addEventListener("beforeunload", e => { if (!dirty) return; flush(); e.preventDefault(); e.returnValue = ""; });
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  document.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(true); } });

  /* ================= Apps ================= */
  const newApp = () => ({ screen: { titel: "Meine App", hintergrund: "#ffffff", textfarbe: "#1f2937" }, ui: [], blocks: null, code: "", css: "" });
  const cur = () => STATIONEN[stIdx];
  const appId = () => cur().app;
  const app = () => { const id = appId(); if (!id) return null; if (!apps[id]) apps[id] = newApp(); return apps[id]; };
  WWB.setApp(() => app() || { ui: [] });
  const uid = () => "c" + Math.random().toString(36).slice(2, 9);
  const findComp = (id, list = app().ui, parent = null) => { for (const c of list) { if (c.id === id) return { c, list, parent }; if (c.kinder) { const r = findComp(id, c.kinder, c); if (r) return r; } } return null; };
  function freeName(typ) { const used = new Set(WW.names(app())); let i = 1; while (used.has(typ + i)) i++; return typ + i; }

  /* ================= Arbeitsbereich ================= */
  function initWork() {
    $$(".wk-tabs button[data-tab]").forEach(b => b.onclick = () => setTab(b.dataset.tab));
    $("#t-restart").onclick = () => renderPreview(true);
    $("#t-share").onclick = shareDlg;
    $("#t-versions").onclick = versions;
    $("#detective").onclick = () => { const l = $("#detective-list"); l.hidden = !l.hidden; };
    window.addEventListener("message", e => {
      if (e.source !== $("#preview").contentWindow || !e.data) return;
      if (e.data.ww === "err") { runtimeErr = e.data.msg; renderDetective(); }
      if (e.data.ww === "select" && tab === "design") { selId = e.data.id; renderDesigner(); }
    });
    ws = Blockly.inject("blockly", {
      toolbox: WWB.toolbox(["ww_start"]), trashcan: true, scrollbars: true, sounds: false, renderer: "zelos", theme: Blockly.Themes.Classic,
      zoom: { controls: true, wheel: true, startScale: 0.85, maxScale: 2, minScale: 0.4 }, move: { scrollbars: true, drag: true, wheel: false },
      grid: { spacing: 24, length: 2, colour: "#e5e7eb", snap: true }
    });
    ws.addChangeListener(e => {
      if (e.isUiEvent || !wsAppId || !apps[wsAppId] || loadingWs) return;
      apps[wsAppId].blocks = Blockly.serialization.workspaces.save(ws);
      apps[wsAppId].code = WWB.wsCode(ws);
      touch(); changed();
    });
  }
  let loadingWs = false;
  function loadWorkspace() {
    const s = cur();
    if (!s.app) return;
    if (wsAppId === s.app) { ws.updateToolbox(WWB.toolbox(s.blocks)); return; }
    loadingWs = true; wsAppId = s.app;
    ws.clear();
    try { if (app().blocks) Blockly.serialization.workspaces.load(app().blocks, ws); } catch (e) { console.warn(e); }
    ws.updateToolbox(WWB.toolbox(s.blocks));
    loadingWs = false;
    app().code = WWB.wsCode(ws);
  }
  function setTab(t) {
    tab = t;
    $$(".wk-tabs button[data-tab]").forEach(b => b.classList.toggle("on", b.dataset.tab === t));
    $("#designer").hidden = t !== "design"; $("#blockly").hidden = t !== "blocks"; 
    if (t === "blocks") { setTimeout(() => Blockly.svgResize(ws), 10); }
    renderPreview();
  }
  let changeT = null;
  function changed() { clearTimeout(changeT); changeT = setTimeout(() => { renderPreview(); renderDetective(); updateTasks(); updateDone(); }, 300); }

  /* ---------- Vorschau im Handy ---------- */
  let lastDoc = "";
  function renderPreview(force) {
    const a = app(); if (!a) return;
    const boot = `const APP=${JSON.stringify(a).replace(/</g, "\\u003c")};const SEL=${JSON.stringify(tab === "design" ? selId : null)};
      const mem={};WW.run(document.body,APP,APP.code||"",{key:"vorschau",store:{get:k=>mem[k]??null,set:(k,v)=>{mem[k]=v}},
      onError:m=>parent.postMessage({ww:"err",msg:m},"*"),select:${tab === "design" ? 'id=>parent.postMessage({ww:"select",id},"*")' : "null"}});
      if(SEL){const e=document.querySelector('[data-ww="'+SEL+'"]');if(e)e.classList.add("ww-sel");}`;
    const doc = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><script src="${ORIGIN}/runtime.js?v=1"><\/script><script>${boot}<\/script></body></html>`;
    if (doc === lastDoc && !force) return;
    lastDoc = doc; runtimeErr = null;
    $("#preview").srcdoc = doc + (force ? `<!--${Date.now()}-->` : "");
  }

  /* ---------- Fehler-Detektiv ---------- */
  function renderDetective() {
    const a = app(); if (!a) return;
    const an = WWC.analyze(a);
    const items = [...an.lint];
    if (runtimeErr) items.unshift({ level: "error", msg: "Beim Ausführen: " + runtimeErr });
    const errs = items.filter(i => i.level === "error").length, warns = items.length - errs;
    const d = $("#detective");
    d.className = "detective app" + (errs ? " has-err" : warns ? " has-warn" : "");
    d.textContent = items.length ? `🕵️ Fehler-Detektiv: ${errs} Fehler${warns ? ` · ${warns} Hinweis${warns > 1 ? "e" : ""}` : ""} – anklicken für Details` : "🕵️ Fehler-Detektiv: Ich finde keinen Fehler. 👍";
    const list = $("#detective-list");
    list.innerHTML = items.map((e, i) => `<button data-i="${i}"><span>${e.level === "error" ? "🔴" : "🟡"}</span><span>${esc(e.msg)}</span></button>`).join("");
    list.querySelectorAll("button").forEach(b => b.onclick = () => {
      const e = items[+b.dataset.i]; if (!e.id) return;
      setTab("blocks"); setTimeout(() => { const bl = ws.getBlockById(e.id); if (bl) { bl.select(); ws.centerOnBlock(e.id); } }, 50);
    });
    if (!items.length) list.hidden = true;
  }

  /* ---------- Oberflächen-Baukasten ---------- */
  const EMOJIS = "🔮 ⭐ 🌟 🚀 🛸 🪐 🌙 ☀️ 🌈 🔥 💎 🪙 🏆 🎯 🎲 🎮 👾 🤖 🐱 🐶 🦊 🐼 🐸 🦄 🐢 🐙 🦋 🐝 ⚽ 🏀 🎵 📚 ✏️ ⏰ ⏳ 🏖️ 🎁 💡 ❤️ 👻 🌲 🌊 ⛄".split(" ");
  const SIZES = [["klein", "klein"], ["mittel", "mittel"], ["gross", "groß"], ["riesig", "riesig"]];
  function renderDesigner() {
    const a = app(), s = cur(); if (!a) return;
    const allowed = (s.komps || []).filter(t => t !== "figur");
    const node = c => {
      const def = WW.COMPONENTS[c.typ] || {};
      const kids = def.kinder ? `<div class="kids">${(c.kinder || []).map(node).join("")}
        ${def.kinder.filter(t => (s.komps || []).includes(t)).map(t => `<button class="add-in" data-add="${t}" data-in="${esc(c.id)}">+ ${WW.COMPONENTS[t].icon} ${WW.COMPONENTS[t].label}</button>`).join("")}</div>` : "";
      return `<div><div class="node ${selId === c.id ? "sel" : ""}" data-id="${esc(c.id)}"><span>${def.icon || "?"}</span><span class="nm">${esc(c.name)}</span><span class="ty">${def.label || c.typ}</span>
        <button data-up="${esc(c.id)}" title="nach oben">▲</button><button data-down="${esc(c.id)}" title="nach unten">▼</button><button data-del="${esc(c.id)}" title="löschen">🗑</button></div>${kids}</div>`;
    };
    const sel = selId && findComp(selId);
    $("#designer").innerHTML = `
      <div class="d-col">
        ${!a.ui.length && s.vorlage ? `<div class="vorlage-box">🧰 Brauchst du eine Starthilfe? <button class="btn small" id="d-vorlage">Startvorlage laden</button></div>` : ""}
        <h3>➕ Baustein hinzufügen</h3>
        <div class="palette">${allowed.map(t => `<button data-add="${t}">${WW.COMPONENTS[t].icon} ${WW.COMPONENTS[t].label}</button>`).join("")}</div>
        <h3>📱 Deine App <span class="hint-small">(von oben nach unten)</span></h3>
        <div class="tree">${a.ui.map(node).join("") || `<p class="muted">Noch leer – füge oben einen Baustein hinzu.</p>`}</div>
        <div style="margin-top:12px"><button class="btn small" id="d-screen">⚙️ App-Einstellungen (Titel, Farben)</button></div>
      </div>
      <div class="d-col"><h3>${sel ? `${WW.COMPONENTS[sel.c.typ].icon} ${esc(sel.c.name)} bearbeiten` : "⚙️ App-Einstellungen"}</h3><div class="props" id="props"></div></div>`;
    $("#designer").querySelectorAll("[data-add]").forEach(b => b.onclick = e => { e.stopPropagation(); addComp(b.dataset.add, b.dataset.in); });
    $("#designer").querySelectorAll(".node").forEach(n => n.onclick = () => { selId = n.dataset.id; renderDesigner(); renderPreview(); });
    $("#designer").querySelectorAll("[data-up],[data-down]").forEach(b => b.onclick = e => { e.stopPropagation(); move(b.dataset.up || b.dataset.down, b.dataset.up ? -1 : 1); });
    $("#designer").querySelectorAll("[data-del]").forEach(b => b.onclick = e => { e.stopPropagation(); delComp(b.dataset.del); });
    $("#d-screen").onclick = () => { selId = null; renderDesigner(); renderPreview(); };
    const v = $("#d-vorlage"); if (v) v.onclick = loadVorlage;
    renderProps(sel && sel.c);
  }
  function addComp(typ, inId) {
    const a = app(), c = { id: uid(), typ, name: freeName(typ), props: {} };
    if (WW.COMPONENTS[typ].kinder) c.kinder = [];
    if (typ === "spielfeld") c.kinder.push({ id: uid(), typ: "figur", name: freeName("figur"), props: {} });
    if (inId) { const p = findComp(inId); p.c.kinder.push(c); } else a.ui.push(c);
    selId = c.id; touch(); renderDesigner(); changed();
  }
  function move(id, d) { const r = findComp(id); const i = r.list.indexOf(r.c), j = i + d; if (j < 0 || j >= r.list.length) return; [r.list[i], r.list[j]] = [r.list[j], r.list[i]]; touch(); renderDesigner(); changed(); }
  function delComp(id) {
    const r = findComp(id); if (!confirm(`„${r.c.name}“ löschen? Blöcke, die ihn benutzen, zeigen dann einen Fehler.`)) return;
    r.list.splice(r.list.indexOf(r.c), 1); if (selId === id) selId = null; renameInBlocks(null, null); touch(); renderDesigner(); changed();
  }
  function loadVorlage() {
    const v = cur().vorlage; if (!v) return;
    const a = app(), clone = list => list.map(c => ({ id: uid(), typ: c.typ, name: c.name, props: { ...(c.props || {}) }, ...(c.kinder ? { kinder: clone(c.kinder) } : {}) }));
    a.ui = clone(v.ui); a.screen = Object.assign(newApp().screen, v.screen || {});
    touch(); renderDesigner(); changed(); toast("🧰 Startvorlage geladen – jetzt fehlen noch die Blöcke!");
  }
  function renderProps(c) {
    const box = $("#props"), a = app();
    const sw = (key, val, obj) => `<div class="swatch-row">${WWB.FARB_NAMEN.map(([n, h]) => `<button data-k="${key}" data-v="${h}" title="${n}" style="background:${h}" class="${String(val).toLowerCase() === h ? "on" : ""}"></button>`).join("")}</div>`;
    if (!c) {
      const s = a.screen;
      box.innerHTML = `<label>Titel der App <input type="text" data-s="titel" value="${esc(s.titel || "")}" maxlength="30"></label>
        <label>Hintergrund ${sw("s:hintergrund", s.hintergrund)}</label><label>Textfarbe ${sw("s:textfarbe", s.textfarbe)}</label>
        <p class="hint-small">Tipp: Tippe im Handy rechts auf einen Baustein, um ihn hier zu bearbeiten.</p>`;
    } else {
      const p = Object.assign({}, WW.COMPONENTS[c.typ].props, c.props);
      const f = [];
      f.push(`<label>Name (für die Blöcke) <input type="text" id="p-name" value="${esc(c.name)}" maxlength="20"><span class="hint-small">nur Buchstaben und Zahlen, keine Leerzeichen</span></label>`);
      if ("text" in p) f.push(`<label>Text <input type="text" data-p="text" value="${esc(p.text)}" maxlength="80"></label>`);
      if ("platzhalter" in p) f.push(`<label>Grauer Hinweistext <input type="text" data-p="platzhalter" value="${esc(p.platzhalter)}" maxlength="40"></label>`);
      if ("farbe" in p) f.push(`<label>Knopf-Farbe ${sw("p:farbe", p.farbe)}</label>`);
      if ("textfarbe" in p) f.push(`<label>Textfarbe ${sw("p:textfarbe", p.textfarbe)}</label>`);
      if ("hintergrund" in p) f.push(`<label>Hintergrund ${sw("p:hintergrund", p.hintergrund)}</label>`);
      if ("groesse" in p && c.typ !== "figur") f.push(`<label>Größe <select data-p="groesse">${SIZES.map(([v, n]) => `<option value="${v}" ${p.groesse === v ? "selected" : ""}>${n}</option>`).join("")}</select></label>`);
      if ("fett" in p) f.push(`<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-p="fett" ${p.fett ? "checked" : ""}> fett</label>`);
      if ("ausrichtung" in p) f.push(`<label>Ausrichtung <select data-p="ausrichtung">${[["links", "links"], ["mitte", "Mitte"], ["rechts", "rechts"]].map(([v, n]) => `<option value="${v}" ${p.ausrichtung === v ? "selected" : ""}>${n}</option>`).join("")}</select></label>`);
      if ("breite" in p) f.push(`<label>Breite <select data-p="breite"><option value="voll" ${p.breite === "voll" ? "selected" : ""}>ganze Breite</option><option value="auto" ${p.breite === "auto" ? "selected" : ""}>nur so breit wie nötig</option></select></label>`);
      if ("bild" in p) f.push(`<label>Bild: Emoji wählen <div class="emoji-row">${EMOJIS.map(e => `<button data-emoji="bild" data-v="${e}">${e}</button>`).join("")}</div></label>
        <label>… oder Bildadresse (https://…) <input type="text" data-p="bild" value="${esc(/^https?:/.test(p.bild) ? p.bild : "")}" placeholder="https://…/bild.png"></label>`);
      if ("emoji" in p) f.push(`<label>Aussehen <div class="emoji-row">${EMOJIS.map(e => `<button data-emoji="emoji" data-v="${e}">${e}</button>`).join("")}</div></label>
        <label>Größe (Pixel) <input type="number" data-p="groesse" value="${p.groesse}" min="20" max="120"></label>
        <label>Start-Position x <input type="number" data-p="x" value="${p.x}" min="0" max="400"></label><label>Start-Position y <input type="number" data-p="y" value="${p.y}" min="0" max="600"></label>`);
      if ("hoehe" in p) f.push(`<label>Höhe (Pixel) <input type="number" data-p="hoehe" value="${p.hoehe}" min="100" max="600"></label>`);
      if ("elemente" in p) f.push(`<label>Einträge am Anfang (einer pro Zeile) <textarea data-p="elemente">${esc(p.elemente)}</textarea></label>`);
      box.innerHTML = f.join("");
    }
    const setP = (k, v) => { if (!c) a.screen[k] = v; else { c.props = c.props || {}; c.props[k] = v; } touch(); changed(); };
    box.querySelectorAll("[data-s]").forEach(i => i.oninput = () => setP(i.dataset.s, i.value));
    box.querySelectorAll("input[data-p], select[data-p], textarea[data-p]").forEach(i => {
      const ev = i.tagName === "SELECT" || i.type === "checkbox" ? "onchange" : "oninput";
      i[ev] = () => setP(i.dataset.p, i.type === "checkbox" ? i.checked : i.type === "number" ? +i.value : i.value);
    });
    box.querySelectorAll(".swatch-row button").forEach(b => b.onclick = () => { const [w, k] = b.dataset.k.split(":"); if (w === "s") a.screen[k] = b.dataset.v; else { c.props = c.props || {}; c.props[k] = b.dataset.v; } touch(); renderProps(c); changed(); });
    box.querySelectorAll("[data-emoji]").forEach(b => b.onclick = () => { c.props = c.props || {}; c.props[b.dataset.emoji] = b.dataset.v; touch(); changed(); });
    const nm = $("#p-name");
    if (nm) nm.onchange = () => {
      const v = nm.value.trim();
      if (!/^[A-Za-zÄÖÜäöüß][A-Za-z0-9ÄÖÜäöüß_]*$/.test(v)) { toast("Name: nur Buchstaben und Zahlen, ohne Leerzeichen, am Anfang ein Buchstabe."); nm.value = c.name; return; }
      if (v !== c.name && WW.names(a).includes(v)) { toast("Diesen Namen gibt es schon."); nm.value = c.name; return; }
      const alt = c.name; c.name = v; renameInBlocks(alt, v); touch(); renderDesigner(); changed();
    };
  }
  function renameInBlocks(alt, neu) {
    // Gespeicherte Blöcke anpassen (auch wenn die Blöcke gerade nicht geladen sind)
    const fix = o => { if (!o || typeof o !== "object" || alt == null) return; if (o.fields) ["KOMP", "A", "B"].forEach(k => { if (o.fields[k] === alt) o.fields[k] = neu; }); Object.values(o).forEach(fix); };
    const a = app(); fix(a.blocks);
    if (wsAppId === appId()) { loadingWs = true; ws.clear(); try { Blockly.serialization.workspaces.load(a.blocks, ws); } catch (e) {} loadingWs = false; a.code = WWB.wsCode(ws); }
  }

  /* ================= Stationen ================= */
  const safe = (fn, a) => { try { return !!fn(a, progress); } catch (e) { return false; } };
  const anOf = s => WWC.analyze(s.app ? (apps[s.app] || newApp()) : newApp());
  const taskOk = (s, i, a) => s.pflicht[i].check ? safe(s.pflicht[i].check, a) : !!progress.manual[`${s.id}-${i}`];
  const bonusOk = (s, i, a) => s.bonus[i].check ? safe(s.bonus[i].check, a) : !!progress.manual[`${s.id}-b${i}`];
  const isDone = s => { const a = anOf(s); return s.pflicht.every((_, i) => taskOk(s, i, a)) && (!s.app || a.errors === 0); };
  function updateDone() {
    let ch = false;
    STATIONEN.forEach(s => { const d = isDone(s); if (d && !progress.done[s.id]) { progress.done[s.id] = new Date().toISOString(); ch = true; if (cur() === s) toast(`🎉 ${s.titel}: alle Pflicht-Aufgaben geschafft!`); } if (!d && progress.done[s.id]) { delete progress.done[s.id]; ch = true; } });
    if (ch) { touch(); updatePicker(); }
  }
  // Werkstatt-Tour zu Beginn von App 1: Die Oberfläche baut sich Schritt für Schritt auf.
  // Stufen: 0 nur Station · 1 + Handy · 2 + Oberfläche · 3 + Blöcke · 4 alles
  let tour = null;
  const uiStep = s => tour && s.app ? TOUR[tour.i].lvl : 5;
  function applyUi() {
    const s = cur(), ui = uiStep(s), sp = $("#split");
    sp.classList.toggle("solo", view === "station" && !s.app);
    ["ui-0", "ui-1", "ui-2", "ui-3", "ui-4"].forEach(c => sp.classList.toggle(c, ui === +c.slice(3)));
    return ui;
  }
  function show(v) {
    view = "station"; $("#learn").scrollTop = 0;
    const s = cur(), ui = applyUi();
    if (ui === 1) tab = "design";
    if (s.app) { loadWorkspace(); $("#appname").textContent = `${s.icon} ${s.titel}`; if (!selId || !findComp(selId)) selId = null; renderDesigner(); setTab(tab); renderDetective(); }
    renderStation();
    updatePicker();
    if (v === "station" && s.id === "a1" && !progress.tour && !tour) startTour();
  }

  const TOUR = [
    { lvl: 0, t: null, h: "🛠️ Deine Werkstatt", x: "Gleich baust du deine erste App. Vorher lernst du deine Werkstatt kennen – Stück für Stück, von links nach rechts. Klicke immer auf „Weiter“." },
    { lvl: 0, t: "#learn", h: "📘 Links: die Station", x: "Hier steht in jeder Station, worum es geht und was du tun sollst – Schritt für Schritt. Die Häkchen ✓ bei den Aufgaben setzen sich von allein, sobald du es geschafft hast." },
    { lvl: 1, t: '.wk-tabs [data-tab="design"]', tab: "design", h: "🎨 Mitte: Oberfläche", x: "In der Mitte baust du. Im Reiter „Oberfläche“ legst du fest, was man <b>sieht</b>: Knöpfe, Texte, Bilder." },
    { lvl: 1, t: ".palette", tab: "design", h: "➕ Bausteine hinzufügen", x: "Ein Klick auf einen Baustein – und er ist in deiner App." },
    { lvl: 1, t: ".tree", tab: "design", h: "📋 Deine App", x: "Hier stehen alle Bausteine deiner App von oben nach unten. Mit ▲ ▼ verschiebst du sie, mit 🗑 löschst du sie. Antippen = bearbeiten." },
    { lvl: 1, t: ".d-col + .d-col", tab: "design", h: "✏️ Bearbeiten", x: "Hier änderst du Text, Farbe und Größe. Wichtig: Jeder Baustein hat einen <b>Namen</b>. Mit diesem Namen sprichst du ihn später in den Blöcken an." },
    { lvl: 2, t: '.wk-tabs [data-tab="blocks"]', tab: "blocks", h: "🧩 Mitte: Blöcke", x: "Im Reiter „Blöcke“ legst du fest, was <b>passiert</b> – die Logik deiner App: „<i>wenn</i> der Knopf angetippt wird, <i>dann</i> …“" },
    { lvl: 2, t: ".blocklyToolboxDiv", tab: "blocks", h: "🗂️ Block-Kategorien", x: "Hier findest du alle Blöcke, nach Farben sortiert. Klick auf eine Kategorie – dann klappen die Blöcke heraus." },
    { lvl: 2, t: "#blockly .blocklySvg", cut: ".blocklyToolboxDiv", inside: true, tab: "blocks", h: "🧱 Die Arbeitsfläche", x: "Hierher ziehst du die Blöcke und steckst sie zusammen wie Puzzleteile. Ein Block wirkt nur, wenn er in einem orangen „wenn …“-Block steckt. Löschen: Block in den Mülleimer 🗑 ziehen. Mit + und − zoomst du." },
    { lvl: 3, t: "#detective", tab: "blocks", h: "🕵️ Fehler-Detektiv", x: "Er meldet, wenn ein Block nirgends dranhängt oder etwas fehlt. Anklicken zeigt dir, welcher Block es ist." },
    { lvl: 4, t: ".phone", tab: "blocks", h: "📱 Rechts: das Handy", x: "Hier läuft deine App – sofort, während du baust. Du kannst sie antippen und ausprobieren wie auf einem echten Handy." },
    { lvl: 5, t: ".phone-tools", tab: "blocks", h: "🧰 Werkzeuge", x: "↻ <b>Neu starten</b>: App von vorn · 📱 <b>Auf dem iPad</b>: App auf dem iPad testen · 🕘 <b>ältere Versionen</b> zurückholen. Gespeichert wird automatisch." },
    { lvl: 5, t: ".bar", tab: "blocks", h: "🧭 Oben: die Leiste", x: "‹ › Station wechseln – auf den Namen klicken zeigt <b>alle Stationen</b>. 🎓 <b>Meine Note</b>: so wirst du bewertet. 🧩 <b>Block-Lexikon</b> zum Nachschlagen. 🧭 <b>Tour</b>: diese Erklärung noch einmal." },
    { lvl: 5, t: null, tab: "design", h: "🚀 Los geht's!", x: () => cur().id === "a1" ? "Jetzt kennst du deine Werkstatt. Bau deine erste App: einen <b>Klick-Zähler</b>. Lies links, wofür er gut ist – dann geht's los." : "Jetzt weißt du wieder, wo alles ist. Weiter geht's mit deiner App!" }
  ];
  function startTour() {
    if (!$("#tour-pop")) document.body.insertAdjacentHTML("beforeend", `<div id="tour-block"></div><div id="tour-spot"></div><div id="tour-pop" role="dialog"></div>`);
    tour = { i: 0 }; tourStep(0);
  }
  function tourStep(i) {
    tour.i = i; const st = TOUR[i];
    if (st.tab) tab = st.tab;
    const ui = applyUi();
    if (ui >= 1) { loadWorkspace(); $("#appname").textContent = `${cur().icon} ${cur().titel}`; renderDesigner(); setTab(tab); renderDetective(); setTimeout(() => Blockly.svgResize(ws), 30); }
    $("#tour-pop").innerHTML = `<div class="tp-n">${i + 1} / ${TOUR.length}</div><h3>${st.h}</h3><p>${typeof st.x === "function" ? st.x() : st.x}</p>
      <div class="tp-b">${i ? `<button class="btn small" id="tp-back">← Zurück</button>` : "<span></span>"}<button class="btn primary" id="tp-next">${i === TOUR.length - 1 ? "Los geht's 🚀" : "Weiter →"}</button></div>`;
    $("#tp-next").onclick = () => i === TOUR.length - 1 ? endTour() : tourStep(i + 1);
    const b = $("#tp-back"); if (b) b.onclick = () => tourStep(i - 1);
    $("#tour-pop").style.visibility = "hidden";
    setTimeout(placeTour, 180);
  }
  function placeTour() {
    if (!tour) return;
    const st = TOUR[tour.i], pop = $("#tour-pop"), spot = $("#tour-spot"), el = st.t && document.querySelector(st.t);
    const W = innerWidth, H = innerHeight, pw = pop.offsetWidth, ph = pop.offsetHeight, g = 16;
    let x = (W - pw) / 2, y = (H - ph) / 2;
    $("#tour-block").classList.toggle("dim", !el);
    if (el) {
      const b = el.getBoundingClientRect(), r = { left: b.left, top: b.top, right: b.right, bottom: b.bottom }, p = 6;
      const c = st.cut && document.querySelector(st.cut); if (c) r.left = Math.max(r.left, c.getBoundingClientRect().right + p);
      r.width = r.right - r.left; r.height = r.bottom - r.top;
      Object.assign(spot.style, { display: "block", left: r.left - p + "px", top: r.top - p + "px", width: r.width + 2 * p + "px", height: r.height + 2 * p + "px" });
      if (st.inside) { x = r.left + 30; y = r.top + 30; }
      else if (r.right + g + pw < W) { x = r.right + g; y = r.top; }
      else if (r.left - g - pw > 0) { x = r.left - g - pw; y = r.top; }
      else if (r.bottom + g + ph < H) { x = r.left; y = r.bottom + g; }
      else { x = r.left; y = r.top - g - ph; }
    } else spot.style.display = "none";
    pop.style.left = Math.max(8, Math.min(W - pw - 8, x)) + "px"; pop.style.top = Math.max(8, Math.min(H - ph - 8, y)) + "px";
    pop.style.visibility = "visible";
  }
  window.addEventListener("resize", placeTour);
  function endTour() {
    tour = null; progress.tour = true; touch(); tab = "design";
    ["#tour-block", "#tour-spot", "#tour-pop"].forEach(q => $(q) && $(q).remove());
    show("station");
  }
  $("#v-note").onclick = () => dialog(noteHtml() + `<div class="dlg-actions"><button class="btn primary" id="dlg-x">Schließen</button></div>`, d => d.querySelector("#dlg-x").onclick = closeDlg);
  $("#v-lex").onclick = () => dialog(lexHtml() + `<div class="dlg-actions"><button class="btn primary" id="dlg-x">Schließen</button></div>`, d => d.querySelector("#dlg-x").onclick = closeDlg);
  $("#v-tour").onclick = () => { if (!cur().app) go(STATIONEN.findIndex(s => s.id === "a1")); startTour(); };
  $("#st-prev").onclick = () => go(stIdx - 1); $("#st-next").onclick = () => go(stIdx + 1); $("#st-pick").onclick = picker;
  function go(i) { if (i < 0 || i >= STATIONEN.length) return; stIdx = i; progress.last = STATIONEN[i].id; selId = null; touch(); show("station"); }
  function updatePicker() { const s = cur(); $("#st-pick").textContent = `${progress.done[s.id] ? "✅" : s.icon} ${s.titel} ▾`; }

  function renderStation() {
    const s = cur(), L = $("#learn"), a = anOf(s);
    const stageMax = s.special ? 0 : 2;
    let stage = s.special ? 0 : Math.min(stageMax, progress.done[s.id] ? stageMax : (progress.stage[s.id] || 0));
    const task = (t, ok, key, auto) => `<li class="${ok ? "done" : ""}" data-key="${key}">${auto ? `<span class="st">${ok ? "✓" : ""}</span>` : `<input type="checkbox" data-manual="${key}" ${ok ? "checked" : ""}>`}<span>${t}</span></li>`;
    const unfold = (label, n) => `<div class="unfold"><button class="btn primary" data-unfold="${n}">${label}</button></div>`;
    let h = `<div class="st-head"><div class="st-kicker"><span>${s.phase}</span>${s.app && !s.uebung ? `<span>·</span><span>App ${PROJEKTE.indexOf(s) + 1 || "★"}</span>` : ""}</div>
      <h1>${s.icon} ${s.titel}</h1><p class="ziel">🎯 ${s.ziel}</p></div>
      ${progress.done[s.id] ? `<div class="done-banner">✅ Alle Pflicht-Aufgaben erledigt.</div>` : ""}`;
    if (s.special === "e1") h += E1();
    else if (s.special === "e2") h += E2();
    else if (s.special === "s8") h += S8();
    else {
      h += `<section class="card"><h2>💡 Wofür ist das gut?</h2><div class="alltag">${s.alltag}</div>${s.lernen}</section>`;
      if (stage === 0) h += unfold("✓ Verstanden – jetzt bauen ↓", 1);
      if (stage >= 1) {
        h += `<section class="card ${stage === 1 ? "new" : ""}" id="sec-bau"><h2>🛠️ Bau deine App <span class="badge" id="pf-count"></span></h2>
          ${s.wahl ? `<p><b>Welche App baust du?</b></p><div class="wahl">${WAHL7.map(([k, n]) => `<button data-wahl="${k}" class="${progress.wahl7 === k ? "on" : ""}">${n}</button>`).join("")}</div>` : ""}
          ${s.bonus1 ? `<label style="display:grid;gap:4px;font-weight:700;margin-bottom:10px">🔎 Mein Problem / meine Idee in einem Satz<input id="idee" maxlength="200" value="${esc(progress.idee || "")}" style="padding:9px;border:1px solid var(--line);border-radius:8px;font:inherit"></label>` : ""}
          <p class="muted">Rechts baust du: <b>🎨 Oberfläche</b> = was man sieht, <b>🧩 Blöcke</b> = was passiert. Die Häkchen setzen sich von allein.</p>
          <ul class="tasks">${s.pflicht.map((p, i) => task(p.t, taskOk(s, i, a), `${s.id}-${i}`, !!p.check)).join("")}</ul></section>`;
        if (stage === 1) h += unfold("Weiter: Mach sie zu deiner App ✨ ↓", 2);
      }
      if (stage >= 2) {
        if (s.bonus.length) h += `<section class="card ${stage === 2 ? "new" : ""}"><h2>✨ Mach sie zu deiner App <span class="muted" style="font-weight:400;font-size:.9rem">(Bonus)</span></h2>
          <ul class="tasks">${s.bonus.map((p, i) => task(p.t, bonusOk(s, i, a), `${s.id}-b${i}`, !!p.check)).join("")}</ul></section>`;
        if (s.profi && s.profi.length) h += `<section class="card"><details><summary><b>⭐ Profi-Aufgaben</b> – für alle, die mehr wollen</summary>
          <ul class="tasks" style="margin-top:10px">${s.profi.map((p, i) => task(p.t, safe(p.check, a), `${s.id}-p${i}`, true)).join("")}</ul></details></section>`;
        if (s.echt) h += `<section class="card"><h2>🌍 Echte Apps</h2><p>${s.echt}</p><p class="muted">Denk kurz nach: Welche App auf deinem Handy funktioniert ähnlich?</p></section>`;
      }
    }
    h += `<div class="st-foot"><button class="btn" id="f-prev" ${stIdx === 0 ? "disabled" : ""}>← Zurück</button><button class="btn primary" id="f-next" ${stIdx === STATIONEN.length - 1 ? "disabled" : ""}>Nächste Station →</button></div>`;
    L.innerHTML = h;
    L.querySelectorAll("[data-unfold]").forEach(b => b.onclick = () => {
      const n0 = +b.dataset.unfold; progress.stage[s.id] = n0; touch();
      renderStation();
      const n = L.querySelector(".card.new"); if (n) n.scrollIntoView({ behavior: "smooth" });
    });
    L.querySelectorAll("[data-manual]").forEach(c => c.onchange = () => { progress.manual[c.dataset.manual] = c.checked; touch(); updateDone(); updateTasks(); });
    L.querySelectorAll("[data-wahl]").forEach(b => b.onclick = () => { progress.wahl7 = b.dataset.wahl; cur().vorlage = WAHL7_VORLAGE[progress.wahl7]; touch(); renderStation(); renderDesigner(); updateDone(); });
    if (s.wahl && progress.wahl7) s.vorlage = WAHL7_VORLAGE[progress.wahl7];
    const idee = $("#idee"); if (idee) idee.oninput = () => { progress.idee = idee.value; touch(); updateTasks(); updateDone(); };
    $("#f-prev").onclick = () => go(stIdx - 1); $("#f-next").onclick = () => go(stIdx + 1);
    if (s.special === "e1") initE1(); if (s.special === "e2") initE2(); if (s.special === "s8") initS8();
    updateTasks();
  }
  function updateTasks() {
    const s = cur(); if (view !== "station") return;
    const a = anOf(s); let n = 0;
    s.pflicht.forEach((_, i) => { const ok = taskOk(s, i, a); n += ok; mark(`${s.id}-${i}`, ok); });
    (s.bonus || []).forEach((_, i) => mark(`${s.id}-b${i}`, bonusOk(s, i, a)));
    (s.profi || []).forEach((p, i) => mark(`${s.id}-p${i}`, safe(p.check, a)));
    const pc = $("#pf-count"); if (pc) { pc.textContent = `${n} von ${s.pflicht.length}`; pc.classList.toggle("ok", n === s.pflicht.length); }
  }
  function mark(key, ok) { const li = $(`.tasks li[data-key="${key}"]`); if (!li) return; li.classList.toggle("done", ok); const st = li.querySelector(".st"); if (st) st.textContent = ok ? "✓" : ""; }
  function picker() {
    let h = "<h2>🗺️ Alle Stationen</h2><div class='picker'>", ph = "";
    STATIONEN.forEach((s, i) => {
      if (s.phase !== ph) { ph = s.phase; h += `<div class="ph">${ph}</div>`; }
      const a = anOf(s), n = s.pflicht.filter((_, j) => taskOk(s, j, a)).length;
      h += `<button data-i="${i}" class="${progress.done[s.id] ? "done" : ""} ${i === stIdx ? "cur" : ""}">${progress.done[s.id] ? "✅" : s.icon} ${s.titel} <small class="muted">· Pflicht ${n}/${s.pflicht.length}</small></button>`;
    });
    dialog(h + "</div>", d => d.querySelectorAll("[data-i]").forEach(b => b.onclick = () => { closeDlg(); go(+b.dataset.i); }));
  }

  /* ---------- Einführung 1: Was ist eine App? ---------- */
  function E1() {
    const s = cur(), a = anOf(s);
    const li = i => { const p = s.pflicht[i], ok = taskOk(s, i, a); return `<li class="${ok ? "done" : ""}" data-key="e1-${i}">${p.check ? `<span class="st">${ok ? "✓" : ""}</span>` : `<input type="checkbox" data-manual="e1-${i}" ${progress.manual["e1-" + i] ? "checked" : ""}>`}<span>${p.t}</span></li>`; };
    return `<section class="card"><h2>📱 Drei Teile hat jede App</h2>
      <div class="parts3"><div class="p1"><span class="big">🖼️</span><b>Oberfläche</b><br><small>Was du siehst und antippst: Knöpfe, Texte, Bilder</small></div>
        <div class="p2"><span class="big">⚙️</span><b>Logik</b><br><small>Was passiert: „Wenn du tippst, dann …“</small></div>
        <div class="p3"><span class="big">🗄️</span><b>Daten</b><br><small>Was sich die App merkt: Nachrichten, Punkte, Listen</small></div></div>
      <p style="margin-top:12px">Beispiel Messenger: Das Eingabefeld ist <b>Oberfläche</b>. „Wenn ich auf Senden tippe, wird die Nachricht verschickt“ ist <b>Logik</b>. Deine Chats sind <b>Daten</b>.</p></section>
      <section class="card"><h2>🧩 Oberfläche, Logik oder Daten?</h2><div class="sort-q" id="q-e1"></div></section>
      <section class="card"><h2>✅ Deine Aufgaben</h2><ul class="tasks">${s.pflicht.map((_, i) => li(i)).join("")}</ul></section>`;
  }
  function initE1() {
    const Q = [["Der rote „Aufnehmen“-Knopf in der Kamera-App", "o"], ["Wenn du ein Foto machst, wird es im Album gespeichert.", "l"], ["Deine Highscores in einem Spiel", "d"],
      ["Die Liste deiner Kontakte", "d"], ["Wenn der Wecker klingelt und du „Schlummern“ tippst, klingelt er in 5 Minuten wieder.", "l"], ["Das Suchfeld in einer Musik-App", "o"]];
    const box = $("#q-e1"), lab = { o: "🖼️ Oberfläche", l: "⚙️ Logik", d: "🗄️ Daten" }, ok = new Set();
    box.innerHTML = Q.map(([t], i) => `<div class="q" data-i="${i}"><span>${t}</span>${Object.entries(lab).map(([k, n]) => `<button data-a="${k}">${n}</button>`).join("")}</div>`).join("");
    box.querySelectorAll("button").forEach(b => b.onclick = () => {
      const q = b.closest(".q"), i = +q.dataset.i, r = Q[i][1] === b.dataset.a;
      q.classList.remove("right", "wrong"); q.classList.add(r ? "right" : "wrong"); if (r) ok.add(i); else ok.delete(i);
      if (ok.size === Q.length && !progress.quiz.e1) { progress.quiz.e1 = true; touch(); updateDone(); updateTasks(); toast("🎉 Alles richtig zugeordnet!"); }
    });
  }
  /* ---------- Einführung 2: Wie denkt eine App? ---------- */
  function E2() {
    return `<section class="card"><h2>🧠 Apps denken in „Wenn … dann …“</h2>
      <p>Eine App tut nichts von allein. Sie <b>wartet auf ein Ereignis</b> – und <b>dann</b> führt sie aus, was du ihr gesagt hast. Genau so programmierst du gleich: mit Blöcken wie ${B("wenn Knopf angetippt wird")} → ${B("mache …")}.</p>
      <p><b>Bau drei Sätze aus deinem Alltag:</b></p><div class="wenn" id="wenn"></div></section>
      <section class="card"><h2>🔐 Was darf eine App?</h2><p>Apps fragen nach <b>Berechtigungen</b> (Kamera, Standort, Kontakte …). Manche brauchen sie wirklich – manche wollen nur Daten sammeln.</p><div class="sort-q" id="q-e2"></div></section>
      <section class="card"><h2>🛠️ Gleich geht's los</h2><p>In der nächsten Station lernst du zuerst deine <b>Werkstatt</b> kennen – eine kurze Tour zeigt dir alles. Dann baust du deine erste eigene App: einen Klick-Zähler.</p></section>
      <section class="card"><h2>✅ Deine Aufgaben</h2><ul class="tasks">${cur().pflicht.map((p, i) => `<li data-key="e2-${i}"><span class="st"></span><span>${p.t}</span></li>`).join("")}</ul></section>`;
  }
  function initE2() {
    const W1 = ["der Wecker klingelt", "es anfängt zu regnen", "mein Akku unter 20 % ist", "ich eine Nachricht bekomme", "die Ampel grün wird", "es zur Pause klingelt"];
    const W2 = ["stehe ich auf", "nehme ich einen Schirm mit", "lade ich das Handy", "zeigt das Handy eine Benachrichtigung", "gehe ich los", "gehe ich auf den Schulhof"];
    const box = $("#wenn"), sel = (opts) => `<select><option value="">…</option>${opts.map(o => `<option>${o}</option>`).join("")}</select>`;
    box.innerHTML = [0, 1, 2].map(() => `<div class="row">Wenn ${sel(W1)} , dann ${sel(W2)} .</div>`).join("");
    const chk = () => { const full = [...box.querySelectorAll(".row")].every(r => [...r.querySelectorAll("select")].every(s => s.value)); if (full && !progress.quiz.e2wenn) { progress.quiz.e2wenn = true; touch(); updateDone(); updateTasks(); toast("👍 Drei Wenn-dann-Sätze!"); } };
    box.querySelectorAll("select").forEach(s => s.onchange = chk);
    const Q = [["Taschenlampen-App will deine Kontakte lesen.", "v"], ["Navi-App will deinen Standort.", "n"], ["Foto-App will die Kamera.", "n"], ["Rechner-App will dein Mikrofon.", "v"], ["Messenger will Benachrichtigungen schicken.", "n"], ["Spiel will deinen genauen Standort.", "v"]];
    const qb = $("#q-e2"), ok = new Set();
    qb.innerHTML = Q.map(([t], i) => `<div class="q" data-i="${i}"><span>${t}</span><button data-a="n">✅ nötig</button><button data-a="v">🚩 verdächtig</button></div>`).join("");
    qb.querySelectorAll("button").forEach(b => b.onclick = () => {
      const q = b.closest(".q"), i = +q.dataset.i, r = Q[i][1] === b.dataset.a; q.classList.remove("right", "wrong"); q.classList.add(r ? "right" : "wrong"); if (r) ok.add(i); else ok.delete(i);
      if (ok.size === Q.length && !progress.quiz.e2rechte) { progress.quiz.e2rechte = true; touch(); updateDone(); updateTasks(); toast("🔐 Gut eingeschätzt!"); }
    });
  }
  /* ---------- Abschluss: Abnahme & App-Messe ---------- */
  function S8() {
    return `<section class="card"><h2>🎤 Abnahme</h2><p>Deine Lehrkraft schaut sich mit dir deine Apps an:</p>
      <ol class="tight"><li>Du zeigst eine App, auf die du stolz bist.</li><li>Deine Lehrkraft zeigt auf <b>drei Blöcke</b> – du erklärst, was sie tun.</li><li>Du baust eine <b>kleine Änderung live</b> ein.</li></ol>
      <p>🏋️ Übe mit dem <b>Erklär-Training</b>: Es zeigt dir zufällige Blöcke aus deinen Apps.</p><div id="training"></div></section>
      <section class="card"><h2>🎪 App-Messe <span class="muted" style="font-weight:400;font-size:.9rem">– ihr organisiert sie selbst, sie zählt nicht zur Note</span></h2>
      <div class="messe"><div><b>1. Aufteilen:</b> Die Klasse teilt sich in Gruppe A und B. Wählt eine Zeitwächterin oder einen Zeitwächter.</div>
        <div><b>2. Runde 1 (10 min):</b> Gruppe A zeigt am Platz ihre Lieblings-App (QR-Code bereithalten). Gruppe B geht herum und testet.</div>
        <div><b>3. Runde 2 (10 min):</b> Tauschen.</div>
        <div><b>4. Rückmeldung:</b> Zu jeder getesteten App „2 Sterne und 1 Wunsch“: zwei Dinge, die gut sind, eins, das noch besser werden kann.</div>
        <div><b>5. Zum Schluss:</b> Jede/r sagt der Klasse in einem Satz, welche fremde App sie oder er am liebsten selbst hätte – und warum.</div></div></section>
      <section class="card"><h2>✅ Deine Aufgabe</h2><ul class="tasks"><li data-key="s8-0"><span class="st"></span><span>${cur().pflicht[0].t}</span></li></ul></section>`;
  }
  function initS8() {
    const box = $("#training");
    const pool = () => PROJEKTE.flatMap(s => { const a = WWC.analyze(apps[s.app] || newApp()); return a.blocks.filter(b => b.type !== "text" && b.type !== "math_number" && b.type !== "ww_farbe").map(b => ({ s, b })); });
    const draw = () => {
      const p = pool(); if (!p.length) { box.innerHTML = `<p class="muted">Bau zuerst ein paar Apps.</p>`; return; }
      const x = p[Math.floor(Math.random() * p.length)];
      box.innerHTML = `<div class="training"><p><b>${x.s.icon} ${x.s.titel}:</b> Erkläre laut, was dieser Block macht – und wann er ausgeführt wird.</p>
        <p style="font-size:1.1rem">${B(blockLabel(x.b))}</p><button class="btn primary" id="tr-next">✔ Erklärt – nächster</button> <span class="muted">Schon erklärt: ${progress.training || 0}</span></div>`;
      $("#tr-next").onclick = () => { progress.training = (progress.training || 0) + 1; touch(); updateDone(); updateTasks(); draw(); };
    };
    box.innerHTML = `<button class="btn primary" id="tr-go">🎲 Erklär-Training starten</button>`; $("#tr-go").onclick = draw;
  }
  function blockLabel(b) {
    const f = b.fields || {}, L = LEX.find(l => l[0] === b.type);
    let t = L ? L[1] : b.type;
    if (f.KOMP) t = t.replace("…", f.KOMP); if (b.varName) t += ` (${b.varName})`;
    return t;
  }

  /* ================= Übersicht, Note, Lexikon ================= */
  function noteHtml() {
    const ev = WWC.evaluate(PROJEKTE, apps, progress, {});
    const stufe = ["0 – noch nicht begonnen", "1 – begonnen", "2 – alle Pflicht-Aufgaben erfüllt und keine Fehler", "3 – zusätzlich mindestens eine Aufgabe aus „Mach sie zu deiner App“"];
    return `<h2>🎓 Meine Note</h2>
      <div class="card"><p>So wird deine App-Entwicklung bewertet. Das gilt <b>von Anfang an</b> – hier siehst du jederzeit deinen Stand.</p>
        <p><b>Deine Apps: ${ev.appsSumme} von 21 Punkten</b></p></div>
      <div class="card"><h2>📱 Deine 7 Apps (je 0–3 Punkte)</h2><p class="muted">${stufe.join(" · ")}</p>
        ${ev.rows.map(r => `<details class="crit-d"><summary><span class="ct">${r.icon} ${r.titel}</span><span class="cp ${r.pts === 3 ? "full" : ""}">${r.pts} / 3</span></summary><p class="muted" style="margin:6px 0">${r.beleg}</p></details>`).join("")}</div>
      <div class="card"><h2>🎤 Apps erklären (0–3 Punkte, zählt dreifach = bis 9)</h2><p>Bei der Abnahme erklärst du drei Blöcke und baust eine kleine Änderung live ein. 3 = sicher und ohne Hilfe, 2 = mit kleinen Hilfen, 1 = nur teilweise, 0 = kann die eigenen Apps nicht erklären.</p></div>
      <div class="card"><h2>⭐ Bonus (höchstens +3)</h2><p>Profi-Aufgaben: je 2 erledigte = +1 (du hast ${ev.rows.reduce((n, r) => n + r.profi, 0)}). Eigene App-Idee: bis +3, bewertet von deiner Lehrkraft.</p></div>
      <div class="card"><h2>📏 Notenschlüssel (von 30 Punkten)</h2><p>${WWC.SCALE.map(([ab, n]) => `<b>${n}</b> ab ${ab} P.`).join(" · ")}</p>
        <p class="muted">Die App-Messe zählt nicht zur Note. Am Ende macht deine Lehrkraft einen Notenvorschlag und entscheidet.</p></div>`;
  }
  const LEX = [
    ["ww_start", "wenn die App startet", "Läuft einmal, sobald die App geöffnet wird – gut, um Variablen einen Anfangswert zu geben."],
    ["ww_klick", "wenn … angetippt wird", "Läuft, wenn jemand einen Knopf (oder eine Figur) antippt."],
    ["ww_alle", "alle … Sekunden", "Läuft immer wieder – für Timer und Spiele."],
    ["ww_wisch", "wenn über … gewischt wird", "Meldet jede Wischbewegung auf der Zeichenfläche."],
    ["ww_set", "setze … auf", "Ändert etwas an einem Baustein: Text, Farbe, Größe, sichtbar …"],
    ["ww_get", "… Text", "Liest, was in einem Baustein steht (z. B. was jemand eingetippt hat)."],
    ["ww_meldung", "zeige Meldung", "Zeigt kurz eine Nachricht unten in der App."],
    ["variables_set", "setze Variable auf", "Gibt einer Variablen (einer Kiste mit Namen) einen Wert."],
    ["math_change", "erhöhe Variable um", "Zählt eine Zahl in der Variablen hoch oder runter."],
    ["controls_if", "wenn … dann (sonst)", "Die App entscheidet: Nur wenn die Bedingung stimmt, passiert das."],
    ["logic_compare", "= ≠ < >", "Vergleicht zwei Werte – das Ergebnis ist wahr oder falsch."],
    ["lists_create_with", "erzeuge Liste mit", "Mehrere Dinge in einer Reihe, z. B. Antworten."],
    ["ww_entferne", "entferne Element aus der Liste", "Mit einer Zahl: entfernt das Element an dieser Stelle. Mit „angetipptes Element“: entfernt genau das, was angetippt wurde."],
    ["ww_zufall_aus", "zufälliges Element aus", "Zieht wie aus einem Hut ein Element aus einer Liste."],
    ["ww_hinzu", "füge … zur Liste hinzu", "Hängt etwas hinten an eine Liste an."],
    ["ww_linie_wisch", "zeichne Linie entlang der Wischbewegung", "Malt die Wischbewegung als Linie."],
    ["ww_stift", "Stift: Farbe, Dicke", "Legt fest, womit gemalt wird."],
    ["ww_bewege", "bewege … um x y", "Verschiebt eine Figur. x: rechts/links, y: unten/oben."],
    ["ww_beruehrt_fig", "… berührt …", "Wahr, wenn sich zwei Figuren berühren."],
    ["ww_speichere", "speichere … unter dem Namen", "Merkt sich etwas auf dem Gerät – auch nach dem Schließen."],
    ["ww_lade", "gespeicherter Wert", "Holt etwas Gespeichertes zurück."],
    ["ww_tagebis", "Tage bis zum …", "Rechnet aus, wie viele Tage es noch bis zu einem Datum sind."]
  ];
  function lexHtml() {
    return `<h2>🧩 Block-Lexikon</h2><div class="card"><div class="spick-list">${LEX.map(([, n, d]) => `<div class="spick-row" style="grid-template-columns:minmax(0,1fr) minmax(0,1.3fr)"><span>${B(n)}</span><span>${d}</span></div>`).join("")}</div></div>`;
  }

  /* ================= Dialoge ================= */
  function dialog(html, after) { $("#dlg-body").innerHTML = html; if (!$("#dlg").open) $("#dlg").showModal(); if (after) after($("#dlg-body")); }
  function closeDlg() { $("#dlg").close(); }
  $("#dlg").addEventListener("click", e => { if (e.target === $("#dlg")) closeDlg(); });
  async function shareDlg() {
    if (!appId()) return;
    await save(true);
    const draw = token => {
      const url = token ? `${ORIGIN}/a/${token}/${appId()}` : "";
      let qr = ""; if (token && window.qrcode) { const q = qrcode(0, "M"); q.addData(url); q.make(); qr = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); }
      const kurz = token ? `${location.host}/a/${token}` : "";
      dialog(`<h2>📱 ${esc(cur().titel)} auf dem iPad testen</h2>${token ? `<div class="share-box"><div class="qr">${qr}</div><div>
          <p><b>iPad:</b> mit dem Schul-WLAN verbinden, Kamera öffnen, QR-Code scannen.</p>
          <p><b>Ohne Scannen:</b> Diese kurze Adresse in Safari eintippen – dort erscheinen alle deine Apps:</p><p class="share-url">${esc(kurz)}</p>
          <p class="muted">Funktioniert auf jedem Gerät mit Internet, auch zu Hause. Tipp: In Safari „Teilen → Zum Home-Bildschirm“ – dann sieht sie aus wie eine echte App.</p>
          <p><a class="btn small" href="${esc(url)}" target="_blank" rel="noopener">🖥️ Hier am PC groß öffnen</a></p>
          <p class="muted">Was die App speichert, bleibt nur auf dem Gerät. Wer die Adresse kennt, kann die App benutzen – schreib nichts Privates hinein.</p></div></div>
          <div class="dlg-actions"><button class="btn danger" id="sh-off">Freigabe beenden</button><button class="btn primary" id="sh-close">Fertig</button></div>`
        : `<p>Deine Apps bekommen eine eigene Adresse und einen QR-Code, damit du sie auf einem anderen Gerät öffnen kannst.</p><p class="muted">Wer die Adresse kennt, kann deine Apps benutzen. Keine Namen, keine Fotos von Personen hineinschreiben.</p>
          <div class="dlg-actions"><button class="btn" id="sh-close">Abbrechen</button><button class="btn primary" id="sh-on">Apps freigeben</button></div>`}`, d => {
        d.querySelector("#sh-close").onclick = closeDlg;
        const on = d.querySelector("#sh-on"); if (on) on.onclick = async () => { const r = await api("/api/share", { ...me, on: true }); shareToken = r.share; draw(r.share); };
        const off = d.querySelector("#sh-off"); if (off) off.onclick = async () => { await api("/api/share", { ...me, on: false }); shareToken = null; draw(null); };
      });
    };
    draw(shareToken);
  }
  async function versions() {
    await save(true);
    try {
      const { versions: v } = await api("/api/versions", me);
      dialog(`<h2>🕘 Ältere Versionen</h2><p class="muted">Etwa alle 10 Minuten Arbeit wird eine Sicherung aller Apps angelegt.</p>
        <div class="vlist">${v.map(x => `<button data-id="${x.id}">🕘 ${time(x.saved_at)}</button>`).join("") || "<p>Noch keine Sicherungen.</p>"}</div>
        <div class="dlg-actions"><button class="btn" id="v-close">Schließen</button></div>`, d => {
        d.querySelector("#v-close").onclick = closeDlg;
        d.querySelectorAll("[data-id]").forEach(b => b.onclick = async () => {
          if (!confirm("Alle Apps auf diesen Stand zurücksetzen? (Der jetzige Stand wird vorher gesichert.)")) return;
          const x = await api("/api/version", { ...me, id: +b.dataset.id });
          await save(true, { forceVersion: true });
          apps = x.apps || {}; wsAppId = null; touch(); closeDlg(); show("station"); toast("↺ Version wiederhergestellt");
        });
      });
    } catch (e) { toast(e.message); }
  }

  /* ---------- Vorlagen für App 7 ---------- */
  const WAHL7_VORLAGE = {
    hausaufgaben: { screen: { titel: "Meine Hausaufgaben" }, ui: [{ typ: "zeile", name: "zeile1", kinder: [{ typ: "eingabe", name: "aufgabe", props: { platzhalter: "z. B. Mathe S. 42 Nr. 3" } }, { typ: "knopf", name: "hinzufuegen", props: { text: "➕" } }] }, { typ: "liste", name: "liste" }, { typ: "text", name: "hinweis", props: { text: "Antippen = erledigt", groesse: "klein" } }] },
    timer: { screen: { titel: "Lern-Timer" }, ui: [{ typ: "bild", name: "bild", props: { bild: "⏳" } }, { typ: "text", name: "anzeige", props: { text: "10:00", groesse: "riesig", fett: true } }, { typ: "zeile", name: "knoepfe", kinder: [{ typ: "knopf", name: "start", props: { text: "▶ Start" } }, { typ: "knopf", name: "stopp", props: { text: "⏸ Stopp", farbe: "#64748b" } }] }] },
    countdown: { screen: { titel: "Ferien-Countdown", hintergrund: "#06b6d4", textfarbe: "#ffffff" }, ui: [{ typ: "bild", name: "bild", props: { bild: "🏖️", groesse: "gross" } }, { typ: "text", name: "anzeige", props: { text: "Noch … Tage", groesse: "gross", fett: true } }] }
  };
})();
