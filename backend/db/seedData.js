const neighbourhoods = [
  {
    id: "altstadt",
    name_de: "Altstadt",
    name_en: "Old Town",
    center: [48.1374, 11.5755],
    description_de: "Das historische Herz Münchens rund um den Marienplatz",
    description_en: "Munich's historic heart around Marienplatz"
  },
  {
    id: "maxvorstadt",
    name_de: "Maxvorstadt",
    name_en: "Maxvorstadt",
    center: [48.1497, 11.5655],
    description_de: "Universitätsviertel mit Museen und Studenten-Lokalen",
    description_en: "University quarter with museums and student bars"
  },
  {
    id: "schwabing",
    name_de: "Schwabing",
    name_en: "Schwabing",
    center: [48.1620, 11.5810],
    description_de: "Bohemisches Viertel mit dem Englischen Garten",
    description_en: "Bohemian quarter with the English Garden"
  },
  {
    id: "isarvorstadt",
    name_de: "Isarvorstadt",
    name_en: "Isarvorstadt",
    center: [48.1285, 11.5680],
    description_de: "Trendiges Viertel rund um den Gärtnerplatz",
    description_en: "Trendy neighbourhood around Gärtnerplatz"
  }
];

const venues = [
  // ALTSTADT
  {
    id: "v001",
    name: "Hofbräuhaus",
    type: "beer_hall",
    neighbourhood_id: "altstadt",
    address: "Platzl 9, 80331 München",
    lat: 48.1378,
    lng: 11.5799,
    opening_hours: "Mo–So 9:00–23:30",
    website: "https://www.hofbraeuhaus.de",
    beers: [
      { brand: "Hofbräu", size_05: 6.20, size_mass: 12.40, updated: "2025-03-15", reports: 8 }
    ],
    description_de: "Das weltberühmte Wirtshaus am Platzl – ein Münchner Original seit 1589.",
    description_en: "The world-famous inn at Platzl — a Munich original since 1589."
  },
  {
    id: "v002",
    name: "Viktualienmarkt Biergarten",
    type: "beer_garden",
    neighbourhood_id: "altstadt",
    address: "Viktualienmarkt 6, 80331 München",
    lat: 48.1351,
    lng: 11.5760,
    opening_hours: "Mo–Sa 10:00–22:00 (saisonal)",
    website: "",
    beers: [
      { brand: "Augustiner / Paulaner / Hofbräu (rotierend)", size_05: 5.30, size_mass: 10.60, updated: "2025-04-20", reports: 5 }
    ],
    description_de: "Mitten auf dem Viktualienmarkt – alle 6 Wochen wechselt die Münchner Brauerei.",
    description_en: "Right in the middle of Viktualienmarkt — every 6 weeks a different Munich brewery."
  },
  {
    id: "v003",
    name: "Andechser am Dom",
    type: "restaurant",
    neighbourhood_id: "altstadt",
    address: "Weinstr. 7a, 80333 München",
    lat: 48.1383,
    lng: 11.5747,
    opening_hours: "Mo–So 10:00–24:00",
    website: "https://www.andechser-am-dom.de",
    beers: [
      { brand: "Andechs", size_05: 5.60, size_mass: 11.20, updated: "2025-02-10", reports: 4 }
    ],
    description_de: "Traditionsreiches Münchner Wirtshaus mit Klosterbier aus Andechs.",
    description_en: "Traditional Munich inn serving monastery beer from Andechs."
  },
  {
    id: "v004",
    name: "Nürnberger Bratwurst Glöckl",
    type: "restaurant",
    neighbourhood_id: "altstadt",
    address: "Frauenplatz 9, 80331 München",
    lat: 48.1389,
    lng: 11.5730,
    opening_hours: "Mo–So 10:00–24:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 5.40, size_mass: 10.80, updated: "2025-01-28", reports: 3 }
    ],
    description_de: "Dunkle historische Gaststätte im Schatten der Frauenkirche seit 1390.",
    description_en: "Dark historic tavern in the shadow of the Frauenkirche since 1390."
  },

  // MAXVORSTADT
  {
    id: "v005",
    name: "Augustiner Keller",
    type: "beer_garden",
    neighbourhood_id: "maxvorstadt",
    address: "Arnulfstr. 52, 80335 München",
    lat: 48.1453,
    lng: 11.5535,
    opening_hours: "Mo–So 10:00–24:00 (saisonal Biergarten)",
    website: "https://www.augustinerkeller.de",
    beers: [
      { brand: "Augustiner", size_05: 4.80, size_mass: 9.60, updated: "2025-04-10", reports: 11 }
    ],
    description_de: "5.000-Plätze-Biergarten unter Kastanien – Holzfassanbier vom Augustiner.",
    description_en: "5,000-seat beer garden under chestnut trees — barrel-tapped Augustiner."
  },
  {
    id: "v006",
    name: "Augustiner am Stachus",
    type: "restaurant",
    neighbourhood_id: "maxvorstadt",
    address: "Neuhauser Str. 27, 80331 München",
    lat: 48.1392,
    lng: 11.5657,
    opening_hours: "Mo–So 9:00–24:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 5.20, size_mass: 10.40, updated: "2025-03-05", reports: 6 }
    ],
    description_de: "Großes Wirtshaus direkt an der Einkaufsmeile am Stachus.",
    description_en: "Large inn on the shopping mile at Stachus."
  },
  {
    id: "v007",
    name: "Alter Simpl",
    type: "bar",
    neighbourhood_id: "maxvorstadt",
    address: "Türkenstr. 57, 80799 München",
    lat: 48.1510,
    lng: 11.5720,
    opening_hours: "Mo–Fr 11:00–3:00, Sa–So 12:00–3:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 4.50, size_mass: 9.00, updated: "2025-04-01", reports: 7 }
    ],
    description_de: "Kultige Studentenbar in der Maxvorstadt – günstige Preise, gutes Bier.",
    description_en: "Iconic student bar in Maxvorstadt — cheap prices, good beer."
  },

  // SCHWABING
  {
    id: "v008",
    name: "Chinesischer Turm",
    type: "beer_garden",
    neighbourhood_id: "schwabing",
    address: "Englischer Garten 3, 80538 München",
    lat: 48.1567,
    lng: 11.5925,
    opening_hours: "Mo–So 10:00–22:00 (saisonal)",
    website: "https://www.chinaturm.de",
    beers: [
      { brand: "Hofbräu", size_05: 5.50, size_mass: 11.00, updated: "2025-04-18", reports: 9 }
    ],
    description_de: "Münchens bekanntester Biergarten im Englischen Garten mit Pagode und Blaskapelle.",
    description_en: "Munich's most famous beer garden in the English Garden with pagoda and brass band."
  },
  {
    id: "v009",
    name: "Seehaus im Englischen Garten",
    type: "beer_garden",
    neighbourhood_id: "schwabing",
    address: "Kleinhesseloher See 3, 80802 München",
    lat: 48.1640,
    lng: 11.5877,
    opening_hours: "Mo–So 10:00–22:00 (saisonal)",
    website: "https://www.seehaus-muenchen.de",
    beers: [
      { brand: "Paulaner", size_05: 5.80, size_mass: 11.60, updated: "2025-03-22", reports: 5 }
    ],
    description_de: "Romantischer Biergarten am Kleinhesseloher See im Englischen Garten.",
    description_en: "Romantic beer garden on the Kleinhesseloher lake in the English Garden."
  },
  {
    id: "v010",
    name: "Münchner Freiheit",
    type: "bar",
    neighbourhood_id: "schwabing",
    address: "Münchner Freiheit 20, 80802 München",
    lat: 48.1648,
    lng: 11.5835,
    opening_hours: "Mo–So 10:00–1:00",
    website: "",
    beers: [
      { brand: "Paulaner", size_05: 5.10, size_mass: 10.20, updated: "2025-02-14", reports: 4 }
    ],
    description_de: "Belebte Bar am Schwabinger Platz mit großer Sonnenterrasse.",
    description_en: "Lively bar on the Schwabing square with large sun terrace."
  },

  // ISARVORSTADT
  {
    id: "v011",
    name: "Gaststätte Fraunhofer",
    type: "restaurant",
    neighbourhood_id: "isarvorstadt",
    address: "Fraunhoferstr. 9, 80469 München",
    lat: 48.1306,
    lng: 11.5717,
    opening_hours: "Mo–So 16:30–1:00",
    website: "https://www.fraunhofer-restaurant.de",
    beers: [
      { brand: "Augustiner", size_05: 4.90, size_mass: 9.80, updated: "2025-04-05", reports: 8 }
    ],
    description_de: "Klassisches Münchner Wirtshaus nahe dem Gärtnerplatz mit rustikalem Flair.",
    description_en: "Classic Munich inn near Gärtnerplatz with rustic charm."
  },
  {
    id: "v012",
    name: "Gärtnerplatz Biergarten",
    type: "beer_garden",
    neighbourhood_id: "isarvorstadt",
    address: "Gärtnerplatz, 80469 München",
    lat: 48.1314,
    lng: 11.5745,
    opening_hours: "Mo–So 11:00–23:00 (saisonal)",
    website: "",
    beers: [
      { brand: "Hacker-Pschorr", size_05: 5.00, size_mass: 10.00, updated: "2025-04-12", reports: 6 }
    ],
    description_de: "Beliebter Biergarten am Gärtnerplatz – Treffpunkt der Szene.",
    description_en: "Popular beer garden at Gärtnerplatz — the meeting spot of the scene."
  },
  {
    id: "v013",
    name: "Baader Café",
    type: "bar",
    neighbourhood_id: "isarvorstadt",
    address: "Baaderstr. 47, 80469 München",
    lat: 48.1318,
    lng: 11.5800,
    opening_hours: "Mo–So 9:00–1:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 4.70, size_mass: null, updated: "2025-03-30", reports: 5 }
    ],
    description_de: "Legendäres Café-Bar im Glockenbachviertel – Frühstück bis Nachtleben.",
    description_en: "Legendary café-bar in Glockenbachviertel — breakfast to nightlife."
  },

  // ─── v3: additional venues ─────────────────────────────────────────────────
  // Prices are realistic 2025 Munich estimates (EUR), grounded in brand,
  // venue type and location — beer gardens cheaper, tourist/upscale spots dearer.
  // A few names below are the closest real establishment to an ambiguous request
  // (see README / commit notes).

  // ALTSTADT
  {
    id: "v014",
    name: "Augustiner Klosterwirt",
    type: "restaurant",
    neighbourhood_id: "altstadt",
    address: "Augustinerstr. 1, 80331 München",
    lat: 48.1386,
    lng: 11.5726,
    opening_hours: "Mo–So 11:00–24:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 5.20, size_mass: 10.40, updated: "2025-05-12", reports: 4 }
    ],
    description_de: "Wirtshaus hinter der Frauenkirche mit ungespundetem Augustiner Edelstoff.",
    description_en: "Inn behind the Frauenkirche pouring unpressurised Augustiner Edelstoff."
  },
  {
    id: "v015",
    name: "Spatenhaus an der Oper",
    type: "restaurant",
    neighbourhood_id: "altstadt",
    address: "Residenzstr. 12, 80333 München",
    lat: 48.1399,
    lng: 11.5786,
    opening_hours: "Mo–So 11:30–24:00",
    website: "",
    beers: [
      { brand: "Spaten", size_05: 5.90, size_mass: 11.80, updated: "2025-04-08", reports: 3 }
    ],
    description_de: "Gehobenes Traditionslokal gegenüber der Bayerischen Staatsoper.",
    description_en: "Upmarket traditional restaurant opposite the Bavarian State Opera."
  },
  {
    id: "v016",
    name: "Zum Franziskaner",
    type: "beer_hall",
    neighbourhood_id: "altstadt",
    address: "Residenzstr. 9, 80333 München",
    lat: 48.1401,
    lng: 11.5783,
    opening_hours: "Mo–So 10:00–24:00",
    website: "",
    beers: [
      { brand: "Spaten", size_05: 5.70, size_mass: 11.40, updated: "2025-03-19", reports: 4 }
    ],
    description_de: "Eines der ältesten Wirtshäuser der Stadt, bekannt für Weißwurst und Spaten.",
    description_en: "One of the city's oldest inns, known for Weisswurst and Spaten beer."
  },
  {
    id: "v017",
    name: "Hofbräukeller am Wiener Platz",
    type: "beer_garden",
    neighbourhood_id: "altstadt",
    address: "Innere Wiener Str. 19, 81667 München",
    lat: 48.1345,
    lng: 11.5945,
    opening_hours: "Mo–So 10:00–24:00 (Biergarten saisonal)",
    website: "",
    beers: [
      { brand: "Hofbräu", size_05: 5.30, size_mass: 10.60, updated: "2025-05-28", reports: 6 }
    ],
    description_de: "Schattiger Kastanien-Biergarten am Wiener Platz, seit 1892 in Betrieb.",
    description_en: "Shady chestnut beer garden on Wiener Platz, running since 1892."
  },
  {
    id: "v018",
    name: "Ratskeller München",
    type: "restaurant",
    neighbourhood_id: "altstadt",
    address: "Marienplatz 8, 80331 München",
    lat: 48.1373,
    lng: 11.5760,
    opening_hours: "Mo–So 11:00–24:00",
    website: "",
    beers: [
      { brand: "Hacker-Pschorr", size_05: 6.20, size_mass: 12.40, updated: "2025-02-27", reports: 5 }
    ],
    description_de: "Gewölbekeller unter dem Neuen Rathaus – zentral, historisch, touristisch.",
    description_en: "Vaulted cellar beneath the New Town Hall — central, historic, touristy."
  },
  {
    id: "v019",
    name: "Weinhaus Neuner",
    type: "restaurant",
    neighbourhood_id: "altstadt",
    address: "Herzogspitalstr. 8, 80331 München",
    lat: 48.1382,
    lng: 11.5680,
    opening_hours: "Di–Sa 12:00–24:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 5.80, size_mass: 11.60, updated: "2025-04-15", reports: 2 }
    ],
    description_de: "Ältestes Weinhaus Münchens von 1852 – gepflegte Küche, auch Augustiner vom Fass.",
    description_en: "Munich's oldest wine house from 1852 — refined food, Augustiner on tap too."
  },
  {
    id: "v020",
    name: "Paulaner im Tal",
    type: "beer_hall",
    neighbourhood_id: "altstadt",
    address: "Tal 12, 80331 München",
    lat: 48.1360,
    lng: 11.5790,
    opening_hours: "Mo–So 10:00–24:00",
    website: "",
    beers: [
      { brand: "Paulaner", size_05: 5.60, size_mass: 11.20, updated: "2025-05-03", reports: 5 }
    ],
    description_de: "Modernisiertes Wirtshaus im Tal mit Paulaner-Ausschank und Innenhof.",
    description_en: "Refurbished inn on Tal street with Paulaner on tap and a courtyard."
  },
  {
    id: "v021",
    name: "Der Pschorr",
    type: "beer_hall",
    neighbourhood_id: "altstadt",
    address: "Viktualienmarkt 15, 80331 München",
    lat: 48.1348,
    lng: 11.5765,
    opening_hours: "Mo–So 10:00–24:00",
    website: "",
    beers: [
      { brand: "Hacker-Pschorr", size_05: 5.90, size_mass: 11.80, updated: "2025-06-01", reports: 7 }
    ],
    description_de: "Wirtshaus am Viktualienmarkt mit Bier aus dem Holzfass (Hirschgulasch, Schweinsbraten).",
    description_en: "Inn on the Viktualienmarkt with wood-cask beer, roast pork and venison goulash."
  },
  {
    id: "v022",
    name: "Kilians Irish Pub",
    type: "bar",
    neighbourhood_id: "altstadt",
    address: "Frauenplatz 11, 80331 München",
    lat: 48.1386,
    lng: 11.5738,
    opening_hours: "Mo–So 12:00–1:00",
    website: "",
    beers: [
      { brand: "Paulaner", size_05: 5.70, size_mass: null, updated: "2025-03-11", reports: 4 }
    ],
    description_de: "Belebter Irish Pub direkt neben dem Dom – Guinness, Paulaner und Live-Sport.",
    description_en: "Busy Irish pub right next to the cathedral — Guinness, Paulaner and live sport."
  },

  // MAXVORSTADT
  {
    id: "v023",
    name: "Schelling Salon",
    type: "restaurant",
    neighbourhood_id: "maxvorstadt",
    address: "Schellingstr. 54, 80799 München",
    lat: 48.1512,
    lng: 11.5720,
    opening_hours: "Mo, Do–So 6:30–1:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 4.90, size_mass: 9.80, updated: "2025-04-22", reports: 6 }
    ],
    description_de: "Historisches Kaffee- und Billardhaus seit 1872 – günstig, unverändert, legendär.",
    description_en: "Historic café and billiard hall since 1872 — cheap, unchanged, legendary."
  },
  {
    id: "v024",
    name: "Café Reitschule",
    type: "restaurant",
    neighbourhood_id: "maxvorstadt",
    address: "Königinstr. 34, 80802 München",
    lat: 48.1520,
    lng: 11.5860,
    opening_hours: "Mo–So 9:00–1:00",
    website: "",
    beers: [
      { brand: "Paulaner", size_05: 5.80, size_mass: 11.60, updated: "2025-05-16", reports: 3 }
    ],
    description_de: "Großes Brasserie-Café am Rand des Englischen Gartens neben der Reitschule.",
    description_en: "Large brasserie-café on the edge of the English Garden next to the riding school."
  },
  {
    id: "v025",
    name: "Osterwaldgarten",
    type: "beer_garden",
    neighbourhood_id: "maxvorstadt",
    address: "Keferstr. 12, 80802 München",
    lat: 48.1640,
    lng: 11.5960,
    opening_hours: "Mo–So 11:00–23:00 (saisonal)",
    website: "",
    beers: [
      { brand: "Spaten", size_05: 5.10, size_mass: 10.20, updated: "2025-05-24", reports: 5 }
    ],
    description_de: "Gemütlicher Nachbarschafts-Biergarten unter alten Bäumen seit 1900.",
    description_en: "Cosy neighbourhood beer garden under old trees, going since 1900."
  },
  {
    id: "v026",
    name: "Park Café",
    type: "beer_garden",
    neighbourhood_id: "maxvorstadt",
    address: "Sophienstr. 7, 80333 München",
    lat: 48.1435,
    lng: 11.5635,
    opening_hours: "Mo–So 11:00–24:00 (Biergarten saisonal)",
    website: "",
    beers: [
      { brand: "Hacker-Pschorr", size_05: 5.40, size_mass: 10.80, updated: "2025-04-30", reports: 4 }
    ],
    description_de: "Biergarten im Alten Botanischen Garten, abends Club und Konzerte.",
    description_en: "Beer garden in the Old Botanical Garden, club nights and concerts after dark."
  },
  {
    id: "v027",
    name: "Türkenhof",
    type: "bar",
    neighbourhood_id: "maxvorstadt",
    address: "Türkenstr. 78, 80799 München",
    lat: 48.1525,
    lng: 11.5745,
    opening_hours: "Mo–So 11:00–1:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 4.80, size_mass: 9.60, updated: "2025-03-07", reports: 7 }
    ],
    description_de: "Studentisch geprägte Kneipe im Uni-Viertel – Augustiner und Wirtshausküche.",
    description_en: "Student pub in the university quarter — Augustiner and hearty pub food."
  },
  {
    id: "v028",
    name: "Löwenbräukeller",
    type: "beer_hall",
    neighbourhood_id: "maxvorstadt",
    address: "Nymphenburger Str. 2, 80335 München",
    lat: 48.1465,
    lng: 11.5560,
    opening_hours: "Mo–So 10:00–23:00",
    website: "",
    beers: [
      { brand: "Löwenbräu", size_05: 5.50, size_mass: 11.00, updated: "2025-05-09", reports: 6 }
    ],
    description_de: "Prachtbau am Stiglmaierplatz mit Festsaal, Wirtshaus und Biergarten.",
    description_en: "Grand hall on Stiglmaierplatz with a ballroom, tavern and beer garden."
  },
  {
    id: "v029",
    name: "Max Emanuel Brauerei",
    type: "bar",
    neighbourhood_id: "maxvorstadt",
    address: "Adalbertstr. 33, 80799 München",
    lat: 48.1525,
    lng: 11.5770,
    opening_hours: "Mo–So 17:00–1:00 (Biergarten saisonal)",
    website: "",
    beers: [
      { brand: "Löwenbräu", size_05: 4.90, size_mass: 9.80, updated: "2025-04-03", reports: 5 }
    ],
    description_de: "Traditionswirtshaus mit kleinem Biergarten, Salsa-Abenden und Studentenpreisen.",
    description_en: "Traditional pub with a small beer garden, salsa nights and student prices."
  },

  // SCHWABING
  {
    id: "v030",
    name: "Wedekind",
    type: "bar",
    neighbourhood_id: "schwabing",
    address: "Feilitzschstr. 1, 80802 München",
    lat: 48.1615,
    lng: 11.5860,
    opening_hours: "Mo–So 8:00–1:00",
    website: "",
    beers: [
      { brand: "Tegernseer", size_05: 5.20, size_mass: null, updated: "2025-05-20", reports: 4 }
    ],
    description_de: "Eck-Lokal am Wedekindplatz – Frühstück, Tegernseer Hell und Schwabinger Publikum.",
    description_en: "Corner spot on Wedekindplatz — breakfast, Tegernseer Hell and a Schwabing crowd."
  },
  {
    id: "v031",
    name: "Schwabinger 7",
    type: "bar",
    neighbourhood_id: "schwabing",
    address: "Feilitzschstr. 15, 80802 München",
    lat: 48.1618,
    lng: 11.5865,
    opening_hours: "Mo–So 19:00–3:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 4.60, size_mass: null, updated: "2025-02-18", reports: 6 }
    ],
    description_de: "Winzige Kult-Kneipe, letzter Rest des alten, rauen Schwabing.",
    description_en: "Tiny cult dive bar, the last remnant of old, rough-edged Schwabing."
  },
  {
    id: "v032",
    name: "Biergarten Hirschau",
    type: "beer_garden",
    neighbourhood_id: "schwabing",
    address: "Gysslingstr. 15, 80805 München",
    lat: 48.1720,
    lng: 11.5960,
    opening_hours: "Mo–So 11:00–23:00 (saisonal)",
    website: "",
    beers: [
      { brand: "Paulaner", size_05: 5.30, size_mass: 10.60, updated: "2025-06-04", reports: 5 }
    ],
    description_de: "Großer Biergarten im nördlichen Englischen Garten mit Spielplatz und Livemusik.",
    description_en: "Large beer garden in the northern English Garden with playground and live music."
  },
  {
    id: "v033",
    name: "Occam Deli",
    type: "bar",
    neighbourhood_id: "schwabing",
    address: "Occamstr. 13, 80802 München",
    lat: 48.1620,
    lng: 11.5866,
    opening_hours: "Mo–So 8:00–1:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 5.40, size_mass: null, updated: "2025-04-27", reports: 3 }
    ],
    description_de: "Deli und Bar an der Münchner Freiheit – Frühstück bis Aperitif.",
    description_en: "Deli and bar by Münchner Freiheit — from breakfast through to aperitivo."
  },
  {
    id: "v034",
    name: "Schwabinger Bräu",
    type: "restaurant",
    neighbourhood_id: "schwabing",
    address: "Leopoldstr. 82, 80802 München",
    lat: 48.1650,
    lng: 11.5860,
    opening_hours: "Mo–So 11:00–24:00",
    website: "",
    beers: [
      { brand: "Hofbräu", size_05: 5.60, size_mass: 11.20, updated: "2025-03-25", reports: 4 }
    ],
    description_de: "Großes Wirtshaus an der Leopoldstraße mit Terrasse zum Flanieren.",
    description_en: "Large inn on Leopoldstrasse with a terrace for people-watching."
  },
  {
    id: "v035",
    name: "Vereinsheim Schwabing",
    type: "bar",
    neighbourhood_id: "schwabing",
    address: "Occamstr. 8, 80802 München",
    lat: 48.1618,
    lng: 11.5862,
    opening_hours: "Di–So 18:00–1:00",
    website: "",
    beers: [
      { brand: "Paulaner", size_05: 5.30, size_mass: null, updated: "2025-05-14", reports: 3 }
    ],
    description_de: "Wirtshaus und Kleinkunstbühne – Kabarett, Konzerte und bayerische Brotzeit.",
    description_en: "Pub and small stage — cabaret, concerts and Bavarian cold platters."
  },

  // ISARVORSTADT
  {
    id: "v036",
    name: "Zum Glockenbach",
    type: "restaurant",
    neighbourhood_id: "isarvorstadt",
    address: "Kapuzinerstr. 29, 80337 München",
    lat: 48.1275,
    lng: 11.5620,
    opening_hours: "Di–Sa 18:00–24:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 5.90, size_mass: 11.80, updated: "2025-04-11", reports: 2 }
    ],
    description_de: "Ambitionierte regionale Küche im Glockenbachviertel, Augustiner vom Fass.",
    description_en: "Ambitious regional cooking in the Glockenbach quarter, Augustiner on tap."
  },
  {
    id: "v037",
    name: "Deutsche Eiche",
    type: "restaurant",
    neighbourhood_id: "isarvorstadt",
    address: "Reichenbachstr. 13, 80469 München",
    lat: 48.1320,
    lng: 11.5765,
    opening_hours: "Mo–So 10:00–24:00",
    website: "",
    beers: [
      { brand: "Paulaner", size_05: 5.50, size_mass: 11.00, updated: "2025-05-07", reports: 5 }
    ],
    description_de: "Institution im Glockenbachviertel mit Wirtshaus, Hotel und Dachterrasse.",
    description_en: "A Glockenbach institution with a tavern, hotel and roof terrace."
  },
  {
    id: "v038",
    name: "Café am Hochhaus",
    type: "bar",
    neighbourhood_id: "isarvorstadt",
    address: "Blumenstr. 29, 80331 München",
    lat: 48.1330,
    lng: 11.5720,
    opening_hours: "Mo–So 20:00–3:00",
    website: "",
    beers: [
      { brand: "Tegernseer", size_05: 5.20, size_mass: null, updated: "2025-03-02", reports: 4 }
    ],
    description_de: "Kleine DJ-Bar am Rand der Isarvorstadt, Treffpunkt der Musikszene.",
    description_en: "Small DJ bar on the edge of Isarvorstadt, a hub for the music scene."
  },
  {
    id: "v039",
    name: "Morizz",
    type: "bar",
    neighbourhood_id: "isarvorstadt",
    address: "Klenzestr. 43, 80469 München",
    lat: 48.1300,
    lng: 11.5735,
    opening_hours: "Mo–So 18:00–3:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 5.80, size_mass: null, updated: "2025-04-19", reports: 3 }
    ],
    description_de: "Elegante Cocktail- und Szenebar im Glockenbachviertel mit Ledersesseln.",
    description_en: "Elegant cocktail and scene bar in Glockenbach with leather armchairs."
  },
  {
    id: "v040",
    name: "Trachtenvogl",
    type: "bar",
    neighbourhood_id: "isarvorstadt",
    address: "Reichenbachstr. 47, 80469 München",
    lat: 48.1290,
    lng: 11.5760,
    opening_hours: "Mo–So 10:00–1:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 4.90, size_mass: null, updated: "2025-05-30", reports: 5 }
    ],
    description_de: "Ehemaliges Trachtengeschäft, heute Café-Bar mit Kaffeehaus-Charme und Spielen.",
    description_en: "A former traditional-dress shop, now a café-bar with coffee-house charm and board games."
  },
  {
    id: "v041",
    name: "Wirtshaus in der Au",
    type: "restaurant",
    neighbourhood_id: "isarvorstadt",
    address: "Lilienstr. 51, 81669 München",
    lat: 48.1275,
    lng: 11.5850,
    opening_hours: "Mo–So 17:00–24:00, Sa–So ab 10:00",
    website: "",
    beers: [
      { brand: "Ayinger", size_05: 5.40, size_mass: 10.80, updated: "2025-04-25", reports: 6 }
    ],
    description_de: "Seit 1901 bekannt für Knödel in allen Varianten, dazu Ayinger vom Fass.",
    description_en: "Known since 1901 for dumplings of every kind, with Ayinger on tap."
  }
];

// Compute avg price per neighbourhood
const neighbourhoodStats = neighbourhoods.map(n => {
  const nvenues = venues.filter(v => v.neighbourhood_id === n.id);
  const prices = nvenues.map(v => v.beers[0].size_05);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  return { ...n, avg_price: Math.round(avg * 100) / 100, venue_count: nvenues.length };
});

module.exports = { neighbourhoods: neighbourhoodStats, venues };
