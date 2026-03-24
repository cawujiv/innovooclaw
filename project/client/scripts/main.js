// Maschinen-Definition für Matrix
const maschinen = [
    { name: 'Laser', key: 'laser', emoji: '🔴' },
    { name: 'TapOne', key: 'tapone', emoji: '🟣' },
    { name: 'Deburrer', key: 'deburrer', emoji: '🟢' },
    { name: 'Manuell', key: 'manuell', emoji: '⚫' }
];

// Strompreis-Konfiguration (Day-Ahead)
let strompreise = [
    { start: 6, end: 9, preis: 0.18, kategorie: 'guenstig', label: '06:00-09:00' },
    { start: 9, end: 12, preis: 0.25, kategorie: 'mittel', label: '09:00-12:00' },
    { start: 12, end: 15, preis: 0.45, kategorie: 'teuer', label: '12:00-15:00' },
    { start: 15, end: 18, preis: 0.22, kategorie: 'mittel', label: '15:00-18:00' }
];

// Auftragsdaten - KORRIGIERT MIT REALISTISCHEN TRUMPF-WERTEN
const initialAuftraege = [
    {
        id: 'LS-004', kunde: 'Fischer Prototypenbau', material: 'St52', dicke: '5mm', stueck: 8, prioritaet: 'Prototyp',
        prozesse: [
            { name: 'Aufwärmen', maschine: 'Laser', dauer: 20, leistung: 8.5, energie: 2.83 },
            { name: 'Rüstzeit', maschine: 'Laser', dauer: 5, leistung: 9.0, energie: 0.75 },
            { name: 'Schneiden', maschine: 'Laser', dauer: 3, leistung: 16.0, energie: 0.80 },
            { name: 'Entgraten', maschine: 'Deburrer', dauer: 5, leistung: 3.2, energie: 0.27 },
            { name: 'Gewinde M8', maschine: 'TapOne', dauer: 4, leistung: 5.5, energie: 0.37 },
            { name: 'Kontrolle', maschine: 'Manuell', dauer: 20, leistung: 0, energie: 0 }
        ],
        gesamtDauer: 57, gesamtEnergie: 5.02, kosten: 1.51
    },
    {
        id: 'LS-006', kunde: 'Hoffmann Anlagenbau', material: 'St37', dicke: '6mm', stueck: 12, prioritaet: 'Prototyp',
        prozesse: [
            { name: 'Rüstzeit Material', maschine: 'Laser', dauer: 15, leistung: 9.0, energie: 2.25 },
            { name: 'Schneiden', maschine: 'Laser', dauer: 7, leistung: 16.0, energie: 1.87 },
            { name: 'Entgraten', maschine: 'Deburrer', dauer: 10, leistung: 3.2, energie: 0.53 },
            { name: 'Gewinde M12', maschine: 'TapOne', dauer: 6, leistung: 5.5, energie: 0.55 },
            { name: 'QK', maschine: 'Manuell', dauer: 5, leistung: 0, energie: 0 }
        ],
        gesamtDauer: 43, gesamtEnergie: 5.20, kosten: 1.56
    },
    {
        id: 'LS-002', kunde: 'Schmidt Metallverarbeitung', material: 'Edst. 1.4301', dicke: '2mm', stueck: 15, prioritaet: 'Kleine Serie',
        prozesse: [
            { name: 'Rüstzeit Material', maschine: 'Laser', dauer: 15, leistung: 9.0, energie: 2.25 },
            { name: 'Schneiden', maschine: 'Laser', dauer: 5, leistung: 16.0, energie: 1.33 },
            { name: 'Entgraten', maschine: 'Deburrer', dauer: 14, leistung: 3.2, energie: 0.75 },
            { name: 'QK', maschine: 'Manuell', dauer: 5, leistung: 0, energie: 0 }
        ],
        gesamtDauer: 39, gesamtEnergie: 4.33, kosten: 1.30
    },
    {
        id: 'LS-008', kunde: 'Koch Sondermaschinenbau', material: 'Edst. 1.4301', dicke: '4mm', stueck: 20, prioritaet: 'Kleine Serie',
        prozesse: [
            { name: 'Rüstzeit Dicke', maschine: 'Laser', dauer: 10, leistung: 9.0, energie: 1.50 },
            { name: 'Schneiden', maschine: 'Laser', dauer: 13, leistung: 16.0, energie: 3.47 },
            { name: 'Entgraten', maschine: 'Deburrer', dauer: 26, leistung: 3.2, energie: 1.39 },
            { name: 'Gewinde M6', maschine: 'TapOne', dauer: 10, leistung: 5.5, energie: 0.92 },
            { name: 'QK', maschine: 'Manuell', dauer: 5, leistung: 0, energie: 0 }
        ],
        gesamtDauer: 64, gesamtEnergie: 7.28, kosten: 2.18
    },
    {
        id: 'LS-001', kunde: 'Müller Maschinenbau', material: 'St37', dicke: '3mm', stueck: 25, prioritaet: 'Große Serie',
        prozesse: [
            { name: 'Rüstzeit Material', maschine: 'Laser', dauer: 15, leistung: 9.0, energie: 2.25 },
            { name: 'Schneiden', maschine: 'Laser', dauer: 14, leistung: 16.0, energie: 3.73 },
            { name: 'Entgraten', maschine: 'Deburrer', dauer: 30, leistung: 3.2, energie: 1.60 },
            { name: 'QK', maschine: 'Manuell', dauer: 5, leistung: 0, energie: 0 }
        ],
        gesamtDauer: 64, gesamtEnergie: 7.58, kosten: 2.27
    },
    {
        id: 'LS-005', kunde: 'Becker Fahrzeugbau', material: 'Edst. 1.4571', dicke: '3mm', stueck: 30, prioritaet: 'Große Serie',
        prozesse: [
            { name: 'Rüstzeit Material', maschine: 'Laser', dauer: 15, leistung: 9.0, energie: 2.25 },
            { name: 'Schneiden', maschine: 'Laser', dauer: 17, leistung: 16.0, energie: 4.53 },
            { name: 'Entgraten', maschine: 'Deburrer', dauer: 42, leistung: 3.2, energie: 2.24 },
            { name: 'QK', maschine: 'Manuell', dauer: 5, leistung: 0, energie: 0 }
        ],
        gesamtDauer: 79, gesamtEnergie: 9.02, kosten: 2.71
    },
    {
        id: 'LS-010', kunde: 'Zimmermann Konstruktion', material: 'Alu AlMg3', dicke: '3mm', stueck: 35, prioritaet: 'Große Serie',
        prozesse: [
            { name: 'Rüstzeit Material', maschine: 'Laser', dauer: 15, leistung: 9.0, energie: 2.25 },
            { name: 'Schneiden', maschine: 'Laser', dauer: 13, leistung: 16.0, energie: 3.47 },
            { name: 'Entgraten', maschine: 'Deburrer', dauer: 44, leistung: 3.2, energie: 2.35 },
            { name: 'Gewinde M10', maschine: 'TapOne', dauer: 18, leistung: 5.5, energie: 1.65 },
            { name: 'QK', maschine: 'Manuell', dauer: 5, leistung: 0, energie: 0 }
        ],
        gesamtDauer: 95, gesamtEnergie: 9.72, kosten: 2.92
    },
    {
        id: 'LS-009', kunde: 'Wagner Metallbau', material: 'St37', dicke: '2mm', stueck: 40, prioritaet: 'Große Serie',
        prozesse: [
            { name: 'Rüstzeit Material', maschine: 'Laser', dauer: 15, leistung: 9.0, energie: 2.25 },
            { name: 'Schneiden', maschine: 'Laser', dauer: 16, leistung: 16.0, energie: 4.27 },
            { name: 'Entgraten', maschine: 'Deburrer', dauer: 38, leistung: 3.2, energie: 2.03 },
            { name: 'QK', maschine: 'Manuell', dauer: 5, leistung: 0, energie: 0 }
        ],
        gesamtDauer: 74, gesamtEnergie: 8.55, kosten: 2.57
    }
];

