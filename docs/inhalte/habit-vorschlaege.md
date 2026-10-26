# Habit-Vorschläge für das Tagebuch — Entwurf zur Prüfung

Stand 26.10.2026 · **eingebaut mit Migration 0029**, außer fünf Vorschlägen,
die das Team gestrichen hat: Geraucht oder gedampft, Mund mit Tape verschlossen
geschlafen, Länger als 48 Stunden gefastet, Nach dem Fasten überessen,
Atemmuskeltraining (IMST). Sie bleiben unten zur Nachvollziehbarkeit stehen und
sind mit ~~Durchstreichung~~ markiert. Die Texte in der App sind für Nutzer
umformuliert; maßgeblich ist die Migration bzw. danach das Studio.

## Wie bewertet wurde

**Blickwinkel:** Peter Attia (*Outlive*, „Medicine 3.0“). Er ist der
bekannteste Arzt, der Longevity als tägliche Praxis denkt, und seine
Rangordnung ist klar: Bewegung, vor allem Kraft und kardiorespiratorische
Fitness, ist der stärkste Hebel. Danach kommen Schlaf, Ernährung (mit Fokus
auf ausreichend Protein und Muskelerhalt) und emotionale Gesundheit. Fasten
sieht er heute nüchterner als früher, weil es Muskel kosten kann.
Die Punkte unten sind **meine Einordnung in seinem Rahmen**, keine Zitate von
ihm.

**Punkte:** Positive Habits bringen 2 bis 10 Punkte. Das Tageslimit jeder
Kategorie liegt bei 20, also füllen zwei starke Habits einen Tag. Je größer
der Hebel auf gesunde Lebensjahre, desto mehr Punkte. Negative Habits ziehen
2 bis 10 Punkte ab, abgestuft nach dem Schaden.

**Evidenz:** stark = randomisierte Studien oder große Metaanalysen ·
mittel = große Kohorten mit konsistentem Bild · schwach = kleine Studien,
Plausibilität. Fast alle Mortalitätsdaten sind Beobachtungsstudien. Sie
zeigen Zusammenhänge, keine bewiesenen Ursachen.

**Art:** ✓ = abhaken (`done`) · # = Zahl eintragen (`number`).

> **Entschieden 26.10.2026:** Das Vorzeichen hängt am Habit
> (`habit_templates.is_negative`, Migration 0028), die sieben Kategorien
> bleiben. Gewinn und Abzug werden je Kategorie getrennt auf ihr Limit
> gedeckelt (SAD, Habit Score Tracker).

---

## 1. Atmung

Die Kategorie hat schon „BOLT-Wert ermitteln“ und „Atmen zum Einschlafen“;
die Vorschläge ergänzen sie, statt sie zu doppeln.

| | Habit | Art | Punkte | Warum | Evidenz |
|---|---|---|---|---|---|
| + | ~~**Atemmuskeltraining (IMST):** 30 kräftige Einatmungen gegen Widerstand~~ *(gestrichen)* | ✓ | 10 | In einer randomisierten Studie (Craighead 2021, *JAHA*) senkten 5 Minuten am Tag den systolischen Blutdruck um rund 9 mmHg, so viel wie Ausdauertraining. Braucht ein Trainingsgerät. | stark (kleine RCTs) |
| + | **Langsam atmen:** 10 Minuten mit etwa 6 Atemzügen pro Minute | ✓ | 8 | Metaanalyse aus 17 RCTs: Blutdruck sinkt im Mittel um rund 5,6/3 mmHg. Bluthochdruck ist einer der stärksten Risikofaktoren für Herz und Gehirn. | mittel |
| + | **Cyclic Sighing:** 5 Minuten, zweimal kurz einatmen, lang ausatmen | ✓ | 6 | Randomisierte Studie (Balban 2023, *Cell Reports Medicine*): bessere Stimmung, niedrigere Atemfrequenz, wirksamer als Meditation gleicher Länge. | mittel |
| + | **Zone 2 durch die Nase:** Ausdauereinheit nur mit Nasenatmung | ✓ | 4 | Hält die Intensität verlässlich im Fettstoffwechsel-Bereich, ohne Pulsuhr. Der eigentliche Hebel ist das Ausdauertraining (siehe Bewegung). | schwach |
| + | **Bewusste Atempause:** dreimal am Tag eine Minute ruhig ausatmen | ✓ | 3 | Kleine Unterbrechung der Stressreaktion. Vor allem nützlich als Gewohnheitsanker. | schwach |
| − | ~~**Geraucht oder gedampft**~~ *(gestrichen)* | ✓ | −10 | Der größte einzelne vermeidbare Schaden überhaupt: Herz, Lunge, Krebs, Gefäße. Gehört hierher, weil es über die Atemwege wirkt. | stark |
| − | **Atemanhalten im oder unter Wasser,** vor allem nach Hyperventilieren | ✓ | −8 | Gefahr der Bewusstlosigkeit ohne Vorwarnung (Schwimmbad-Blackout). Seltenes Ereignis, aber tödlich, und für eine Atem-App besonders wichtig auszusprechen. | stark (Mechanismus, Fallberichte) |
| − | ~~**Mund mit Tape verschlossen geschlafen**~~ *(gestrichen)* | ✓ | −3 | Systematische Übersicht 2025 (*PLOS ONE*, 10 Studien): kaum Nutzen, möglicher Schaden bei verengter Nase oder unerkannter Schlafapnoe. | mittel |

