/* App-Werkstatt – Analyse einer App (ohne Blockly), Fehler-Detektiv, Kriterien und Notenvorschlag.
   Wird von der Schülerseite und der Lehrkraft-Ansicht gemeinsam genutzt. */
const WWC = (() => {
  const EVENTS = ["ww_start", "ww_klick", "ww_eingabe", "ww_auswahl", "ww_beruehrt", "ww_wisch", "ww_alle"];
  const NEED = { ww_set: ["WERT"], ww_meldung: ["WERT"], ww_liste_zeigen: ["WERT"], ww_zufall_aus: ["LISTE"], ww_hinzu: ["WERT", "LISTE"], ww_entferne: ["LISTE"],
    variables_set: ["VALUE"], controls_if: ["IF0"], logic_compare: ["A", "B"], math_change: ["DELTA"],
    logic_operation: ["A", "B"], logic_negate: ["BOOL"], text_isEmpty: ["VALUE"], text_changeCase: ["TEXT"],
    lists_length: ["VALUE"], lists_isEmpty: ["VALUE"], lists_getIndex: ["VALUE", "AT"], ww_speichere: ["WERT"], ww_stift: ["FARBE"] };
  // Blöcke, die nur in bestimmten Ereignissen einen Sinn haben
  const CTX = { ww_linie_wisch: [["ww_wisch"], "wenn über … gewischt wird"], ww_punkt: [["ww_beruehrt", "ww_wisch"], "wenn … berührt wird"],
    ww_ber_xy: [["ww_beruehrt", "ww_wisch"], "wenn … berührt wird"], ww_angetippt: [["ww_auswahl"], "wenn in … etwas angetippt wird"] };
  const KOMP_FIELDS = ["KOMP", "A", "B"];
  const KOMP_TYPES = { ww_beruehrt_fig: ["A", "B"] };

  function analyze(app) {
    app = app || {};
    const comps = [];
    WW.walk(app.ui, (c, parent) => comps.push({ ...c, props: Object.assign({}, (WW.COMPONENTS[c.typ] || {}).props, c.props || {}), parent: parent ? parent.typ : null }));
    const names = new Set(comps.map(c => c.name));
    const state = app.blocks || {};
    const vars = {}; (state.variables || []).forEach(v => { vars[v.id] = v.name; });
    const blocks = [], lint = [];
    const visit = (b, top, depth, parentInput) => {
      if (!b) return;
      const varName = b.fields && b.fields.VAR ? vars[b.fields.VAR.id] || b.fields.VAR.name : null;
      const node = { id: b.id, type: b.type, fields: b.fields || {}, top, varName, inputs: b.inputs || {}, extra: b.extraState, parentInput };
      blocks.push(node);
      Object.entries(b.inputs || {}).forEach(([n, inp]) => { visit(inp.block, top, depth + 1, n); if (!inp.block && inp.shadow) visit(inp.shadow, top, depth + 1, n); });
      if (b.next) visit(b.next.block, top, depth, "next");
    };
    const tops = (state.blocks && state.blocks.blocks) || [];
    tops.forEach(t => visit(t, t, 0, null));

    // Fehler-Detektiv
    tops.forEach(t => {
      if (!EVENTS.includes(t.type)) lint.push({ level: "error", id: t.id, msg: "Ein Block hängt nirgends dran – zieh ihn in einen orangen „wenn …“-Block, sonst passiert nichts." });
      else if (!t.inputs || !t.inputs.DO || !t.inputs.DO.block) lint.push({ level: "warn", id: t.id, msg: "Dieses Ereignis ist noch leer – es fehlen Blöcke bei „mache“." });
    });
    const evSeen = {};
    tops.filter(t => EVENTS.includes(t.type) && t.type !== "ww_alle").forEach(t => {
      const k = t.type + ":" + ((t.fields || {}).KOMP || "");
      if (evSeen[k] && t.type !== "ww_start") lint.push({ level: "warn", id: t.id, msg: "Dieses Ereignis gibt es zweimal – pack die Blöcke besser in ein einziges." });
      evSeen[k] = 1;
    });
    blocks.forEach(b => {
      (KOMP_TYPES[b.type] || KOMP_FIELDS).forEach(f => {
        if (!(f in b.fields) || typeof b.fields[f] === "object") return;
        if (f !== "KOMP" && !KOMP_TYPES[b.type]) return;
        const v = b.fields[f];
        if (!v) lint.push({ level: "error", id: b.id, msg: "In einem Block ist noch kein Baustein ausgewählt (Feld ist leer)." });
        else if (!names.has(v)) lint.push({ level: "error", id: b.id, msg: `Den Baustein „${v}“ gibt es nicht mehr – wähle im Block einen anderen aus.` });
      });
      const ctx = CTX[b.type];
      if (ctx && b.top && EVENTS.includes(b.top.type) && !ctx[0].includes(b.top.type)) lint.push({ level: "warn", id: b.id, msg: `Ein Block funktioniert nur im Ereignis „${ctx[1]}“ – hier passiert damit nichts.` });
      (NEED[b.type] || []).filter(n => !(n === "AT" && b.fields.WHERE && !/^FROM_/.test(b.fields.WHERE))).forEach(n => { if (!b.inputs[n] || (!b.inputs[n].block && !b.inputs[n].shadow)) lint.push({ level: "warn", id: b.id, msg: "In einem Block ist noch eine Lücke – setz dort einen Wert ein." }); });
    });
    const setVars = new Set(blocks.filter(b => b.type === "variables_set" || b.type === "math_change").map(b => b.varName));
    new Set(blocks.filter(b => b.type === "variables_get").map(b => b.varName)).forEach(v => {
      if (v && !setVars.has(v)) lint.push({ level: "warn", msg: `Die Variable „${v}“ bekommt nie einen Wert – setz sie z. B. bei „wenn die App startet“.` });
    });

    const evBlocks = (type, komp) => tops.filter(t => t.type === type && (!komp || (t.fields || {}).KOMP === komp));
    const under = (topPred, pred) => blocks.some(b => b.top && topPred(b.top) && pred(b));
    return {
      app, comps, names, blocks, tops, lint,
      errors: lint.filter(l => l.level === "error").length,
      comp: (typ, pred) => comps.filter(c => c.typ === typ && (!pred || pred(c))),
      count: (type, pred) => blocks.filter(b => b.type === type && (!pred || pred(b))).length,
      has: (type, pred) => blocks.some(b => b.type === type && (!pred || pred(b))),
      ev: evBlocks,
      inEvent: (evType, pred) => under(t => !evType || (Array.isArray(evType) ? evType.includes(t.type) : t.type === evType), pred),
      setsProp: (prop, evType) => under(t => !evType || t.type === evType, b => b.type === "ww_set" && b.fields.PROP === prop),
      texts: () => blocks.filter(b => b.type === "text").map(b => String(b.fields.TEXT || "")),
      listItems: () => blocks.filter(b => b.type === "lists_create_with").reduce((n, b) => n + Object.keys(b.inputs).filter(k => /^ADD/.test(k) && (b.inputs[k].block || b.inputs[k].shadow)).length, 0),
      changed: (typ, prop, def) => comps.some(c => c.typ === typ && c.props[prop] !== undefined && String(c.props[prop]) !== String(def)),
      // ref = Bildschirm der Startvorlage: deren Titel/Farbe zählt nicht als „eigene“ Gestaltung
      screenChanged: (ref = {}) => { const s = app.screen || {}, hg = String(s.hintergrund || "#ffffff").toLowerCase(), ti = String(s.titel || "").trim();
        return (hg !== "#ffffff" && hg !== String(ref.hintergrund || "").toLowerCase()) || (!!ti && !/^Meine App$/i.test(ti) && ti !== ref.titel); }
    };
  }

  /* ---------- Bewertung (vorab sichtbar in „Meine Note“) ---------- */
  const SCALE = [[27, 1], [23, 2], [19, 3], [15, 4], [9, 5], [0, 6]];
  const MAX = 30, BONUS_MAX = 3;
  const safe = (fn, a, p) => { try { return !!fn(a, p); } catch (e) { return false; } };

  // Stand einer Projekt-App: 0 nicht begonnen, 1 begonnen, 2 Pflicht erfüllt + keine Fehler, 3 zusätzlich „Mach sie zu deiner App“
  function appStand(st, app, progress) {
    const a = analyze(app);
    const pf = st.pflicht.map((p, i) => p.check ? safe(p.check, a, progress) : !!((progress || {}).manual || {})[`${st.id}-${i}`]);
    const bo = (st.bonus || []).map((p, i) => p.check ? safe(p.check, a, progress) : !!((progress || {}).manual || {})[`${st.id}-b${i}`]);
    const pro = (st.profi || []).map(p => p.check ? safe(p.check, a, progress) : false);
    const begonnen = a.comps.length > 0 || a.blocks.length > 0;
    const pflicht = pf.length > 0 && pf.every(Boolean);
    let pts = !begonnen ? 0 : pflicht && a.errors === 0 ? (bo.some(Boolean) ? 3 : 2) : 1;
    const beleg = !begonnen ? "noch nicht begonnen"
      : `${pf.filter(Boolean).length}/${pf.length} Pflicht-Aufgaben, ${bo.filter(Boolean).length} Bonus, ${a.errors} Fehler`;
    return { pts, beleg, pf, bo, pro, a };
  }

  function noteFor(points) {
    for (let i = 0; i < SCALE.length; i++) {
      const [ab, note] = SCALE[i];
      if (points >= ab) {
        const top = i === 0 ? MAX : SCALE[i - 1][0] - 1, span = top - ab + 1, pos = span > 2 ? (points - ab) / (span - 1) : .5;
        const tend = note === 6 ? "" : pos >= .67 && note !== 1 ? "+" : pos < .34 ? "−" : "";
        return { note, text: `${note}${tend}` };
      }
    }
    return { note: 6, text: "6" };
  }

  // projekte: Stationen mit App (A1–A7); manual: { erklaeren: 0–3, eigene: 0–3 }
  function evaluate(projekte, apps, progress, manual = {}) {
    const rows = projekte.map(st => { const s = appStand(st, (apps || {})[st.app], progress); return { id: st.app, titel: st.titel, icon: st.icon, pts: s.pts, beleg: s.beleg, profi: s.pro.filter(Boolean).length }; });
    const profiPunkte = Math.floor(rows.reduce((n, r) => n + r.profi, 0) / 2);
    const eigene = manual.eigene || 0;
    const bonus = Math.min(BONUS_MAX, profiPunkte + eigene);
    const appsSumme = rows.reduce((n, r) => n + r.pts, 0);
    const erkl = manual.erklaeren;
    const sum = Math.min(MAX, appsSumme + (erkl == null ? 0 : erkl * 3) + bonus);
    const complete = erkl != null;
    return { rows, appsSumme, erkl, bonus, profiPunkte, eigene, sum, max: MAX, complete, note: complete ? noteFor(sum) : null };
  }

  function bericht(nick, ev, extra) {
    const z = ev.rows.map(r => `• ${r.icon} ${r.titel}: ${r.pts}/3 – ${r.beleg}`).join("\n");
    return `App-Entwicklung von „${nick}“ – Notenvorschlag ${ev.note ? ev.note.text : "–"} (${ev.sum} von ${ev.max} Punkten)

Apps (je 0–3 Punkte: 1 = begonnen, 2 = alle Pflicht-Aufgaben ohne Fehler, 3 = zusätzlich eigene Erweiterung):
${z}
Summe Apps: ${ev.appsSumme}/21

Apps erklären (Abnahme): ${ev.erkl == null ? "–" : ev.erkl + "/3 × 3 = " + ev.erkl * 3}/9
Bonus: +${ev.bonus} (Profi-Aufgaben: ${ev.profiPunkte}, eigene App-Idee: ${ev.eigene}; höchstens +${BONUS_MAX})
${extra ? `\nAnmerkung der Lehrkraft: ${extra}\n` : ""}
Notenschlüssel: ab 27 P. = 1, ab 23 = 2, ab 19 = 3, ab 15 = 4, ab 9 = 5, darunter 6. Vorschlag – die Lehrkraft entscheidet.`;
  }

  return { analyze, appStand, evaluate, noteFor, bericht, SCALE, MAX, BONUS_MAX, EVENTS };
})();
