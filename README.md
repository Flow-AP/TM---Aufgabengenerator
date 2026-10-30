# TM Aufgabengenerator – Stereostatik

Ein Browser-Werkzeug zum Erstellen von Aufgabenskizzen aus der Technischen Mechanik (Statik starrer Körper)
im Lehrbuchstil. Tragwerke aus Balken, Stäben, Seilen und Federn werden per Drag & Drop zusammengesetzt,
mit Lagern, Gelenken, Lasten und Bemaßungen versehen und als SVG/PNG oder als Aufgabenblatt exportiert.

## Start

Keine Installation und kein Build nötig: `index.html` direkt im Browser öffnen (Chrome, Firefox, Edge, Safari).
Die aktuelle Aufgabe wird automatisch im Browser (localStorage) zwischengespeichert.

## Funktionen

| Bereich | Inhalt |
|---|---|
| Tragwerk | Balken (Kontur- oder Liniendarstellung), Stab (gelenkig), Seil, Feder |
| Lager | Festlager, Loslager, Loslager mit Rollen, Einspannung, Parallelführung, Pendelstütze |
| Verbindungen | Gelenk (M = 0), Schiebehülse (N = 0), drehbare Schiebehülse (N = 0, M = 0), Parallelführung / Querkraftgelenk (Q = 0), starre Ecken bei Rahmen |
| Seil & Masse | Rolle (frei drehbar), feste Trommel mit Seilreibung (Euler-Eytelwein, Grenzfall), Massenblock (G = m·g, hängend oder aufliegend) |
| Lasten | Einzelkraft (beliebige Richtung, optional mit Winkelangabe α), Moment (beide Drehsinne), Streckenlast (konstant, Dreieck, Trapez; senkrecht oder vertikal wirkend) |
| Bemaßung | Länge horizontal / vertikal / parallel (Maßzahl immer über der Maßlinie, ohne Einheit), Winkel mit Pfeilen zwischen Elementen, Kräften oder zur Horizontalen/Vertikalen; je Maß wählbar: Maßzahl, Symbol oder „Symbol = Maßzahl“ |
| Beschriftung | Knotennamen (A, B, …, auch automatisch), Elementbeschriftung (EI, 1, 2 …), freie Texte, Indizes `F_1`, `q_{0}`, Exponenten `x^2`, griechische Buchstaben `\alpha` |
| Export | SVG, PNG (3-fache Auflösung), Drucken / PDF mit Titel und Aufgabentext, Speichern/Laden als JSON |

## Durchrechnen und Lösung

Mit **Durchrechnen** (oder dem Reiter *Lösung*) wird die Aufgabe gelöst:

* **Statische Bestimmtheit:** Abzählkriterium *n = a + z − 3p* und zusätzlich eine Rangprüfung des
  Gleichungssystems. Ausnahmefälle (z. B. Lagerkräfte durch einen Punkt) werden erkannt.
  Ausgegeben wird „statisch bestimmt“, „x-fach statisch unbestimmt“ oder „kinematisch verschieblich“.
* **Lagerreaktionen, Gelenkkräfte, Stab- und Seilkräfte** (mit Zug/Druck). Ein Seil unter Druck wird gemeldet.
* **Schnittgrößen N, Q, M** als Diagramme, untereinander oder direkt am Tragwerk. Auch Rahmen sind möglich.
  Randwerte und Extremwerte sind beschriftet (Extremwert bei Q = 0 exakt bestimmt). Die gestrichelte Faser zeigt
  das Bezugssystem. Bei Fachwerken stehen die Stabkräfte direkt am Stab (Druckstäbe gestrichelt).
* **Gesuchte Lasten:** Kräfte, Momente oder Massen lassen sich als „gesucht“ markieren; ihr Betrag wird aus dem
  Gleichgewicht berechnet (z. B. Haltekraft an einer Seiltrommel).
* **Rollen und Trommeln:** Das Seil liegt tangential an. Bei einer freien Rolle sind beide Seilkräfte gleich. Bei
  einer festen Trommel gilt im Grenzfall S_groß = S_klein · e^(μα), der Umschlingungswinkel α wird aus der Geometrie bestimmt.
  Verschiebliche Systeme (Seil mit hängender Masse) werden gelöst, wenn die Belastung im Gleichgewicht ist.
* **Freikörperbild:** Lager werden durch die berechneten Reaktionskräfte ersetzt.
* **Freigeschnittene Teilsysteme:** Jeder starre Körper wird einzeln dargestellt, auseinandergezogen, mit seinen Lasten,
  Lagerreaktionen (rot) und den Verbindungskräften an Gelenken, Schiebehülsen, Seilen und Stäben (violett,
  actio = reactio). Auch diese Ansicht rechnet beim Ändern live mit.
