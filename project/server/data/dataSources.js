// Simulierte Strompreise (aus der ursprünglichen HTML extrahiert)
const simulatedStrompreise = [
  { start: 6, end: 9, preis: 0.18, kategorie: 'guenstig', label: '06:00-09:00' },
  { start: 9, end: 12, preis: 0.25, kategorie: 'mittel', label: '09:00-12:00' },
  { start: 12, end: 15, preis: 0.45, kategorie: 'teuer', label: '12:00-15:00' },
  { start: 15, end: 18, preis: 0.22, kategorie: 'mittel', label: '15:00-18:00' }
];

// Simulierte Aufträge (VOLLSTÄNDIG aus der HTML extrahiert)
const simulatedAuftraege = [
  {
    id: 'LS-004', 
    kunde: 'Fischer Prototypenbau', 
    material: 'St52', 
    dicke: '5mm', 
    stueck: 8, 
    prioritaet: 'Prototyp',
    prozesse: [
      { name: 'Aufwärmen', maschine: 'Laser', dauer: 20, leistung: 8.5, energie: 2.83 },
      { name: 'Rüstzeit', maschine: 'Laser', dauer: 5, leistung: 9.0, energie: 0.75 },
      { name: 'Schneiden', maschine: 'Laser', dauer: 3, leistung: 16.0, energie: 0.80 },
      { name: 'Entgraten', maschine: 'Deburrer', dauer: 5, leistung: 3.2, energie: 0.27 },
      { name: 'Gewinde M8', maschine: 'TapOne', dauer: 4, leistung: 5.5, energie: 0.37 },
      { name: 'Kontrolle', maschine: 'Manuell', dauer: 20, leistung: 0, energie: 0 }
    ],
    gesamtDauer: 57, 
    gesamtEnergie: 5.02, 
    kosten: 1.51
  },
  {
    id: 'LS-006', 
    kunde: 'Hoffmann Anlagenbau', 
    material: 'St37', 
    dicke: '6mm', 
    stueck: 12, 
    prioritaet: 'Prototyp',
    prozesse: [
      { name: 'Rüstzeit Material', maschine: 'Laser', dauer: 15, leistung: 9.0, energie: 2.25 },
      { name: 'Schneiden', maschine: 'Laser', dauer: 7, leistung: 16.0, energie: 1.87 },
      { name: 'Entgraten', maschine: 'Deburrer', dauer: 10, leistung: 3.2, energie: 0.53 },
      { name: 'Gewinde M12', maschine: 'TapOne', dauer: 6, leistung: 5.5, energie: 0.55 },
      { name: 'QK', maschine: 'Manuell', dauer: 5, leistung: 0, energie: 0 }
    ],
    gesamtDauer: 43, 
    gesamtEnergie: 5.20, 
    kosten: 1.56
  },
  {
    id: 'LS-002', 
    kunde: 'Schmidt Metallverarbeitung', 
    material: 'Edst. 1.4301', 
    dicke: '2mm', 
    stueck: 15, 
    prioritaet: 'Kleine Serie',
    prozesse: [
      { name: 'Rüstzeit Material', maschine: 'Laser', dauer: 15, leistung: 9.0, energie: 2.25 },
      { name: 'Schneiden', maschine: 'Laser', dauer: 5, leistung: 16.0, energie: 1.33 },
      { name: 'Entgraten', maschine: 'Deburrer', dauer: 14, leistung: 3.2, energie: 0.75 },
      { name: 'QK', maschine: 'Manuell', dauer: 5, leistung: 0, energie: 0 }
    ],
    gesamtDauer: 39, 
    gesamtEnergie: 4.33, 
    kosten: 1.30
  },
  {
    id: 'LS-008', 
    kunde: 'Koch Sondermaschinenbau', 
    material: 'Edst. 1.4301', 
    dicke: '4mm', 
    stueck: 20, 
    prioritaet: 'Kleine Serie',
    prozesse: [
      { name: 'Rüstzeit Dicke', maschine: 'Laser', dauer: 10, leistung: 9.0, energie: 1.50 },
      { name: 'Schneiden', maschine: 'Laser', dauer: 13, leistung: 16.0, energie: 3.47 },
      { name: 'Entgraten', maschine: 'Deburrer', dauer: 26, leistung: 3.2, energie: 1.39 },
      { name: 'Gewinde M6', maschine: 'TapOne', dauer: 10, leistung: 5.5, energie: 0.92 },
      { name: 'QK', maschine: 'Manuell', dauer: 5, leistung: 0, energie: 0 }
    ],
    gesamtDauer: 64, 
    gesamtEnergie: 7.28, 
    kosten: 2.18
  },
  {
    id: 'LS-001', 
    kunde: 'Müller Maschinenbau', 
    material: 'St37', 
    dicke: '3mm', 
    stueck: 25, 
    prioritaet: 'Große Serie',
    prozesse: [
      { name: 'Rüstzeit Material', maschine: 'Laser', dauer: 15, leistung: 9.0, energie: 2.25 },
      { name: 'Schneiden', maschine: 'Laser', dauer: 14, leistung: 16.0, energie: 3.73 },
      { name: 'Entgraten', maschine: 'Deburrer', dauer: 30, leistung: 3.2, energie: 1.60 },
      { name: 'QK', maschine: 'Manuell', dauer: 5, leistung: 0, energie: 0 }
    ],
    gesamtDauer: 64, 
    gesamtEnergie: 7.58, 
    kosten: 2.27
  },
  {
    id: 'LS-005', 
    kunde: 'Becker Fahrzeugbau', 
    material: 'Edst. 1.4571', 
    dicke: '3mm', 
    stueck: 30, 
    prioritaet: 'Große Serie',
    prozesse: [
      { name: 'Rüstzeit Material', maschine: 'Laser', dauer: 15, leistung: 9.0, energie: 2.25 },
      { name: 'Schneiden', maschine: 'Laser', dauer: 17, leistung: 16.0, energie: 4.53 },
      { name: 'Entgraten', maschine: 'Deburrer', dauer: 42, leistung: 3.2, energie: 2.24 },
      { name: 'QK', maschine: 'Manuell', dauer: 5, leistung: 0, energie: 0 }
    ],
    gesamtDauer: 79, 
    gesamtEnergie: 9.02, 
    kosten: 2.71
  },
  {
    id: 'LS-010', 
    kunde: 'Zimmermann Konstruktion', 
    material: 'Alu AlMg3', 
    dicke: '3mm', 
    stueck: 35, 
    prioritaet: 'Große Serie',
    prozesse: [
      { name: 'Rüstzeit Material', maschine: 'Laser', dauer: 15, leistung: 9.0, energie: 2.25 },
      { name: 'Schneiden', maschine: 'Laser', dauer: 13, leistung: 16.0, energie: 3.47 },
      { name: 'Entgraten', maschine: 'Deburrer', dauer: 44, leistung: 3.2, energie: 2.35 },
      { name: 'Gewinde M10', maschine: 'TapOne', dauer: 18, leistung: 5.5, energie: 1.65 },
      { name: 'QK', maschine: 'Manuell', dauer: 5, leistung: 0, energie: 0 }
    ],
    gesamtDauer: 95, 
    gesamtEnergie: 9.72, 
    kosten: 2.92
  },
  {
    id: 'LS-009', 
    kunde: 'Wagner Metallbau', 
    material: 'St37', 
    dicke: '2mm', 
    stueck: 40, 
    prioritaet: 'Große Serie',
    prozesse: [
      { name: 'Rüstzeit Material', maschine: 'Laser', dauer: 15, leistung: 9.0, energie: 2.25 },
      { name: 'Schneiden', maschine: 'Laser', dauer: 16, leistung: 16.0, energie: 4.27 },
      { name: 'Entgraten', maschine: 'Deburrer', dauer: 38, leistung: 3.2, energie: 2.03 },
      { name: 'QK', maschine: 'Manuell', dauer: 5, leistung: 0, energie: 0 }
    ],
    gesamtDauer: 74, 
    gesamtEnergie: 8.55, 
    kosten: 2.57
  }
];