## 2. Ernährung

| | Habit | Art | Punkte | Warum | Evidenz |
|---|---|---|---|---|---|
| + | **Protein-Ziel erreicht:** etwa 1,2 bis 1,6 g pro kg Körpergewicht | ✓ | 10 | Attias wichtigster Ernährungspunkt: Muskel ist ein Organ der Langlebigkeit, und im Alter steigt der Bedarf (anabole Resistenz). Ab etwa 1,6 g/kg flacht der Zusatznutzen beim Krafttraining ab (Morton 2018). | stark |
| + | **Mindestens 30 g Ballaststoffe** (Hülsenfrüchte, Vollkorn, Gemüse) | ✓ | 8 | Lancet-Metaanalyse (Reynolds 2019): 15 bis 30 % weniger Sterblichkeit, Herzerkrankungen, Typ-2-Diabetes und Darmkrebs bei der höchsten Zufuhr; der größte Nutzen liegt bei 25 bis 29 g und darüber. | stark |
| + | **Fünf Handvoll Gemüse und Obst** | ✓ | 6 | Bis etwa 800 g am Tag sinkt die Sterblichkeit weiter (Aune 2017). | mittel |
| + | **Eine Handvoll Nüsse** | ✓ | 4 | Etwa 20 g am Tag gehen mit weniger Herz-Kreislauf-Erkrankungen und geringerer Sterblichkeit einher (Aune 2016). Mit PREDIMED auch durch eine randomisierte Studie zur Mittelmeerkost gestützt. | mittel |
| + | **Fettfisch gegessen** (Lachs, Makrele, Hering, Sardine) | ✓ | 3 | Omega-3-Quelle. Als Wochenziel gedacht (zweimal), daher wenige Punkte pro Tag. | mittel |
| − | **Süßgetränk getrunken** (Limo, Eistee, Energydrink, Saft mit Zuckerzusatz) | ✓ | −8 | Konsistent mit Diabetes, Gewichtszunahme und höherer Sterblichkeit verbunden. Flüssiger Zucker sättigt nicht. | stark |
| − | **Verarbeitetes Fleisch gegessen** (Wurst, Speck, Schinken) | ✓ | −6 | Die Gruppe hochverarbeiteter Lebensmittel mit dem stärksten Zusammenhang zur Sterblichkeit (Fang 2024, *BMJ*); von der WHO als krebserregend eingestuft. | stark |
| − | **Alkohol getrunken** | ✓ | −6 | Kein Schutzeffekt bei geringer Menge (Zhao 2023, *JAMA Netw Open*), dafür Schaden für Schlaf, Leber und Krebsrisiko. Attia rät zu so wenig wie möglich. Bei Frauen steigt das Risiko schon ab geringeren Mengen. | stark |

## 3. Fasten

Hier ist die Evidenz für Langlebigkeit beim Menschen am dünnsten. Der Nutzen
kommt vor allem über weniger Essen und bessere Essenszeiten, nicht über eine
eigene „Fasten-Wirkung“. Deshalb sind die Punkte bewusst niedriger angesetzt
als in Bewegung oder Schlaf.

