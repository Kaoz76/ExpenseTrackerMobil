import React from 'react';
import { getCategoryInfo } from '../../utils/categoryMap';
import { useLanguage } from '../../context/LanguageContext';

function ProductFilters({
  searchTerm,
  setSearchTerm,
  showSuggestions,
  setShowSuggestions,
  suggestions,
  recentSearches,
  saveSearchTerm,
  handleSelectSuggestion,
  handleReset,
  sortOption,
  setSortOption,
  uniqueCategories,
  selectedCategory,
  setSelectedCategory
}) {
  const { t } = useLanguage();

  return (
    <>
      {/* Başlık ve Arama / Filtreleme Çubuğu */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-3">
        <h1 className="display-6 fw-bold mb-3 mb-md-0">{t('common.products')}</h1>

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
                placeholder={t('common.search_products')}
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              />

              {(searchTerm || selectedCategory !== 'all') && (
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
                {suggestions.map((p) => {
                  const displayType = p.type === 'Other' || p.type === 'Diğer' ? t('common.category_other') : p.type;
                  const catInfo = getCategoryInfo(displayType);
                  return (
                    <div
                      key={p.id}
                      className="suggestion-item"
                      onMouseDown={() => handleSelectSuggestion(p)}
                    >
                      <div className="suggestion-item-icon" style={{ color: catInfo.color }}>
                        {catInfo.icon}
                      </div>
                      <div className="suggestion-item-details">
                        <span className="suggestion-item-name">{p.name}</span>
                        <span className="suggestion-item-sub">{p.brand} • {displayType}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sorting control */}
          <select
            className="sort-select"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            aria-label={t('common.sort_by')}
          >
            <option value="most_purchased">{t('common.sort_most_purchased')}</option>
            <option value="price_low_high">{t('common.sort_price_low_to_high')}</option>
            <option value="price_high_low">{t('common.sort_price_high_to_low')}</option>
            <option value="az">{t('common.sort_az')}</option>
            <option value="recent">{t('common.sort_recent')}</option>
          </select>
        </div>
      </div>

      {/* Recent searches history tags */}
      {showSuggestions && !searchTerm.trim() && recentSearches.length > 0 && (
        <div className="recent-searches-container mb-3">
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

      {/* Horizontal Category Badges Scrollable List */}
      {uniqueCategories.length > 1 && (
        <div className="category-scroll-container mb-3">
          {uniqueCategories.map((cat) => {
            const isActive = selectedCategory === cat;
            const displayLabel = cat === 'all' ? t('common.category_all') : cat;
            return (
              <button
                key={cat}
                className={`category-pill ${isActive ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {displayLabel}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

export default ProductFilters;
