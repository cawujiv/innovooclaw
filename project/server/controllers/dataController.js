const getDataSource = require('../data/dataSources');
const { dataSource } = require('../config/dataConfig');

/**
 * GET /api/strompreise
 * Liefert die Strompreise aus der konfigurierten Datenquelle
 */
exports.getStrompreise = async (req, res) => {
  try {
    const source = getDataSource(dataSource);
    const strompreise = await source.strompreise();
    
    res.json({
      success: true,
      source: dataSource,
      count: strompreise.length,
      data: strompreise,
    });
  } catch (error) {
    console.error('❌ Fehler beim Laden der Strompreise:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

/**
 * GET /api/auftraege
 * Liefert die Aufträge aus der konfigurierten Datenquelle
 */
exports.getAuftraege = async (req, res) => {
  try {
    const source = getDataSource(dataSource);
    const auftraege = await source.auftraege();
    
    res.json({
      success: true,
      source: dataSource,
      count: auftraege.length,
      data: auftraege,
    });
  } catch (error) {
    console.error('❌ Fehler beim Laden der Aufträge:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

/**
 * GET /api/data
 * Liefert alle Daten kombiniert (Strompreise + Aufträge)
 */
exports.getAllData = async (req, res) => {
  try {
    const source = getDataSource(dataSource);
    const strompreise = await source.strompreise();
    const auftraege = await source.auftraege();
    
    // Berechne Zusammenfassungen
    const gesamtEnergie = auftraege.reduce((sum, a) => sum + a.gesamtEnergie, 0);
    const gesamtDauer = auftraege.reduce((sum, a) => sum + a.gesamtDauer, 0);
    
    res.json({
      success: true,
      source: dataSource,
      timestamp: new Date(),
      summary: {
        anzahlAuftraege: auftraege.length,
        anzahlStrompreise: strompreise.length,
        gesamtEnergie: gesamtEnergie.toFixed(2) + ' kWh',
        gesamtDauer: gesamtDauer + ' min',
      },
      data: {
        strompreise,
        auftraege,
      },
    });
  } catch (error) {
    console.error('❌ Fehler beim Laden aller Daten:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};
