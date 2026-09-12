export const de = {
  translation: {
    nav: {
      title: "MünchnerBierpreis",
      subtitle: "Finde dein Helles",
      language: "EN"
    },
    search: {
      placeholder: "Lokal, Viertel, Straße, Marke oder Typ suchen...",
      filters: "Filter",
      clear: "Alle zurücksetzen",
      results: "Ergebnisse",
      noResults: "Keine Lokale gefunden"
    },
    filters: {
      type: "Art des Lokals",
      priceRange: "Preisbereich (0,5L)",
      brand: "Biermarke",
      neighbourhood: "Stadtteil",
      all: "Alle",
      types: {
        beer_garden: "Biergarten",
        beer_hall: "Wirtshaus / Bierhalle",
        bar: "Bar",
        restaurant: "Restaurant"
      }
    },
    map: {
      hover: "Hover über ein Viertel",
      avgPrice: "Ø Preis (0,5L)",
      venues: "Lokale",
      noData: "Noch keine Daten",
      legend: {
        title: "Preis pro 0,5L",
        cheap: "Günstig",
        expensive: "Teuer"
      }
    },
    venue: {
      type: {
        beer_garden: "Biergarten",
        beer_hall: "Wirtshaus",
        bar: "Bar",
        restaurant: "Restaurant"
      },
      price05: "0,5L Helles",
      priceMass: "Maß (1L)",
      brand: "Biermarke",
      lastUpdated: "Zuletzt geprüft",
      reports: "Meldungen",
      address: "Adresse",
      hours: "Öffnungszeiten",
      directions: "Route",
      otherBeers: "Weitere Biere hier",
      noHistory: "Noch keine Preisgeschichte für dieses Lokal.",
      brandsCount: "{{count}} Marken",
      daysAtPrice: "{{count}} Tage",
      current: "aktuell",
      disclaimer: "Preise sind community-gemeldete Schätzungen. Bitte vor dem Besuch vor Ort prüfen.",
      confidence: {
        low: "Wenig Daten",
        medium: "Einige Meldungen",
        high: "Gut bestätigt"
      },
      outdated: "Möglicherweise veraltet",
      freshness: {
        fresh: "Aktueller Preis",
        aging: "Etwas älter",
        stale: "Veraltet",
        monthsAgo: "Monate her"
      }
    },
    stats: {
      cityAvg: "Ø München",
      cheapest: "Günstigstes",
      priciest: "Teuerstes",
      byNeighbourhood: "Nach Viertel"
    },
    submission: {
      title: "Preis melden",
      newVenue: "Neues Lokal hinzufügen",
      selectVenue: "Lokal auswählen",
      brand: "Biermarke",
      size: "Größe",
      price: "Preis (€)",
      date: "Besuchsdatum",
      name: "Dein Name",
      anonymous: "Anonym",
      photo: "Foto der Preisliste (optional)",
      submit: "Absenden",
      success: "Danke! Deine Meldung wird geprüft.",
      error: "Fehler beim Absenden. Bitte versuche es erneut.",
      pricePlaceholder: "z.B. 4,80",
      namePlaceholder: "Dein Name oder leer lassen",
      thisVenuesBrands: "Biere dieses Lokals",
      allBrands: "Alle Marken",
      otherBrandPlaceholder: "Markenname eingeben"
    },
    report: {
      button: "Melden",
      title: "Was möchtest du melden?",
      back: "Zurück",
      topics: {
        price_change: "Preis hat sich geändert",
        new_beer: "Anderes Bier verfügbar",
        closed: "Lokal dauerhaft geschlossen",
        other_info: "Andere falsche Info"
      },
      errBrandPrice: "Marke und Preis sind erforderlich",
      errNote: "Bitte beschreibe, was falsch ist",
      closedConfirm: "Bestätige, dass dieses Lokal dauerhaft geschlossen ist.",
      confirmClosed: "Ja, geschlossen",
      noteOptional: "Anmerkung (optional)",
      noteLabel: "Was ist falsch?",
      notePlaceholder: "Beschreibe das Problem..."
    },
    missingBar: {
      fab: "Fehlt ein Lokal?",
      title: "Fehlt ein Lokal?",
      searchLabel: "Zuerst suchen",
      searchPlaceholder: "Name des Lokals...",
      searchError: "Suche fehlgeschlagen. Bitte versuche es erneut.",
      noResults: "Keine Treffer gefunden.",
      mightExist: "Dieses Lokal könnte schon auf der Karte sein!",
      didYouMean: "Meintest du: {{name}}?",
      addManually: "Nicht gefunden? Manuell hinzufügen",
      priceMassOptional: "Preis Maß (1L, optional)",
      photoOptional: "Foto (optional)",
      continue: "Weiter",
      errName: "Name ist erforderlich",
      errNeighbourhood: "Stadtteil ist erforderlich",
      errBrand: "Biermarke ist erforderlich",
      errPrice: "Preis (0,5L) ist erforderlich",
      noCoords: "Keine Koordinaten gesetzt — unser Team prüft die Adresse.",
      success: "Danke! Wir prüfen deine Meldung innerhalb von 48 Stunden."
    },
    admin: {
      login: "Admin-Login",
      username: "Benutzername",
      password: "Passwort",
      signin: "Anmelden",
      dashboard: "Dashboard",
      pending: "Ausstehend",
      approved: "Genehmigt",
      rejected: "Abgelehnt",
      outliers: "Ausreißer",
      totalVenues: "Lokale gesamt",
      approve: "Genehmigen",
      reject: "Ablehnen",
      logout: "Abmelden",
      noSubmissions: "Keine Meldungen",
      submissions: "Meldungen",
      rejectReasonPrompt: "Grund für Ablehnung (optional):",
      venues: {
        tab: "Lokale",
        total: "{{count}} Lokale",
        addTitle: "Lokal hinzufügen",
        editTitle: "Lokal bearbeiten",
        name: "Name",
        beers: "Biere",
        cheapest: "Günstigstes",
        edit: "Bearbeiten",
        save: "Speichern",
        close: "Schließen",
        cancel: "Abbrechen",
        create: "Erstellen",
        addAnotherBeer: "Weiteres Bier hinzufügen",
        errName: "Name und Stadtteil sind erforderlich",
        errBeer: "Mindestens eine Marke mit Preis ist erforderlich",
        errPrice: "Ungültiger Preis",
        searchPlaceholder: "Nach Name, Stadtteil oder Marke suchen...",
        deleteBeer: "Löschen",
        confirmDelete: "{{brand}} wirklich löschen?",
        lastBeer: "Ein Lokal muss mindestens ein Bier haben"
      }
    },
    priceHistory: "Preisentwicklung",
    sortBy: "Sortieren nach",
    sortPrice: "Preis",
    sortName: "Name",
    backToMap: "Zurück zur Karte",
    loading: "Wird geladen...",
    trends: {
      button: "Preistrends",
      title: "Preistrends",
      subtitle: "Ø Preis für 0,5L Helles pro Viertel, über Zeit",
      error: "Trends konnten nicht geladen werden.",
      noData: "Noch keine Trenddaten vorhanden."
    }
  }
};