let auftraege = [...initialAuftraege];
let optimierteAuftraege = [];
let originalZeitraster = []; // Für Vorher-Vergleich
let chart = null;
let isOptimized = false;

// Popup-Element
const popup = document.getElementById('prozess-popup');

// Initialisierung
document.addEventListener('DOMContentLoaded', () => {
    renderStrompreisEditor();
    // Erstelle Original-Zeitraster beim ersten Laden
    originalZeitraster = erstelleZeitraster(false);
    updateUI();
});

// Strompreis-Editor rendern
function renderStrompreisEditor() {
    const container = document.getElementById('strompreis-editor');
    container.innerHTML = '';
    
    strompreise.forEach((fenster, index) => {
        const div = document.createElement('div');
        div.className = `zeitfenster ${fenster.kategorie}`;
        div.innerHTML = `
            <div class="zeit">${fenster.label} Uhr</div>
            <input type="number" step="0.01" value="${fenster.preis.toFixed(2)}" 
                   onchange="updateStrompreis(${index}, this.value)" />
            <div class="label">€/kWh</div>
        `;
        container.appendChild(div);
    });
}

function updateStrompreis(index, wert) {
    strompreise[index].preis = parseFloat(wert);
    
    // Kategorisierung neu berechnen
    const preise = strompreise.map(s => s.preis).sort((a, b) => a - b);
    const niedrig = preise[0];
    const hoch = preise[preise.length - 1];
    const mittel = (niedrig + hoch) / 2;
    
    strompreise[index].kategorie = 
        strompreise[index].preis <= (niedrig + (mittel - niedrig) / 2) ? 'guenstig' :
        strompreise[index].preis >= (hoch - (hoch - mittel) / 2) ? 'teuer' : 'mittel';
    
    renderStrompreisEditor();
    // Chart und Timeline IMMER aktualisieren (auch ohne Optimierung)
    updateChart();
    renderProzessTimelineMatrix();
}