* **Schnittgrößen gemeinsam oder je Teilsystem:** Wahlweise ein Diagrammsatz für das Gesamtsystem oder eigene
  N-, Q- und M-Diagramme für jedes Teilsystem, in derselben Anordnung wie beim Freischneiden.
* **Live-Anpassung:** Kraft entlang des Balkens ziehen, Richtung am runden Griff ändern, Knoten verschieben,
  Zahlenwerte im Bereich *Werte verändern* ändern – Lösung und Diagramme passen sich sofort an.
  Gleiche Grundgrößen bleiben gekoppelt (`F` und `2F`).
* **Zufallsvarianten:** neue Lastwerte, auf Wunsch auch neue Längen und Winkel (konsistent für `a`, `2a`, `l/2` …).
* **Drucken:** Aufgabe, Aufgabe + Lösung oder eine **Variantenserie** (je Variante ein Aufgabenblatt mit
  Zahlenwerten, Lösungen im Anhang).

Einheiten: Länge (mm, cm, m), Kraft (N, kN, MN) und Masse (g, kg, t) sind wählbar. Daraus ergeben sich die Einheiten
für Momente und Streckenlasten. Beim Wechsel der Kraft- oder Masseneinheit können die Lastwerte umgerechnet werden.
Die Längeneinheit benennt das Raster (1 Rasterlänge = 1 Längeneinheit). Einheiten werden nie kursiv und als „in kN“
geschrieben; Maße stehen ohne Einheit im Bild, die Längeneinheit erscheint im Aufgabentext. Streckenlasten beziehen sich auf die Elementlänge.

Vorzeichen: *x* von Knoten 1 nach Knoten 2 des Elements, *z* rechts davon (gestrichelte Faser).
N > 0 ist Zug. Q und M sind auf die gestrichelte Faser bezogen, M ist auf der Zugseite aufgetragen.

## Bedienung

* **Drag & Drop:** Bauteil aus der linken Palette auf die Zeichenfläche ziehen. Lager, Gelenke und Lasten
  rasten an Knoten ein; lässt man sie auf einem Balken fallen, wird dort automatisch ein Knoten eingefügt.
* **Zeichnen:** Balken/Stab/Seil in der Palette anklicken, dann Start- und Endpunkt klicken (zeichnet eine Kette,
  ideal für Rahmen) oder mit gedrückter Maustaste ziehen. `Shift` = 15°-Schritte.
* **Mitwachsen:** Alles hängt an Knoten. Wird ein Knoten gezogen oder ein Maß geändert, wachsen die angeschlossenen
  Balken, Stäbe und Seile mit; Lager, Lasten und Maße wandern mit.
* **Maße als Geometrie:** Maß auswählen und rechts den Zahlenwert ändern – die Konstruktion wird gestreckt
  (Option „Angehängte Teile mitbewegen“). Die angezeigte Bezeichnung (z. B. `a`, `2a`, `l/2`) ist davon unabhängig.
* **Verbinden:** Knoten auf einen anderen Knoten oder ein Element ziehen.
* **Verbindungen hervorheben:** Gelenke zwischen Tragwerksteilen, Schiebehülsen und Parallelführungen werden größer
  gezeichnet (Größe unter *Darstellung → Verbindungen* einstellbar).
* **Beschriftungen von Lasten** (F_1, q_0, M_1 …) lassen sich mit der Maus frei verschieben.
* **Winkel an Kräften:** Winkelwerkzeug, Kraft anklicken, dann ein Element am Angriffspunkt, eine zweite Kraft oder
  eine freie Stelle (Bezugsachse). Ändert man den Winkelwert, dreht sich die Kraft mit.
* **Ansicht:** Hintergrund ziehen, Mitteltaste oder Leertaste = verschieben, Mausrad = Zoom, `F` = einpassen.
* **Tasten:** `Entf` löschen, `R` drehen (Lager/Kraft), `H` Gelenk umschalten, `Esc` Werkzeug beenden,
  `Strg+Z` / `Strg+Y` rückgängig/wiederholen, `Strg+S` speichern.

## Aufbau

```
index.html        Oberfläche
css/style.css     Gestaltung
js/model.js       Datenmodell, Geometrie (Teilen, Verschmelzen, Strecken, Drehen)
js/render.js      SVG-Darstellung im Lehrbuchstil
js/solver.js      Gleichgewichtssystem, Bestimmtheitsprüfung, Schnittgrößen
js/values.js      Zahlenwerte, Einheiten, Gegeben-Liste, Zufallsvarianten
js/diagrams.js    Schnittgrößendiagramme, Freikörperbild
js/examples.js    Beispielaufgaben
js/app.js         Editor: Palette, Werkzeuge, Eigenschaften, Export
```

Das Dateiformat (JSON) enthält Knoten, Elemente, Lager, Lasten, Maße, Texte und Metadaten (Titel, Aufgabentext).