// Datenquellen-Konfiguration
const dataSources = {
  simulated: {
    strompreise: async () => simulatedStrompreise,
    auftraege: async () => simulatedAuftraege,
  },
  external: {
    strompreise: async () => {
      // Später: Externe API Anbindung (z.B. EPEX Spot)
      // Beispiel-Implementation:
      // const response = await fetch(process.env.STROMPREIS_API_URL);
      // return response.json();
      
      // Fallback zu simulierten Daten
      console.log('⚠️  Externe API noch nicht konfiguriert - verwende simulierte Daten');
      return simulatedStrompreise;
    },
    auftraege: async () => {
      // Später: Externe API Anbindung
      // Beispiel-Implementation:
      // const response = await fetch(process.env.AUFTRAG_API_URL);
      // return response.json();
      
      // Fallback zu simulierten Daten
      console.log('⚠️  Externe API noch nicht konfiguriert - verwende simulierte Daten');
      return simulatedAuftraege;
    },
  },
};

/**
 * Liefert die konfigurierte Datenquelle zurück
 * @param {string} source - 'simulated' oder 'external'
 * @returns {object} Datenquellen-Objekt mit strompreise() und auftraege() Funktionen
 */
module.exports = function getDataSource(source = 'simulated') {
  if (!dataSources[source]) {
    console.warn(`⚠️  Datenquelle '${source}' nicht gefunden - verwende 'simulated'`);
    return dataSources.simulated;
  }
  return dataSources[source];
};
