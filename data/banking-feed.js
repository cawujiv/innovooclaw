// innovooClaw · data/banking-feed.js  (Frontend-Browser-JS)
const bankingFeedConfig = {
  kontoName: 'Girokonto', iban: 'DE89 3704 0044 **** **** 00',
  bank: 'Commerzbank', startSaldo: 3247.80,
};
const txCategories = {
  einnahmen:    { icon: '💼', label: 'Einnahmen',    color: '#00e5a0', bg: 'rgba(0,229,160,0.08)'   },
  lebensmittel: { icon: '🛒', label: 'Lebensmittel', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)'  },
  restaurant:   { icon: '🍽', label: 'Restaurant',   color: '#f97316', bg: 'rgba(249,115,22,0.08)'  },
  transport:    { icon: '🚂', label: 'Transport',    color: '#6b8aff', bg: 'rgba(107,138,255,0.08)' },
  abonnements:  { icon: '📺', label: 'Abonnements',  color: '#a855f7', bg: 'rgba(168,85,247,0.08)'  },
  gesundheit:   { icon: '💊', label: 'Gesundheit',   color: '#f472b6', bg: 'rgba(244,114,182,0.08)' },
  wohnen:       { icon: '🏠', label: 'Wohnen',       color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
  shopping:     { icon: '📦', label: 'Shopping',     color: '#fb923c', bg: 'rgba(251,146,60,0.08)'  },
  sport:        { icon: '🏊', label: 'Sport',        color: '#34d399', bg: 'rgba(52,211,153,0.08)'  },
  sonstiges:    { icon: '💳', label: 'Sonstiges',    color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
};
const bankingHistory = [];
const bankingLiveQueue = [];
const bankingMonthSummary = { monat: '', einnahmen: 0, ausgaben: 0, top3: [] };
