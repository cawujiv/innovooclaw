// innovooClaw · data/scenarios.js  (Frontend-Browser-JS)
// Demo-Szenarien für das Chat-Fenster.

const scenarios = {
  morning: {
    channel: 'leben', icon: '📋', title: '# leben',
    messages: []
  },
  budget: {
    channel: 'finanzen', icon: '💰', title: '# finanzen',
    messages: [
      { delay: 0,    who: 'user', name: 'Du',   time: '19:30', text: 'Mina, was habe ich diesen Monat ausgegeben?' },
      { delay: 800,  who: 'mina', typing: true },
      { delay: 2500, who: 'mina', name: 'MINA', time: '19:30',
        text: 'Hier dein Monats-Budget im Überblick:',
        action: { color: 'var(--accent-b)', title: '💳 Monats-Auswertung', items: [
          'Lebensmittel: 312,80 € (Budget: 350 €) ✅',
          'Restaurant: 156,40 € ⚠️',
          'Abonnements: 67,90 € – 1 inaktiv',
          'Gesamt: 1.847 € von 2.200 €'
        ]}},
    ]
  },
  travel: {
    channel: 'fitness', icon: '✈️', title: '# fitness & reise',
    messages: [
      { delay: 0,    who: 'user', name: 'Du',   time: '12:15', text: 'Vera, ich brauche ein Wochenende in Wien im November.' },
      { delay: 800,  who: 'vera', typing: true },
      { delay: 2500, who: 'vera', name: 'VERA', time: '12:16', text: 'Ich suche Verbindungen und prüfe deinen Kalender…',
        action: { color: 'var(--accent-c)', title: '🔍 Aktive Suche', items: [
          'Google Calendar → freie Wochenenden Nov',
          'DB Navigator → Verbindungen',
        ]}},
    ]
  },
  health: {
    channel: 'fitness', icon: '❤️', title: '# fitness',
    messages: [
      { delay: 0,    who: 'user', name: 'Du',   time: '20:00', text: 'Vera, wie war meine Woche gesundheitlich?' },
      { delay: 800,  who: 'vera', typing: true },
      { delay: 2500, who: 'vera', name: 'VERA', time: '20:00', text: 'Wochenauswertung folgt sofort…' },
    ]
  },
  swim: {
    channel: 'fitness', icon: '🏊', title: '# fitness · swim',
    messages: [
      { delay: 0,    who: 'user', name: 'Du',   time: '19:45', text: 'Vera, analysiere bitte meine Schwimmeinheiten.' },
      { delay: 800,  who: 'vera', typing: true },
      { delay: 2500, who: 'vera', name: 'VERA', time: '19:45', text: 'Lade Garmin-Daten…' },
    ]
  },
};