// Zeitraster erstellen
function erstelleZeitraster(optimiert) {
    const zeitraster = [];
    const startMinute = 360; // 6:00
    const endMinute = 1080;  // 18:00
    
    // Erstelle vollständiges Zeitraster in 15-Minuten-Schritten
    for (let minute = startMinute; minute <= endMinute; minute += 15) {
        zeitraster.push({
            zeitMinuten: minute,
            zeit: minutenZuUhrzeit(minute),
            leistung: 0,
            strompreis: getStrompreis(minute),
            maschine: '',
            prozess: '',
            auftragId: ''
        });
    }
    
    const verwendeteAuftraege = optimiert ? auftraege : initialAuftraege;
    
    // Fülle Lastprofil
    if (optimiert && isOptimized) {
        // Optimierte Version
        verwendeteAuftraege.forEach(auftrag => {
            let aktuelleMinute = auftrag.startMinute;
            
            auftrag.prozesse.forEach(prozess => {
                const prozessEnde = aktuelleMinute + prozess.dauer;
                
                zeitraster.forEach(punkt => {
                    if (punkt.zeitMinuten >= aktuelleMinute && punkt.zeitMinuten < prozessEnde) {
                        punkt.leistung = prozess.leistung;
                        punkt.maschine = prozess.maschine;
                        punkt.prozess = prozess.name;
                        punkt.auftragId = auftrag.id;
                    }
                });
                
                aktuelleMinute = prozessEnde;
            });
        });
    } else {
        // Original: sequenziell ab 06:00
        let zeitpunkt = startMinute;
        verwendeteAuftraege.forEach(auftrag => {
            auftrag.prozesse.forEach(prozess => {
                const prozessEnde = zeitpunkt + prozess.dauer;
                
                zeitraster.forEach(punkt => {
                    if (punkt.zeitMinuten >= zeitpunkt && punkt.zeitMinuten < prozessEnde) {
                        punkt.leistung = prozess.leistung;
                        punkt.maschine = prozess.maschine;
                        punkt.prozess = prozess.name;
                        punkt.auftragId = auftrag.id;
                    }
                });
                
                zeitpunkt = prozessEnde;
            });
        });
    }
    
    return zeitraster;
}

