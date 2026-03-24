/**
 * i18n Helper Module
 * Internationalisierung für EFDM Lastmanagement
 * 
 * Unterstützte Sprachen: DE, EN
 */

// Verfügbare Übersetzungen
let translations = {};
let currentLanguage = 'de'; // Default: Deutsch

/**
 * Lädt Übersetzungen vom Server
 */
async function loadTranslations(lang = 'de') {
    try {
        const response = await fetch(`/i18n/${lang}.json`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        translations = await response.json();
        currentLanguage = lang;
        console.log(`✅ i18n: Sprache '${lang}' geladen`);
        return translations;
    } catch (error) {
        console.error(`❌ i18n: Fehler beim Laden von '${lang}':`, error);
        // Fallback zu Deutsch
        if (lang !== 'de') {
            console.log('🔄 i18n: Fallback zu Deutsch...');
            return loadTranslations('de');
        }
        return {};
    }
}

/**
 * Übersetzt einen Key mit optionalen Platzhaltern
 * 
 * @param {string} key - Übersetzungs-Key (z.B. "app.title" oder "alerts.optimization_success")
 * @param {object} params - Optionale Parameter für Platzhalter {percent: 10, amount: 5.50}
 * @returns {string} - Übersetzter Text
 * 
 * @example
 * t('app.title') // "⚡ Energieflexible Produktionsplanung"
 * t('alerts.optimization_success', {percent: 10.5, amount: 5.50}) 
 * // "✅ Optimierung erfolgreich! Energiekosten um 10.5% reduziert (5.50 € gespart)"
 */
function t(key, params = {}) {
    // Navigiere durch verschachtelte Keys
    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            console.warn(`⚠️ i18n: Key nicht gefunden: '${key}'`);
            return key; // Fallback: zeige Key
        }
    }
    
    // Wenn es ein String ist, ersetze Platzhalter
    if (typeof value === 'string') {
        return replacePlaceholders(value, params);
    }
    
    console.warn(`⚠️ i18n: Key '${key}' ist kein String`);
    return key;
}

/**
 * Ersetzt Platzhalter in Strings
 * 
 * @param {string} text - Text mit Platzhaltern {key}
 * @param {object} params - Werte für Platzhalter
 * @returns {string} - Text mit ersetzten Platzhaltern
 * 
 * @example
 * replacePlaceholders("Hallo {name}!", {name: "Max"}) // "Hallo Max!"
 */
function replacePlaceholders(text, params) {
    return text.replace(/\{(\w+)\}/g, (match, key) => {
        return key in params ? params[key] : match;
    });
}

/**
 * Gibt die aktuelle Sprache zurück
 */
function getCurrentLanguage() {
    return currentLanguage;
}

/**
 * Setzt die Sprache und lädt Übersetzungen
 */
async function setLanguage(lang) {
    await loadTranslations(lang);
    // Trigger Event für UI-Update
    document.dispatchEvent(new CustomEvent('languageChanged', { 
        detail: { language: lang } 
    }));
}

/**
 * Gibt alle verfügbaren Sprachen zurück
 */
function getAvailableLanguages() {
    return [
        { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
        { code: 'en', name: 'English', flag: '🇬🇧' }
    ];
}

/**
 * Detektiert Browser-Sprache
 */
function detectBrowserLanguage() {
    const browserLang = navigator.language || navigator.userLanguage;
    const langCode = browserLang.split('-')[0]; // z.B. "de-DE" -> "de"
    
    // Prüfe ob unterstützt
    const supported = ['de', 'en'];
    return supported.includes(langCode) ? langCode : 'de';
}

/**
 * Initialisiert i18n mit Browser-Sprache oder Default
 */
async function initI18n(defaultLang = null) {
    const lang = defaultLang || detectBrowserLanguage();
    await loadTranslations(lang);
    console.log(`🌍 i18n initialisiert: ${lang}`);
}

// Export für Module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        t,
        loadTranslations,
        getCurrentLanguage,
        setLanguage,
        getAvailableLanguages,
        detectBrowserLanguage,
        initI18n
    };
}

// Global verfügbar machen für Browser
if (typeof window !== 'undefined') {
    window.i18n = {
        t,
        loadTranslations,
        getCurrentLanguage,
        setLanguage,
        getAvailableLanguages,
        detectBrowserLanguage,
        initI18n
    };
}
