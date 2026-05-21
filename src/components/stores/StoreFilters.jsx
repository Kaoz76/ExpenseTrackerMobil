import React from 'react';
import { FaStore } from 'react-icons/fa';
import { useLanguage } from '../../context/LanguageContext';

function StoreFilters({
  searchTerm,
  setSearchTerm,
  showSuggestions,
  setShowSuggestions,
  suggestions,
  recentSearches,
  saveSearchTerm,
  handleSelectSuggestion,
  handleReset
}) {
  const { t } = useLanguage();

  return (
    <>
      {/* 🔥 BAŞLIK VE YENİ ARAMA ÇUBUĞU */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-3">
        <h1 className="display-6 fw-bold mb-3 mb-md-0">{t('common.stores')}</h1>

        <div className="search-controls-wrapper d-flex flex-column flex-md-row gap-2">
          <div className="search-wrapper">
            <form className="search-form" onSubmit={(e) => { e.preventDefault(); saveSearchTerm(searchTerm); }}>
              <button type="submit">
                <svg width="17" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="search">
                  <path d="M7.667 12.667A5.333 5.333 0 107.667 2a5.333 5.333 0 000 10.667zM14.334 14l-2.9-2.9" stroke="currentColor" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
              </button>

              <input
                className="search-input"
                placeholder={t('common.search_stores_placeholder')}
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              />

              {searchTerm && (
                <button className="search-reset" type="button" onClick={handleReset}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              )}
            </form>

            {/* Autocomplete suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="search-suggestions-dropdown">
                {suggestions.map((store) => (
                  <div
                    key={store.id}
                    className="suggestion-item"
                    onMouseDown={() => handleSelectSuggestion(store)}
                  >
                    <div className="suggestion-item-icon text-primary">
                      <FaStore />
                    </div>
                    <div className="suggestion-item-details">
                      <span className="suggestion-item-name">{store.name}</span>
                      <span className="suggestion-item-sub">{store.visitCount} {t('common.visit_recorded')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent searches history tags */}
      {showSuggestions && !searchTerm.trim() && recentSearches.length > 0 && (
        <div className="recent-searches-container mb-4">
          <span className="recent-searches-title">{t('common.recent_searches')}:</span>
          {recentSearches.map((term, idx) => (
            <button
              key={idx}
              className="recent-search-pill"
              onMouseDown={() => {
                setSearchTerm(term);
                setShowSuggestions(false);
              }}
            >
              {term}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export default StoreFilters;