// KORRIGIERTE Energiekostenoptimierung - ALLE Aufträge in günstige Zeiten!
function optimiereNachStrompreis() {
    // Speichere Original-Zeitraster
    originalZeitraster = erstelleZeitraster(false);
    
    // 1. Bewerte jeden Auftrag nach Energiekosten in verschiedenen Zeitfenstern
    const bewerteteAuftraege = auftraege.map(auftrag => {
        const bewertungen = strompreise.map(fenster => {
            const kosten = auftrag.gesamtEnergie * fenster.preis;
            return {
                fenster: fenster.label,
                preis: fenster.preis,
                kosten: kosten,
                kategorie: fenster.kategorie,
                zeitslot: fenster,
                startMinute: fenster.start * 60
            };
        });
        
        // Sortiere nach günstigstem Zeitfenster
        bewertungen.sort((a, b) => a.kosten - b.kosten);
        
        return {
            ...auftrag,
            bewertungen: bewertungen,
            optimalerZeitslot: bewertungen[0]
        };
    });
    
    // 2. Sortiere ALLE Aufträge nach Energie (höchster Energieverbrauch zuerst für maximale Ersparnis)
    const sortiertNachEnergie = bewerteteAuftraege.sort((a, b) => b.gesamtEnergie - a.gesamtEnergie);
    
    // 3. Zeitfenster-Kapazitäten initialisieren
    const zeitfensterKapazitaet = strompreise.map(f => ({
        ...f,
        startMinute: f.start * 60,
        aktuelleMinute: f.start * 60,
        endMinute: f.end * 60,
        verbleibendeZeit: (f.end - f.start) * 60,
        auftraege: []
    }));
    
    const optimiert = [];
    
    // 4. ALLE Aufträge in günstigste verfügbare Zeitfenster verschieben
    sortiertNachEnergie.forEach(auftrag => {
        let zugewiesen = false;
        
        // Versuche in günstigsten Zeitfenstern zu platzieren (aufsteigend nach Preis)
        for (let bewertung of auftrag.bewertungen) {
            const fenster = zeitfensterKapazitaet.find(f => f.label === bewertung.fenster);
            
            if (fenster && fenster.verbleibendeZeit >= auftrag.gesamtDauer) {
                optimiert.push({
                    ...auftrag,
                    zugewiesenesZeitfenster: bewertung.fenster,
                    startMinute: fenster.aktuelleMinute,
                    endMinute: fenster.aktuelleMinute + auftrag.gesamtDauer,
                    strompreis: bewertung.preis,
                    kategorie: bewertung.kategorie,
                    kostenGespart: true
                });
                
                fenster.aktuelleMinute += auftrag.gesamtDauer;
                fenster.verbleibendeZeit -= auftrag.gesamtDauer;
                fenster.auftraege.push(auftrag.id);
                zugewiesen = true;
                break;
            }
        }
        
        // Fallback: wenn kein Platz in optimalem Fenster
        if (!zugewiesen) {
            const verfuegbar = zeitfensterKapazitaet.find(f => f.verbleibendeZeit >= auftrag.gesamtDauer);
            if (verfuegbar) {
                const bewertung = auftrag.bewertungen.find(b => b.fenster === verfuegbar.label);
                optimiert.push({
                    ...auftrag,
                    zugewiesenesZeitfenster: verfuegbar.label,
                    startMinute: verfuegbar.aktuelleMinute,
                    endMinute: verfuegbar.aktuelleMinute + auftrag.gesamtDauer,
                    strompreis: bewertung.preis,
                    kategorie: bewertung.kategorie,
                    kostenGespart: false
                });
                verfuegbar.aktuelleMinute += auftrag.gesamtDauer;
                verfuegbar.verbleibendeZeit -= auftrag.gesamtDauer;
            }
        }
    });
    
    // Sortiere nach tatsächlicher Startzeit
    optimiert.sort((a, b) => a.startMinute - b.startMinute);
    
    // Berechne Einsparungen
    const originalKosten = berechneGesamtkosten(initialAuftraege, 0.30);
    const optimierteKosten = optimiert.reduce((sum, a) => sum + (a.gesamtEnergie * a.strompreis), 0);
    const ersparnis = originalKosten - optimierteKosten;
    const ersparnisProz = (ersparnis / originalKosten * 100);
    
    // Prüfe Mindestkriterium (5% Ersparnis)
    if (ersparnisProz < 5) {
        document.getElementById('optimization-alert').innerHTML = `
            <div class="alert alert-warning">
                ⚠️ Optimierung ergab nur ${ersparnisProz.toFixed(1)}% Ersparnis (${ersparnis.toFixed(2)} €). 
                Mindestens 5% erforderlich. Bitte Strompreise anpassen oder Produktion beibehalten.
            </div>
        `;
        document.getElementById('optimization-alert').style.display = 'block';
        return;
    }
    
    optimierteAuftraege = optimiert;
    auftraege = optimiert;
    isOptimized = true;
    
    document.getElementById('optimization-alert').innerHTML = `
        <div class="alert alert-success">
            ✅ Optimierung erfolgreich! Energiekosten um ${ersparnisProz.toFixed(1)}% reduziert (${ersparnis.toFixed(2)} € gespart)<br>
            <strong>Alle ${optimiert.length} Aufträge</strong> wurden in die günstigsten verfügbaren Zeitfenster verschoben
        </div>
    `;
    document.getElementById('optimization-alert').style.display = 'block';
    
    updateUI();
    updateChart();
}

function berechneGesamtkosten(auftragsListe, durchschnittspreis) {
    return auftragsListe.reduce((sum, a) => sum + (a.gesamtEnergie * durchschnittspreis), 0);
}

// Berechne Kennzahlen
function berechneKennzahlen() {
    const gesamtEnergie = initialAuftraege.reduce((sum, a) => sum + a.gesamtEnergie, 0);
    
    let gesamtKostenOptimiert = 0;
    let hochpreisAuftraege = 0;
    
    if (isOptimized) {
        gesamtKostenOptimiert = auftraege.reduce((sum, a) => 
            sum + (a.gesamtEnergie * a.strompreis), 0
        );
        hochpreisAuftraege = auftraege.filter(a => a.kategorie === 'teuer').length;
    } else {
        gesamtKostenOptimiert = gesamtEnergie * 0.30;
    }
    
    const gesamtKostenOriginal = gesamtEnergie * 0.30;
    const ersparnis = gesamtKostenOriginal - gesamtKostenOptimiert;
    
    // Vergütungsberechnung
    const vermiedeneSpitzenlast = isOptimized ? 
        auftraege.filter(a => a.kategorie === 'guenstig').reduce((sum, a) => {
            const maxLeistung = Math.max(...a.prozesse.map(p => p.leistung));
            return sum + maxLeistung;
        }, 0) : 0;
    
    const verguetungLastverschiebung = ersparnis * 0.5; // 50% vom Regelbetrag
    const verguetungFlexibilitaet = vermiedeneSpitzenlast * 0.30 * 0.8; // 80% vom Leistungspreis
    const gesamtVerguetung = verguetungLastverschiebung + verguetungFlexibilitaet;
    
    const durchschnittsPreis = isOptimized ?
        (gesamtKostenOptimiert / gesamtEnergie) :
        0.30;
    
    return {
        gesamtEnergie: gesamtEnergie.toFixed(2),
        gesamtKostenOriginal: gesamtKostenOriginal.toFixed(2),
        gesamtKostenOptimiert: gesamtKostenOptimiert.toFixed(2),
        ersparnis: ersparnis.toFixed(2),
        verguetungLastverschiebung: verguetungLastverschiebung.toFixed(2),
        verguetungFlexibilitaet: verguetungFlexibilitaet.toFixed(2),
        gesamtVerguetung: gesamtVerguetung.toFixed(2),
        durchschnittsPreis: durchschnittsPreis.toFixed(2),
        hochpreisAuftraege: hochpreisAuftraege,
        vermiedeneSpitzenlast: vermiedeneSpitzenlast.toFixed(1)
    };
}