| | Habit | Art | Punkte | Warum | Evidenz |
|---|---|---|---|---|---|
| + | **Drei Stunden vor dem Schlafen nichts mehr gegessen** | ✓ | 8 | Ein spätes Abendessen erhöht Blutzucker und Cortisol in der Nacht (randomisierte Crossover-Studie, 22 Uhr gegen 18 Uhr). Hilft gleichzeitig dem Schlaf. | mittel |
| + | **12 Stunden Nachtfasten** (z. B. 20 bis 8 Uhr) | ✓ | 6 | Ein sanftes, für fast alle sicheres Fenster. Längere Fenster brachten in der TREAT-Studie (Lowe 2020) keinen Vorteil beim Abnehmen. | mittel |
| + | **Früh essen:** Hauptmahlzeiten vor 18 Uhr | ✓ | 5 | Frühes zeitbeschränktes Essen verbesserte in einer kontrollierten Studie Insulinempfindlichkeit und Blutdruck, auch ohne Gewichtsverlust (Sutton 2018). | mittel (kleine RCTs) |
| + | **Das Fasten mit Protein gebrochen** (mindestens 30 g) | ✓ | 5 | Schützt vor dem Hauptrisiko des Fastens, dem Muskelverlust. | mittel |
| + | **Keine Zwischenmahlzeiten** | ✓ | 3 | Weniger Insulinspitzen, weniger unbemerkte Kalorien. Eher Gewohnheitshilfe als eigener Hebel. | schwach |
| − | **Gefastet, aber Protein-Ziel verfehlt** | ✓ | −8 | In der TREAT-Studie entfiel ein großer Teil des Gewichtsverlusts auf Muskel. Weniger Muskel wiegt für die Langlebigkeit schwerer als jeder Fastennutzen. | mittel |
| − | ~~**Länger als 48 Stunden gefastet, ohne ärztliche Begleitung**~~ *(gestrichen)* | ✓ | −6 | Muskelverlust, Elektrolytstörungen, bei Vorerkrankungen oder Medikamenten (z. B. Diabetes) gefährlich. | mittel |
| − | ~~**Nach dem Fasten überessen** (Heißhunger, große Zuckermahlzeit)~~ *(gestrichen)* | ✓ | −4 | Macht das Defizit zunichte und belastet den Blutzucker. Oft ein Zeichen, dass das Fenster zu streng ist. | schwach |

## 4. Bewegung

Für Attia der wichtigste Bereich. Kardiorespiratorische Fitness (VO2max) ist
einer der stärksten bekannten Prädiktoren für Lebenserwartung.

| | Habit | Art | Punkte | Warum | Evidenz |
|---|---|---|---|---|---|
| + | **Zone-2-Ausdauer:** 45 Minuten, so dass man noch sprechen kann | ✓ | 10 | Kern von Attias Programm (etwa 3 Stunden pro Woche). Baut die aerobe Basis und die Mitochondrien auf. | stark |
| + | **VO2max-Intervalle:** 4 × 4 Minuten an der Grenze, 4 Minuten Pause | ✓ | 10 | Hebt die VO2max am stärksten. Attia empfiehlt eine Einheit pro Woche, deshalb als Wochenhabit gedacht. Einstieg erst nach einigen Wochen Zone 2. | stark |
| + | **Schritte** | # | 6 | Lancet-Metaanalyse 2025 (Ding): 7.000 statt 2.000 Schritte, rund 47 % weniger Sterblichkeit. Der Nutzen flacht ab 5.000 bis 7.000 ab. Vorschlag: Ziel 7.000. | stark |
| + | **Kurze Belastungsspitzen im Alltag:** dreimal 1 bis 2 Minuten richtig schnaufen (Treppe, Rad bergauf) | ✓ | 5 | Bei sonst nicht trainierenden Menschen 38 bis 40 % weniger Sterblichkeit (Stamatakis 2022, *Nature Medicine*). Ideal für Einsteiger. | mittel |
| + | **Gleichgewicht:** 2 Minuten auf einem Bein pro Seite | ✓ | 4 | Wer mit 51 bis 75 Jahren keine 10 Sekunden auf einem Bein steht, hatte ein deutlich höheres Sterberisiko (Araújo 2022, *BJSM*). Stürze sind im Alter eine der häufigsten Todesursachen durch Verletzung. | mittel |
| − | **Mehr als 60 Minuten am Stück gesessen** | ✓ | −6 | Langes, ununterbrochenes Sitzen schadet unabhängig vom Sport. Erst rund eine Stunde Bewegung am Tag gleicht viel Sitzen aus (Ekelund 2016, *Lancet*). | mittel |
| − | **Mehr als 3 Stunden fernsehen oder streamen** | ✓ | −6 | In derselben Metaanalyse die schädlichste Form des Sitzens, schwerer auszugleichen als Sitzen bei der Arbeit. | mittel |
| − | **Unter 4.000 Schritten geblieben** | ✓ | −4 | Unterhalb davon steigt das Risiko steil an. Eher Warnsignal als Strafe; Krankheitstage sollten das Habit pausieren können. | mittel |

