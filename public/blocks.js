/* App-Werkstatt – eigene deutsche Blöcke, Code-Erzeugung und Werkzeugkasten (Toolbox) */
const WWB = (() => {
  const JS = Blockly.JavaScript, O = javascript.Order;
  // Beschriftungen so, wie sie in den Aufgaben stehen
  Object.assign(Blockly.Msg, { CONTROLS_IF_MSG_IF: "wenn", CONTROLS_IF_MSG_THEN: "dann", CONTROLS_IF_MSG_ELSE: "sonst", CONTROLS_IF_MSG_ELSEIF: "sonst wenn",
    TEXT_CHANGECASE_OPERATOR_LOWERCASE: "in Kleinbuchstaben", TEXT_CHANGECASE_OPERATOR_UPPERCASE: "in Großbuchstaben", TEXT_CHANGECASE_OPERATOR_TITLECASE: "mit großen Anfangsbuchstaben" });
  let currentApp = () => ({ ui: [] });
  const setApp = fn => { currentApp = fn; };
  const q = s => JSON.stringify(String(s == null ? "" : s));

  // Dropdown mit den Bausteinen der aktuellen App (nach Typ gefiltert).
  // Nimmt auch Namen an, die es (noch/nicht mehr) gibt – sonst würde Blockly beim Laden still auf einen anderen Baustein umstellen.
  class KompDropdown extends Blockly.FieldDropdown {
    doClassValidation_(v) { return typeof v === "string" ? v : null; }
    getOptions() { return super.getOptions(false); }
  }
  function kompField(typen) {
    return new KompDropdown(function () {
      const opts = WW.names(currentApp(), typen).map(n => [n, n]);
      const cur = this && this.getValue && this.getValue();
      if (cur && !opts.some(o => o[1] === cur)) opts.push([`${cur} ⚠️`, cur]);
      return opts.length ? opts : [["(noch keiner da)", ""]];
    });
  }
  const FARB_NAMEN = [["🔴 rot", "#ef4444"], ["🟠 orange", "#f97316"], ["🟡 gelb", "#eab308"], ["🟢 grün", "#22c55e"], ["🩵 türkis", "#06b6d4"],
    ["🔵 blau", "#3b82f6"], ["🟣 lila", "#8b5cf6"], ["🩷 pink", "#ec4899"], ["⚫ schwarz", "#111827"], ["⚪ weiß", "#ffffff"], ["🩶 grau", "#9ca3af"], ["🟤 braun", "#92400e"]];

  const C = { ereignis: "#e07b00", baustein: 205, liste: 260, zeichnen: 320, spiel: 140, speicher: 15, zeit: 180, farbe: 340 };
  const def = (type, init) => { Blockly.Blocks[type] = { init }; };

  /* ---------- Ereignisse ---------- */
  const evt = (type, text, typen, extra) => def(type, function () {
    const parts = text.split("%1");
    this.appendDummyInput().appendField(parts[0]);
    if (typen) this.inputList[0].appendField(kompField(typen), "KOMP");
    if (parts[1]) this.inputList[0].appendField(parts[1]);
    if (extra) extra.call(this);
    this.appendStatementInput("DO").appendField("mache");
    this.setColour(C.ereignis); this.setTooltip("Ein Ereignis: Wenn das passiert, werden die Blöcke darin ausgeführt.");
    this.wwEvent = true;
  });
  evt("ww_start", "wenn die App startet");
  evt("ww_klick", "wenn %1 angetippt wird", ["knopf", "figur"]);
  evt("ww_eingabe", "wenn sich der Text in %1 ändert", ["eingabe"]);
  evt("ww_auswahl", "wenn in %1 etwas angetippt wird", ["liste"]);
  evt("ww_beruehrt", "wenn %1 berührt wird", ["zeichenflaeche"]);
  evt("ww_wisch", "wenn über %1 gewischt wird", ["zeichenflaeche"]);
  def("ww_alle", function () {
    this.appendDummyInput().appendField("alle").appendField(new Blockly.FieldNumber(1, 0.1, 60, 0.1), "SEK").appendField("Sekunden");
    this.appendStatementInput("DO").appendField("mache");
    this.setColour(C.ereignis); this.setTooltip("Wiederholt die Blöcke darin immer wieder."); this.wwEvent = true;
  });

  /* ---------- Bausteine verändern ---------- */
  const PROPS_SET = [["Text", "text"], ["Hintergrundfarbe", "hintergrund"], ["Textfarbe", "textfarbe"], ["Schriftgröße", "groesse"], ["sichtbar", "sichtbar"], ["antippbar", "aktiv"]];
  def("ww_set", function () {
    this.appendValueInput("WERT").appendField("setze").appendField(kompField(null), "KOMP").appendField(new Blockly.FieldDropdown(PROPS_SET), "PROP").appendField("auf");
    this.setInputsInline(true); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(C.baustein);
    this.setTooltip("Ändert eine Eigenschaft eines Bausteins deiner App.");
  });
  def("ww_get", function () {
    this.appendDummyInput().appendField(kompField(["text", "knopf", "eingabe"]), "KOMP").appendField(new Blockly.FieldDropdown([["Text", "text"], ["sichtbar", "sichtbar"]]), "PROP");
    this.setOutput(true); this.setColour(C.baustein); this.setTooltip("Liest eine Eigenschaft eines Bausteins.");
  });
  def("ww_zahl_aus", function () {
    this.appendDummyInput().appendField("Zahl aus").appendField(kompField(["eingabe", "text"]), "KOMP");
    this.setOutput(true, "Number"); this.setColour(C.baustein); this.setTooltip("Macht aus dem Text im Feld eine Zahl, mit der man rechnen kann.");
  });
  def("ww_meldung", function () {
    this.appendValueInput("WERT").appendField("zeige Meldung");
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(C.baustein); this.setTooltip("Zeigt kurz eine Nachricht unten in der App.");
  });
  def("ww_liste_zeigen", function () {
    this.appendValueInput("WERT").appendField("zeige in").appendField(kompField(["liste"]), "KOMP").appendField("die Liste");
    this.setInputsInline(true); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(C.baustein);
  });
  def("ww_angetippt", function () { this.appendDummyInput().appendField("angetipptes Element"); this.setOutput(true); this.setColour(C.baustein); });

  /* ---------- Farben ---------- */
  def("ww_farbe", function () { this.appendDummyInput().appendField(new Blockly.FieldDropdown(FARB_NAMEN), "F"); this.setOutput(true, "String"); this.setColour(C.farbe); });
  def("ww_zufallsfarbe", function () { this.appendDummyInput().appendField("🎲 zufällige Farbe"); this.setOutput(true, "String"); this.setColour(C.farbe); });

  /* ---------- Listen ---------- */
  def("ww_zufall_aus", function () { this.appendValueInput("LISTE").appendField("🎲 zufälliges Element aus"); this.setOutput(true); this.setColour(C.liste); });
  def("ww_hinzu", function () {
    this.appendValueInput("WERT").appendField("füge");
    this.appendValueInput("LISTE").appendField("zur Liste");
    this.appendDummyInput().appendField("hinzu");
    this.setInputsInline(true); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(C.liste);
  });
  def("ww_entferne", function () {
    this.appendValueInput("NR").appendField("entferne Element (Nr. oder angetipptes)");
    this.appendValueInput("LISTE").appendField("aus der Liste");
    this.setInputsInline(true); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(C.liste);
  });

  /* ---------- Zeichnen ---------- */
  def("ww_stift", function () {
    this.appendValueInput("FARBE").appendField("Stift von").appendField(kompField(["zeichenflaeche"]), "KOMP").appendField("Farbe");
    this.appendValueInput("DICKE").setCheck("Number").appendField("Dicke");
    this.setInputsInline(true); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(C.zeichnen);
  });
  def("ww_linie_wisch", function () {
    this.appendDummyInput().appendField("zeichne Linie entlang der Wischbewegung auf").appendField(kompField(["zeichenflaeche"]), "KOMP");
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(C.zeichnen);
  });
  def("ww_punkt", function () {
    this.appendDummyInput().appendField("zeichne Punkt an der Berührung auf").appendField(kompField(["zeichenflaeche"]), "KOMP");
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(C.zeichnen);
  });
  def("ww_leeren", function () {
    this.appendDummyInput().appendField("lösche alles auf").appendField(kompField(["zeichenflaeche"]), "KOMP");
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(C.zeichnen);
  });
  def("ww_ber_xy", function () { this.appendDummyInput().appendField(new Blockly.FieldDropdown([["x", "x"], ["y", "y"]]), "A").appendField("der Berührung"); this.setOutput(true, "Number"); this.setColour(C.zeichnen); });

  /* ---------- Spiel ---------- */
  def("ww_bewege", function () {
    this.appendValueInput("DX").setCheck("Number").appendField("bewege").appendField(kompField(["figur"]), "KOMP").appendField("um x");
    this.appendValueInput("DY").setCheck("Number").appendField("y");
    this.setInputsInline(true); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(C.spiel);
    this.setTooltip("x: nach rechts (+) oder links (−). y: nach unten (+) oder oben (−).");
  });
  def("ww_setzepos", function () {
    this.appendValueInput("X").setCheck("Number").appendField("setze").appendField(kompField(["figur"]), "KOMP").appendField("auf x");
    this.appendValueInput("Y").setCheck("Number").appendField("y");
    this.setInputsInline(true); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(C.spiel);
  });
  def("ww_zufallpos", function () {
    this.appendDummyInput().appendField("setze").appendField(kompField(["figur"]), "KOMP").appendField("an eine zufällige Stelle");
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(C.spiel);
  });
  def("ww_beruehrt_fig", function () {
    this.appendDummyInput().appendField(kompField(["figur"]), "A").appendField("berührt").appendField(kompField(["figur"]), "B");
    this.setOutput(true, "Boolean"); this.setColour(C.spiel);
  });
  def("ww_figpos", function () {
    this.appendDummyInput().appendField(kompField(["figur"]), "KOMP").appendField(new Blockly.FieldDropdown([["x-Position", "x"], ["y-Position", "y"]]), "A");
    this.setOutput(true, "Number"); this.setColour(C.spiel);
  });

  /* ---------- Speichern ---------- */
  def("ww_speichere", function () {
    this.appendValueInput("WERT").appendField("💾 speichere");
    this.appendDummyInput().appendField("unter dem Namen").appendField(new Blockly.FieldTextInput("liste"), "NAME");
    this.setInputsInline(true); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(C.speicher);
    this.setTooltip("Speichert etwas auf diesem Gerät – auch wenn die App geschlossen wird.");
  });
  def("ww_lade", function () {
    this.appendDummyInput().appendField("💾 gespeicherter Wert").appendField(new Blockly.FieldTextInput("liste"), "NAME");
    this.appendValueInput("STD").appendField(", sonst");
    this.setInputsInline(true); this.setOutput(true); this.setColour(C.speicher);
  });

  /* ---------- Zeit ---------- */
  def("ww_jetzt", function () {
    this.appendDummyInput().appendField("aktuelle").appendField(new Blockly.FieldDropdown([["Stunde", "stunde"], ["Minute", "minute"], ["Sekunde", "sekunde"], ["Wochentag", "wochentag"], ["Tag", "tag"], ["Monat", "monat"], ["Jahr", "jahr"]]), "TEIL");
    this.setOutput(true); this.setColour(C.zeit);
  });
  def("ww_tagebis", function () {
    this.appendDummyInput().appendField("Tage bis zum").appendField(new Blockly.FieldTextInput("01.07.2027"), "DATUM");
    this.setOutput(true, "Number"); this.setColour(C.zeit); this.setTooltip("Datum so schreiben: TT.MM.JJJJ");
  });
  def("ww_stoppe", function () { this.appendDummyInput().appendField("⏹ stoppe alle Wiederholungen"); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(C.zeit); });

  /* ---------- Code-Erzeugung ---------- */
  const G = JS.forBlock;
  // Schutz vor Endlos-Wiederholungen (z. B. „wiederhole 1000000-mal“)
  JS.INFINITE_LOOP_TRAP = 'if (--A.schutz < 0) throw new Error("Eine Wiederholung läuft viel zu oft – ist die Zahl zu groß?");\n';
  const val = (b, g, n, d) => g.valueToCode(b, n, O.NONE) || d;
  const body = (b, g) => g.statementToCode(b, "DO");
  const komp = b => q(b.getFieldValue("KOMP"));
  G.ww_start = (b, g) => `A.start(function () {\n${body(b, g)}});\n`;
  const onEv = ev => (b, g) => `A.on(${komp(b)}, "${ev}", function () {\n${body(b, g)}});\n`;
  G.ww_klick = onEv("klick"); G.ww_eingabe = onEv("aenderung"); G.ww_auswahl = onEv("auswahl"); G.ww_beruehrt = onEv("beruehrt"); G.ww_wisch = onEv("wisch");
  G.ww_alle = (b, g) => `A.alle(${Number(b.getFieldValue("SEK")) || 1}, function () {\n${body(b, g)}});\n`;
  G.ww_set = (b, g) => `A.set(${komp(b)}, "${b.getFieldValue("PROP")}", ${val(b, g, "WERT", '""')});\n`;
  G.ww_get = (b) => [`A.get(${komp(b)}, "${b.getFieldValue("PROP")}")`, O.FUNCTION_CALL];
  G.ww_zahl_aus = (b) => [`A.zahl(A.get(${komp(b)}, "text"))`, O.FUNCTION_CALL];
  G.ww_meldung = (b, g) => `A.meldung(${val(b, g, "WERT", '""')});\n`;
  G.ww_liste_zeigen = (b, g) => `A.set(${komp(b)}, "elemente", ${val(b, g, "WERT", "[]")});\n`;
  G.ww_angetippt = () => ["A.ev.element", O.MEMBER];
  G.ww_farbe = b => [q(b.getFieldValue("F")), O.ATOMIC];
  G.ww_zufallsfarbe = () => ["A.zufallsfarbe()", O.FUNCTION_CALL];
  G.ww_zufall_aus = (b, g) => [`A.zufallAus(${val(b, g, "LISTE", "[]")})`, O.FUNCTION_CALL];
  G.ww_hinzu = (b, g) => `A.hinzu(${val(b, g, "LISTE", "null")}, ${val(b, g, "WERT", '""')});\n`;
  G.ww_entferne = (b, g) => `A.entferne(${val(b, g, "LISTE", "null")}, ${val(b, g, "NR", "1")});\n`;
  G.ww_stift = (b, g) => `A.stift(${komp(b)}, ${val(b, g, "FARBE", "null")}, ${val(b, g, "DICKE", "null")});\n`;
  G.ww_linie_wisch = b => `A.linie(${komp(b)}, A.ev.vx, A.ev.vy, A.ev.x, A.ev.y);\n`;
  G.ww_punkt = b => `A.punkt(${komp(b)}, A.ev.x, A.ev.y);\n`;
  G.ww_leeren = b => `A.leeren(${komp(b)});\n`;
  G.ww_ber_xy = b => [`A.ev.${b.getFieldValue("A") === "y" ? "y" : "x"}`, O.MEMBER];
  G.ww_bewege = (b, g) => `A.bewege(${komp(b)}, ${val(b, g, "DX", "0")}, ${val(b, g, "DY", "0")});\n`;
  G.ww_setzepos = (b, g) => `A.setzePos(${komp(b)}, ${val(b, g, "X", "0")}, ${val(b, g, "Y", "0")});\n`;
  G.ww_zufallpos = b => `A.zufallPos(${komp(b)});\n`;
  G.ww_beruehrt_fig = b => [`A.beruehrt(${q(b.getFieldValue("A"))}, ${q(b.getFieldValue("B"))})`, O.FUNCTION_CALL];
  G.ww_figpos = b => [`A.get(${komp(b)}, "${b.getFieldValue("A") === "y" ? "y" : "x"}")`, O.FUNCTION_CALL];
  G.ww_speichere = (b, g) => `A.speichere(${q(b.getFieldValue("NAME"))}, ${val(b, g, "WERT", '""')});\n`;
  G.ww_lade = (b, g) => [`A.lade(${q(b.getFieldValue("NAME"))}, ${val(b, g, "STD", '""')})`, O.FUNCTION_CALL];
  G.ww_jetzt = b => [`A.jetzt(${q(b.getFieldValue("TEIL"))})`, O.FUNCTION_CALL];
  G.ww_tagebis = b => [`A.tageBis(${q(b.getFieldValue("DATUM"))})`, O.FUNCTION_CALL];
  G.ww_stoppe = () => "A.stoppeTimer();\n";

  /* ---------- Werkzeugkasten ---------- */
  const sh = (type, fields) => ({ shadow: { type, fields } });
  const blk = (type, fields) => ({ block: { type, fields } });
  const TOOL = {
    ww_start: {}, ww_klick: {}, ww_eingabe: {}, ww_auswahl: {}, ww_beruehrt: {}, ww_wisch: {}, ww_alle: {},
    ww_set: { inputs: { WERT: sh("text", { TEXT: "Hallo" }) } }, ww_get: {}, ww_zahl_aus: {},
    ww_meldung: { inputs: { WERT: sh("text", { TEXT: "Gut gemacht!" }) } },
    ww_liste_zeigen: {}, ww_angetippt: {},
    ww_farbe: {}, ww_zufallsfarbe: {},
    ww_zufall_aus: {}, ww_hinzu: {}, ww_entferne: { inputs: { NR: sh("math_number", { NUM: 1 }) } },
    ww_stift: { inputs: { FARBE: blk("ww_farbe", { F: "#3b82f6" }), DICKE: sh("math_number", { NUM: 6 }) } },
    ww_linie_wisch: {}, ww_punkt: {}, ww_leeren: {}, ww_ber_xy: {},
    ww_bewege: { inputs: { DX: sh("math_number", { NUM: 20 }), DY: sh("math_number", { NUM: 0 }) } },
    ww_setzepos: { inputs: { X: sh("math_number", { NUM: 0 }), Y: sh("math_number", { NUM: 0 }) } },
    ww_zufallpos: {}, ww_beruehrt_fig: {}, ww_figpos: {},
    ww_speichere: {}, ww_lade: { inputs: { STD: blk("lists_create_empty") } },
    ww_jetzt: {}, ww_tagebis: {}, ww_stoppe: {},
    controls_if: {}, controls_ifelse: { type: "controls_if", extraState: { hasElse: true } },
    logic_compare: {}, logic_operation: {}, logic_negate: {}, logic_boolean: {},
    controls_repeat_ext: { inputs: { TIMES: sh("math_number", { NUM: 3 }) } },
    math_number: {}, math_arithmetic: { inputs: { A: sh("math_number", { NUM: 1 }), B: sh("math_number", { NUM: 1 }) } },
    math_random_int: { inputs: { FROM: sh("math_number", { NUM: 1 }), TO: sh("math_number", { NUM: 6 }) } },
    text: {}, text_join: {}, text_changeCase: {}, text_isEmpty: {},
    lists_create_with: {}, lists_create_empty: {}, lists_length: {}, lists_getIndex: {}, lists_isEmpty: {}
  };
  const CATS = [
    { name: "Ereignisse", colour: C.ereignis, types: ["ww_start", "ww_klick", "ww_eingabe", "ww_auswahl", "ww_beruehrt", "ww_wisch", "ww_alle"] },
    { name: "Bausteine", colour: C.baustein, types: ["ww_set", "ww_get", "ww_zahl_aus", "ww_meldung", "ww_liste_zeigen", "ww_angetippt"] },
    { name: "Farben", colour: C.farbe, types: ["ww_farbe", "ww_zufallsfarbe"] },
    { name: "Variablen", colour: 330, custom: "VARIABLE" },
    { name: "Rechnen", colour: 230, types: ["math_number", "math_arithmetic", "math_random_int"] },
    { name: "Text", colour: 160, types: ["text", "text_join", "text_changeCase", "text_isEmpty"] },
    { name: "Wenn … dann", colour: 210, types: ["controls_if", "controls_ifelse", "logic_compare", "logic_operation", "logic_negate", "logic_boolean", "controls_repeat_ext"] },
    { name: "Listen", colour: C.liste, types: ["lists_create_with", "lists_create_empty", "ww_zufall_aus", "ww_hinzu", "ww_entferne", "lists_length", "lists_getIndex", "lists_isEmpty"] },
    { name: "Zeichnen", colour: C.zeichnen, types: ["ww_stift", "ww_linie_wisch", "ww_punkt", "ww_leeren", "ww_ber_xy"] },
    { name: "Spiel", colour: C.spiel, types: ["ww_bewege", "ww_setzepos", "ww_zufallpos", "ww_beruehrt_fig", "ww_figpos"] },
    { name: "Speichern", colour: C.speicher, types: ["ww_speichere", "ww_lade"] },
    { name: "Zeit", colour: C.zeit, types: ["ww_jetzt", "ww_tagebis", "ww_stoppe"] }
  ];
  function toolbox(allowed) {
    const ok = t => !allowed || allowed.includes(t) || allowed.includes("*");
    const contents = CATS.map(c => {
      if (c.custom) return ok("variables") ? { kind: "category", name: c.name, colour: c.colour, custom: c.custom } : null;
      const items = c.types.filter(ok).map(t => ({ kind: "block", type: t, ...TOOL[t] }));
      return items.length ? { kind: "category", name: c.name, colour: c.colour, contents: items } : null;
    }).filter(Boolean);
    return { kind: "categoryToolbox", contents };
  }

  // Nur Ereignis-Blöcke erzeugen Code – lose Blöcke meldet der Fehler-Detektiv
  function wsCode(ws) {
    JS.init(ws);
    let code = "";
    ws.getTopBlocks(true).forEach(bl => { if (!bl.wwEvent || (bl.isEnabled && !bl.isEnabled())) return; let c = JS.blockToCode(bl); if (Array.isArray(c)) c = c[0]; code += c; });
    return JS.finish(code);
  }
  // Code für einen gespeicherten Blockstand erzeugen (ohne sichtbare Arbeitsfläche)
  function codeFor(state) {
    const ws = new Blockly.Workspace();
    try {
      if (state) Blockly.serialization.workspaces.load(state, ws);
      return wsCode(ws);
    }
    catch (e) { return ""; } finally { ws.dispose(); }
  }

  return { setApp, toolbox, codeFor, wsCode, FARB_NAMEN };
})();