// UI aktualisieren
function updateUI() {
    const kennzahlen = berechneKennzahlen();
    
    // Summary Cards
    document.getElementById('summary-energie').textContent = kennzahlen.gesamtEnergie;
    document.getElementById('summary-kosten-original').textContent = kennzahlen.gesamtKostenOriginal;
    document.getElementById('summary-kosten-optimiert').textContent = kennzahlen.gesamtKostenOptimiert;
    document.getElementById('summary-ersparnis').textContent = kennzahlen.ersparnis;
    document.getElementById('summary-verguetung').textContent = kennzahlen.gesamtVerguetung;
    
    // Statistiken
    document.getElementById('stat-energie').textContent = kennzahlen.gesamtEnergie + ' kWh';
    document.getElementById('stat-durchschnittspreis').textContent = kennzahlen.durchschnittsPreis + ' €/kWh';
    document.getElementById('stat-energiekosten').textContent = kennzahlen.gesamtKostenOptimiert + ' €';
    document.getElementById('stat-hochpreis').textContent = kennzahlen.hochpreisAuftraege;
    document.getElementById('stat-vermieden').textContent = kennzahlen.vermiedeneSpitzenlast + ' kW';
    
    // Vergütungsdetails
    document.getElementById('verguetung-details').innerHTML = `
        <div class="comparison-value positive">
            <span class="label">Energiekostenersparnis:</span>
            <span class="value positive">${kennzahlen.ersparnis} €</span>
        </div>
        <div class="comparison-value positive">
            <span class="label">Vergütung Lastverschiebung (50%):</span>
            <span class="value positive">+${kennzahlen.verguetungLastverschiebung} €</span>
        </div>
        <div class="comparison-value positive">
            <span class="label">Vergütung Flexibilität (80%):</span>
            <span class="value positive">+${kennzahlen.verguetungFlexibilitaet} €</span>
        </div>
        <div class="comparison-value positive" style="border-top: 2px solid #48bb78; margin-top: 10px; padding-top: 15px;">
            <span class="label"><strong>Gesamt-Einsparungen:</strong></span>
            <span class="value positive" style="font-size: 1.3em;">${kennzahlen.gesamtVerguetung} €</span>
        </div>
    `;
    
    // Chart
    updateChart();
    
    // Prozess-Timeline MATRIX
    renderProzessTimelineMatrix();
    
    // Auftrags-Liste
    renderAuftragsliste();
}