export const en = {
  translation: {
    nav: {
      title: "MünchnerBierpreis",
      subtitle: "Find your Helles",
      language: "DE"
    },
    search: {
      placeholder: "Search venue, area, street, brand or type...",
      filters: "Filters",
      clear: "Clear all",
      results: "Results",
      noResults: "No venues found"
    },
    filters: {
      type: "Venue type",
      priceRange: "Price range (0.5L)",
      brand: "Beer brand",
      neighbourhood: "Neighbourhood",
      all: "All",
      types: {
        beer_garden: "Beer Garden",
        beer_hall: "Beer Hall / Inn",
        bar: "Bar",
        restaurant: "Restaurant"
      }
    },
    map: {
      hover: "Hover over a neighbourhood",
      avgPrice: "Avg price (0.5L)",
      venues: "venues",
      noData: "No data yet",
      legend: {
        title: "Price per 0.5L",
        cheap: "Cheap",
        expensive: "Expensive"
      }
    },
    venue: {
      type: {
        beer_garden: "Beer Garden",
        beer_hall: "Beer Hall",
        bar: "Bar",
        restaurant: "Restaurant"
      },
      price05: "0.5L Helles",
      priceMass: "Maß (1L)",
      brand: "Beer brand",
      lastUpdated: "Last confirmed",
      reports: "reports",
      address: "Address",
      hours: "Opening hours",
      directions: "Directions",
      otherBeers: "Other beers here",
      noHistory: "No price history for this venue yet.",
      brandsCount: "{{count}} brands",
      daysAtPrice: "{{count}} days",
      current: "current",
      disclaimer: "Prices are community-reported estimates. Please verify prices on site before visiting.",
      confidence: {
        low: "Few reports",
        medium: "Some reports",
        high: "Well confirmed"
      },
      outdated: "Possibly outdated",
      freshness: {
        fresh: "Fresh price",
        aging: "Getting old",
        stale: "Outdated",
        monthsAgo: "months ago"
      }
    },
    stats: {
      cityAvg: "Munich avg",
      cheapest: "Cheapest",
      priciest: "Priciest",
      byNeighbourhood: "By neighbourhood"
    },
    submission: {
      title: "Report a price",
      newVenue: "Add new venue",
      selectVenue: "Select venue",
      brand: "Beer brand",
      size: "Size",
      price: "Price (€)",
      date: "Visit date",
      name: "Your name",
      anonymous: "Anonymous",
      photo: "Photo of price list (optional)",
      submit: "Submit",
      success: "Thanks! Your report will be reviewed.",
      error: "Submission failed. Please try again.",
      pricePlaceholder: "e.g. 4.80",
      namePlaceholder: "Your name or leave blank",
      thisVenuesBrands: "This venue's beers",
      allBrands: "All brands",
      otherBrandPlaceholder: "Enter brand name"
    },
    report: {
      button: "Report",
      title: "What would you like to report?",
      back: "Back",
      topics: {
        price_change: "Price has changed",
        new_beer: "Different beer available",
        closed: "This place is permanently closed",
        other_info: "Other incorrect info"
      },
      errBrandPrice: "Brand and price are required",
      errNote: "Please describe what's wrong",
      closedConfirm: "Confirm this venue is permanently closed.",
      confirmClosed: "Yes, closed",
      noteOptional: "Note (optional)",
      noteLabel: "What's wrong?",
      notePlaceholder: "Describe the issue..."
    },
    missingBar: {
      fab: "Missing a bar?",
      title: "Missing a bar?",
      searchLabel: "Search first",
      searchPlaceholder: "Venue name...",
      searchError: "Search failed. Please try again.",
      noResults: "No matches found.",
      mightExist: "This venue might already be on the map!",
      didYouMean: "Did you mean: {{name}}?",
      addManually: "Not finding it? Add manually",
      priceMassOptional: "Price Maß (1L, optional)",
      photoOptional: "Photo (optional)",
      continue: "Continue",
      errName: "Name is required",
      errNeighbourhood: "Neighbourhood is required",
      errBrand: "Beer brand is required",
      errPrice: "Price (0.5L) is required",
      noCoords: "No coordinates set — our team will verify the address.",
      success: "Thanks! We'll review your submission within 48 hours."
    },
    admin: {
      login: "Admin Login",
      username: "Username",
      password: "Password",
      signin: "Sign in",
      dashboard: "Dashboard",
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
      outliers: "Outliers",
      totalVenues: "Total venues",
      approve: "Approve",
      reject: "Reject",
      logout: "Log out",
      noSubmissions: "No submissions",
      submissions: "Submissions",
      rejectReasonPrompt: "Reason for rejection (optional):",
      venues: {
        tab: "Venues",
        total: "{{count}} venues",
        addTitle: "Add venue",
        editTitle: "Edit venue",
        name: "Name",
        beers: "Beers",
        cheapest: "Cheapest",
        edit: "Edit",
        save: "Save",
        close: "Close",
        cancel: "Cancel",
        create: "Create",
        addAnotherBeer: "Add another beer",
        errName: "Name and neighbourhood are required",
        errBeer: "At least one brand with a price is required",
        errPrice: "Invalid price",
        searchPlaceholder: "Search by name, neighbourhood or brand...",
        deleteBeer: "Delete",
        confirmDelete: "Really delete {{brand}}?",
        lastBeer: "A venue must keep at least one beer"
      }
    },
    priceHistory: "Price history",
    sortBy: "Sort by",
    sortPrice: "Price",
    sortName: "Name",
    backToMap: "Back to map",
    loading: "Loading...",
    trends: {
      button: "Price Trends",
      title: "Price Trends",
      subtitle: "Avg. price for 0.5L Helles per neighbourhood, over time",
      error: "Couldn't load trend data.",
      noData: "No trend data yet."
    }
  }
};
