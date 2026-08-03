/**
 * Tenkeord: det som står ved prikken mens spørrefunksjonen jobber.
 *
 * «Tolker spørsmålet …» sa sant, men sa det på samme måte hver gang, og etter
 * tredje spørsmål leser man det ikke lenger. Disse gjør samme jobb, men på
 * språket til byen de handler om.
 *
 * ## Hvor ordene kommer fra
 *
 * Ordlista er levert av prosjekteieren: sunnmørske og ålesundske ord og uttrykk
 * med forklaring. Den erstatter forrige runde, der ordene var normert nynorsk
 * med Ålesunds arbeidsvokabular fordi kilden vi ville bruke, dialektordboka
 * «Fole kaule!», ikke lar seg lese hos Nasjonalbiblioteket.
 *
 * ## Regelen som holder lista ærlig
 *
 * **Hvert ord står i den formen kilden ga det.** Der lista inneholder en ferdig
 * setning brukes den ordrett: «Ej he fole låkt i haude», «Ka e ditte for nåke»,
 * «Han sit og maular småsei», «Nedi djupaste kavet». Der den gir et fast uttrykk
 * står det urørt: «I eit hattefok», «Mo plitt åleine», «Lått og løye». Resten er
 * substantiv og adjektiv satt sammen med ord som ikke trenger bøying.
 *
 * Der en form måtte bøyes er den slått opp i Nynorskordboka, ikke gjettet:
 * *andøve* blir **andøver** (ikke «andøvar»), *vente* blir **ventar**. Fire ord
 * i lista finnes ikke i ordboka i det hele tatt — *våe*, *kjantre*, *kjave* og
 * *læke* — og de brukes derfor bare i den formen kilden ga dem, eller ikke.
 *
 * Bakgrunnen for regelen: forrige liste ble skrevet fra hukommelsen, og seks av
 * formene var gale på en måte en lokal leser ville sett med en gang. Én slik
 * runde holder.
 *
 * ## Hvorfor disse og ikke andre
 *
 * Ordlista er mye lengre enn dette. Utvalget er de som sier noe om **å holde på
 * med noe** — venting, leting, slit, uro, vær som ikke gir seg. Ord om folk og
 * lynne er stort sett utelatt: de beskriver noen, og her er det ingen å beskrive.
 *
 * To av dem er lista på sitt beste. *Andøve* er «å holde båten på samme plass
 * mot vind eller strøm, gjerne over en fiskeplass» — det er nøyaktig hva en
 * ventestripe gjør. *Føreferd* er «at man synes man hører en person komme like
 * før personen faktisk ankommer», altså vardøger. Et svar som er i ferd med å
 * komme har ikke noe bedre navn enn det.
 */

export const thinkingWords: string[] = [
  // ── Havet og båten. Andøve: holde båten i ro over fiskeplassen.
  "Andøver over staden",
  "Nedi djupaste kavet",
  "Vøe i sjøen",
  "Våe nota",
  "Agnalj på kroken",
  "Ein hysehip",
  "Nedi ei gjøtt",
  "Auster i botnen",
  "Litt gisen i botnen",
  "Ein slenter i sundet",

  // ── Vêret. Dombe er støv som fyker, opplett er pausen mellom bygene,
  //    skotung er skybanken som varsler ruskevær.
  "Dombe i arkivet",
  "Ventar på opplett",
  "Skotung i horisonten",
  "Ei tynnaknute gjennom tala",
  "Skjellje frå nord",
  "Bleik på himmelen",
  "Dape og depel",
  "Ei pøyte her og der",

  // ── Landskapet. Ein reit er eit lite jordstykke: eitt om gongen.
  "Ein reit om gongen",
  "Rabb og reine",
  "Opp mot skogavakset",
  "Himmelsjå i vest",

  // ── Slit og uro. Ykt er eit avgrensa arbeidsøkt, hattefok er full fart,
  //    trongsteg er å stå fast.
  "Ein ykt til",
  "Fole forkava",
  "I eit hattefok",
  "I trongsteg",
  "Skalte og valte",
  "Ha haudbròt",
  "Trebole i handa",
  "Hækjen på tal",

  // ── Kraftuttrykk. Årre står så sterkt i Ålesund at to badstuer heiter
  //    «Årre» og «Heite».
  "Årre",
  "Årre heite",
  "Årre steikje",
  "Hute dej",
  "Få dånedimpen",
  "Fekk seg ein kjøl",
  "Stadig ballong",
  "Lått og løye",
  "Mo plitt åleine",
  "Oppi inkje",

  // ── Setningane frå lista, ordrett. «Ej he fole låkt i haude» er nærmast
  //    standardeksempelet på sunnmørsk.
  "Ej he fole låkt i haude",
  "Ka e ditte for nåke",
  "Dæ va fole te kaule",
  "Korleis gjenge det",
  "Du treng ikkje ha attelet",
  "Han sit og maular småsei",
  "Det verte bra",
  "Ikkje heilt i pussentur",
  "Fy for ein tæv",

  // ── Tid og tilkomst. Førdags er i forgårs, førårs er året før i fjor, og
  //    føreferd er vardøger: at nokon er i ferd med å kome.
  "Føreferd av eit svar",
  "Førdags og førårs",
  "Keiveleg, ditte",
  "Abakela tal",

  // ── Kvardag.
  "Bunding og kaffi",
  "Ei mataså",
  "Rabbestappe etterpå",
  "Kippesko i dag",
  "Over kløppen",
  "Løyent, ditte",
];