// Prozess-Timeline MATRIX rendern
function renderProzessTimelineMatrix() {
    const container = document.getElementById('timeline-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Zeitbereich: 6:00 bis 18:00 (360 bis 1080 Minuten)
    const startMinute = 360;
    const endMinute = 1080;
    const gesamtDauer = endMinute - startMinute; // 720 Minuten = 12 Stunden
    
    // Container für Timeline-Grid
    const grid = document.createElement('div');
    grid.className = 'timeline-grid';
    
    // Zeitmarkierungen
    const timeMarkers = document.createElement('div');
    timeMarkers.className = 'timeline-time-markers';
    
    for (let minute = startMinute; minute <= endMinute; minute += 60) {
        const marker = document.createElement('div');
        marker.className = 'time-marker';
        const position = ((minute - startMinute) / gesamtDauer) * 100;
        marker.style.left = position + '%';
        
        const label = document.createElement('div');
        label.className = 'time-marker-label';
        label.textContent = minutenZuUhrzeit(minute);
        label.style.left = position + '%';
        
        timeMarkers.appendChild(marker);
        timeMarkers.appendChild(label);
    }
    
    grid.appendChild(timeMarkers);
    
    // Erstelle Maschinenreihen
    maschinen.forEach((maschine, index) => {
        const row = document.createElement('div');
        row.className = 'machine-row';
        row.style.top = (index * 60) + 'px';
        
        const label = document.createElement('div');
        label.className = 'machine-label';
        label.textContent = `${maschine.emoji} ${maschine.name}`;
        
        row.appendChild(label);
        grid.appendChild(row);
    });
    
    // Sammle alle Prozesse
    const prozesseListe = [];
    
    if (isOptimized) {
        auftraege.forEach(auftrag => {
            let aktuelleMinute = auftrag.startMinute;
            
            auftrag.prozesse.forEach(prozess => {
                const prozessStart = aktuelleMinute;
                const prozessEnde = aktuelleMinute + prozess.dauer;
                
                prozesseListe.push({
                    auftrag: auftrag,
                    prozess: prozess,
                    start: prozessStart,
                    ende: prozessEnde
                });
                
                aktuelleMinute = prozessEnde;
            });
        });
    } else {
        // Original: sequenziell
        let zeitpunkt = startMinute;
        initialAuftraege.forEach(auftrag => {
            auftrag.prozesse.forEach(prozess => {
                const prozessStart = zeitpunkt;
                const prozessEnde = zeitpunkt + prozess.dauer;
                
                prozesseListe.push({
                    auftrag: auftrag,
                    prozess: prozess,
                    start: prozessStart,
                    ende: prozessEnde
                });
                
                zeitpunkt = prozessEnde;
            });
        });
    }
    
    // Rendere Prozesse in Matrix-Position
    prozesseListe.forEach(item => {
        // Finde Maschinenindex
        const maschinenIndex = maschinen.findIndex(m => 
            m.name.toLowerCase() === item.prozess.maschine.toLowerCase()
        );
        
        if (maschinenIndex === -1) return;
        
        const div = document.createElement('div');
        div.className = 'timeline-prozess';
        
        // Maschinenklasse für Farbe
        const maschinenklasse = 'maschine-' + item.prozess.maschine.toLowerCase().replace(/[^a-z]/g, '');
        div.classList.add(maschinenklasse);
        
        // Position berechnen
        const left = ((item.start - startMinute) / gesamtDauer) * 100;
        const width = ((item.ende - item.start) / gesamtDauer) * 100;
        const top = maschinenIndex * 60 + 7.5; // Zentriert in Maschinenreihe
        
        div.style.left = left + '%';
        div.style.width = width + '%';
        div.style.top = top + 'px';
        
        // Inhalt
        div.innerHTML = `
            <div class="timeline-prozess-name">${item.auftrag.id}</div>
            <div class="timeline-prozess-info">${item.prozess.name} | ${item.prozess.leistung.toFixed(1)} kW</div>
        `;
        
        // Popup-Event-Listener
        div.addEventListener('mouseenter', (e) => zeigeProzessPopup(e, item));
        div.addEventListener('mouseleave', verbergePopup);
        div.addEventListener('mousemove', bewegePopup);
        
        grid.appendChild(div);
    });
    
    container.appendChild(grid);
}

// Popup-Funktionen
function zeigeProzessPopup(event, item) {
    const strompreis = getStrompreis(item.start);
    const kategorie = getStrompreisKategorie(strompreis);
    const energieKosten = (item.prozess.energie * strompreis).toFixed(2);
    
    popup.innerHTML = `
        <div class="popup-header">
            🔧 ${item.prozess.name}
        </div>
        <div class="popup-row">
            <span class="popup-label">Auftrag:</span>
            <span class="popup-value">${item.auftrag.id}</span>
        </div>
        <div class="popup-row">
            <span class="popup-label">Kunde:</span>
            <span class="popup-value">${item.auftrag.kunde}</span>
        </div>
        <div class="popup-row">
            <span class="popup-label">Maschine:</span>
            <span class="popup-value">${item.prozess.maschine}</span>
        </div>
        <div class="popup-row">
            <span class="popup-label">Startzeit:</span>
            <span class="popup-value">${minutenZuUhrzeit(item.start)}</span>
        </div>
        <div class="popup-row">
            <span class="popup-label">Endzeit:</span>
            <span class="popup-value">${minutenZuUhrzeit(item.ende)}</span>
        </div>
        <div class="popup-row">
            <span class="popup-label">Dauer:</span>
            <span class="popup-value">${item.prozess.dauer} min</span>
        </div>
        <div class="popup-row">
            <span class="popup-label">Leistung:</span>
            <span class="popup-value">${item.prozess.leistung.toFixed(1)} kW</span>
        </div>
        <div class="popup-row">
            <span class="popup-label">Energie:</span>
            <span class="popup-value">${item.prozess.energie.toFixed(2)} kWh</span>
        </div>
        <div class="popup-row">
            <span class="popup-label">Strompreis:</span>
            <span class="popup-value">${strompreis.toFixed(2)} €/kWh</span>
        </div>
        <div class="popup-highlight">
            💰 Energiekosten: ${energieKosten} €
        </div>
        ${isOptimized && item.auftrag.zugewiesenesZeitfenster ? `
            <div class="popup-row" style="margin-top: 10px; padding-top: 10px; border-top: 2px solid #e2e8f0;">
                <span class="popup-label">Zeitfenster:</span>
                <span class="popup-value">${item.auftrag.zugewiesenesZeitfenster}</span>
            </div>
            <div class="popup-row">
                <span class="popup-label">Kategorie:</span>
                <span class="popup-value" style="color: ${kategorie === 'guenstig' ? '#38a169' : kategorie === 'teuer' ? '#e53e3e' : '#ed8936'};">
                    ${kategorie === 'guenstig' ? '✅ Günstig' : kategorie === 'teuer' ? '❌ Teuer' : '⚠️ Mittel'}
                </span>
            </div>
        ` : ''}
    `;
    
    popup.style.display = 'block';
    bewegePopup(event);
}

function bewegePopup(event) {
    const x = event.clientX + 20;
    const y = event.clientY + 20;
    
    popup.style.left = x + 'px';
    popup.style.top = y + 'px';
}

function verbergePopup() {
    popup.style.display = 'none';
}

function getStrompreisKategorie(preis) {
    const fenster = strompreise.find(f => Math.abs(f.preis - preis) < 0.001);
    return fenster ? fenster.kategorie : 'mittel';
}

// Chart aktualisieren mit Vorher/Nachher-Vergleich
function updateChart() {
    const ctx = document.getElementById('combinedChart').getContext('2d');
    
    if (chart) {
        chart.destroy();
    }
    
    // Erstelle aktuelles Zeitraster
    const zeitraster = erstelleZeitraster(isOptimized);
    
    // Datasets vorbereiten
    const datasets = [
        {
            label: 'Strompreis (€/kWh)',
            data: zeitraster.map(d => d.strompreis),
            borderColor: '#f56565',
            backgroundColor: 'rgba(245, 101, 101, 0.15)',
            borderWidth: 2,
            fill: true,
            tension: 0,
            stepped: true,
            yAxisID: 'y1',
            order: 3
        }
    ];
    
    // Wenn optimiert, zeige beide Linien
    if (isOptimized) {
        // Original-Lastprofil (gestrichelt, grau)
        datasets.push({
            label: 'Leistung Original (kW)',
            data: originalZeitraster.map(d => d.leistung),
            borderColor: '#a0aec0',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [10, 5],
            fill: false,
            tension: 0,
            stepped: true,
            yAxisID: 'y',
            order: 2
        });
        
        // Optimiertes Lastprofil (durchgezogen, blau)
        datasets.push({
            label: 'Leistung Optimiert (kW)',
            data: zeitraster.map(d => d.leistung),
            borderColor: '#4299e1',
            backgroundColor: 'rgba(66, 153, 225, 0.2)',
            borderWidth: 3,
            fill: true,
            tension: 0,
            stepped: true,
            yAxisID: 'y',
            order: 1
        });
    } else {
        // Nur aktuelles Lastprofil
        datasets.push({
            label: 'Leistung (kW)',
            data: zeitraster.map(d => d.leistung),
            borderColor: '#4299e1',
            backgroundColor: 'rgba(66, 153, 225, 0.2)',
            borderWidth: 3,
            fill: true,
            tension: 0,
            stepped: true,
            yAxisID: 'y',
            order: 1
        });
    }
    
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: zeitraster.map(d => d.zeit),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { font: { size: 14, weight: 'bold' } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.y;
                            if (label.includes('Leistung')) {
                                return `${label}: ${value.toFixed(1)} kW`;
                            } else {
                                return `${label}: ${value.toFixed(2)} €/kWh`;
                            }
                        },
                        afterLabel: function(context) {
                            const dataIndex = context.dataIndex;
                            const punkt = zeitraster[dataIndex];
                            if (punkt && punkt.maschine && context.dataset.label.includes('Leistung')) {
                                return [
                                    `Auftrag: ${punkt.auftragId}`,
                                    `Maschine: ${punkt.maschine}`,
                                    `Prozess: ${punkt.prozess}`
                                ];
                            }
                            return '';
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    max: 16,
                    title: {
                        display: true,
                        text: 'Leistung (kW)',
                        font: { size: 14, weight: 'bold' },
                        color: '#4299e1'
                    },
                    ticks: {
                        color: '#4299e1',
                        callback: function(value) {
                            return value + ' kW';
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true,
                    max: 0.6,
                    title: {
                        display: true,
                        text: 'Strompreis (€/kWh)',
                        font: { size: 14, weight: 'bold' },
                        color: '#f56565'
                    },
                    ticks: {
                        color: '#f56565',
                        callback: function(value) {
                            return value.toFixed(2) + ' €';
                        }
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Uhrzeit',
                        font: { size: 14, weight: 'bold' }
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 20
                    }
                }
            }
        }
    });
}