## 5. Muskeltraining

| | Habit | Art | Punkte | Warum | Evidenz |
|---|---|---|---|---|---|
| + | **Krafttraining Ganzkörper,** schwer genug, dass die letzten Wiederholungen hart sind | ✓ | 10 | Metaanalyse (Momma 2022, *BJSM*): 10 bis 17 % weniger Sterblichkeit, der größte Nutzen bei 30 bis 60 Minuten pro Woche. Attia: der wichtigste Einzelbaustein. | stark |
| + | **Beine und Hüfte schwer:** Kniebeuge, Kreuzheben, Ausfallschritt | ✓ | 8 | Beinkraft entscheidet, ob man mit 80 noch vom Boden aufsteht. Schwere Belastung erhält außerdem die Knochendichte. | stark |
| + | **Griffkraft trainiert:** Farmer's Walk oder Hängen an der Stange | ✓ | 6 | Griffkraft ist ein starker Marker: je 5 kg weniger, rund 16 % höhere Sterblichkeit (Leong 2015, *Lancet*, PURE). Training des Markers zeigt nicht automatisch die gleiche Wirkung, verbessert aber Alltagskraft. | mittel |
| + | **Aufsteh-Test geübt:** ohne Hände vom Boden aufstehen | ✓ | 4 | Weniger Stützpunkte beim Aufstehen gingen mit niedrigerer Sterblichkeit einher (Brito 2014). Übt Kraft, Beweglichkeit und Gleichgewicht zugleich. | mittel |
| + | **Stabilität und Mobilität:** 10 Minuten Rumpf, Schultern, Füße | ✓ | 3 | Bei Attia das Fundament: es schützt vor Verletzungen, die ein Training monatelang stoppen. | schwach |
| − | **Mit Schmerz oder ohne Aufwärmen schwer trainiert** | ✓ | −8 | Für Attia ist eine Verletzung der größte Rückschlag: Monate Pause kosten mehr als jede verpasste Einheit. | mittel |
| − | **Sieben Tage ohne Krafteinheit** | ✓ | −5 | Kraft und Muskel bauen mit dem Alter schneller ab; Regelmäßigkeit schlägt Intensität. Als Wochenhabit gedacht. | mittel |
| − | **Viel Alkohol nach dem Training** | ✓ | −4 | Bremst den Muskelaufbau messbar, auch mit Protein (Parr 2014). | schwach |

## 6. Schlaf

| | Habit | Art | Punkte | Warum | Evidenz |
|---|---|---|---|---|---|
| + | **Feste Schlafenszeit:** innerhalb von 30 Minuten der eigenen Zeit | ✓ | 10 | Schlafregelmäßigkeit sagte die Sterblichkeit besser voraus als die Schlafdauer: 20 bis 48 % weniger Sterblichkeit (Windred 2024, UK Biobank, 60.977 Personen). | mittel (groß, objektiv gemessen) |
| + | **7 bis 9 Stunden geschlafen** | # | 8 | Zu kurzer Schlaf verschlechtert Blutzucker, Blutdruck, Appetit und Erholung. Attia zählt Schlaf zu den vier großen Säulen. | stark |
| + | **Morgens Tageslicht:** 10 Minuten draußen, innerhalb einer Stunde nach dem Aufstehen | ✓ | 5 | Stellt die innere Uhr, macht abends früher müde. | mittel |
| + | **Kühles, dunkles Schlafzimmer** (etwa 18 °C, Handy draußen) | ✓ | 4 | Einfache Umgebungsfaktoren für tieferen Schlaf. | schwach |
| + | **Abendroutine:** 30 Minuten ohne Bildschirm vor dem Licht-Aus | ✓ | 4 | Erleichtert das Einschlafen. „Atmen zum Einschlafen“ passt hinein. | schwach |
| − | **Koffein weniger als 8 Stunden vor dem Schlafen** | ✓ | −6 | Schon 6 Stunden vorher kostete es über eine Stunde Schlaf, ohne dass es die Testpersonen bemerkten (Drake 2013). | mittel (kleine Studie) |
| − | **Alkohol in den 3 Stunden vor dem Schlafen** | ✓ | −6 | Man schläft schneller ein, aber die zweite Nachthälfte wird unruhig, und der Ruhepuls bleibt höher. | stark |
| − | **Handy im Bett benutzt** | ✓ | −4 | Längere Einschlafzeit, mehr Wachphasen, schlechtere Herzratenvariabilität (2022, Ring-Messungen; Effekt nur im Bett, nicht davor). | mittel |

