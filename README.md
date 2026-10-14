# App-Werkstatt (Digitale Medien, Jahrgang 8)

Eine Lernumgebung, in der Schülerinnen und Schüler mit Blöcken (Blockly) eigene kleine Apps programmieren. Stationen führen Schritt für Schritt durch Ereignisse, Variablen, Bedingungen und Listen. Ein Fehler-Detektiv hilft bei der Suche nach Problemen, und ein Notenvorschlag folgt Kriterien, die von Anfang an sichtbar sind. Fertige Apps lassen sich per QR-Code auf Handy oder Tablet öffnen.

- Schülerseite: `/` (Anmeldung mit Klasse, Vorname und vierstelliger PIN)
- Lehrkraft-Ansicht: `/lehrkraft.html`
- Inhalte ändern: Stationen in `public/stations.js`, Kriterien in `public/checks.js`, Blöcke in `public/blocks.js`

## Selbst hosten (Cloudflare)
Die Werkstatt läuft als Cloudflare Worker mit einer D1-Datenbank. Ein kostenloses Cloudflare-Konto reicht.

```
npm install -g wrangler
npx wrangler d1 create dm8-app-werkstatt --jurisdiction eu   # ausgegebene ID in wrangler.jsonc bei database_id eintragen
npx wrangler d1 execute dm8-app-werkstatt --remote --file schema.sql
npx wrangler secret put TEACHER_KEY   # Passwort für die Lehrkraft-Ansicht
npx wrangler secret put PIN_SALT      # beliebige lange Zufallszeichenkette
npx wrangler deploy
```

Die Klassen stehen in `wrangler.jsonc` unter `vars.KURSE` (kommagetrennt, zum Beispiel `8a,8b,demo`).

Lokal testen: `npx wrangler d1 execute dm8-app-werkstatt --local --file schema.sql`, dann eine Datei `.dev.vars` mit `TEACHER_KEY=...` und `PIN_SALT=...` anlegen und `npx wrangler dev` starten.

## Datenschutz
Gespeichert werden nur Vorname (bei Doppelten mit Nachnamen-Initial), ein PIN-Hash, der Code der Schülerinnen und Schüler, der Fortschritt und die Bewertung. Das sind personenbezogene Daten: Datenbank in der EU anlegen und den Einsatz mit der Datenschutz-Regelung deiner Schule abstimmen. Zum Schuljahresende lassen sich alle Daten in der Lehrkraft-Ansicht löschen.

## Online-Demo
Eine Demo auf GitHub Pages gibt es nicht, weil Anmeldung und Speichern einen Server brauchen.

## Für Lehrkräfte
Lösungen, den Lehrerzugang und passende Klausuren gebe ich gern an Lehrkräfte weiter. Schreib mir dazu einfach ein Issue hier im Repo oder eine Nachricht über GitHub.

## Lizenz
Inhalte CC BY 4.0, Namensnennung: Mr Brändt. Code MIT. Details in LICENSE und THIRD_PARTY.md.
