/* App-Werkstatt – Lehrkraft-Ansicht */
(() => {
  const $ = s => document.querySelector(s);
  let KEY = sessionStorage.getItem("aw-tkey") || "", kurs = "", list = [];

  async function api(path, data) {
    const opt = { headers: { "x-teacher-key": KEY, "content-type": "application/json" } };
    if (data) { opt.method = "POST"; opt.body = JSON.stringify(data); }
    const r = await fetch(path, opt);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Fehler " + r.status);
    return j;
  }
  function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2400); }
  const time = d => d ? new Date(d).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "–";
  const EIGEN = STATIONEN.find(s => s.bonus1);

  /* ---------- Auswertung pro Person ---------- */
  function auswerten(s) {
    const r = s.rating || {}, p = s.progress || {};
    const ev = WWC.evaluate(PROJEKTE, s.apps, p, { erklaeren: r.erklaeren, eigene: r.eigene || 0 });
    const profi = ev.rows.reduce((n, x) => n + x.profi, 0);
    const errors = PROJEKTE.reduce((n, st) => n + (s.apps[st.app] ? WWC.analyze(s.apps[st.app]).errors : 0), 0);
    const eigen = EIGEN && s.apps[EIGEN.app] ? WWC.analyze(s.apps[EIGEN.app]) : null;
    return { ev, profi, errors, eigen, r, training: p.training || 0 };
  }

  /* ---------- Anmeldung ---------- */
  async function open() {
    try {
      const { kurse } = await api("/api/t/kurse");
      sessionStorage.setItem("aw-tkey", KEY);
      $("#t-login").hidden = true; $("#t-app").hidden = false;
      $("#t-kurs").innerHTML = kurse.map(k => `<option>${k}</option>`).join("");
      const last = localStorage.getItem("aw-tkurs");
      kurs = last && kurse.includes(last) ? last : kurse[0];
      $("#t-kurs").value = kurs;
      load();
    } catch (e) { $("#t-msg").textContent = e.message; sessionStorage.removeItem("aw-tkey"); }
  }
  $("#t-form").onsubmit = e => { e.preventDefault(); KEY = $("#t-key").value; open(); };
  if (KEY) open();
  $("#t-kurs").onchange = () => { kurs = $("#t-kurs").value; localStorage.setItem("aw-tkurs", kurs); load(); };
  $("#t-reload").onclick = load;

  async function load() {
    const { students } = await api("/api/t/kurs?kurs=" + encodeURIComponent(kurs));
    list = students.map(s => ({ ...s, a: auswerten(s) }));
    render();
  }

  /* ---------- Tabelle ---------- */
  const TITLES = { erklaeren: ["kann die eigenen Apps nicht erklären", "nur teilweise", "mit kleinen Hilfen", "sicher und ohne Hilfe"], eigene: ["keine eigene App", "Idee + Anfang", "funktionierender Prototyp", "eigene, gut durchdachte App"] };
  const rateBtns = (s, k) => `<span class="rate" data-nick="${esc(s.nick_key)}" data-k="${k}">${[0, 1, 2, 3].map(v => `<button class="${s.a.r[k] === v ? "on" : ""}" data-v="${v}" title="${TITLES[k][v]}">${v}</button>`).join("")}</span>`;
  const pts7 = ev => `<span class="pts7">${ev.rows.map(r => `<span class="p${r.pts}" title="${esc(r.titel)}: ${esc(r.beleg)}">${r.pts}</span>`).join("")}</span>`;
  function noteCell(s) {
    const r = s.a.r;
    if (r.override && r.override.note) return `<span class="note-big">${esc(r.override.note)}</span> <span class="chip">geändert</span>`;
    if (r.result) return `<span class="note-big">${esc(r.result.text)}</span> <span class="muted">${r.result.sum} P.</span>`;
    return `<span class="muted">${s.a.ev.complete ? "bereit" : "Erklären fehlt"}</span>`;
  }
  function render() {
    $("#t-table").innerHTML = `<tr><th>Name</th><th>Zuletzt</th><th>Apps 1–7</th><th>Summe</th><th>Fehler</th><th>Profi</th><th>Erklären (×3)</th><th>Eigene App</th><th>Note</th><th></th></tr>` +
      (list.map((s, i) => `<tr>
        <td><b>${esc(s.nick)}</b>${s.fails >= 10 ? ' <span class="chip err">gesperrt</span>' : ""}</td>
        <td>${time(s.updated_at)}</td>
        <td>${pts7(s.a.ev)}</td>
        <td><b>${s.a.ev.appsSumme}</b>/21</td>
        <td><span class="chip ${s.a.errors ? "err" : "ok"}">${s.a.errors}</span></td>
        <td>${s.a.profi ? "⭐ " + s.a.profi : "–"}</td>
        <td>${rateBtns(s, "erklaeren")}</td>
        <td>${rateBtns(s, "eigene")}${s.a.eigen && s.a.eigen.comps.length ? ' <span class="chip ok" title="hat an einer eigenen App gearbeitet">💡</span>' : ""}</td>
        <td>${noteCell(s)}</td>
        <td><button class="btn small" data-detail="${i}">👁 Details</button></td></tr>`).join("") || `<tr><td colspan="10" class="muted">Noch niemand angemeldet.</td></tr>`);
    document.querySelectorAll("#t-table .rate button").forEach(b => b.onclick = () => {
      const box = b.parentElement, s = list.find(x => x.nick_key === box.dataset.nick);
      setRating(s, { [box.dataset.k]: +b.dataset.v });
    });
    document.querySelectorAll("[data-detail]").forEach(b => b.onclick = () => detail(list[+b.dataset.detail]));
  }

  async function setRating(s, patch) {
    const data = { ...(s.rating || {}), ...patch };
    await api("/api/t/rating", { kurs, nick: s.nick_key, data });
    s.rating = data; s.a = auswerten(s); render();
  }

  /* ---------- Note generieren ---------- */
  function generate(s) {
    const a = auswerten(s);
    if (!a.ev.complete) return null;
    return { note: a.ev.note.note, text: a.ev.note.text, sum: a.ev.sum, bericht: WWC.bericht(s.nick, a.ev, (s.rating || {}).kommentar || ""), date: new Date().toISOString() };
  }
  $("#t-gen-all").onclick = async () => {
    const ready = list.filter(s => s.a.ev.complete), missing = list.filter(s => !s.a.ev.complete);
    if (!ready.length) { alert("Noch niemand ist vollständig bewertet. Vergib zuerst „Erklären“."); return; }
    if (!confirm(`Notenvorschläge für ${ready.length} SuS erzeugen?${missing.length ? `\n\nOhne „Erklären“ (übersprungen): ${missing.map(s => s.nick).join(", ")}` : ""}`)) return;
    for (const s of ready) await setRating(s, { result: generate(s) });
    toast(`⚙️ ${ready.length} Notenvorschläge erzeugt`);
  };

  /* ---------- Details ---------- */
  const previewDoc = app => {
    const boot = `const APP=${JSON.stringify(app).replace(/</g, "\\u003c")};const mem={};WW.run(document.body,APP,APP.code||"",{key:"lk",store:{get:k=>mem[k]??null,set:(k,v)=>{mem[k]=v}}});`;
    return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><script src="${location.origin}/runtime.js?v=1"><\/script><script>${boot}<\/script></body></html>`;
  };
  function detail(s, appIdx = 0) {
    const a = auswerten(s), r = s.rating || {}, p = s.progress || {};
    const all = [...PROJEKTE, ...(EIGEN ? [EIGEN] : [])];
    const st = all[appIdx], app = s.apps[st.app], an = app ? WWC.analyze(app) : null;
    const row = a.ev.rows.find(x => x.id === st.app);
    const html = `<h2>👁 ${esc(s.nick)} <span class="muted" style="font-weight:400;font-size:1rem">· zuletzt ${time(s.updated_at)} · Erklär-Training: ${a.training}×</span></h2>
      <div class="detail">
        <div>
          <div class="apptabs">${all.map((x, i) => `<button data-app="${i}" class="${i === appIdx ? "on" : ""}">${x.icon} ${i < PROJEKTE.length ? i + 1 : "★"}</button>`).join("")}</div>
          <p><b>${st.icon} ${esc(st.titel)}</b>${row ? ` – <b>${row.pts}/3</b> · ${esc(row.beleg)}` : ""}${st.wahl && p.wahl7 ? ` · Wahl: ${esc(p.wahl7)}` : ""}</p>
          ${st.bonus1 ? `<p><b>Idee:</b> ${esc(p.idee || "–")}</p>` : ""}
          ${app ? `<iframe sandbox="allow-scripts" id="d-prev"></iframe>
            <details style="margin-top:8px"><summary><b>Programm ansehen (JavaScript)</b></summary><div class="codeview">${esc(app.code || "// keine Blöcke")}</div></details>
            <details style="margin-top:8px"><summary><b>Fehler-Detektiv (${an.lint.length})</b></summary><ul>${an.lint.map(e => `<li>${e.level === "error" ? "🔴" : "🟡"} ${esc(e.msg)}</li>`).join("") || "<li>keine</li>"}</ul></details>`
          : `<p class="muted">Noch nicht begonnen.</p>`}
        </div>
        <div>
          <table class="crit ev"><tr><th>Kriterium</th><th>P.</th><th>Beleg</th></tr>
            ${a.ev.rows.map(x => `<tr><td>${x.icon} ${esc(x.titel)}</td><td class="pts">${x.pts}/3</td><td>${esc(x.beleg)}</td></tr>`).join("")}
            <tr><td><b>Apps erklären</b> (×3)</td><td class="pts">${r.erklaeren ?? "–"}</td><td>${rateBtns({ nick_key: s.nick_key, a }, "erklaeren")}</td></tr>
            <tr><td>Bonus: Eigene App</td><td class="pts">${r.eigene || 0}</td><td>${rateBtns({ nick_key: s.nick_key, a }, "eigene")}</td></tr>
            <tr><td>Bonus gesamt (max. +3)</td><td class="pts">+${a.ev.bonus}</td><td>${a.profi} Profi-Aufgabe(n) → +${a.ev.profiPunkte}</td></tr>
            <tr><td><b>Summe</b></td><td class="pts">${a.ev.sum}/${a.ev.max}</td><td>${a.ev.note ? `Vorschlag: <b>${a.ev.note.text}</b>` : "„Erklären“ fehlt noch"}</td></tr>
          </table>
          <p><label><b>Anmerkung (erscheint im Bericht)</b><textarea id="d-komm" rows="2" style="width:100%;height:64px;min-height:0">${esc(r.kommentar || "")}</textarea></label></p>
          <div class="dlg-actions" style="justify-content:flex-start"><button class="btn primary" id="d-gen">⚙️ Note generieren</button></div>
          <div id="d-ber">${r.result ? `<p><b>Notenvorschlag vom ${time(r.result.date)}:</b></p><div class="bericht">${esc(r.result.bericht)}</div>` : ""}</div>
          <p style="margin-top:12px"><b>Abweichende Note</b> (optional)<br>
            <input id="d-ov" placeholder="z. B. 2−" value="${esc((r.override || {}).note || "")}" style="width:80px;padding:6px;border-radius:8px;border:1px solid var(--line)">
            <input id="d-ovg" placeholder="Begründung" value="${esc((r.override || {}).grund || "")}" style="width:70%;padding:6px;border-radius:8px;border:1px solid var(--line)"></p>
          <div class="dlg-actions" style="justify-content:space-between">
            <span><button class="btn small" id="d-pin">🔑 PIN zurücksetzen</button> <button class="btn small danger" id="d-del">🗑 Löschen</button></span>
            <span><button class="btn" id="d-close">Schließen</button> <button class="btn primary" id="d-save">Speichern</button></span>
          </div>
        </div>
      </div>`;
    $("#dlg-body").innerHTML = html;
    if (!$("#dlg").open) $("#dlg").showModal();
    if (app) $("#d-prev").srcdoc = previewDoc(app);
    const again = (i = appIdx) => detail(list.find(x => x.nick_key === s.nick_key), i);
    $("#dlg-body").querySelectorAll("[data-app]").forEach(b => b.onclick = () => again(+b.dataset.app));
    $("#dlg-body").querySelectorAll(".rate button").forEach(b => b.onclick = async () => { await saveText(s); await setRating(s, { [b.parentElement.dataset.k]: +b.dataset.v }); again(); });
    $("#d-gen").onclick = async () => {
      await saveText(s);
      const g = generate(s);
      if (!g) { alert("Bitte zuerst „Apps erklären“ vergeben."); return; }
      await setRating(s, { result: g }); again();
    };
    $("#d-save").onclick = async () => { await saveText(s); $("#dlg").close(); toast("Gespeichert"); };
    $("#d-close").onclick = () => $("#dlg").close();
    $("#d-pin").onclick = async () => {
      const pin = prompt(`Neue vierstellige PIN für „${s.nick}“:`);
      if (!pin) return;
      try { await api("/api/t/pin", { kurs, nick: s.nick_key, pin }); toast("🔑 PIN geändert"); load(); } catch (e) { alert(e.message); }
    };
    $("#d-del").onclick = async () => {
      if (prompt(`Wirklich ALLES von „${s.nick}“ löschen? Zum Bestätigen den Namen eintippen:`) !== s.nick) return;
      await api("/api/t/delete", { kurs, nick: s.nick_key }); $("#dlg").close(); load();
    };
  }
  async function saveText(s) {
    const komm = $("#d-komm").value.trim(), ov = $("#d-ov").value.trim(), grund = $("#d-ovg").value.trim();
    if (ov && !grund) { alert("Bitte eine Begründung für die abweichende Note angeben."); throw new Error("Begründung fehlt"); }
    await setRating(s, { kommentar: komm, override: ov ? { note: ov, grund } : null });
  }

  /* ---------- Schuljahresende: aufräumen ---------- */
  $("#t-clear").onclick = () => {
    $("#dlg-body").innerHTML = `<h2>🧹 Daten löschen (z. B. am Schuljahresende)</h2>
      <p>Gelöscht werden Konten, Apps, Versionen, Freigaben und Bewertungen. <b>Das kann nicht rückgängig gemacht werden.</b></p>
      <p>Tipp: Vorher <b>⬇️ CSV</b> und <b>🖨️ Berichte drucken</b> für jede Klasse sichern.</p>
      <div class="dlg-actions" style="justify-content:flex-start;flex-wrap:wrap">
        <button class="btn" id="c-csv">⬇️ Erst CSV von ${esc(kurs)} sichern</button>
        <button class="btn danger" id="c-kurs">🧹 Nur Klasse ${esc(kurs)} löschen</button>
        <button class="btn danger" id="c-alle">🧹 Alle Klassen löschen</button>
        <button class="btn" id="c-close">Abbrechen</button>
      </div>`;
    if (!$("#dlg").open) $("#dlg").showModal();
    $("#c-close").onclick = () => $("#dlg").close();
    $("#c-csv").onclick = () => $("#t-csv").click();
    const run = async scope => {
      const was = scope === "alle" ? "ALLE Klassen" : `die Klasse ${kurs}`;
      if (prompt(`Wirklich alle Daten für ${was} löschen?\nZum Bestätigen LÖSCHEN eintippen:`) !== "LÖSCHEN") return;
      try {
        const r = await api("/api/t/clear", { scope, kurs, confirm: "LÖSCHEN" });
        $("#dlg").close(); toast(`🧹 ${r.geloescht} Konten gelöscht`); load();
      } catch (e) { alert(e.message); }
    };
    $("#c-kurs").onclick = () => run("kurs");
    $("#c-alle").onclick = () => run("alle");
  };

  /* ---------- Export ---------- */
  const finalNote = s => { const r = s.rating || {}; return r.override && r.override.note ? r.override.note : r.result ? r.result.text : ""; };
  $("#t-csv").onclick = () => {
    const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["Vorname", ...PROJEKTE.map((p, i) => `App ${i + 1}`), "Apps", "Erklären", "Bonus", "Punkte", "Notenvorschlag", "Endnote", "Begründung Abweichung", "Bericht"],
      ...list.map(s => { const r = s.rating || {}, ev = s.a.ev; return [s.nick, ...ev.rows.map(x => x.pts), ev.appsSumme, r.erklaeren ?? "", ev.bonus, r.result ? r.result.sum : "", r.result ? r.result.text : "", finalNote(s), (r.override || {}).grund || "", r.result ? r.result.bericht : ""]; })];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + rows.map(r => r.map(q).join(";")).join("\n")], { type: "text/csv" }));
    a.download = `app-noten-${kurs}.csv`; a.click();
  };
  $("#t-print").onclick = () => {
    const done = list.filter(s => (s.rating || {}).result);
    if (!done.length) { alert("Noch keine generierten Noten."); return; }
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Berichte ${esc(kurs)}</title><style>body{font-family:system-ui,sans-serif;max-width:800px;margin:auto;padding:20px}section{page-break-after:always;white-space:pre-wrap;line-height:1.5;font-size:14px}h2{margin-bottom:4px}</style></head><body>` +
      done.map(s => { const r = s.rating; return `<section><h2>${esc(s.nick)} – Note ${esc(finalNote(s))}</h2>${esc(r.result.bericht)}${r.override && r.override.note ? `\n\nAbweichende Endnote ${esc(r.override.note)}: ${esc(r.override.grund)}` : ""}</section>`; }).join("") + `</body></html>`);
    w.document.close(); w.focus(); w.print();
  };
})();