## 7. Stressmanagement

| | Habit | Art | Punkte | Warum | Evidenz |
|---|---|---|---|---|---|
| + | **Echte Zeit mit Menschen,** die einem wichtig sind (persönlich oder Anruf) | ✓ | 10 | Starke soziale Bindungen: rund 50 % höhere Überlebenschance (Holt-Lunstad 2010, 148 Studien). Ein Effekt in der Größenordnung des Rauchens. Attia nennt emotionale Gesundheit die meist übersehene Säule. | mittel (groß, konsistent) |
| + | **Meditation oder Achtsamkeitsübung:** 10 Minuten | ✓ | 6 | Metaanalyse 2024: niedrigerer Blutdruck bei erhöhten Werten, weniger Stress und Angst. Viele Studien mit Qualitätsmängeln. | mittel |
| + | **Zeit in der Natur** (Ziel: 120 Minuten pro Woche) | # | 5 | Ab 120 Minuten pro Woche deutlich häufiger gute Gesundheit und Wohlbefinden (White 2019, 19.806 Personen). Querschnitt, keine bewiesene Ursache. | schwach |
| + | **Drei Dinge aufgeschrieben, für die ich dankbar bin** | ✓ | 3 | Kleine, gut belegte Stimmungsübung; passt zur Idee eines Tagebuchs. | schwach |
| + | **Arbeit bewusst beendet:** feste Uhrzeit, danach keine Mails | ✓ | 3 | Erholung braucht Abschalten. Vor allem ein Schutz vor dauerhaftem Stress. | schwach |
| − | **Ganzer Tag ohne echten Kontakt** zu einem anderen Menschen | ✓ | −6 | Soziale Isolation, Einsamkeit und Alleinleben hängen jeweils für sich mit früherem Tod zusammen (Holt-Lunstad 2015, 3,4 Mio. Personen). | mittel |
| − | **Mehr als 30 Minuten Doomscrolling** (Nachrichten, Social Media ohne Ziel) | ✓ | −4 | Bei Erwachsenen ohne Vorbelastung später mehr depressive Symptome (*JAMA Netw Open* 2021). Ursache und Richtung sind nicht geklärt. | schwach |
| − | **Mit Alkohol oder Essen gegen Stress** | ✓ | −4 | Doppelter Schaden: das Problem bleibt, die Folgen kommen dazu. | schwach |

---

## Was mir bei der Prüfung auffallen würde

- **Medizinische Grenze:** Mehrere Habits (Atemmuskeltraining, Fasten über
  48 h, VO2max-Intervalle) sind für Menschen mit Herz-, Lungen- oder
  Stoffwechselerkrankungen nicht ohne Rücksprache geeignet. Die Beschreibung
  in der App sollte das sagen, ähnlich wie beim BOLT-Wert.
- **Atemmuskeltraining braucht ein Gerät.** Ein Habit, das ohne Kauf nicht
  geht, passt vielleicht nicht als Vorschlag.
- **Wochenhabits:** VO2max-Intervalle, Fettfisch und „Sieben Tage ohne
  Krafteinheit“ sind eigentlich Wochenziele. Das Tagebuch kennt heute nur
  Tage. Die Punkte sind daher pro Erledigung gedacht, gedeckelt durch das
  Wochenlimit der Kategorie.
- **Gewicht und Protein:** „Protein-Ziel erreicht“ setzt voraus, dass die
  Person ihr Gewicht kennt. Gefragt oder gespeichert wird es nicht.
- **Doppelt gezählt:** Alkohol taucht in Ernährung, Schlaf, Muskeltraining
  und Stress auf. Wer alle Kategorien führt, würde für ein Glas Wein bis zu
  viermal abgezogen. Vermutlich sollte nur eine Stelle übrig bleiben.
- **Rauchen** passt inhaltlich in keine Kategorie richtig; unter Atmung steht
  es, weil es dort am nächsten liegt.
