/* App-Werkstatt – Laufzeit: zeigt eine App an und führt ihr Programm aus.
   Wird in der Vorschau (Werkstatt), auf der Teilen-Seite (iPad/Handy) und in der Lehrkraft-Ansicht benutzt.
   Programme entstehen nur aus Blöcken (kein frei getippter Code). */
const WW = (() => {
  /* ---------- Bausteine der Oberfläche ---------- */
  const COMPONENTS = {
    knopf:  { label: "Knopf", icon: "🔘", props: { text: "Knopf", farbe: "#5b4bdb", textfarbe: "#ffffff", groesse: "mittel", breite: "voll" } },
    text:   { label: "Text", icon: "📝", props: { text: "Text", textfarbe: "", groesse: "mittel", ausrichtung: "mitte", fett: false } },
    bild:   { label: "Bild", icon: "🖼️", props: { bild: "🌟", groesse: "mittel" } },
    eingabe:{ label: "Eingabefeld", icon: "⌨️", props: { platzhalter: "Hier tippen …" } },
    liste:  { label: "Liste", icon: "📋", props: { elemente: "" } },
    zeichenflaeche: { label: "Zeichenfläche", icon: "🎨", props: { hoehe: 300, hintergrund: "#ffffff" } },
    spielfeld: { label: "Spielfeld", icon: "🎮", props: { hoehe: 300, hintergrund: "#e0f2fe" }, kinder: ["figur"] },
    figur:  { label: "Figur", icon: "🚀", props: { emoji: "🚀", x: 40, y: 40, groesse: 44 }, nurIn: "spielfeld" },
    zeile:  { label: "Zeile (nebeneinander)", icon: "↔️", props: {}, kinder: ["knopf", "text", "bild", "eingabe"] }
  };
  const SIZE = { klein: 14, mittel: 18, gross: 26, riesig: 40 };
  const IMG = { klein: 40, mittel: 80, gross: 140, riesig: 200 };

  function walk(list, fn, parent) { (list || []).forEach(c => { fn(c, parent); if (c.kinder) walk(c.kinder, fn, c); }); }
  function names(app, typ) { const out = []; walk(app.ui, c => { if (!typ || (Array.isArray(typ) ? typ.includes(c.typ) : c.typ === typ)) out.push(c.name); }); return out; }

  const BASE_CSS = `
    *{box-sizing:border-box} html,body{margin:0;height:100%}
    .ww-app{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;min-height:100%;display:flex;flex-direction:column}
    .ww-title{padding:14px 16px;font-weight:700;font-size:18px;background:rgba(0,0,0,.06)}
    .ww-body{flex:1;padding:14px;display:flex;flex-direction:column;gap:10px}
    .ww-knopf{border:0;border-radius:12px;padding:12px 16px;font:inherit;font-weight:700;cursor:pointer;touch-action:manipulation}
    .ww-knopf:active{transform:scale(.97)}
    .ww-knopf:disabled{opacity:.5}
    .ww-text{line-height:1.4;word-wrap:break-word}
    .ww-bild{display:block;margin:0 auto;object-fit:contain;max-width:100%}
    .ww-emoji{text-align:center;line-height:1.1}
    .ww-eingabe{font:inherit;font-size:17px;padding:11px 12px;border:2px solid #cbd5e1;border-radius:10px;width:100%}
    .ww-liste{list-style:none;margin:0;padding:0;border:2px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fff}
    .ww-liste li{padding:11px 14px;border-bottom:1px solid #e2e8f0;cursor:pointer;color:#1f2937}
    .ww-liste li:last-child{border-bottom:0}
    .ww-liste li:active{background:#f1f5f9}
    .ww-liste .leer{color:#94a3b8;cursor:default}
    .ww-canvas{width:100%;border-radius:12px;border:2px solid #e2e8f0;touch-action:none;display:block}
    .ww-feld{position:relative;width:100%;border-radius:12px;overflow:hidden;border:2px solid #cbd5e1;touch-action:manipulation}
    .ww-figur{position:absolute;line-height:1;user-select:none;cursor:pointer;transition:left .08s linear,top .08s linear}
    .ww-zeile{display:flex;gap:8px;align-items:center}
    .ww-zeile>*{flex:1;min-width:0}
    .ww-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#111827;color:#fff;padding:12px 18px;border-radius:12px;font-weight:600;max-width:90%;text-align:center;z-index:9;box-shadow:0 8px 24px rgba(0,0,0,.25)}
    .ww-err{position:fixed;left:8px;right:8px;top:8px;background:#fde5ea;color:#9f1239;padding:8px 10px;border-radius:10px;font-size:13px;font-weight:600;z-index:10}
    .ww-sel{outline:3px dashed #f59e0b;outline-offset:2px}`;

  /* ---------- App anzeigen ---------- */
  function render(root, app, opts = {}) {
    const doc = root.ownerDocument;
    const st = doc.createElement("style"); st.textContent = BASE_CSS + "\n" + String(app.css || "").replace(/<\/?style/gi, ""); root.appendChild(st);
    const scr = app.screen || {};
    const wrap = doc.createElement("div"); wrap.className = "ww-app";
    wrap.style.background = scr.hintergrund || "#ffffff"; wrap.style.color = scr.textfarbe || "#1f2937";
    if (scr.titel) { const t = doc.createElement("div"); t.className = "ww-title"; t.textContent = scr.titel; wrap.appendChild(t); }
    const body = doc.createElement("div"); body.className = "ww-body"; wrap.appendChild(body); root.appendChild(wrap);
    const reg = {};
    const make = (c, parent) => {
      const p = Object.assign({}, (COMPONENTS[c.typ] || {}).props, c.props || {});
      let el;
      switch (c.typ) {
        case "knopf": el = doc.createElement("button"); el.className = "ww-knopf"; el.textContent = p.text; el.style.background = p.farbe; el.style.color = p.textfarbe;
          el.style.fontSize = (SIZE[p.groesse] || 18) + "px"; if (p.breite !== "voll" && parent !== "zeile") el.style.alignSelf = "center"; break;
        case "text": el = doc.createElement("div"); el.className = "ww-text"; el.textContent = p.text; if (p.textfarbe) el.style.color = p.textfarbe;
          el.style.fontSize = (SIZE[p.groesse] || 18) + "px"; el.style.textAlign = { links: "left", mitte: "center", rechts: "right" }[p.ausrichtung] || "center";
          if (p.fett) el.style.fontWeight = "700"; break;
        case "bild": el = makeImg(doc, p.bild, IMG[p.groesse] || 80); break;
        case "eingabe": el = doc.createElement("input"); el.className = "ww-eingabe"; el.placeholder = p.platzhalter; el.autocomplete = "off"; break;
        case "liste": el = doc.createElement("ul"); el.className = "ww-liste"; el._items = String(p.elemente || "").split("\n").map(s => s.trim()).filter(Boolean); drawList(el); break;
        case "zeichenflaeche": el = doc.createElement("canvas"); el.className = "ww-canvas"; el.style.height = (+p.hoehe || 300) + "px"; el.style.background = p.hintergrund; el._bg = p.hintergrund; break;
        case "spielfeld": el = doc.createElement("div"); el.className = "ww-feld"; el.style.height = (+p.hoehe || 300) + "px"; el.style.background = p.hintergrund;
          (c.kinder || []).forEach(k => el.appendChild(make(k, "spielfeld"))); break;
        case "figur": el = doc.createElement("div"); el.className = "ww-figur"; el.textContent = p.emoji; el.style.fontSize = (+p.groesse || 44) + "px";
          el._x = +p.x || 0; el._y = +p.y || 0; el._s = +p.groesse || 44; el.style.left = el._x + "px"; el.style.top = el._y + "px"; break;
        case "zeile": el = doc.createElement("div"); el.className = "ww-zeile"; (c.kinder || []).forEach(k => el.appendChild(make(k, "zeile"))); break;
        default: el = doc.createElement("div");
      }
      el.id = c.name; el.dataset.ww = c.id;
      reg[c.name] = { el, typ: c.typ };
      return el;
    };
    (app.ui || []).forEach(c => body.appendChild(make(c)));
    // Zeichenflächen auf echte Pixelgröße bringen
    Object.values(reg).filter(r => r.typ === "zeichenflaeche").forEach(r => fitCanvas(r.el));
    return { reg, wrap, body };
  }
  function makeImg(doc, src, px) {
    const s = String(src || "").trim();
    if (/^https?:\/\//i.test(s)) { const i = doc.createElement("img"); i.className = "ww-bild"; i.src = s; i.alt = ""; i.style.height = px + "px"; return i; }
    const d = doc.createElement("div"); d.className = "ww-emoji"; d.textContent = s || "🌟"; d.style.fontSize = Math.round(px * .8) + "px"; return d;
  }
  function drawList(el) {
    const doc = el.ownerDocument; el.innerHTML = "";
    if (!el._items.length) { const li = doc.createElement("li"); li.className = "leer"; li.textContent = "(noch leer)"; el.appendChild(li); return; }
    el._items.forEach(t => { const li = doc.createElement("li"); li.textContent = t; el.appendChild(li); });
  }
  function fitCanvas(c) {
    const w = c.clientWidth || 300, h = c.clientHeight || 300, r = c.ownerDocument.defaultView.devicePixelRatio || 1;
    if (c.width === Math.round(w * r)) return;
    const old = c.width ? c.toDataURL() : null;
    c.width = Math.round(w * r); c.height = Math.round(h * r);
    const ctx = c.getContext("2d"); ctx.setTransform(r, 0, 0, r, 0, 0); ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (old) { const im = new Image(); im.onload = () => ctx.drawImage(im, 0, 0, w, h); im.src = old; }
  }

  /* ---------- Programm ausführen ---------- */
  const FARBEN = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"];
  function run(root, app, code, opts = {}) {
    const { reg, wrap } = render(root, app, opts);
    const win = root.ownerDocument.defaultView, doc = root.ownerDocument;
    const timers = [], handlers = {};
    let starts = [];
    const mem = {};
    const storeKey = k => `appw-${opts.key || "app"}-${k}`;
    const report = (msg) => {
      let e = doc.querySelector(".ww-err"); if (!e) { e = doc.createElement("div"); e.className = "ww-err"; doc.body.appendChild(e); }
      e.textContent = "⚠️ " + msg; if (opts.onError) opts.onError(msg);
    };
    const call = (fn, ev) => { try { A.ev = ev || {}; A.schutz = 100000; fn(); } catch (e) { report(fehlertext(e)); } };
    const R = n => { const r = reg[n]; if (!r) throw new Error(`Den Baustein „${n}“ gibt es nicht (mehr).`); return r; };
    const A = {
      ev: {},
      on(name, ev, fn) { (handlers[name + ":" + ev] = handlers[name + ":" + ev] || []).push(fn); },
      start(fn) { starts.push(fn); },
      alle(sek, fn) { const ms = Math.max(100, (+sek || 1) * 1000); timers.push(win.setInterval(() => call(fn), ms)); },
      stoppeTimer() { while (timers.length) win.clearInterval(timers.pop()); },
      set(name, prop, v) {
        const r = R(name), el = r.el;
        switch (prop) {
          case "text":
            if (r.typ === "eingabe") el.value = v == null ? "" : String(v);
            else if (r.typ === "bild") { const n = makeImg(doc, v, el.offsetHeight || 80); n.id = el.id; el.replaceWith(n); r.el = n; }
            else if (r.typ === "figur") el.textContent = String(v);
            else el.textContent = Array.isArray(v) ? v.join(", ") : (v == null ? "" : String(v));
            break;
          case "hintergrund": if (r.typ === "zeichenflaeche") { el._bg = v; } el.style.background = v; break;
          case "textfarbe": el.style.color = v; break;
          case "sichtbar": el.style.display = v ? "" : "none"; break;
          case "aktiv": el.disabled = !v; break;
          case "groesse": el.style.fontSize = (SIZE[String(v).toLowerCase().replace("ß", "ss")] || +v || 18) + "px"; break;
          case "elemente": el._items = (Array.isArray(v) ? v : String(v || "").split(",")).map(x => String(x)); drawList(el); break;
          default: throw new Error(`Unbekannte Eigenschaft „${prop}“.`);
        }
      },
      get(name, prop) {
        const r = R(name), el = r.el;
        if (prop === "text") return r.typ === "eingabe" ? el.value : el.textContent;
        if (prop === "sichtbar") return el.style.display !== "none";
        if (prop === "x") return el._x; if (prop === "y") return el._y;
        if (prop === "elemente") return (el._items || []).slice();
        return "";
      },
      meldung(t) {
        const m = doc.createElement("div"); m.className = "ww-toast"; m.textContent = String(t); doc.body.appendChild(m);
        win.setTimeout(() => m.remove(), 2600);
      },
      zufallsfarbe() { return FARBEN[Math.floor(Math.random() * FARBEN.length)]; },
      zufallAus(liste) { if (!Array.isArray(liste) || !liste.length) return ""; return liste[Math.floor(Math.random() * liste.length)]; },
      // Zeichnen
      stift(name, farbe, dicke) { const c = R(name).el; if (farbe != null) c._farbe = farbe; if (dicke != null) c._dicke = +dicke; },
      linie(name, x1, y1, x2, y2) { const c = R(name).el, g = c.getContext("2d"); g.strokeStyle = c._farbe || "#111827"; g.lineWidth = c._dicke || 5; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); },
      punkt(name, x, y) { const c = R(name).el, g = c.getContext("2d"); g.fillStyle = c._farbe || "#111827"; g.beginPath(); g.arc(x, y, (c._dicke || 5) / 2, 0, Math.PI * 2); g.fill(); },
      leeren(name) { const c = R(name).el; c.getContext("2d").clearRect(0, 0, c.width, c.height); },
      // Spiel
      setzePos(name, x, y) { const r = R(name), el = r.el, f = el.parentElement; const mx = f.clientWidth - el._s, my = f.clientHeight - el._s;
        el._x = Math.max(0, Math.min(mx, +x || 0)); el._y = Math.max(0, Math.min(my, +y || 0)); el.style.left = el._x + "px"; el.style.top = el._y + "px"; },
      bewege(name, dx, dy) { const el = R(name).el; A.setzePos(name, el._x + (+dx || 0), el._y + (+dy || 0)); },
      zufallPos(name) { const el = R(name).el, f = el.parentElement; A.setzePos(name, Math.random() * (f.clientWidth - el._s), Math.random() * (f.clientHeight - el._s)); },
      beruehrt(a, b) { const A1 = R(a).el, B1 = R(b).el; return A1._x < B1._x + B1._s * .8 && A1._x + A1._s * .8 > B1._x && A1._y < B1._y + B1._s * .8 && A1._y + A1._s * .8 > B1._y; },
      // Speichern auf dem Gerät
      speichere(k, v) { const s = JSON.stringify(v); if (opts.store) return opts.store.set(k, s); try { win.localStorage.setItem(storeKey(k), s); } catch (e) { mem[k] = s; } },
      lade(k, d) { let s = null; if (opts.store) s = opts.store.get(k); else { try { s = win.localStorage.getItem(storeKey(k)); } catch (e) { s = null; } if (s == null) s = mem[k] ?? null; }
        try { return s == null ? d : JSON.parse(s); } catch (e) { return d; } },
      // Zeit
      jetzt(teil) { const d = new Date(); return { stunde: d.getHours(), minute: d.getMinutes(), sekunde: d.getSeconds(), tag: d.getDate(), monat: d.getMonth() + 1, jahr: d.getFullYear(),
        wochentag: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"][d.getDay()] }[teil]; },
      tageBis(datum) { const m = String(datum).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/); if (!m) return 0; const z = new Date(+m[3], +m[2] - 1, +m[1]); const h = new Date(); h.setHours(0, 0, 0, 0);
        return Math.ceil((z - h) / 86400000); },
      // Listen
      hinzu(liste, x) { if (!Array.isArray(liste)) throw new Error("„füge hinzu“ braucht eine Liste – hast du die Variable vorher mit einer Liste belegt?"); liste.push(x); return liste; },
      entferne(liste, nr) { if (!Array.isArray(liste)) throw new Error("„entferne“ braucht eine Liste."); const i = typeof nr === "string" ? liste.findIndex(x => String(x) === nr) : Math.round(+nr) - 1; if (i >= 0 && i < liste.length) liste.splice(i, 1); return liste; },
      zahl(x) { const n = parseFloat(String(x).replace(",", ".")); return isNaN(n) ? 0 : n; }
    };
    // Ereignisse der Bausteine verbinden
    Object.entries(reg).forEach(([name, r]) => {
      const el = r.el, fire = (ev, data) => (handlers[name + ":" + ev] || []).forEach(fn => call(fn, data));
      if (r.typ === "knopf") el.addEventListener("click", () => fire("klick"));
      if (r.typ === "figur") el.addEventListener("pointerdown", () => fire("klick"));
      if (r.typ === "eingabe") el.addEventListener("input", () => fire("aenderung"));
      if (r.typ === "liste") el.addEventListener("click", e => { const li = e.target.closest("li"); if (li && !li.classList.contains("leer")) fire("auswahl", { element: li.textContent }); });
      if (r.typ === "zeichenflaeche") {
        let last = null;
        const pos = e => { const b = el.getBoundingClientRect(); return { x: Math.round(e.clientX - b.left), y: Math.round(e.clientY - b.top) }; };
        el.addEventListener("pointerdown", e => { fitCanvas(el); el.setPointerCapture(e.pointerId); last = pos(e); fire("beruehrt", { ...last }); });
        el.addEventListener("pointermove", e => { if (!last) return; const p = pos(e); fire("wisch", { x: p.x, y: p.y, vx: last.x, vy: last.y }); last = p; });
        el.addEventListener("pointerup", () => { last = null; });
        el.addEventListener("pointercancel", () => { last = null; });
      }
    });
    // Programm laden
    // Figuren, die außerhalb liegen (z. B. auf schmalen Handys), ins Spielfeld holen
    const fitFig = () => Object.entries(reg).forEach(([name, r]) => { if (r.typ === "figur" && r.el.parentElement && r.el.parentElement.clientWidth) A.setzePos(name, r.el._x, r.el._y); });
    fitFig(); win.addEventListener("resize", fitFig);
    try { A.schutz = 100000; new Function("A", code || "")(A); } catch (e) { report(fehlertext(e)); }
    starts.forEach(fn => call(fn));
    if (opts.select) wrap.addEventListener("click", e => { const t = e.target.closest("[data-ww]"); if (t) opts.select(t.dataset.ww); }, true);
    return { A, stop: () => A.stoppeTimer(), reg };
  }
  function fehlertext(e) {
    const m = String(e && e.message || e);
    if (/is not defined/.test(m)) return "Ein Block benutzt etwas, das es nicht gibt: " + m.replace(" is not defined", "");
    if (/Cannot read prop|undefined/.test(m)) return "Ein Wert fehlt noch – ist jede Lücke im Block gefüllt? (" + m + ")";
    return m;
  }

  return { COMPONENTS, SIZE, IMG, walk, names, render, run, FARBEN };
})();
if (typeof module !== "undefined") module.exports = WW;
