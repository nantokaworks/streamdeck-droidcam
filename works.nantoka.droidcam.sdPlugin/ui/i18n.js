/**
 * i18n Helper for Property Inspector
 * This file provides internationalization support for Property Inspector UI
 */

let translations = {};
let currentLanguage = 'en';

/**
 * Load translations for the current language
 * @param {string} lang - Language code (e.g., 'en', 'ja')
 */
async function loadTranslations(lang) {
    try {
        const response = await fetch(`../${lang}.json`);
        if (response.ok) {
            const data = await response.json();
            translations = data.Localization || {};
            currentLanguage = lang;
            return true;
        }
    } catch (error) {
        console.error(`Failed to load ${lang} translations:`, error);
    }
    return false;
}

/**
 * Translate a key
 * @param {string} key - Translation key
 * @param {string} defaultValue - Default value if translation not found
 * @returns {string} Translated text
 */
function t(key, defaultValue = '') {
    return translations[key] || defaultValue || key;
}

/**
 * Initialize i18n and apply translations to DOM
 * @param {string} lang - Language code (defaults to system language or 'en')
 */
async function initI18n(lang = null) {
    // Get language from Stream Deck or use default
    if (!lang) {
        // Try to get language from Stream Deck global settings
        // For now, we'll use navigator.language as a fallback
        const browserLang = navigator.language.toLowerCase();
        if (browserLang.startsWith('ja')) {
            lang = 'ja';
        } else {
            lang = 'en';
        }
    }
    
    // Load translations
    const loaded = await loadTranslations(lang);
    if (!loaded && lang !== 'en') {
        // Fallback to English if preferred language fails
        await loadTranslations('en');
    }
    
    // Apply translations to DOM elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = t(key, element.textContent);
        
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            // For input elements, update placeholder
            if (element.hasAttribute('placeholder')) {
                element.placeholder = translation;
            }
        } else {
            // For other elements, update text content
            element.textContent = translation;
        }
    });
    
    // Apply translations to elements with data-i18n-placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        element.placeholder = t(key, element.placeholder);
    });
    
    // Apply translations to elements with data-i18n-title
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        const key = element.getAttribute('data-i18n-title');
        element.title = t(key, element.title);
    });
}

/**
 * Get the current language
 * @returns {string} Current language code
 */
function getCurrentLanguage() {
    return currentLanguage;
}

// Export functions for use in Property Inspector
window.i18n = {
    init: initI18n,
    t: t,
    getCurrentLanguage: getCurrentLanguage
};