- **Ton:** Abzüge können sich wie Bestrafung anfühlen. Die App beschreibt
  sich als „Regelmäßigkeit schlägt Perfektion“; zu viele negative Habits
  passen nicht ganz dazu.

## Quellen

- Ding et al. 2025, Daily steps and health outcomes, *Lancet Public Health*: <https://pubmed.ncbi.nlm.nih.gov/40713949/>
- Momma et al. 2022, Muscle-strengthening activities and mortality, *BJSM*: <https://bjsm.bmj.com/content/56/13/755>
- Windred et al. 2024, Sleep regularity and mortality, *Sleep*: <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10782489/>
- Stamatakis et al. 2022, VILPA and mortality, *Nature Medicine*: <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9800274/>
- Balban et al. 2023, Cyclic sighing, *Cell Reports Medicine*: <https://pmc.ncbi.nlm.nih.gov/articles/9873947/>
- Slow breathing and blood pressure, Metaanalyse 2019: <https://pubmed.ncbi.nlm.nih.gov/31331557/>
- Reynolds et al. 2019, Carbohydrate quality, *Lancet*: <https://discovery.dundee.ac.uk/ws/files/30375889/Final_Lancet_for_John.pdf>
- Fang et al. 2024, Ultra-processed food and mortality, *BMJ*: <https://pmc.ncbi.nlm.nih.gov/articles/PMC11077436>
- Zhao et al. 2023, Alcohol and all-cause mortality, *JAMA Netw Open*: <https://www.healio.com/news/primary-care/20230405/metaanalysis-alcohol-consumption-does-not-lower-allcause-mortality-risk>
- Morton et al. 2018 und Empfehlungen für Ältere (Protein): <https://pmc.ncbi.nlm.nih.gov/articles/PMC10272976>
- Lowe et al. 2020, TREAT, *JAMA Intern Med*: <https://pace-cme.org/news/no-difference-in-weight-loss-or-metabolic-markers-with-time-restricted-eating/2455829>
- Spätes Abendessen und Blutzucker (randomisierte Crossover-Studie): <https://hcplive.com/view/late-dinners-increase-blood-glucose-could-promote-obesity>
- AHA 2024, Kritik an der Beobachtung zu 8-Stunden-Essensfenster: <https://www.nutritioninsight.com/news/scientists-dispute-study-linking-time-restricted-eating-to-poor-heart-health.html>
- Drake et al. 2013, Koffein 6 Stunden vor dem Schlafen: <https://pmc.ncbi.nlm.nih.gov/articles/PMC3805807/>
- Smartphone im Bett und Schlaf (2022): <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9643910/>
- Mouth Taping, systematische Übersicht 2025, *PLOS ONE*: <https://pmc.ncbi.nlm.nih.gov/articles/PMC12094774>
- Holt-Lunstad 2010, Social relationships and mortality: <https://cdr.lib.unc.edu/concern/articles/7d2792359?locale=en>
- Holt-Lunstad 2015, Einsamkeit und Isolation (APA): <https://www.apa.org/news/press/releases/2017/08/lonely-die>
- Achtsamkeit und Blutdruck, Metaanalyse 2024: <https://doaj.org/article/04a4e555123e458a855f13b5b648bf96>
- White et al. 2019, 120 Minuten Natur: <https://pmc.ncbi.nlm.nih.gov/articles/PMC6565732>
- Social Media und depressive Symptome, *JAMA Netw Open* 2021: <https://pmc.ncbi.nlm.nih.gov/articles/PMC8611479>
- Sitting-Rising-Test und One-Leg-Stand (Araújo): <https://fortune.com/well/2023/03/23/can-sit-stand-test-predict-how-long-you-will-live>
- Attias Bewegungsrahmen (Stabilität, Zone 2, Zone 5, Kraft): <https://peterattiamd.com/exercising-for-longevity/comment-page-1/>

Aus der Fachliteratur ergänzt, in dieser Recherche nicht erneut aufgerufen:
Craighead 2021 (*JAHA*, Atemmuskeltraining), Aune 2016/2017 (Nüsse, Obst und
Gemüse), Sutton 2018 (*Cell Metabolism*, frühes Essensfenster), Ekelund 2016
(*Lancet*, Sitzen und Fernsehen), Leong 2015 (*Lancet*, Griffkraft), Parr 2014
(*PLOS ONE*, Alkohol und Muskelaufbau), Brito 2014 (Sitting-Rising-Test). Diese
Angaben vor einer Veröffentlichung bitte gegen die Originale prüfen.