function getStrompreis(minute) {
    const stunde = minute / 60;
    const fenster = strompreise.find(f => stunde >= f.start && stunde < f.end);
    return fenster ? fenster.preis : 0.30;
}

function minutenZuUhrzeit(minuten) {
    const stunden = Math.floor(minuten / 60);
    const mins = minuten % 60;
    return `${stunden.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Auftragsliste rendern
function renderAuftragsliste() {
    const container = document.getElementById('auftrags-liste');
    container.innerHTML = '';
    
    const anzeigeAuftraege = isOptimized ? auftraege : initialAuftraege;
    
    anzeigeAuftraege.forEach((auftrag, index) => {
        const startZeit = isOptimized ? 
            minutenZuUhrzeit(auftrag.startMinute) : 
            minutenZuUhrzeit(360 + initialAuftraege.slice(0, index).reduce((sum, a) => sum + a.gesamtDauer, 0));
        
        const endeZeit = isOptimized ? 
            minutenZuUhrzeit(auftrag.endMinute) :
            minutenZuUhrzeit(360 + initialAuftraege.slice(0, index + 1).reduce((sum, a) => sum + a.gesamtDauer, 0));
        
        const inSchicht2 = isOptimized ? auftrag.endMinute > 870 : false;
        
        const div = document.createElement('div');
        div.className = 'auftrag-item' + (inSchicht2 ? ' schicht2' : '');
        
        const strompreisClass = isOptimized ? 
            `strompreis-${auftrag.kategorie}` : 
            'strompreis-mittel';
        
        // Prozessliste HTML generieren
        let prozessListeHtml = '<div class="prozess-liste">';
        prozessListeHtml += '<div class="prozess-liste-title">📋 Prozessschritte:</div>';
        auftrag.prozesse.forEach((prozess, pIndex) => {
            prozessListeHtml += `
                <div class="prozess-item">
                    <div class="prozess-nummer">${pIndex + 1}</div>
                    <div class="prozess-name">${prozess.name}</div>
                    <div class="prozess-maschine">🔧 ${prozess.maschine}</div>
                    <div class="prozess-dauer">⏱️ ${prozess.dauer} min</div>
                    <div class="prozess-leistung">⚡ ${prozess.leistung.toFixed(1)} kW</div>
                </div>
            `;
        });
        prozessListeHtml += '</div>';

        div.innerHTML = `
            <div class="auftrag-header">
                <div class="auftrag-nummer">#${index + 1}</div>
                <div class="auftrag-info">
                    <div class="id">${auftrag.id}</div>
                    <div class="kunde">${auftrag.kunde}</div>
                </div>
                <div class="auftrag-zeit">
                    <div class="time">${startZeit} - ${endeZeit}</div>
                    <div style="font-size: 0.8em; color: #a0aec0;">${auftrag.gesamtDauer} min</div>
                    ${isOptimized ? `<div style="font-size: 0.85em; margin-top: 5px; font-weight: bold; color: #2d3748;">${auftrag.zugewiesenesZeitfenster} Uhr</div>` : ''}
                </div>
                <div class="auftrag-stats">
                    <div class="energie">${auftrag.gesamtEnergie.toFixed(2)} kWh</div>
                    ${isOptimized ? 
                        `<div class="kosten">${(auftrag.gesamtEnergie * auftrag.strompreis).toFixed(2)} €</div>` :
                        `<div class="kosten">${(auftrag.gesamtEnergie * 0.30).toFixed(2)} €</div>`
                    }
                </div>
                <div>
                    ${isOptimized ? 
                        `<span class="strompreis-badge ${strompreisClass}">${auftrag.strompreis.toFixed(2)} €/kWh</span>` :
                        '<span class="strompreis-badge strompreis-mittel">0.30 €/kWh</span>'
                    }
                </div>
                <div>
                    ${inSchicht2 ? '<span class="schicht-badge">Schicht 2</span>' : '<span style="color: #48bb78; font-weight: bold;">✓ Schicht 1</span>'}
                </div>
                <div style="text-align: center; font-size: 1.5em;">
                    ${isOptimized && auftrag.kostenGespart ? '💰' : ''}
                </div>
            </div>
            ${prozessListeHtml}
        `;
        
        container.appendChild(div);
    });
}

// Simulation zurücksetzen
function resetSimulation() {
    // Zufällige neue Strompreise generieren
    const basePreise = [0.15, 0.22, 0.38, 0.19];
    const variation = () => (Math.random() - 0.5) * 0.1;
    
    strompreise.forEach((fenster, index) => {
        fenster.preis = Math.max(0.10, basePreise[index] + variation());
    });
    
    auftraege = [...initialAuftraege];
    optimierteAuftraege = [];
    originalZeitraster = erstelleZeitraster(false);
    isOptimized = false;
    
    document.getElementById('optimization-alert').style.display = 'none';
    
    renderStrompreisEditor();
    updateUI();
}
