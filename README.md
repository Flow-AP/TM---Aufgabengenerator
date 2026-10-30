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
| Verbindungen | Gelenk an beliebigen Knoten, starre Ecken bei Rahmen |
| Lasten | Einzelkraft (beliebige Richtung, optional mit Winkelangabe α), Moment (beide Drehsinne), Streckenlast (konstant, Dreieck, Trapez; senkrecht oder vertikal wirkend) |
| Bemaßung | Länge horizontal / vertikal / parallel, Winkel zwischen zwei Elementen oder zur Horizontalen/Vertikalen |
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
* **Freikörperbild:** Lager werden durch die berechneten Reaktionskräfte ersetzt.
* **Live-Anpassung:** Kraft entlang des Balkens ziehen, Richtung am runden Griff ändern, Knoten verschieben,
  Zahlenwerte im Bereich *Werte verändern* ändern – Lösung und Diagramme passen sich sofort an.
  Gleiche Grundgrößen bleiben gekoppelt (`F` und `2F`).
* **Zufallsvarianten:** neue Lastwerte, auf Wunsch auch neue Längen und Winkel (konsistent für `a`, `2a`, `l/2` …).
* **Drucken:** Aufgabe, Aufgabe + Lösung oder eine **Variantenserie** (je Variante ein Aufgabenblatt mit
  Zahlenwerten, Lösungen im Anhang).

Zahlenwerte: Kräfte in *kN*, Momente in *kNm*, Streckenlasten in *kN/m* (Einheiten einstellbar). Die Länge im
Raster entspricht der Länge in Metern. Streckenlasten beziehen sich auf die Elementlänge.

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
