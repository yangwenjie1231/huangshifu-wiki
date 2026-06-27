import React from 'react'
import { ViewModeSelector } from '../components/ViewModeSelector'
import { useUserPreferences } from '../context/UserPreferencesContext'
import { useSearchPage } from '../hooks/useSearchPage'
import { SearchBox } from '../components/search/SearchBox'
import { SearchFilters } from '../components/search/SearchFilters'
import { SearchResults } from '../components/search/SearchResults'
import { usePublicFeatures } from '../hooks/usePublicFeatures'

const Search: React.FC = () => {
  const { preferences, setViewMode } = useUserPreferences()
  const viewMode = preferences.viewMode
  const { features } = usePublicFeatures()
  const semanticSearchEnabled = features.semanticSearch

  const {
    state,
    searchHistory,
    tabItems,
    performSearch,
    handleQueryChange,
    handleImageSearch,
    toggleTag,
    updateFilters,
    resetFilters,
    setActiveTab,
    setShowFilters,
    dismissSuggestions,
    removeSearchHistoryItem,
    clearSearchHistory,
  } = useSearchPage()

  React.useEffect(() => {
    if (!semanticSearchEnabled && state.filters.semanticImageSearch) {
      updateFilters({ semanticImageSearch: false })
    }
  }, [semanticSearchEnabled, state.filters.semanticImageSearch, updateFilters])

  return (
    <div
      className="min-h-[calc(100vh-60px)] bg-bg-primary"
      style={{
        fontFamily: "'Noto Serif SC', 'Source Han Serif SC', 'SimSun', 'STSong', 'FangSong', serif",
        lineHeight: 1.8,
      }}
    >
      <div className="max-w-[1100px] mx-auto px-6 py-8 pb-32 search-page">
        {/* Header */}
        <header className="mb-7">
          <div className="flex items-end justify-between flex-wrap gap-3">
            <h1 className="text-[1.75rem] font-bold text-text-primary tracking-[0.12em]">搜索</h1>
            <div className="flex items-center gap-3">
              <ViewModeSelector value={viewMode} onChange={setViewMode} size="sm" />
            </div>
          </div>
        </header>

        {/* Search Box */}
        <SearchBox
          query={state.query}
          suggestions={state.suggestions}
          aiSearching={state.aiSearching}
          semanticImageSearch={state.filters.semanticImageSearch}
          semanticSearchEnabled={semanticSearchEnabled}
          searchHistory={searchHistory}
          onQueryChange={handleQueryChange}
          onSearch={performSearch}
          onImageSearch={handleImageSearch}
          onToggleSemanticSearch={() => {
            if (semanticSearchEnabled) {
              updateFilters({ semanticImageSearch: !state.filters.semanticImageSearch })
            }
          }}
          onDismissSuggestions={dismissSuggestions}
          onRemoveSearchHistoryItem={removeSearchHistoryItem}
          onClearSearchHistory={clearSearchHistory}
        />

        {/* Search Filters */}
        <SearchFilters
          filters={state.filters}
          hotKeywords={state.hotKeywords}
          showFilters={state.showFilters}
          semanticSearchEnabled={semanticSearchEnabled}
          onToggleShowFilters={() => setShowFilters(!state.showFilters)}
          onToggleTag={toggleTag}
          onUpdateFilters={updateFilters}
          onResetFilters={resetFilters}
          onApplyFilters={() => performSearch(state.query)}
          onSearchKeyword={(keyword) => performSearch(keyword)}
        />

        {/* Search Results */}
        <SearchResults
          state={state}
          viewMode={viewMode}
          tabItems={tabItems}
          onTabChange={setActiveTab}
        />
      </div>
    </div>
  )
}

export default Search
