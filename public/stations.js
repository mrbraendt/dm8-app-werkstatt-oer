/* App-Werkstatt – Stationen.
   Projekt-Stationen haben eine eigene App (app: "a1" …). check(a, p): a = Analyse aus checks.js, p = Fortschritt. Ohne check → Häkchen. */
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const B = s => `<span class="blk">${s}</span>`;          // Block-Name im Text
const K = s => `<span class="cmp">${s}</span>`;          // Baustein-Name im Text

// Hilfen für Prüfungen
const inEv = (a, ev, pred) => a.inEvent(ev, pred);
const setText = (a, ev) => a.inEvent(ev, b => b.type === "ww_set" && b.fields.PROP === "text");
const setTextWith = (a, ev, innerType) => a.blocks.some(b => b.type === "ww_set" && b.fields.PROP === "text" && b.top && (!ev || (Array.isArray(ev) ? ev.includes(b.top.type) : b.top.type === ev))
  && b.inputs.WERT && b.inputs.WERT.block && JSON.stringify(b.inputs.WERT.block).includes(`"type":"${innerType}"`));
const varNames = a => new Set(a.blocks.filter(b => b.varName).map(b => b.varName));
const klickCount = a => a.tops.filter(t => t.type === "ww_klick").length;

const STATIONEN = [
  /* ================= Einführung ================= */
  {
    id: "e1", nr: 1, phase: "Einführung", icon: "📱", titel: "Was ist eine App?", special: "e1",
    ziel: "Du kannst an Apps aus deinem Alltag erklären, aus welchen drei Teilen jede App besteht.",
    pflicht: [
      { t: "Ordne alle Beispiele richtig zu: Oberfläche, Logik oder Daten.", check: (a, p) => !!(p && p.quiz && p.quiz.e1) },
      { t: "Erkläre einer Partnerin oder einem Partner an deiner Lieblings-App die drei Teile." }
    ],
    bonus: []
  },
  {
    id: "e2", nr: 2, phase: "Einführung", icon: "🧠", titel: "Wie denkt eine App?", special: "e2",
    ziel: "Du kannst Abläufe als „Wenn … dann …“ beschreiben und einschätzen, welche Berechtigungen eine App wirklich braucht.",
    pflicht: [
      { t: "Bau drei „Wenn … dann …“-Sätze aus deinem Alltag.", check: (a, p) => !!(p && p.quiz && p.quiz.e2wenn) },
      { t: "Entscheide bei allen Apps: Ist die Berechtigung nötig oder verdächtig?", check: (a, p) => !!(p && p.quiz && p.quiz.e2rechte) }
    ],
    bonus: []
  },

  /* ================= App 1 ================= */
  {
    id: "a1", app: "a1", nr: 3, phase: "Apps bauen", icon: "🔢", titel: "Klick-Zähler",
    alltag: "Punkte beim Spieleabend zählen, Tore beim Kicker, Runden beim Training.",
    echt: "Jede App mit einem „Gefällt mir“-Zähler oder Punktestand funktioniert genau so.",
    ziel: "Du kannst mit einem Ereignis und einer Variablen eine Zahl hochzählen und anzeigen.",
    lernen: `
      <div class="concept"><div><span class="big">👆</span><b>Ereignis</b><small>„<i>wenn</i> der Knopf angetippt wird …“ – darauf wartet die App.</small></div>
        <div><span class="big">📦</span><b>Variable</b><small>Eine Kiste mit Namen, die sich etwas merkt – hier: wie viele Punkte es gibt.</small></div>
        <div><span class="big">🖥️</span><b>Anzeige</b><small>Damit man die Zahl sieht, schreibt die App sie in einen Text.</small></div></div>
      <p>Jede App wartet auf <b>Ereignisse</b>: Antippen, Wischen, Tippen … Erst dann passiert etwas.</p>`,
    komps: ["text", "knopf", "zeile"],
    blocks: ["ww_start", "ww_klick", "ww_set", "variables", "math_number", "math_arithmetic", "ww_meldung", "controls_if", "logic_compare", "text", "ww_farbe"],
    vorlage: { screen: { titel: "Punkte-Zähler" }, ui: [{ typ: "text", name: "anzeige", props: { text: "0", groesse: "riesig", fett: true } }, { typ: "knopf", name: "plus", props: { text: "+1" } }] },
    pflicht: [
      { t: `Oberfläche: Füge einen ${K("Text")} für den Punktestand hinzu (Text: 0, groß).`, check: a => a.comp("text").length >= 1 },
      { t: `Oberfläche: Füge einen ${K("Knopf")} mit der Aufschrift „+1“ hinzu.`, check: a => a.comp("knopf").length >= 1 },
      { t: `Blöcke: Lege bei ${B("Variablen")} die Variable „punkte“ an. Setze sie in ${B("wenn die App startet")} auf 0.`, check: a => inEv(a, "ww_start", b => b.type === "variables_set") },
      { t: `Blöcke: In ${B("wenn plus angetippt wird")} → ${B("erhöhe punkte um 1")}.`, check: a => inEv(a, "ww_klick", b => b.type === "math_change") },
      { t: `… und darunter ${B("setze anzeige Text auf punkte")}. Teste im Handy rechts!`, check: a => setTextWith(a, "ww_klick", "variables_get") }
    ],
    bonus: [
      { t: "Ein zweiter Knopf: „−1“ oder „Zurücksetzen“.", check: a => a.comp("knopf").length >= 2 && klickCount(a) >= 2 },
      { t: "Gib deiner App einen eigenen Titel und eigene Farben (Oberfläche → App-Einstellungen).", check: a => a.screenChanged({ titel: "Punkte-Zähler" }) || a.changed("knopf", "farbe", "#5b4bdb") }
    ],
    profi: [
      { t: "Zwei Teams: zwei Zähler mit zwei Variablen nebeneinander (Zeile).", check: a => new Set(a.blocks.filter(b => b.type === "math_change").map(b => b.varName)).size >= 2 },
      { t: `Ab 10 Punkten: ${B("wenn … dann")} ${B("zeige Meldung „Gewonnen!“")}.`, check: a => inEv(a, "ww_klick", b => b.type === "controls_if") && a.has("ww_meldung") }
    ]
  },

  /* ================= App 2 ================= */
  {
    id: "a2", app: "a2", nr: 4, phase: "Apps bauen", icon: "🔮", titel: "Wahrheitskugel",
    alltag: "Spaß in der Pause – und das Prinzip hinter Würfel-, Los- und Glücksrad-Apps.",
    echt: "Würfel-Apps, Glücksräder und „Zufällige Playlist“ wählen genauso zufällig aus einer Liste.",
    ziel: "Du kannst Antworten in einer Liste speichern und die App zufällig eine davon auswählen lassen.",
    lernen: `
      <div class="concept"><div><span class="big">📜</span><b>Liste</b><small>Mehrere Dinge in einer Reihe: „Ja!“, „Eher nicht.“, „Frag später nochmal.“</small></div>
        <div><span class="big">🎲</span><b>Zufall</b><small>${B("zufälliges Element aus")} zieht wie aus einem Hut eins davon.</small></div></div>
      <p>So funktioniert die Kugel: <b>wenn</b> der Knopf angetippt wird → <b>setze</b> den Antwort-Text auf ein <b>zufälliges Element aus</b> der Liste.</p>`,
    komps: ["bild", "text", "knopf", "eingabe", "zeile"],
    blocks: ["ww_start", "ww_klick", "ww_set", "ww_get", "ww_meldung", "lists_create_with", "ww_zufall_aus", "text", "text_isEmpty", "ww_farbe", "ww_zufallsfarbe", "controls_if", "controls_ifelse", "variables"],
    vorlage: { screen: { titel: "Wahrheitskugel", hintergrund: "#1e1b4b", textfarbe: "#ffffff" }, ui: [{ typ: "bild", name: "kugel", props: { bild: "🔮", groesse: "gross" } }, { typ: "knopf", name: "fragen", props: { text: "Frag die Kugel!" } }, { typ: "text", name: "antwort", props: { text: "…", groesse: "gross" } }] },
    pflicht: [
      { t: `Oberfläche: ein ${K("Bild")} (🔮), ein ${K("Knopf")} „Frag die Kugel!“ und ein ${K("Text")} für die Antwort.`, check: a => a.comp("bild").length >= 1 && a.comp("knopf").length >= 1 && a.comp("text").length >= 1 },
      { t: `Blöcke: ${B("wenn fragen angetippt wird")} → ${B("setze antwort Text auf")} …`, check: a => setText(a, "ww_klick") },
      { t: `… ${B("zufälliges Element aus")} einer ${B("Liste")} mit mindestens 3 Antworten.`, check: a => setTextWith(a, "ww_klick", "ww_zufall_aus") && a.listItems() >= 3 }
    ],
    bonus: [
      { t: "Mach sie zu deiner Kugel: mindestens 6 eigene Antworten.", check: a => a.listItems() >= 6 },
      { t: `Die Antwort erscheint jedes Mal in einer anderen Farbe (${B("zufällige Farbe")}).`, check: a => a.has("ww_zufallsfarbe") }
    ],
    profi: [
      { t: `Ein ${K("Eingabefeld")} für die Frage: Ist es leer, kommt ${B("zeige Meldung „Stell zuerst eine Frage!“")}.`, check: a => a.comp("eingabe").length >= 1 && a.has("text_isEmpty") && a.has("ww_meldung") }
    ]
  },

  /* ================= App 3 ================= */
  {
    id: "a3", app: "a3", nr: 5, phase: "Apps bauen", icon: "🎯", titel: "Entscheidungshelfer",
    alltag: "Wer fängt an? Teams auslosen, Aufgaben im Haushalt verteilen, Plan fürs Wochenende.",
    echt: "Apps zum Auslosen von Teams oder Gewinnspielen arbeiten genauso mit einer Liste, die man selbst füllt.",
    ziel: "Du kannst eine Liste in der App mit eigenen Einträgen füllen und daraus zufällig auswählen lassen.",
    lernen: `
      <p>Bei der Wahrheitskugel stand die Liste fest. Jetzt füllen die <b>Benutzer</b> die Liste selbst:</p>
      <div class="concept"><div><span class="big">⌨️</span><b>Eintippen</b><small>Name oder Idee ins ${K("Eingabefeld")}</small></div>
        <div><span class="big">➕</span><b>Hinzufügen</b><small>${B("füge … zur Liste hinzu")}</small></div>
        <div><span class="big">🎯</span><b>Entscheiden</b><small>${B("zufälliges Element aus")} der Liste</small></div></div>
      <p>💡 Die Variable braucht am Anfang eine <b>leere Liste</b> – sonst kann man nichts hinzufügen.</p>`,
    komps: ["text", "eingabe", "knopf", "liste", "zeile"],
    blocks: ["ww_start", "ww_klick", "ww_auswahl", "ww_set", "ww_get", "ww_meldung", "ww_liste_zeigen", "ww_angetippt", "variables", "lists_create_empty", "lists_create_with", "ww_hinzu", "ww_entferne", "ww_zufall_aus", "lists_length", "lists_isEmpty", "lists_getIndex", "controls_if", "controls_ifelse", "logic_compare", "text", "text_join", "math_number"],
    vorlage: { screen: { titel: "Wer fängt an?" }, ui: [{ typ: "zeile", name: "zeile1", kinder: [{ typ: "eingabe", name: "eingabe", props: { platzhalter: "Name oder Idee" } }, { typ: "knopf", name: "hinzufuegen", props: { text: "➕" } }] }, { typ: "liste", name: "liste" }, { typ: "knopf", name: "entscheide", props: { text: "🎯 Entscheide!" } }, { typ: "text", name: "ergebnis", props: { text: "", groesse: "gross", fett: true } }] },
    pflicht: [
      { t: `Oberfläche: ${K("Eingabefeld")}, ${K("Knopf")} „➕“, ${K("Liste")}, ${K("Knopf")} „Entscheide!“ und ein ${K("Text")} fürs Ergebnis.`, check: a => a.comp("eingabe").length && a.comp("knopf").length >= 2 && a.comp("liste").length && a.comp("text").length },
      { t: `${B("wenn die App startet")} → ${B("setze auswahl auf erzeuge eine leere Liste")}.`, check: a => inEv(a, "ww_start", b => b.type === "variables_set" && b.inputs.VALUE && b.inputs.VALUE.block && b.inputs.VALUE.block.type === "lists_create_empty") },
      { t: `Knopf ➕: ${B("füge eingabe Text zur Liste auswahl hinzu")} und ${B("zeige in liste die Liste auswahl")}.`, check: a => inEv(a, "ww_klick", b => b.type === "ww_hinzu") && inEv(a, "ww_klick", b => b.type === "ww_liste_zeigen") },
      { t: `Knopf Entscheide: ${B("setze ergebnis Text auf zufälliges Element aus auswahl")}.`, check: a => setTextWith(a, "ww_klick", "ww_zufall_aus") }
    ],
    bonus: [
      { t: "Nach dem Hinzufügen wird das Eingabefeld wieder leer.", check: a => a.blocks.some(b => b.type === "ww_set" && b.fields.PROP === "text" && a.comp("eingabe").some(c => c.name === b.fields.KOMP)) },
      { t: "Ein Knopf „Neu starten“ leert die Liste.", check: a => a.inEvent("ww_klick", b => b.type === "variables_set" && JSON.stringify(b.inputs).includes("lists_create_empty")) }
    ],
    profi: [
      { t: `Jede/r kommt nur einmal dran: Das gezogene Element wird aus der Liste entfernt (${B("entferne Element …")}).`, check: a => a.has("ww_entferne") },
      { t: `Ist die Liste leer, zeigt die App eine Meldung (${B("ist leer")}).`, check: a => a.has("lists_isEmpty") && a.has("ww_meldung") }
    ]
  },

  /* ================= App 4 ================= */
  {
    id: "a4", app: "a4", nr: 6, phase: "Apps bauen", icon: "🧠", titel: "Lern-Quiz",
    alltag: "Vokabeln, Fachbegriffe oder Formeln üben – zum Beispiel vor der nächsten Arbeit.",
    echt: "Lern-Apps wie Vokabeltrainer prüfen deine Antwort mit genau so einem „wenn … dann … sonst“.",
    ziel: "Du kannst mit „wenn … dann … sonst“ eine Antwort prüfen und Punkte vergeben.",
    lernen: `
      <div class="concept"><div><span class="big">❓</span><b>Frage</b><small>steht im ${K("Text")}</small></div>
        <div><span class="big">⌨️</span><b>Antwort</b><small>tippt man ins ${K("Eingabefeld")}</small></div>
        <div><span class="big">⚖️</span><b>Prüfen</b><small>${B("wenn")} Antwort ${B("=")} richtig → „Richtig!“ ${B("sonst")} → „Leider falsch“</small></div></div>
      <p>${B("wenn … dann … sonst")} ist eine <b>Bedingung</b>: Die App entscheidet, welcher Weg passiert.</p>`,
    komps: ["text", "eingabe", "knopf", "zeile"],
    blocks: ["ww_start", "ww_klick", "ww_set", "ww_get", "ww_meldung", "variables", "controls_if", "controls_ifelse", "logic_compare", "logic_operation", "text", "text_join", "text_changeCase", "math_number", "math_arithmetic", "lists_create_with", "lists_getIndex", "lists_length", "ww_farbe"],
    vorlage: { screen: { titel: "Mein Lern-Quiz" }, ui: [{ typ: "text", name: "frage", props: { text: "Was heißt „dog“?", groesse: "gross", fett: true } }, { typ: "eingabe", name: "antwort", props: { platzhalter: "Deine Antwort" } }, { typ: "knopf", name: "pruefen", props: { text: "Prüfen" } }, { typ: "text", name: "rueckmeldung", props: { text: "" } }, { typ: "text", name: "punkte", props: { text: "Punkte: 0", groesse: "klein" } }] },
    pflicht: [
      { t: `Oberfläche: ${K("Text")} für die Frage, ${K("Eingabefeld")}, ${K("Knopf")} „Prüfen“, ${K("Text")} für die Rückmeldung.`, check: a => a.comp("text").length >= 2 && a.comp("eingabe").length && a.comp("knopf").length },
      { t: `Beim Prüfen: ${B("wenn … dann … sonst")} mit ${B("antwort Text")} ${B("=")} richtige Antwort.`, check: a => inEv(a, "ww_klick", b => b.type === "controls_if" && b.extra && b.extra.hasElse) && inEv(a, "ww_klick", b => b.type === "logic_compare") },
      { t: "Bei „richtig“ gibt es einen Punkt (Variable punkte), und beide Fälle zeigen eine Rückmeldung.", check: a => inEv(a, "ww_klick", b => b.type === "math_change") && a.blocks.filter(b => b.type === "ww_set" && b.top && b.top.type === "ww_klick").length >= 2 }
    ],
    bonus: [
      { t: "Mach es zu deinem Quiz: mindestens 3 eigene Fragen zu einem Schulfach (Listen für Fragen und Antworten).", check: a => a.listItems() >= 6 && a.has("lists_getIndex") },
      { t: "Die Rückmeldung ist farbig: grün bei richtig, rot bei falsch.", check: a => a.inEvent("ww_klick", b => b.type === "ww_set" && ["textfarbe", "hintergrund"].includes(b.fields.PROP)) }
    ],
    profi: [
      { t: `Groß- und Kleinschreibung ist egal (${B("in Kleinbuchstaben")}).`, check: a => a.has("text_changeCase") },
      { t: "Nach der letzten Frage zeigt die App, wie viele Punkte man geschafft hat.", check: a => a.has("lists_length") && a.has("ww_meldung") }
    ]
  },

  /* ================= App 5 ================= */
  {
    id: "a5", app: "a5", nr: 7, phase: "Apps bauen", icon: "🎨", titel: "Zeichen-App",
    alltag: "Schnelle Skizzen, eine Wegbeschreibung, Notizen oder einfach Kritzeln.",
    echt: "Notiz- und Mal-Apps reagieren genauso auf deinen Finger: Jede Wischbewegung wird zu einer Linie.",
    ziel: "Du kannst auf Berührungen und Wischbewegungen reagieren und eine Zeichen-App mit Farben bauen.",
    lernen: `
      <div class="concept"><div><span class="big">👉</span><b>Wischen</b><small>${B("wenn über zeichenflaeche gewischt wird")} meldet jede kleine Bewegung</small></div>
        <div><span class="big">✏️</span><b>Linie</b><small>${B("zeichne Linie entlang der Wischbewegung")} malt das Stück nach</small></div>
        <div><span class="big">🖍️</span><b>Stift</b><small>${B("Stift von … Farbe … Dicke")} legt fest, womit gemalt wird</small></div></div>
      <p>🧽 Wie radiert man? Ganz einfach: <b>Malen mit der Hintergrundfarbe</b> (weiß).</p>`,
    komps: ["zeichenflaeche", "knopf", "zeile", "text"],
    blocks: ["ww_start", "ww_klick", "ww_wisch", "ww_beruehrt", "ww_linie_wisch", "ww_punkt", "ww_stift", "ww_leeren", "ww_farbe", "ww_zufallsfarbe", "math_number", "ww_set", "variables"],
    vorlage: { screen: { titel: "Mal-App" }, ui: [{ typ: "zeichenflaeche", name: "zeichenflaeche", props: { hoehe: 320 } }, { typ: "zeile", name: "farben", kinder: [{ typ: "knopf", name: "rot", props: { text: "Rot", farbe: "#ef4444" } }, { typ: "knopf", name: "blau", props: { text: "Blau", farbe: "#3b82f6" } }] }, { typ: "knopf", name: "loeschen", props: { text: "🗑 Alles löschen", farbe: "#64748b" } }] },
    pflicht: [
      { t: `Oberfläche: eine ${K("Zeichenfläche")}, mindestens zwei Farb-${K("Knöpfe")} (in einer ${K("Zeile")}) und ein Knopf „Löschen“.`, check: a => a.comp("zeichenflaeche").length && a.comp("knopf").length >= 3 },
      { t: `${B("wenn über zeichenflaeche gewischt wird")} → ${B("zeichne Linie entlang der Wischbewegung")}.`, check: a => inEv(a, "ww_wisch", b => b.type === "ww_linie_wisch") },
      { t: `Jeder Farbknopf: ${B("Stift von zeichenflaeche Farbe …")}.`, check: a => a.blocks.filter(b => b.type === "ww_stift" && b.top && b.top.type === "ww_klick").length >= 2 },
      { t: `Löschen-Knopf: ${B("lösche alles auf zeichenflaeche")}.`, check: a => inEv(a, "ww_klick", b => b.type === "ww_leeren") }
    ],
    bonus: [
      { t: "Ein Radierer: Knopf, der mit Weiß malt.", check: a => a.blocks.some(b => b.type === "ww_stift" && JSON.stringify(b.inputs).includes("#ffffff")) },
      { t: "Zwei Knöpfe für dünn und dick (Dicke z. B. 3 und 15).", check: a => new Set(a.blocks.filter(b => b.type === "ww_stift").map(b => JSON.stringify((b.inputs.DICKE || {}).shadow || (b.inputs.DICKE || {}).block || ""))).size >= 2 }
    ],
    profi: [
      { t: `Ein Knopf für eine ${B("zufällige Farbe")}.`, check: a => a.has("ww_zufallsfarbe") },
      { t: `Antippen macht einen Punkt (${B("wenn … berührt wird")} + ${B("zeichne Punkt")}).`, check: a => inEv(a, "ww_beruehrt", b => b.type === "ww_punkt") }
    ]
  },

  /* ================= App 6 ================= */
  {
    id: "a6", app: "a6", nr: 8, phase: "Apps bauen", icon: "🚀", titel: "Mini-Spiel",
    alltag: "Ein kleines Pausenspiel – selbst gebaut statt heruntergeladen.",
    echt: "Fast jedes Handyspiel prüft ständig: Berühren sich zwei Figuren? Dann gibt es Punkte – oder das Spiel ist vorbei.",
    ziel: "Du kannst Figuren steuern, Berührungen erkennen und dafür Punkte vergeben.",
    lernen: `
      <div class="concept"><div><span class="big">🕹️</span><b>Steuern</b><small>${B("bewege rakete um x 20 y 0")} – x nach rechts/links, y nach unten/oben</small></div>
        <div><span class="big">💥</span><b>Berührung</b><small>${B("rakete berührt stern")} ist wahr oder falsch</small></div>
        <div><span class="big">⏱️</span><b>Zeit</b><small>${B("alle … Sekunden")} wiederholt etwas immer wieder</small></div></div>
      <p>📐 Im Spielfeld ist oben links x = 0 und y = 0. Nach rechts wird x größer, nach <b>unten</b> wird y größer.</p>`,
    komps: ["spielfeld", "figur", "knopf", "zeile", "text"],
    blocks: ["ww_start", "ww_klick", "ww_alle", "ww_bewege", "ww_setzepos", "ww_zufallpos", "ww_beruehrt_fig", "ww_figpos", "controls_if", "controls_ifelse", "logic_compare", "logic_operation", "variables", "math_number", "math_arithmetic", "math_random_int", "ww_set", "ww_meldung", "ww_stoppe", "text", "text_join"],
    vorlage: { screen: { titel: "Sternenjäger" }, ui: [{ typ: "text", name: "punkte", props: { text: "Punkte: 0", fett: true } },
      { typ: "spielfeld", name: "spielfeld", props: { hoehe: 280 }, kinder: [{ typ: "figur", name: "rakete", props: { emoji: "🚀", x: 30, y: 200 } }, { typ: "figur", name: "stern", props: { emoji: "⭐", x: 200, y: 60 } }] },
      { typ: "zeile", name: "steuerung", kinder: [{ typ: "knopf", name: "links", props: { text: "◀" } }, { typ: "knopf", name: "hoch", props: { text: "▲" } }, { typ: "knopf", name: "runter", props: { text: "▼" } }, { typ: "knopf", name: "rechts", props: { text: "▶" } }] }] },
    pflicht: [
      { t: `Oberfläche: ein ${K("Spielfeld")} mit zwei ${K("Figuren")} (z. B. 🚀 und ⭐) und Steuer-Knöpfen.`, check: a => a.comp("spielfeld").length && a.comp("figur").length >= 2 && a.comp("knopf").length >= 2 },
      { t: `Jeder Steuer-Knopf: ${B("bewege rakete um x … y …")}.`, check: a => a.blocks.filter(b => b.type === "ww_bewege" && b.top && b.top.type === "ww_klick").length >= 2 },
      { t: `Nach dem Bewegen: ${B("wenn rakete berührt stern")} → Punkt dazu und ${B("setze stern an eine zufällige Stelle")}.`, check: a => a.blocks.some(b => b.type === "controls_if" && JSON.stringify(b.inputs).includes("ww_beruehrt_fig") && JSON.stringify(b.inputs).includes("ww_zufallpos")) },
      { t: "Die Punkte werden im Text angezeigt.", check: a => setText(a, ["ww_klick", "ww_alle"]) && a.has("math_change") }
    ],
    bonus: [
      { t: `Eine Zeit läuft ab: ${B("alle … Sekunden")} zählt die Zeit runter, bei 0 ist das Spiel vorbei.`, check: a => a.tops.some(t => t.type === "ww_alle") && (a.has("ww_stoppe") || a.has("ww_meldung")) },
      { t: "Eigene Figuren und Farben fürs Spielfeld.", check: a => a.comp("figur").some(f => !["🚀", "⭐"].includes(f.props.emoji)) || a.changed("spielfeld", "hintergrund", "#e0f2fe") }
    ],
    profi: [
      { t: `Ein Gegner bewegt sich von allein (${B("alle … Sekunden")} + ${B("bewege")}); berührt er die Rakete, ist das Spiel vorbei.`, check: a => a.inEvent("ww_alle", b => b.type === "ww_bewege" || b.type === "ww_zufallpos") && a.comp("figur").length >= 3 }
    ]
  },

  /* ================= App 7 ================= */
  {
    id: "a7", app: "a7", nr: 9, phase: "Apps bauen", icon: "🛠️", titel: "Nützliche App", wahl: true,
    alltag: "Etwas, das du wirklich benutzt: Hausaufgaben im Blick, konzentriert lernen, Vorfreude auf die Ferien.",
    echt: "To-do-Listen, Timer und Countdown-Apps gehören zu den meistbenutzten Apps überhaupt.",
    ziel: "Du kannst eine App bauen, die Daten auf dem Gerät speichert oder mit Zeit arbeitet.",
    lernen: `
      <p>Such dir <b>eine</b> von drei Apps aus (unten bei „Bau deine App“):</p>
      <div class="concept"><div><span class="big">📚</span><b>Hausaufgaben-Liste</b><small>${B("💾 speichere")} merkt sich die Liste – auch wenn die App zu ist</small></div>
        <div><span class="big">⏳</span><b>Lern-Timer</b><small>${B("alle … Sekunden")} zählt herunter, dann: Pause!</small></div>
        <div><span class="big">🏖️</span><b>Ferien-Countdown</b><small>${B("Tage bis zum …")} rechnet mit dem Kalender</small></div></div>
      <p>🔒 Was deine App speichert, bleibt <b>nur auf deinem Gerät</b>.</p>`,
    komps: ["text", "eingabe", "knopf", "liste", "zeile", "bild"],
    blocks: ["ww_start", "ww_klick", "ww_alle", "ww_auswahl", "ww_set", "ww_get", "ww_meldung", "ww_liste_zeigen", "ww_angetippt", "variables", "lists_create_empty", "ww_hinzu", "ww_entferne", "lists_length", "lists_getIndex", "ww_speichere", "ww_lade", "ww_jetzt", "ww_tagebis", "ww_stoppe", "controls_if", "controls_ifelse", "logic_compare", "logic_operation", "math_number", "math_arithmetic", "text", "text_join"],
    pflicht: [
      { t: "Wähle deine App (oben) und baue die Oberfläche dafür.", check: (a, p) => !!(p && p.wahl7) && a.comps.length >= 3 },
      { t: "📚 Hausaufgaben: Beim Start wird die Liste geladen, beim Hinzufügen gespeichert. ⏳ Timer: Jede Sekunde zählt die Zeit herunter. 🏖️ Countdown: Beim Start steht da „Noch … Tage“.",
        check: (a, p) => {
          const w = p && p.wahl7;
          if (w === "hausaufgaben") return inEv(a, "ww_start", b => b.type === "ww_lade") && inEv(a, "ww_klick", b => b.type === "ww_speichere");
          if (w === "timer") return inEv(a, "ww_alle", b => b.type === "math_change") && setText(a, "ww_alle");
          if (w === "countdown") return setTextWith(a, "ww_start", "ww_tagebis");
          return false;
        } },
      { t: "Die App zeigt etwas Sinnvolles an, wenn sie fertig ist / leer ist (z. B. Meldung „Pause!“ oder „Keine Hausaufgaben 🎉“).", check: a => a.has("controls_if") && (a.has("ww_meldung") || setText(a)) }
    ],
    bonus: [
      { t: "📚 Erledigtes antippen und entfernen · ⏳ Start-/Stopp-Knopf · 🏖️ ein zweites Datum (z. B. Geburtstag)", check: (a, p) => {
          const w = p && p.wahl7;
          if (w === "hausaufgaben") return a.tops.some(t => t.type === "ww_auswahl") && a.has("ww_entferne");
          if (w === "timer") return klickCount(a) >= 2;
          if (w === "countdown") return a.count("ww_tagebis") >= 2;
          return false;
        } },
      { t: "Gib der App einen eigenen Titel, Farben und ein passendes Bild.", check: (a, p) => a.screenChanged((WAHL7_SCREEN[(p || {}).wahl7]) || {}) && a.comp("bild").length >= 1 }
    ],
    profi: [
      { t: `Nutze ${B("aktuelle Stunde/Wochentag")}, z. B. „Guten Morgen“ vor 12 Uhr.`, check: a => a.has("ww_jetzt") }
    ]
  },

  /* ================= Abschluss ================= */
  {
    id: "s8", nr: 10, phase: "Abschluss", icon: "🎤", titel: "Abnahme & App-Messe", special: "s8",
    ziel: "Du kannst deine Apps erklären und anderen Rückmeldung zu ihren Apps geben.",
    pflicht: [{ t: "Ich habe mit dem Erklär-Training mindestens 5 Blöcke laut erklärt.", check: (a, p) => (p && p.training || 0) >= 5 }],
    bonus: []
  },
  {
    id: "b1", app: "eigen", nr: "★", phase: "Bonus", icon: "💡", titel: "Eigene App-Idee", bonus1: true,
    alltag: "Ein Problem aus deinem eigenen Alltag – gelöst mit einer selbst gebauten App.",
    echt: "So arbeiten echte App-Entwickler: Problem verstehen, skizzieren, bauen, testen lassen, verbessern.",
    ziel: "Du kannst eine eigene App-Idee planen, umsetzen, von anderen testen lassen und verbessern.",
    lernen: `
      <p>Freiwillig – bringt <b>Bonuspunkte</b>. Gehe vor wie echte App-Entwickler:</p>
      <ol class="tight"><li>🔎 <b>Problem:</b> Was nervt dich im Alltag oder was fehlt dir?</li><li>✏️ <b>Skizze:</b> Zeichne die Oberfläche auf Papier.</li>
        <li>🛠️ <b>Prototyp:</b> Bau die einfachste Version, die funktioniert.</li><li>🧪 <b>Test:</b> Lass jemanden die App benutzen – ohne zu helfen!</li><li>🔁 <b>Verbessern:</b> Bau mindestens eine Rückmeldung ein.</li></ol>`,
    komps: ["text", "knopf", "bild", "eingabe", "liste", "zeichenflaeche", "spielfeld", "figur", "zeile"],
    blocks: ["*", "variables"],
    pflicht: [
      { t: "Ich habe mein Problem in einem Satz aufgeschrieben (Feld oben).", check: (a, p) => ((p && p.idee) || "").trim().length >= 15 },
      { t: "Ich habe eine Skizze auf Papier gezeichnet." },
      { t: "Mein Prototyp funktioniert: mindestens 3 Bausteine und 2 Ereignisse.", check: a => a.comps.length >= 3 && a.tops.filter(t => WWC.EVENTS.includes(t.type)).length >= 2 },
      { t: "Jemand hat meine App getestet, und ich habe eine Verbesserung eingebaut." }
    ],
    bonus: []
  }
];
const PROJEKTE = STATIONEN.filter(s => s.app && !s.bonus1 && !s.uebung);
const WAHL7_SCREEN = { hausaufgaben: { titel: "Meine Hausaufgaben" }, timer: { titel: "Lern-Timer" }, countdown: { titel: "Ferien-Countdown", hintergrund: "#06b6d4" } };
const WAHL7 = [["hausaufgaben", "📚 Hausaufgaben-Liste"], ["timer", "⏳ Lern-Timer"], ["countdown", "🏖️ Ferien-Countdown"]];
