/**
 * Datenquellen-Konfiguration
 * 
 * Über die Umgebungsvariable DATA_SOURCE kann zwischen
 * simulierten und externen Datenquellen umgeschaltet werden.
 * 
 * Werte:
 * - 'simulated': Nutzt die hardcodierten Testdaten
 * - 'external': Nutzt externe APIs (EPEX Spot, ERP-System etc.)
 */

module.exports = {
  dataSource: process.env.DATA_SOURCE || 'simulated',
  
  // Weitere Konfigurationen für externe APIs
  externalApis: {
    strompreise: {
      url: process.env.STROMPREIS_API_URL || 'https://api.example.com/strompreise',
      apiKey: process.env.STROMPREIS_API_KEY || '',
      timeout: 5000, // 5 Sekunden
    },
    auftraege: {
      url: process.env.AUFTRAG_API_URL || 'https://api.example.com/auftraege',
      apiKey: process.env.AUFTRAG_API_KEY || '',
      timeout: 5000,
    },
  },
  
  // Cache-Konfiguration
  cache: {
    enabled: process.env.CACHE_ENABLED === 'true',
    ttl: parseInt(process.env.CACHE_TTL || '3600', 10), // 1 Stunde Standard
  },
};
