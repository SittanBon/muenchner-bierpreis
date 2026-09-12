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
      { brand: "Hofbräu", size_05: 6.2, size_mass: 12.4, updated: "2025-03-15", reports: 8 }
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
    lng: 11.576,
    opening_hours: "Mo–Sa 10:00–22:00 (saisonal)",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 5.3, size_mass: 10.6, updated: "2025-04-20", reports: 5 },
      { brand: "Paulaner", size_05: 5.4, size_mass: 10.8, updated: "2025-06-01", reports: 3 },
      { brand: "Hofbräu", size_05: 5.6, size_mass: null, updated: "2025-06-01", reports: 5 }
    ],
    description_de: "Mitten auf dem Viktualienmarkt – alle 6 Wochen wechselt die Münchner Brauerei, aktuell Augustiner.",
    description_en: "Right in the middle of Viktualienmarkt — every 6 weeks a different Munich brewery, currently Augustiner."
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
      { brand: "Andechs", size_05: 5.6, size_mass: 11.2, updated: "2025-02-10", reports: 4 }
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
    lng: 11.573,
    opening_hours: "Mo–So 10:00–24:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 5.4, size_mass: 10.8, updated: "2025-01-28", reports: 3 }
    ],
    description_de: "Dunkle historische Gaststätte im Schatten der Frauenkirche seit 1390.",
    description_en: "Dark historic tavern in the shadow of the Frauenkirche since 1390."
  },
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
      { brand: "Augustiner", size_05: 4.8, size_mass: 9.6, updated: "2025-04-10", reports: 11 },
      { brand: "Hacker-Pschorr", size_05: 5, size_mass: 10, updated: "2025-06-01", reports: 3 }
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
      { brand: "Augustiner", size_05: 5.2, size_mass: 10.4, updated: "2025-03-05", reports: 6 }
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
    lat: 48.151,
    lng: 11.572,
    opening_hours: "Mo–Fr 11:00–3:00, Sa–So 12:00–3:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 4.5, size_mass: 9, updated: "2025-04-01", reports: 7 }
    ],
    description_de: "Kultige Studentenbar in der Maxvorstadt – günstige Preise, gutes Bier.",
    description_en: "Iconic student bar in Maxvorstadt — cheap prices, good beer."
  },
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
      { brand: "Hofbräu", size_05: 5.5, size_mass: 11, updated: "2025-04-18", reports: 9 },
      { brand: "Paulaner", size_05: 5.7, size_mass: null, updated: "2025-06-01", reports: 2 },
      { brand: "Augustiner", size_05: 5.4, size_mass: null, updated: "2025-06-01", reports: 4 }
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
    lat: 48.164,
    lng: 11.5877,
    opening_hours: "Mo–So 10:00–22:00 (saisonal)",
    website: "https://www.seehaus-muenchen.de",
    beers: [
      { brand: "Paulaner", size_05: 5.8, size_mass: 11.6, updated: "2025-03-22", reports: 5 },
      { brand: "Hacker-Pschorr", size_05: 6, size_mass: 12, updated: "2025-06-01", reports: 2 }
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
      { brand: "Paulaner", size_05: 5.1, size_mass: 10.2, updated: "2025-02-14", reports: 4 }
    ],
    description_de: "Belebte Bar am Schwabinger Platz mit großer Sonnenterrasse.",
    description_en: "Lively bar on the Schwabing square with large sun terrace."
  },
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
      { brand: "Augustiner", size_05: 4.9, size_mass: 9.8, updated: "2025-04-05", reports: 8 }
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
      { brand: "Hacker-Pschorr", size_05: 5, size_mass: 10, updated: "2025-04-12", reports: 6 },
      { brand: "Augustiner", size_05: 4.9, size_mass: null, updated: "2025-06-01", reports: 2 },
      { brand: "Spaten", size_05: 5.2, size_mass: 10.4, updated: "2025-06-01", reports: 3 }
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
    lng: 11.58,
    opening_hours: "Mo–So 9:00–1:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 4.7, size_mass: null, updated: "2025-03-30", reports: 5 }
    ],
    description_de: "Legendäres Café-Bar im Glockenbachviertel – Frühstück bis Nachtleben.",
    description_en: "Legendary café-bar in Glockenbachviertel — breakfast to nightlife."
  },
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
      { brand: "Augustiner", size_05: 5.2, size_mass: 10.4, updated: "2025-05-12", reports: 4 }
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
      { brand: "Spaten", size_05: 5.9, size_mass: 11.8, updated: "2025-04-08", reports: 3 }
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
      { brand: "Spaten", size_05: 5.7, size_mass: 11.4, updated: "2025-03-19", reports: 4 }
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
      { brand: "Hofbräu", size_05: 5.3, size_mass: 10.6, updated: "2025-05-28", reports: 6 },
      { brand: "Tegernseer", size_05: 5.1, size_mass: 10.2, updated: "2025-06-01", reports: 2 }
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
    lng: 11.576,
    opening_hours: "Mo–So 11:00–24:00",
    website: "",
    beers: [
      { brand: "Hacker-Pschorr", size_05: 6.2, size_mass: 12.4, updated: "2025-02-27", reports: 5 },
      { brand: "Paulaner", size_05: 6, size_mass: 12, updated: "2025-06-01", reports: 3 }
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
    lng: 11.568,
    opening_hours: "Di–Sa 12:00–24:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 5.8, size_mass: 11.6, updated: "2025-04-15", reports: 2 }
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
    lat: 48.136,
    lng: 11.579,
    opening_hours: "Mo–So 10:00–24:00",
    website: "",
    beers: [
      { brand: "Paulaner", size_05: 5.6, size_mass: 11.2, updated: "2025-05-03", reports: 5 }
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
      { brand: "Hacker-Pschorr", size_05: 5.9, size_mass: 11.8, updated: "2025-06-01", reports: 7 },
      { brand: "Augustiner", size_05: 5.7, size_mass: null, updated: "2025-06-01", reports: 6 }
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
      { brand: "Paulaner", size_05: 5.7, size_mass: null, updated: "2025-03-11", reports: 4 }
    ],
    description_de: "Belebter Irish Pub direkt neben dem Dom – Guinness, Paulaner und Live-Sport.",
    description_en: "Busy Irish pub right next to the cathedral — Guinness, Paulaner and live sport."
  },
  {
    id: "v023",
    name: "Schelling Salon",
    type: "restaurant",
    neighbourhood_id: "maxvorstadt",
    address: "Schellingstr. 54, 80799 München",
    lat: 48.1512,
    lng: 11.572,
    opening_hours: "Mo, Do–So 6:30–1:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 4.9, size_mass: 9.8, updated: "2025-04-22", reports: 6 }
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
    lat: 48.152,
    lng: 11.586,
    opening_hours: "Mo–So 9:00–1:00",
    website: "",
    beers: [
      { brand: "Paulaner", size_05: 5.8, size_mass: 11.6, updated: "2025-05-16", reports: 3 }
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
    lat: 48.164,
    lng: 11.596,
    opening_hours: "Mo–So 11:00–23:00 (saisonal)",
    website: "",
    beers: [
      { brand: "Spaten", size_05: 5.1, size_mass: 10.2, updated: "2025-05-24", reports: 5 },
      { brand: "Ayinger", size_05: 5.3, size_mass: null, updated: "2025-06-01", reports: 4 }
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
      { brand: "Hacker-Pschorr", size_05: 5.4, size_mass: 10.8, updated: "2025-04-30", reports: 4 },
      { brand: "Tegernseer", size_05: 5.6, size_mass: 11.2, updated: "2025-06-01", reports: 3 }
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
      { brand: "Augustiner", size_05: 4.8, size_mass: 9.6, updated: "2025-03-07", reports: 7 }
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
    lng: 11.556,
    opening_hours: "Mo–So 10:00–23:00",
    website: "",
    beers: [
      { brand: "Löwenbräu", size_05: 5.5, size_mass: 11, updated: "2025-05-09", reports: 6 },
      { brand: "Augustiner", size_05: 5.7, size_mass: 11.4, updated: "2025-06-01", reports: 6 },
      { brand: "Franziskaner", size_05: 5.9, size_mass: null, updated: "2025-06-01", reports: 2 }
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
    lng: 11.577,
    opening_hours: "Mo–So 17:00–1:00 (Biergarten saisonal)",
    website: "",
    beers: [
      { brand: "Löwenbräu", size_05: 4.9, size_mass: 9.8, updated: "2025-04-03", reports: 5 }
    ],
    description_de: "Traditionswirtshaus mit kleinem Biergarten, Salsa-Abenden und Studentenpreisen.",
    description_en: "Traditional pub with a small beer garden, salsa nights and student prices."
  },
  {
    id: "v030",
    name: "Wedekind",
    type: "bar",
    neighbourhood_id: "schwabing",
    address: "Feilitzschstr. 1, 80802 München",
    lat: 48.1615,
    lng: 11.586,
    opening_hours: "Mo–So 8:00–1:00",
    website: "",
    beers: [
      { brand: "Tegernseer", size_05: 5.2, size_mass: null, updated: "2025-05-20", reports: 4 }
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
      { brand: "Augustiner", size_05: 4.6, size_mass: null, updated: "2025-02-18", reports: 6 }
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
    lat: 48.172,
    lng: 11.596,
    opening_hours: "Mo–So 11:00–23:00 (saisonal)",
    website: "",
    beers: [
      { brand: "Paulaner", size_05: 5.3, size_mass: 10.6, updated: "2025-06-04", reports: 5 },
      { brand: "Hofbräu", size_05: 5.5, size_mass: 11, updated: "2025-06-01", reports: 2 }
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
    lat: 48.162,
    lng: 11.5866,
    opening_hours: "Mo–So 8:00–1:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 5.4, size_mass: null, updated: "2025-04-27", reports: 3 }
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
    lat: 48.165,
    lng: 11.586,
    opening_hours: "Mo–So 11:00–24:00",
    website: "",
    beers: [
      { brand: "Hofbräu", size_05: 5.6, size_mass: 11.2, updated: "2025-03-25", reports: 4 },
      { brand: "Augustiner", size_05: 5.4, size_mass: null, updated: "2025-06-01", reports: 5 }
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
      { brand: "Paulaner", size_05: 5.3, size_mass: null, updated: "2025-05-14", reports: 3 }
    ],
    description_de: "Wirtshaus und Kleinkunstbühne – Kabarett, Konzerte und bayerische Brotzeit.",
    description_en: "Pub and small stage — cabaret, concerts and Bavarian cold platters."
  },
  {
    id: "v036",
    name: "Zum Glockenbach",
    type: "restaurant",
    neighbourhood_id: "isarvorstadt",
    address: "Kapuzinerstr. 29, 80337 München",
    lat: 48.1275,
    lng: 11.562,
    opening_hours: "Di–Sa 18:00–24:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 5.9, size_mass: 11.8, updated: "2025-04-11", reports: 2 }
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
    lat: 48.132,
    lng: 11.5765,
    opening_hours: "Mo–So 10:00–24:00",
    website: "",
    beers: [
      { brand: "Paulaner", size_05: 5.5, size_mass: 11, updated: "2025-05-07", reports: 5 },
      { brand: "Hacker-Pschorr", size_05: 5.7, size_mass: 11.4, updated: "2025-06-01", reports: 5 }
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
    lat: 48.133,
    lng: 11.572,
    opening_hours: "Mo–So 20:00–3:00",
    website: "",
    beers: [
      { brand: "Tegernseer", size_05: 5.2, size_mass: null, updated: "2025-03-02", reports: 4 }
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
    lat: 48.13,
    lng: 11.5735,
    opening_hours: "Mo–So 18:00–3:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 5.8, size_mass: null, updated: "2025-04-19", reports: 3 }
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
    lat: 48.129,
    lng: 11.576,
    opening_hours: "Mo–So 10:00–1:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 4.9, size_mass: null, updated: "2025-05-30", reports: 5 }
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
    lng: 11.585,
    opening_hours: "Mo–So 17:00–24:00, Sa–So ab 10:00",
    website: "",
    beers: [
      { brand: "Ayinger", size_05: 5.4, size_mass: 10.8, updated: "2025-04-25", reports: 6 },
      { brand: "Andechs", size_05: 5.6, size_mass: null, updated: "2025-06-01", reports: 4 }
    ],
    description_de: "Seit 1901 bekannt für Knödel in allen Varianten, dazu Ayinger vom Fass.",
    description_en: "Known since 1901 for dumplings of every kind, with Ayinger on tap."
  },
  {
    id: "v042",
    name: "Rustikeria",
    type: "restaurant",
    neighbourhood_id: "altstadt",
    address: "Rosenheimer Straße 1, 81667 München",
    lat: 48.1322,
    lng: 11.5882,
    opening_hours: "Mo–So 11:30–23:00",
    website: "https://rustikeria.de/",
    beers: [
      { brand: "Löwenbräu", size_05: 6.85, size_mass: 13.7, updated: "2025-06-01", reports: 5 }
    ],
    description_de: "Gehobene Küche mit gut sortierter Bierkarte.",
    description_en: "Well-regarded food with a solid beer selection."
  },
  {
    id: "v043",
    name: "Klenze 17",
    type: "restaurant",
    neighbourhood_id: "altstadt",
    address: "Klenzestraße 17, 80469 München",
    lat: 48.1329,
    lng: 11.5782,
    opening_hours: "Mo–So 11:30–23:00",
    website: "https://www.klenze17.de/",
    beers: [
      { brand: "Hofbräu", size_05: 6.85, size_mass: 13.7, updated: "2025-06-01", reports: 8 }
    ],
    description_de: "Gehobene Küche mit gut sortierter Bierkarte.",
    description_en: "Well-regarded food with a solid beer selection."
  },
  {
    id: "v044",
    name: "Hans im Glück",
    type: "restaurant",
    neighbourhood_id: "altstadt",
    address: "Tal 10, 80331 München",
    lat: 48.136,
    lng: 11.5784,
    opening_hours: "Mo–So 11:30–23:00",
    website: "https://hansimglueck-burgergrill.de/burger-restaurant/muenchen-tal/",
    beers: [
      { brand: "Paulaner", size_05: 5.45, size_mass: 10.9, updated: "2025-06-01", reports: 2 }
    ],
    description_de: "Burger- Küche mit gut sortierter Bierkarte.",
    description_en: "burger cuisine with a solid beer selection."
  },
  {
    id: "v045",
    name: "Karam",
    type: "restaurant",
    neighbourhood_id: "altstadt",
    address: "Schwanthalerstraße 8, 80336 München",
    lat: 48.1375,
    lng: 11.5633,
    opening_hours: "Mo–So 11:30–23:00",
    website: "",
    beers: [
      { brand: "Tegernseer", size_05: 5.75, size_mass: 11.5, updated: "2025-06-01", reports: 2 }
    ],
    description_de: "Syrische Küche mit gut sortierter Bierkarte.",
    description_en: "Syrian cuisine with a solid beer selection."
  },
  {
    id: "v046",
    name: "Schumann's",
    type: "bar",
    neighbourhood_id: "altstadt",
    address: "Odeonsplatz 7, 80539 München",
    lat: 48.1439,
    lng: 11.5786,
    opening_hours: "Mo–So 17:00–1:00",
    website: "https://schumanns.de/de/index.html",
    beers: [
      { brand: "Hacker-Pschorr", size_05: 5, size_mass: null, updated: "2025-06-01", reports: 5 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v047",
    name: "Café Kosmos",
    type: "bar",
    neighbourhood_id: "altstadt",
    address: "Dachauer Straße 7, 80335 München",
    lat: 48.1425,
    lng: 11.56,
    opening_hours: "Mo–So 17:00–1:00",
    website: "https://www.cafe-kosmos.de/",
    beers: [
      { brand: "Tegernseer", size_05: 5.8, size_mass: null, updated: "2025-06-01", reports: 3 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v048",
    name: "s'Zwölferl",
    type: "bar",
    neighbourhood_id: "altstadt",
    address: "Seitzstraße 12, 80538 München",
    lat: 48.1412,
    lng: 11.585,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Tegernseer", size_05: 4.95, size_mass: null, updated: "2025-06-01", reports: 4 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v049",
    name: "The Moon Bar Lehel",
    type: "bar",
    neighbourhood_id: "altstadt",
    address: "Thierschplatz 5, 80538 München",
    lat: 48.1395,
    lng: 11.5892,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Paulaner", size_05: 5.35, size_mass: null, updated: "2025-06-01", reports: 2 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v050",
    name: "Tattenbach",
    type: "beer_hall",
    neighbourhood_id: "altstadt",
    address: "Tattenbachstraße 6, 80538 München",
    lat: 48.14,
    lng: 11.5899,
    opening_hours: "Mo–So 10:00–24:00",
    website: "https://www.tattenbach.de/",
    beers: [
      { brand: "Paulaner", size_05: 5.85, size_mass: 11.7, updated: "2025-06-01", reports: 5 }
    ],
    description_de: "Traditionsreiches Wirtshaus mit bayerische Küche und bayerischem Bier vom Fass.",
    description_en: "Traditional Munich inn serving Bavarian cuisine with Bavarian beer on tap."
  },
  {
    id: "v051",
    name: "Augustiner am Dom",
    type: "beer_hall",
    neighbourhood_id: "altstadt",
    address: "Frauenplatz 8, 80331 München",
    lat: 48.1382,
    lng: 11.574,
    opening_hours: "Mo–So 10:00–24:00",
    website: "https://www.augustineramdom.de",
    beers: [
      { brand: "Löwenbräu", size_05: 5.9, size_mass: 11.8, updated: "2025-06-01", reports: 2 }
    ],
    description_de: "Traditionsreiches Wirtshaus mit regionale Küche und bayerischem Bier vom Fass.",
    description_en: "Traditional Munich inn serving regional cuisine with Bavarian beer on tap."
  },
  {
    id: "v052",
    name: "Kubaschewski",
    type: "bar",
    neighbourhood_id: "altstadt",
    address: "Karlsplatz 5, 80335 München",
    lat: 48.1397,
    lng: 11.5667,
    opening_hours: "Mo–So 17:00–1:00",
    website: "https://kubaschewski.bar/",
    beers: [
      { brand: "Tegernseer", size_05: 4.95, size_mass: null, updated: "2025-06-01", reports: 6 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v053",
    name: "Cohibar City",
    type: "bar",
    neighbourhood_id: "altstadt",
    address: "Herzog-Rudolf-Straße 2, 80539 München",
    lat: 48.1389,
    lng: 11.5835,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Spaten", size_05: 5.1, size_mass: 10.2, updated: "2025-06-01", reports: 3 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v054",
    name: "Gasthaus Isarthor",
    type: "beer_hall",
    neighbourhood_id: "altstadt",
    address: "Kanalstraße 2, 80538 München",
    lat: 48.1349,
    lng: 11.5836,
    opening_hours: "Mo–So 10:00–24:00",
    website: "https://www.gasthaus-isarthor.de/",
    beers: [
      { brand: "Paulaner", size_05: 5.7, size_mass: 11.4, updated: "2025-06-01", reports: 7 }
    ],
    description_de: "Traditionsreiches Wirtshaus mit bayerische Küche und bayerischem Bier vom Fass.",
    description_en: "Traditional Munich inn serving Bavarian cuisine with Bavarian beer on tap."
  },
  {
    id: "v055",
    name: "Tegernseer Tal - Bräuhaus",
    type: "beer_hall",
    neighbourhood_id: "altstadt",
    address: "Tal 8, 80331 München",
    lat: 48.136,
    lng: 11.5782,
    opening_hours: "Mo–So 10:00–24:00",
    website: "https://www.tegernseer-tal8.com/",
    beers: [
      { brand: "Augustiner", size_05: 6.15, size_mass: 12.3, updated: "2025-06-01", reports: 8 }
    ],
    description_de: "Traditionsreiches Wirtshaus mit regionale Küche und bayerischem Bier vom Fass.",
    description_en: "Traditional Munich inn serving regional cuisine with Bavarian beer on tap."
  },
  {
    id: "v056",
    name: "Zum Dürnbräu",
    type: "beer_hall",
    neighbourhood_id: "altstadt",
    address: "Dürnbräugasse 2, 80331 München",
    lat: 48.1362,
    lng: 11.5801,
    opening_hours: "Mo–So 10:00–24:00",
    website: "https://www.zumduernbraeu.de/",
    beers: [
      { brand: "Paulaner", size_05: 5.3, size_mass: 10.6, updated: "2025-06-01", reports: 8 }
    ],
    description_de: "Traditionsreiches Wirtshaus mit regionale Küche und bayerischem Bier vom Fass.",
    description_en: "Traditional Munich inn serving regional cuisine with Bavarian beer on tap."
  },
  {
    id: "v057",
    name: "Donisl",
    type: "beer_hall",
    neighbourhood_id: "altstadt",
    address: "Weinstraße 1, 80333 München",
    lat: 48.1377,
    lng: 11.5749,
    opening_hours: "Mo–So 10:00–24:00",
    website: "https://www.donisl.com/",
    beers: [
      { brand: "Hacker-Pschorr", size_05: 5.8, size_mass: 11.6, updated: "2025-06-01", reports: 4 }
    ],
    description_de: "Traditionsreiches Wirtshaus mit bayerische Küche und bayerischem Bier vom Fass.",
    description_en: "Traditional Munich inn serving Bavarian cuisine with Bavarian beer on tap."
  },
  {
    id: "v058",
    name: "Wintergarten",
    type: "beer_hall",
    neighbourhood_id: "maxvorstadt",
    address: "Nordendstraße 37, 80796 München",
    lat: 48.1572,
    lng: 11.5748,
    opening_hours: "Mo–So 10:00–24:00",
    website: "https://www.wintergarten-schwabing.de/",
    beers: [
      { brand: "Hofbräu", size_05: 6.05, size_mass: 12.1, updated: "2025-06-01", reports: 3 }
    ],
    description_de: "Traditionsreiches Wirtshaus mit bayerische Küche und bayerischem Bier vom Fass.",
    description_en: "Traditional Munich inn serving Bavarian cuisine with Bavarian beer on tap."
  },
  {
    id: "v059",
    name: "Casa Nostra",
    type: "restaurant",
    neighbourhood_id: "maxvorstadt",
    address: "Gabelsbergerstraße 97, 80333 München",
    lat: 48.1498,
    lng: 11.5597,
    opening_hours: "Mo–So 11:30–23:00",
    website: "https://www.casa-nostra-monaco.de/",
    beers: [
      { brand: "Hacker-Pschorr", size_05: 6.95, size_mass: 13.9, updated: "2025-06-01", reports: 4 }
    ],
    description_de: "Italienische Küche mit gut sortierter Bierkarte.",
    description_en: "Italian cuisine with a solid beer selection."
  },
  {
    id: "v060",
    name: "Kaito",
    type: "restaurant",
    neighbourhood_id: "maxvorstadt",
    address: "Gabelsbergerstraße 85, 80333 München",
    lat: 48.1495,
    lng: 11.5608,
    opening_hours: "Mo–So 11:30–23:00",
    website: "https://www.kaito-restaurant.com/de",
    beers: [
      { brand: "Paulaner", size_05: 5.7, size_mass: 11.4, updated: "2025-06-01", reports: 2 }
    ],
    description_de: "Japanische Küche mit gut sortierter Bierkarte.",
    description_en: "Japanese cuisine with a solid beer selection."
  },
  {
    id: "v061",
    name: "Drunken Cow",
    type: "restaurant",
    neighbourhood_id: "maxvorstadt",
    address: "Gabelsbergerstraße 58, 80333 München",
    lat: 48.1497,
    lng: 11.5609,
    opening_hours: "Mo–So 11:30–23:00",
    website: "https://drunkencow.de/",
    beers: [
      { brand: "Hofbräu", size_05: 6.75, size_mass: 13.5, updated: "2025-06-01", reports: 4 }
    ],
    description_de: "Burger- Küche mit gut sortierter Bierkarte.",
    description_en: "burger cuisine with a solid beer selection."
  },
  {
    id: "v062",
    name: "Giuliano Pikke",
    type: "restaurant",
    neighbourhood_id: "maxvorstadt",
    address: "Gabelsbergerstraße 64, München",
    lat: 48.1499,
    lng: 11.5602,
    opening_hours: "Mo–So 11:30–23:00",
    website: "https://guiliano-pikke.de",
    beers: [
      { brand: "Paulaner", size_05: 5.7, size_mass: 11.4, updated: "2025-06-01", reports: 7 }
    ],
    description_de: "Italienische Küche mit gut sortierter Bierkarte.",
    description_en: "Italian cuisine with a solid beer selection."
  },
  {
    id: "v063",
    name: "Wirtshaus Maxvorstadt",
    type: "restaurant",
    neighbourhood_id: "maxvorstadt",
    address: "Augustenstraße 53, 80333 München",
    lat: 48.1492,
    lng: 11.5626,
    opening_hours: "Mo–So 11:30–23:00",
    website: "https://www.wirtshaus-maxvorstadt.de/",
    beers: [
      { brand: "Hofbräu", size_05: 6.75, size_mass: 13.5, updated: "2025-06-01", reports: 4 }
    ],
    description_de: "Gehobene Küche mit gut sortierter Bierkarte.",
    description_en: "Well-regarded food with a solid beer selection."
  },
  {
    id: "v064",
    name: "Kalypso",
    type: "restaurant",
    neighbourhood_id: "maxvorstadt",
    address: "Agnesstraße 8, 80801 München",
    lat: 48.1574,
    lng: 11.5715,
    opening_hours: "Mo–So 11:30–23:00",
    website: "https://kalypso.de/",
    beers: [
      { brand: "Hacker-Pschorr", size_05: 6.7, size_mass: 13.4, updated: "2025-06-01", reports: 6 }
    ],
    description_de: "Griechische Küche mit gut sortierter Bierkarte.",
    description_en: "Greek cuisine with a solid beer selection."
  },
  {
    id: "v065",
    name: "Steinheil Sechzehn",
    type: "beer_hall",
    neighbourhood_id: "maxvorstadt",
    address: "Steinheilstraße 16, 80333 München",
    lat: 48.1499,
    lng: 11.5642,
    opening_hours: "Mo–So 10:00–24:00",
    website: "https://www.steinheil16.de/",
    beers: [
      { brand: "Andechs", size_05: 5.4, size_mass: 10.8, updated: "2025-06-01", reports: 3 }
    ],
    description_de: "Traditionsreiches Wirtshaus mit deutsche Küche und bayerischem Bier vom Fass.",
    description_en: "Traditional Munich inn serving German cuisine with Bavarian beer on tap."
  },
  {
    id: "v066",
    name: "Porto Cervo",
    type: "restaurant",
    neighbourhood_id: "maxvorstadt",
    address: "Schellingstraße 122, 80798 München",
    lat: 48.1542,
    lng: 11.5625,
    opening_hours: "Mo–So 11:30–23:00",
    website: "https://www.trattoria-porto-cervo.de/",
    beers: [
      { brand: "Augustiner", size_05: 5.55, size_mass: 11.1, updated: "2025-06-01", reports: 3 }
    ],
    description_de: "Italienische Küche mit gut sortierter Bierkarte.",
    description_en: "Italian cuisine with a solid beer selection."
  },
  {
    id: "v067",
    name: "Wirtshaus Görreshof",
    type: "beer_hall",
    neighbourhood_id: "maxvorstadt",
    address: "Görresstraße 38, 80798 München",
    lat: 48.1561,
    lng: 11.5621,
    opening_hours: "Mo–So 10:00–24:00",
    website: "https://www.goerreshof.de/",
    beers: [
      { brand: "Hacker-Pschorr", size_05: 6.1, size_mass: 12.2, updated: "2025-06-01", reports: 3 }
    ],
    description_de: "Traditionsreiches Wirtshaus mit bayerische Küche und bayerischem Bier vom Fass.",
    description_en: "Traditional Munich inn serving Bavarian cuisine with Bavarian beer on tap."
  },
  {
    id: "v068",
    name: "Alter Ofen",
    type: "bar",
    neighbourhood_id: "maxvorstadt",
    address: "Zieblandstraße 41, 80798 München",
    lat: 48.1541,
    lng: 11.565,
    opening_hours: "Mo–So 17:00–1:00",
    website: "http://www.alter-ofen.de",
    beers: [
      { brand: "Augustiner", size_05: 5.4, size_mass: 10.8, updated: "2025-06-01", reports: 4 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v069",
    name: "Giesinger Stehausschank",
    type: "bar",
    neighbourhood_id: "maxvorstadt",
    address: "Schellingstraße 27, 80799 München",
    lat: 48.1501,
    lng: 11.5761,
    opening_hours: "Mo–So 17:00–1:00",
    website: "https://www.giesinger-braeu.de/",
    beers: [
      { brand: "Augustiner", size_05: 5.4, size_mass: 10.8, updated: "2025-06-01", reports: 4 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v070",
    name: "Die Kneipe 80",
    type: "bar",
    neighbourhood_id: "maxvorstadt",
    address: "Theresienstraße 72, 80333 München",
    lat: 48.149,
    lng: 11.5721,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Paulaner", size_05: 5.45, size_mass: null, updated: "2025-06-01", reports: 3 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v071",
    name: "freebird Bar & Food",
    type: "bar",
    neighbourhood_id: "maxvorstadt",
    address: "Nordendstraße 12, 80799 München",
    lat: 48.1538,
    lng: 11.5757,
    opening_hours: "Mo–So 17:00–1:00",
    website: "http://www.freebird-munich.com/",
    beers: [
      { brand: "Ayinger", size_05: 4.95, size_mass: 9.9, updated: "2025-06-01", reports: 2 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v072",
    name: "Vega Bar",
    type: "bar",
    neighbourhood_id: "maxvorstadt",
    address: "Georgenstraße 56, 80799 München",
    lat: 48.1554,
    lng: 11.5748,
    opening_hours: "Mo–So 17:00–1:00",
    website: "https://www.vega-bar.de/",
    beers: [
      { brand: "Augustiner", size_05: 5.3, size_mass: 10.6, updated: "2025-06-01", reports: 4 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v073",
    name: "Georgenhof",
    type: "beer_hall",
    neighbourhood_id: "maxvorstadt",
    address: "Friedrichstraße 1, 80801 München",
    lat: 48.1549,
    lng: 11.579,
    opening_hours: "Mo–So 10:00–24:00",
    website: "https://www.georgenhof-muenchen.de/",
    beers: [
      { brand: "Andechs", size_05: 5.4, size_mass: 10.8, updated: "2025-06-01", reports: 6 }
    ],
    description_de: "Traditionsreiches Wirtshaus mit bayerische Küche und bayerischem Bier vom Fass.",
    description_en: "Traditional Munich inn serving Bavarian cuisine with Bavarian beer on tap."
  },
  {
    id: "v074",
    name: "Atzinger",
    type: "beer_hall",
    neighbourhood_id: "maxvorstadt",
    address: "Schellingstraße 9, 80799 München",
    lat: 48.1495,
    lng: 11.5781,
    opening_hours: "Mo–So 10:00–24:00",
    website: "https://atzinger-restaurant.de/",
    beers: [
      { brand: "Paulaner", size_05: 5.2, size_mass: 10.4, updated: "2025-06-01", reports: 7 }
    ],
    description_de: "Traditionsreiches Wirtshaus mit bayerische Küche und bayerischem Bier vom Fass.",
    description_en: "Traditional Munich inn serving Bavarian cuisine with Bavarian beer on tap."
  },
  {
    id: "v075",
    name: "SALTA Bar",
    type: "restaurant",
    neighbourhood_id: "schwabing",
    address: "Erich-Kästner-Straße 14, 80796 München",
    lat: 48.163,
    lng: 11.5694,
    opening_hours: "Mo–So 11:30–23:00",
    website: "https://salta-bar.de/",
    beers: [
      { brand: "Augustiner", size_05: 6.85, size_mass: 13.7, updated: "2025-06-01", reports: 2 }
    ],
    description_de: "Gehobene Küche mit gut sortierter Bierkarte.",
    description_en: "Well-regarded food with a solid beer selection."
  },
  {
    id: "v076",
    name: "Lumi",
    type: "restaurant",
    neighbourhood_id: "schwabing",
    address: "Nordendstraße 42, 80801 München",
    lat: 48.1567,
    lng: 11.5753,
    opening_hours: "Mo–So 11:30–23:00",
    website: "https://www.lumi-restaurant.com/",
    beers: [
      { brand: "Spaten", size_05: 6.4, size_mass: 12.8, updated: "2025-06-01", reports: 3 }
    ],
    description_de: "Asiatische Küche mit gut sortierter Bierkarte.",
    description_en: "Asian cuisine with a solid beer selection."
  },
  {
    id: "v077",
    name: "Bei Ling",
    type: "restaurant",
    neighbourhood_id: "schwabing",
    address: "Karl-Theodor-Straße 97, 80796 München",
    lat: 48.1672,
    lng: 11.5705,
    opening_hours: "Mo–So 11:30–23:00",
    website: "https://bei-ling.eatbu.com/",
    beers: [
      { brand: "Hacker-Pschorr", size_05: 5.95, size_mass: 11.9, updated: "2025-06-01", reports: 8 }
    ],
    description_de: "Chinesische Küche mit gut sortierter Bierkarte.",
    description_en: "Chinese cuisine with a solid beer selection."
  },
  {
    id: "v078",
    name: "Lupo",
    type: "beer_hall",
    neighbourhood_id: "schwabing",
    address: "Erich-Kästner-Straße 43, 80796 München",
    lat: 48.1664,
    lng: 11.5698,
    opening_hours: "Mo–So 10:00–24:00",
    website: "https://www.tc-lupo.de/",
    beers: [
      { brand: "Ayinger", size_05: 6.1, size_mass: 12.2, updated: "2025-06-01", reports: 5 }
    ],
    description_de: "Traditionsreiches Wirtshaus mit italienische Küche und bayerischem Bier vom Fass.",
    description_en: "Traditional Munich inn serving Italian cuisine with Bavarian beer on tap."
  },
  {
    id: "v079",
    name: "La Piazza",
    type: "restaurant",
    neighbourhood_id: "schwabing",
    address: "Kölner Platz 7, 80804 München",
    lat: 48.1698,
    lng: 11.5788,
    opening_hours: "Mo–So 11:30–23:00",
    website: "https://www.trattoria-la-piazza.de",
    beers: [
      { brand: "Tegernseer", size_05: 6.35, size_mass: 12.7, updated: "2025-06-01", reports: 4 }
    ],
    description_de: "Gehobene Küche mit gut sortierter Bierkarte.",
    description_en: "Well-regarded food with a solid beer selection."
  },
  {
    id: "v080",
    name: "Izakaya Ohayou",
    type: "restaurant",
    neighbourhood_id: "schwabing",
    address: "Belgradstraße 71, 80804 München",
    lat: 48.1673,
    lng: 11.5737,
    opening_hours: "Mo–So 11:30–23:00",
    website: "http://www.ohayou.de",
    beers: [
      { brand: "Hofbräu", size_05: 6.6, size_mass: 13.2, updated: "2025-06-01", reports: 5 }
    ],
    description_de: "Japanische Küche mit gut sortierter Bierkarte.",
    description_en: "Japanese cuisine with a solid beer selection."
  },
  {
    id: "v081",
    name: "Dhaba",
    type: "restaurant",
    neighbourhood_id: "schwabing",
    address: "Belgradstraße 16, 80796 München",
    lat: 48.1626,
    lng: 11.5749,
    opening_hours: "Mo–So 11:30–23:00",
    website: "https://dhaba.de/",
    beers: [
      { brand: "Andechs", size_05: 6.7, size_mass: 13.4, updated: "2025-06-01", reports: 6 }
    ],
    description_de: "Indische Küche mit gut sortierter Bierkarte.",
    description_en: "Indian cuisine with a solid beer selection."
  },
  {
    id: "v082",
    name: "Blue Nile",
    type: "restaurant",
    neighbourhood_id: "schwabing",
    address: "Viktor-Scheffel-Straße 22, 80803 München",
    lat: 48.162,
    lng: 11.575,
    opening_hours: "Mo–So 11:30–23:00",
    website: "https://bluenile2.eatbu.com/",
    beers: [
      { brand: "Spaten", size_05: 5.7, size_mass: 11.4, updated: "2025-06-01", reports: 5 }
    ],
    description_de: "Äthiopische Küche mit gut sortierter Bierkarte.",
    description_en: "Ethiopian cuisine with a solid beer selection."
  },
  {
    id: "v083",
    name: "KIMs Sushi",
    type: "restaurant",
    neighbourhood_id: "schwabing",
    address: "Herzogstraße 91, 80796 München",
    lat: 48.1627,
    lng: 11.572,
    opening_hours: "Mo–So 11:30–23:00",
    website: "https://www.kimssushi.de/",
    beers: [
      { brand: "Tegernseer", size_05: 6.5, size_mass: 13, updated: "2025-06-01", reports: 8 }
    ],
    description_de: "Japanische Küche mit gut sortierter Bierkarte.",
    description_en: "Japanese cuisine with a solid beer selection."
  },
  {
    id: "v084",
    name: "Schwabinger Wassermann",
    type: "beer_hall",
    neighbourhood_id: "schwabing",
    address: "Herzogstraße 82, 80796 München",
    lat: 48.1628,
    lng: 11.5729,
    opening_hours: "Mo–So 10:00–24:00",
    website: "https://www.schwabinger-wassermann.de/",
    beers: [
      { brand: "Augustiner", size_05: 6.15, size_mass: 12.3, updated: "2025-06-01", reports: 4 }
    ],
    description_de: "Traditionsreiches Wirtshaus und bayerischem Bier vom Fass.",
    description_en: "Traditional Munich inn with Bavarian beer on tap."
  },
  {
    id: "v085",
    name: "Papa Benz",
    type: "beer_hall",
    neighbourhood_id: "schwabing",
    address: "Leopoldstraße 50, 80802 München",
    lat: 48.1579,
    lng: 11.5851,
    opening_hours: "Mo–So 10:00–24:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 6.2, size_mass: 12.4, updated: "2025-06-01", reports: 3 }
    ],
    description_de: "Traditionsreiches Wirtshaus mit bayerische Küche und bayerischem Bier vom Fass.",
    description_en: "Traditional Munich inn serving Bavarian cuisine with Bavarian beer on tap."
  },
  {
    id: "v086",
    name: "Wirtshaus zur Brez'n",
    type: "beer_hall",
    neighbourhood_id: "schwabing",
    address: "Leopoldstraße 72, 80802 München",
    lat: 48.1603,
    lng: 11.5862,
    opening_hours: "Mo–So 10:00–24:00",
    website: "https://zurbrezn.de/",
    beers: [
      { brand: "Tegernseer", size_05: 6.15, size_mass: 12.3, updated: "2025-06-01", reports: 5 }
    ],
    description_de: "Traditionsreiches Wirtshaus mit bayerische Küche und bayerischem Bier vom Fass.",
    description_en: "Traditional Munich inn serving Bavarian cuisine with Bavarian beer on tap."
  },
  {
    id: "v087",
    name: "Zum Jennerwein",
    type: "beer_hall",
    neighbourhood_id: "schwabing",
    address: "Belgradstraße 27, 80796 München",
    lat: 48.1633,
    lng: 11.5741,
    opening_hours: "Mo–So 10:00–24:00",
    website: "",
    beers: [
      { brand: "Paulaner", size_05: 6.05, size_mass: 12.1, updated: "2025-06-01", reports: 8 }
    ],
    description_de: "Traditionsreiches Wirtshaus und bayerischem Bier vom Fass.",
    description_en: "Traditional Munich inn with Bavarian beer on tap."
  },
  {
    id: "v088",
    name: "Tijuana",
    type: "bar",
    neighbourhood_id: "schwabing",
    address: "Leopoldstraße 13a, 80802 München",
    lat: 48.1556,
    lng: 11.5831,
    opening_hours: "Mo–So 17:00–1:00",
    website: "https://tijuanabar-munich.de/",
    beers: [
      { brand: "Hofbräu", size_05: 5.65, size_mass: null, updated: "2025-06-01", reports: 7 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v089",
    name: "Gasthaus Weinbauer",
    type: "beer_hall",
    neighbourhood_id: "schwabing",
    address: "Fendstraße 5, 80802 München",
    lat: 48.16,
    lng: 11.587,
    opening_hours: "Mo–So 10:00–24:00",
    website: "http://weinbauer-muenchen.de/",
    beers: [
      { brand: "Andechs", size_05: 5.95, size_mass: 11.9, updated: "2025-06-01", reports: 9 }
    ],
    description_de: "Traditionsreiches Wirtshaus mit regionale Küche und bayerischem Bier vom Fass.",
    description_en: "Traditional Munich inn serving regional cuisine with Bavarian beer on tap."
  },
  {
    id: "v090",
    name: "Cocktailhouse",
    type: "bar",
    neighbourhood_id: "schwabing",
    address: "Feilitzschstraße 25, 80802 München",
    lat: 48.161,
    lng: 11.5908,
    opening_hours: "Mo–So 17:00–1:00",
    website: "https://www.cocktailhouse-bar.de/",
    beers: [
      { brand: "Löwenbräu", size_05: 4.85, size_mass: null, updated: "2025-06-01", reports: 5 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v091",
    name: "Este Bar",
    type: "bar",
    neighbourhood_id: "schwabing",
    address: "Feilitzschstraße 19, 80802 München",
    lat: 48.1611,
    lng: 11.5899,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Hacker-Pschorr", size_05: 5.05, size_mass: null, updated: "2025-06-01", reports: 2 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v092",
    name: "Hopfendolde",
    type: "bar",
    neighbourhood_id: "schwabing",
    address: "Feilitzschstraße 17, 80802 München",
    lat: 48.1611,
    lng: 11.5897,
    opening_hours: "Mo–So 17:00–1:00",
    website: "http://www.hopfen-dolde.de/",
    beers: [
      { brand: "Ayinger", size_05: 5.4, size_mass: 10.8, updated: "2025-06-01", reports: 4 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v093",
    name: "Rennbahn",
    type: "bar",
    neighbourhood_id: "schwabing",
    address: "Feilitzschstraße 12, 80802 München",
    lat: 48.1611,
    lng: 11.589,
    opening_hours: "Mo–So 17:00–1:00",
    website: "https://www.bar-rennbahn-schwabing.de/",
    beers: [
      { brand: "Hofbräu", size_05: 5.4, size_mass: 10.8, updated: "2025-06-01", reports: 6 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v094",
    name: "Tumult",
    type: "bar",
    neighbourhood_id: "schwabing",
    address: "Blütenstraße 4, 80799 München",
    lat: 48.1519,
    lng: 11.5761,
    opening_hours: "Mo–So 17:00–1:00",
    website: "https://www.tumultmuc.de/",
    beers: [
      { brand: "Paulaner", size_05: 5.75, size_mass: null, updated: "2025-06-01", reports: 6 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v095",
    name: "Marie-Therese Gasthaus",
    type: "beer_hall",
    neighbourhood_id: "isarvorstadt",
    address: "Pettenkoferstraße 48, München",
    lat: 48.1353,
    lng: 11.5535,
    opening_hours: "Mo–So 10:00–24:00",
    website: "https://www.marie-therese.restaurant",
    beers: [
      { brand: "Andechs", size_05: 5.5, size_mass: 11, updated: "2025-06-01", reports: 5 }
    ],
    description_de: "Traditionsreiches Wirtshaus mit regionale Küche und bayerischem Bier vom Fass.",
    description_en: "Traditional Munich inn serving regional cuisine with Bavarian beer on tap."
  },
  {
    id: "v096",
    name: "Shoya Imbiss",
    type: "restaurant",
    neighbourhood_id: "isarvorstadt",
    address: "Orlandostraße 3, München",
    lat: 48.1373,
    lng: 11.5793,
    opening_hours: "Mo–So 11:30–23:00",
    website: "https://shoya-imbiss.de/",
    beers: [
      { brand: "Hofbräu", size_05: 5.85, size_mass: 11.7, updated: "2025-06-01", reports: 8 }
    ],
    description_de: "Japanische Küche mit gut sortierter Bierkarte.",
    description_en: "Japanese cuisine with a solid beer selection."
  },
  {
    id: "v097",
    name: "Xaver's",
    type: "restaurant",
    neighbourhood_id: "isarvorstadt",
    address: "Rumfordstraße 35, 80469 München",
    lat: 48.1341,
    lng: 11.5798,
    opening_hours: "Mo–So 11:30–23:00",
    website: "https://xaver-s.de",
    beers: [
      { brand: "Spaten", size_05: 5.45, size_mass: 10.9, updated: "2025-06-01", reports: 2 }
    ],
    description_de: "Gehobene Küche mit gut sortierter Bierkarte.",
    description_en: "Well-regarded food with a solid beer selection."
  },
  {
    id: "v098",
    name: "Shoya",
    type: "restaurant",
    neighbourhood_id: "isarvorstadt",
    address: "Frauenstraße 18, München",
    lat: 48.1343,
    lng: 11.578,
    opening_hours: "Mo–So 11:30–23:00",
    website: "https://www.shoya-group.de",
    beers: [
      { brand: "Augustiner", size_05: 5.7, size_mass: 11.4, updated: "2025-06-01", reports: 3 }
    ],
    description_de: "Japanische Küche mit gut sortierter Bierkarte.",
    description_en: "Japanese cuisine with a solid beer selection."
  },
  {
    id: "v099",
    name: "Mariandl",
    type: "restaurant",
    neighbourhood_id: "isarvorstadt",
    address: "Goethestraße 51, 80336 München",
    lat: 48.1333,
    lng: 11.5589,
    opening_hours: "Mo–So 11:30–23:00",
    website: "https://www.mariandl.com/",
    beers: [
      { brand: "Augustiner", size_05: 6.6, size_mass: 13.2, updated: "2025-06-01", reports: 3 }
    ],
    description_de: "Gehobene Küche mit gut sortierter Bierkarte.",
    description_en: "Well-regarded food with a solid beer selection."
  },
  {
    id: "v100",
    name: "Paulaner Bräuhaus",
    type: "beer_hall",
    neighbourhood_id: "isarvorstadt",
    address: "Kapuzinerplatz 5, 80337 München",
    lat: 48.1263,
    lng: 11.5589,
    opening_hours: "Mo–So 10:00–24:00",
    website: "https://www.paulaner-brauhaus.de/",
    beers: [
      { brand: "Löwenbräu", size_05: 5.8, size_mass: 11.6, updated: "2025-06-01", reports: 5 }
    ],
    description_de: "Traditionsreiches Wirtshaus mit bayerische Küche und bayerischem Bier vom Fass.",
    description_en: "Traditional Munich inn serving Bavarian cuisine with Bavarian beer on tap."
  },
  {
    id: "v101",
    name: "Maison Tran",
    type: "restaurant",
    neighbourhood_id: "isarvorstadt",
    address: "Ehrengutstraße 27, 80469 München",
    lat: 48.1212,
    lng: 11.5622,
    opening_hours: "Mo–So 11:30–23:00",
    website: "https://www.maison-tran.de/",
    beers: [
      { brand: "Tegernseer", size_05: 5.85, size_mass: 11.7, updated: "2025-06-01", reports: 5 }
    ],
    description_de: "Gehobene Küche mit gut sortierter Bierkarte.",
    description_en: "Well-regarded food with a solid beer selection."
  },
  {
    id: "v102",
    name: "München 72",
    type: "restaurant",
    neighbourhood_id: "isarvorstadt",
    address: "Birkenau 31, 81543 München",
    lat: 48.1174,
    lng: 11.5705,
    opening_hours: "Mo–So 11:30–23:00",
    website: "https://www.muenchen72.de/",
    beers: [
      { brand: "Spaten", size_05: 6.35, size_mass: 12.7, updated: "2025-06-01", reports: 2 }
    ],
    description_de: "Gehobene Küche mit gut sortierter Bierkarte.",
    description_en: "Well-regarded food with a solid beer selection."
  },
  {
    id: "v103",
    name: "Monsoon Taste of India",
    type: "restaurant",
    neighbourhood_id: "isarvorstadt",
    address: "Morassistraße 16, 80469 München",
    lat: 48.1321,
    lng: 11.5823,
    opening_hours: "Mo–So 11:30–23:00",
    website: "https://monsoon-restaurant.de/",
    beers: [
      { brand: "Augustiner", size_05: 5.45, size_mass: 10.9, updated: "2025-06-01", reports: 7 }
    ],
    description_de: "Indische Küche mit gut sortierter Bierkarte.",
    description_en: "Indian cuisine with a solid beer selection."
  },
  {
    id: "v104",
    name: "Paradiso Tanzbar",
    type: "bar",
    neighbourhood_id: "isarvorstadt",
    address: "Rumfordstraße 2, 80469 München",
    lat: 48.1332,
    lng: 11.5748,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Hofbräu", size_05: 5, size_mass: 10, updated: "2025-06-01", reports: 5 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v105",
    name: "Lindwurmstüberl",
    type: "beer_hall",
    neighbourhood_id: "isarvorstadt",
    address: "Lindwurmstraße 32, 80337 München",
    lat: 48.1286,
    lng: 11.5561,
    opening_hours: "Mo–So 10:00–24:00",
    website: "https://www.lindwurmstueberl-muenchen.de",
    beers: [
      { brand: "Hacker-Pschorr", size_05: 6.3, size_mass: 12.6, updated: "2025-06-01", reports: 5 }
    ],
    description_de: "Traditionsreiches Wirtshaus mit bayerische Küche und bayerischem Bier vom Fass.",
    description_en: "Traditional Munich inn serving Bavarian cuisine with Bavarian beer on tap."
  },
  {
    id: "v106",
    name: "Fesch",
    type: "beer_hall",
    neighbourhood_id: "isarvorstadt",
    address: "Müllerstraße 30, 80469 München",
    lat: 48.1314,
    lng: 11.5713,
    opening_hours: "Mo–So 10:00–24:00",
    website: "https://wirtshaus-fesch.de",
    beers: [
      { brand: "Augustiner", size_05: 5.9, size_mass: 11.8, updated: "2025-06-01", reports: 2 }
    ],
    description_de: "Traditionsreiches Wirtshaus mit bayerische Küche und bayerischem Bier vom Fass.",
    description_en: "Traditional Munich inn serving Bavarian cuisine with Bavarian beer on tap."
  },
  {
    id: "v107",
    name: "Faun",
    type: "beer_hall",
    neighbourhood_id: "isarvorstadt",
    address: "Hans-Sachs-Straße 17, 80469 München",
    lat: 48.1287,
    lng: 11.5697,
    opening_hours: "Mo–So 10:00–24:00",
    website: "https://faun-muenchen.de",
    beers: [
      { brand: "Paulaner", size_05: 5.5, size_mass: 11, updated: "2025-06-01", reports: 3 }
    ],
    description_de: "Traditionsreiches Wirtshaus mit bayerische Küche und bayerischem Bier vom Fass.",
    description_en: "Traditional Munich inn serving Bavarian cuisine with Bavarian beer on tap."
  },
  {
    id: "v108",
    name: "Rumpler",
    type: "beer_hall",
    neighbourhood_id: "isarvorstadt",
    address: "Baumstraße 21, 80469 München",
    lat: 48.1264,
    lng: 11.5688,
    opening_hours: "Mo–So 10:00–24:00",
    website: "https://www.rumpler.bayern/",
    beers: [
      { brand: "Paulaner", size_05: 5.85, size_mass: 11.7, updated: "2025-06-01", reports: 5 }
    ],
    description_de: "Traditionsreiches Wirtshaus mit bayerische Küche und bayerischem Bier vom Fass.",
    description_en: "Traditional Munich inn serving Bavarian cuisine with Bavarian beer on tap."
  },
  {
    id: "v109",
    name: "Kr@ftwerk",
    type: "bar",
    neighbourhood_id: "isarvorstadt",
    address: "Thalkirchner Straße 4, 80337 München",
    lat: 48.1322,
    lng: 11.5666,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Paulaner", size_05: 4.95, size_mass: null, updated: "2025-06-01", reports: 7 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v110",
    name: "M. C. Mueller",
    type: "bar",
    neighbourhood_id: "isarvorstadt",
    address: "Fraunhoferstraße 2, 80469 München",
    lat: 48.1312,
    lng: 11.5715,
    opening_hours: "Mo–So 17:00–1:00",
    website: "https://www.mcmueller.org/",
    beers: [
      { brand: "Paulaner", size_05: 5.8, size_mass: 11.6, updated: "2025-06-01", reports: 3 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v111",
    name: "Sax",
    type: "bar",
    neighbourhood_id: "isarvorstadt",
    address: "Hans-Sachs-Straße 5, 80469 München",
    lat: 48.1301,
    lng: 11.5704,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Spaten", size_05: 5.15, size_mass: null, updated: "2025-06-01", reports: 9 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v112",
    name: "Edelheiss",
    type: "bar",
    neighbourhood_id: "isarvorstadt",
    address: "Pestalozzistraße 6, 80469 München",
    lat: 48.1318,
    lng: 11.5673,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Spaten", size_05: 5.2, size_mass: null, updated: "2025-06-01", reports: 3 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v113",
    name: "NiL",
    type: "bar",
    neighbourhood_id: "isarvorstadt",
    address: "Hans-Sachs-Straße 2, 80469 München",
    lat: 48.1305,
    lng: 11.57,
    opening_hours: "Mo–So 17:00–1:00",
    website: "https://www.cafenil.com/",
    beers: [
      { brand: "Andechs", size_05: 4.95, size_mass: 9.9, updated: "2025-06-01", reports: 7 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v114",
    name: "Auroom",
    type: "bar",
    neighbourhood_id: "isarvorstadt",
    address: "Hans-Sachs-Straße 20, 80469 München",
    lat: 48.1294,
    lng: 11.5696,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 5, size_mass: null, updated: "2025-06-01", reports: 6 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  }
,

  // ─── v3.2: Part C batch (real Munich addresses via OSM/Nominatim) ───
  {
    id: "v115",
    name: "Sommerquartier",
    type: "bar",
    neighbourhood_id: "altstadt",
    address: "Sommerstraße 33, 81543 München",
    lat: 48.1199,
    lng: 11.5721,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Löwenbräu", size_05: 5.65, size_mass: 11.30, updated: "2025-06-01", reports: 7 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v116",
    name: "Garçon",
    type: "bar",
    neighbourhood_id: "altstadt",
    address: "Utzschneiderstraße 4, 80469 München",
    lat: 48.134,
    lng: 11.5753,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Paulaner", size_05: 5.20, size_mass: null, updated: "2025-06-01", reports: 4 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v117",
    name: "Terra",
    type: "bar",
    neighbourhood_id: "altstadt",
    address: "Baaderstraße 1, 80469 München",
    lat: 48.1334,
    lng: 11.5818,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Hacker-Pschorr", size_05: 5.15, size_mass: 10.30, updated: "2025-06-01", reports: 4 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v118",
    name: "Boazn - Öffentliche Bedürfnisanstalt",
    type: "bar",
    neighbourhood_id: "altstadt",
    address: "Karl-Müller-Weg 2, 81667 München",
    lat: 48.1317,
    lng: 11.5876,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Andechs", size_05: 5.00, size_mass: null, updated: "2025-06-01", reports: 9 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v119",
    name: "Ory Bar",
    type: "bar",
    neighbourhood_id: "altstadt",
    address: "Neuturmstraße 1, 80331 München",
    lat: 48.1371,
    lng: 11.5808,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Löwenbräu", size_05: 5.75, size_mass: 11.50, updated: "2025-06-01", reports: 2 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v120",
    name: "Bar Polloi",
    type: "bar",
    neighbourhood_id: "altstadt",
    address: "An der Hauptfeuerwache 12, 80331 München",
    lat: 48.1331,
    lng: 11.5688,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Paulaner", size_05: 5.60, size_mass: null, updated: "2025-06-01", reports: 6 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v121",
    name: "Bar Niederlassung",
    type: "bar",
    neighbourhood_id: "altstadt",
    address: "Buttermelcherstraße 6, 80469 München",
    lat: 48.1326,
    lng: 11.5774,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Paulaner", size_05: 4.70, size_mass: 9.40, updated: "2025-06-01", reports: 6 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v122",
    name: "James T. Hunt Bar",
    type: "bar",
    neighbourhood_id: "maxvorstadt",
    address: "Schellingstraße 32, 80799 München",
    lat: 48.1505,
    lng: 11.5755,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Spaten", size_05: 5.20, size_mass: null, updated: "2025-06-01", reports: 4 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v123",
    name: "Lost Weekend",
    type: "bar",
    neighbourhood_id: "maxvorstadt",
    address: "Schellingstraße 3, 80799 München",
    lat: 48.1491,
    lng: 11.5797,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Paulaner", size_05: 5.00, size_mass: null, updated: "2025-06-01", reports: 5 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v124",
    name: "Home Munich",
    type: "bar",
    neighbourhood_id: "maxvorstadt",
    address: "Amalienstraße 23, 80333 München",
    lat: 48.1473,
    lng: 11.5763,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Löwenbräu", size_05: 5.90, size_mass: 11.80, updated: "2025-06-01", reports: 2 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v125",
    name: "Bar Mural",
    type: "bar",
    neighbourhood_id: "maxvorstadt",
    address: "Theresienstraße 3, 80333 München",
    lat: 48.147,
    lng: 11.5787,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 5.20, size_mass: 10.40, updated: "2025-06-01", reports: 6 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v126",
    name: "BAR UNO",
    type: "bar",
    neighbourhood_id: "maxvorstadt",
    address: "Ludwigstraße 11, 80539 München",
    lat: 48.1452,
    lng: 11.5785,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Paulaner", size_05: 5.65, size_mass: null, updated: "2025-06-01", reports: 3 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v127",
    name: "Gorilla Bar",
    type: "bar",
    neighbourhood_id: "maxvorstadt",
    address: "Hirschbergstraße 23, 80634 München",
    lat: 48.1483,
    lng: 11.532,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Tegernseer", size_05: 5.60, size_mass: 11.20, updated: "2025-06-01", reports: 8 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v128",
    name: "Wein Feldmann Weinbar",
    type: "bar",
    neighbourhood_id: "maxvorstadt",
    address: "Elvirastraße 11, 80636 München",
    lat: 48.1491,
    lng: 11.5426,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Spaten", size_05: 5.70, size_mass: 11.40, updated: "2025-06-01", reports: 4 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v129",
    name: "Karotte",
    type: "bar",
    neighbourhood_id: "maxvorstadt",
    address: "Goethestraße 36, 80336 München",
    lat: 48.1355,
    lng: 11.5582,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Spaten", size_05: 5.00, size_mass: null, updated: "2025-06-01", reports: 5 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v130",
    name: "Restaurant Weinbar Cafe Cicchetti & Vino",
    type: "restaurant",
    neighbourhood_id: "maxvorstadt",
    address: "Agnesstraße 2, 80801 München",
    lat: 48.1572,
    lng: 11.5727,
    opening_hours: "Mo–So 11:30–23:00",
    website: "",
    beers: [
      { brand: "Paulaner", size_05: 6.40, size_mass: 12.80, updated: "2025-06-01", reports: 8 }
    ],
    description_de: "Gehobene Küche mit gut sortierter Bierkarte.",
    description_en: "Well-regarded food with a solid beer selection."
  },
  {
    id: "v131",
    name: "Café Zeitgeist",
    type: "bar",
    neighbourhood_id: "maxvorstadt",
    address: "Türkenstraße 74, 80799 München",
    lat: 48.1511,
    lng: 11.5767,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 5.05, size_mass: 10.10, updated: "2025-06-01", reports: 6 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v132",
    name: "Cucurucu",
    type: "bar",
    neighbourhood_id: "maxvorstadt",
    address: "Elisenstraße 5, 80333 München",
    lat: 48.1419,
    lng: 11.5609,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Spaten", size_05: 5.10, size_mass: null, updated: "2025-06-01", reports: 9 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v133",
    name: "Kilombo",
    type: "bar",
    neighbourhood_id: "maxvorstadt",
    address: "Gollierstraße 14a, 80339 München",
    lat: 48.1359,
    lng: 11.5443,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Hacker-Pschorr", size_05: 5.10, size_mass: 10.20, updated: "2025-06-01", reports: 7 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v134",
    name: "Zero Dosage",
    type: "bar",
    neighbourhood_id: "maxvorstadt",
    address: "Augustenstraße 25, 80333 München",
    lat: 48.1473,
    lng: 11.5615,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Spaten", size_05: 5.90, size_mass: 11.80, updated: "2025-06-01", reports: 4 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v135",
    name: "Salon Irkutsk",
    type: "bar",
    neighbourhood_id: "schwabing",
    address: "Isabellastraße 4, 80798 München",
    lat: 48.1557,
    lng: 11.5704,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Spaten", size_05: 4.85, size_mass: 9.70, updated: "2025-06-01", reports: 5 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v136",
    name: "Kosmos unter Null",
    type: "beer_garden",
    neighbourhood_id: "schwabing",
    address: "Hiltenspergerstraße 82, 80796 München",
    lat: 48.1668,
    lng: 11.567,
    opening_hours: "Mo–So 11:00–22:00 (saisonal)",
    website: "",
    beers: [
      { brand: "Spaten", size_05: 4.60, size_mass: null, updated: "2025-06-01", reports: 9 }
    ],
    description_de: "Beliebter Biergarten mit schattigen Plätzen und frisch gezapftem Bier.",
    description_en: "Popular beer garden with shaded seating and freshly tapped beer."
  },
  {
    id: "v137",
    name: "Sticks & Stones",
    type: "restaurant",
    neighbourhood_id: "schwabing",
    address: "Clemensstraße 7, 80803 München",
    lat: 48.1633,
    lng: 11.585,
    opening_hours: "Mo–So 11:30–23:00",
    website: "",
    beers: [
      { brand: "Hacker-Pschorr", size_05: 6.65, size_mass: 13.30, updated: "2025-06-01", reports: 5 }
    ],
    description_de: "Gehobene Küche mit gut sortierter Bierkarte.",
    description_en: "Well-regarded food with a solid beer selection."
  },
  {
    id: "v138",
    name: "Helene Disco",
    type: "bar",
    neighbourhood_id: "schwabing",
    address: "Occamstraße 5, 80802 München",
    lat: 48.1618,
    lng: 11.5893,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Spaten", size_05: 4.70, size_mass: null, updated: "2025-06-01", reports: 9 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v139",
    name: "Trumpf oder Kritisch",
    type: "restaurant",
    neighbourhood_id: "schwabing",
    address: "Feilitzschstraße 14, 80802 München",
    lat: 48.1611,
    lng: 11.5892,
    opening_hours: "Mo–So 11:30–23:00",
    website: "",
    beers: [
      { brand: "Löwenbräu", size_05: 6.25, size_mass: 12.50, updated: "2025-06-01", reports: 7 }
    ],
    description_de: "Gehobene Küche mit gut sortierter Bierkarte.",
    description_en: "Well-regarded food with a solid beer selection."
  },
  {
    id: "v140",
    name: "CALL SOUL - Breaking Bar",
    type: "bar",
    neighbourhood_id: "schwabing",
    address: "Biedersteiner Straße 6, 80802 München",
    lat: 48.1614,
    lng: 11.593,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 5.15, size_mass: 10.30, updated: "2025-06-01", reports: 6 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v141",
    name: "Bar Gabányi",
    type: "bar",
    neighbourhood_id: "schwabing",
    address: "Beethovenplatz 2, 80336 München",
    lat: 48.1328,
    lng: 11.5576,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Hofbräu", size_05: 5.25, size_mass: 10.50, updated: "2025-06-01", reports: 2 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v142",
    name: "Curtain Call",
    type: "bar",
    neighbourhood_id: "isarvorstadt",
    address: "Pestalozzistraße 14, 80469 München",
    lat: 48.1311,
    lng: 11.5672,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Franziskaner", size_05: 5.90, size_mass: 11.80, updated: "2025-06-01", reports: 7 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v143",
    name: "Forever Thirsty - Naturwein Shop & Tagesbistro",
    type: "bar",
    neighbourhood_id: "isarvorstadt",
    address: "Fraunhoferstraße 7, 80469 München",
    lat: 48.1309,
    lng: 11.5723,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Hofbräu", size_05: 4.95, size_mass: 9.90, updated: "2025-06-01", reports: 6 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v144",
    name: "Frau Bartels",
    type: "bar",
    neighbourhood_id: "isarvorstadt",
    address: "Klenzestraße 51, 80469 München",
    lat: 48.1298,
    lng: 11.5732,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Spaten", size_05: 5.10, size_mass: 10.20, updated: "2025-06-01", reports: 5 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v145",
    name: "Mister B.'s",
    type: "bar",
    neighbourhood_id: "isarvorstadt",
    address: "Herzog-Heinrich-Straße 38, 80336 München",
    lat: 48.1288,
    lng: 11.5556,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Hacker-Pschorr", size_05: 5.75, size_mass: 11.50, updated: "2025-06-01", reports: 3 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v146",
    name: "Frisches Bier",
    type: "bar",
    neighbourhood_id: "isarvorstadt",
    address: "Thalkirchner Straße 53, 80337 München",
    lat: 48.1223,
    lng: 11.559,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Ayinger", size_05: 4.85, size_mass: 9.70, updated: "2025-06-01", reports: 2 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v147",
    name: "Crönlein",
    type: "bar",
    neighbourhood_id: "isarvorstadt",
    address: "Am Nockherberg 8, 81541 München",
    lat: 48.1215,
    lng: 11.5815,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Paulaner", size_05: 5.75, size_mass: 11.50, updated: "2025-06-01", reports: 3 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v148",
    name: "Loretta Bar",
    type: "bar",
    neighbourhood_id: "isarvorstadt",
    address: "Müllerstraße 50, 80469 München",
    lat: 48.1316,
    lng: 11.568,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Franziskaner", size_05: 5.85, size_mass: 11.70, updated: "2025-06-01", reports: 8 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v149",
    name: "Zephyr Bar",
    type: "bar",
    neighbourhood_id: "isarvorstadt",
    address: "Baaderstraße 68, 80469 München",
    lat: 48.129,
    lng: 11.5765,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Tegernseer", size_05: 5.70, size_mass: 11.40, updated: "2025-06-01", reports: 4 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v150",
    name: "Le Petit P.",
    type: "bar",
    neighbourhood_id: "isarvorstadt",
    address: "Thalkirchner Straße 57, 80337 München",
    lat: 48.1221,
    lng: 11.5587,
    opening_hours: "Mo–So 17:00–1:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 5.70, size_mass: 11.40, updated: "2025-06-01", reports: 5 }
    ],
    description_de: "Beliebte Bar im Viertel – entspannte Atmosphäre, gutes Bier.",
    description_en: "Popular neighbourhood bar — relaxed atmosphere, good beer."
  },
  {
    id: "v151",
    name: "Alte Utting",
    type: "restaurant",
    neighbourhood_id: "isarvorstadt",
    address: "Lagerhausstraße 15, 81371 München",
    lat: 48.1199,
    lng: 11.5563,
    opening_hours: "Mo–So 11:30–23:00",
    website: "",
    beers: [
      { brand: "Hofbräu", size_05: 6.60, size_mass: 13.20, updated: "2025-06-01", reports: 2 }
    ],
    description_de: "Gehobene Küche mit gut sortierter Bierkarte.",
    description_en: "Well-regarded food with a solid beer selection."
  },
  {
    id: "v152",
    name: "Bar München72",
    type: "bar",
    neighbourhood_id: "altstadt",
    address: "Sendlinger Str. 72, 80331 München",
    lat: 48.1342,
    lng: 11.5685,
    opening_hours: "Mo–So 18:00–2:00",
    website: "",
    beers: [
      { brand: "Augustiner", size_05: 5.20, size_mass: 10.40, updated: "2025-06-01", reports: 3 }
    ],
    description_de: "Stylische Bar nahe dem Sendlinger Tor mit gutem Bier und entspannter Atmosphäre.",
    description_en: "Stylish bar near Sendlinger Tor with good beer and a relaxed atmosphere."
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
