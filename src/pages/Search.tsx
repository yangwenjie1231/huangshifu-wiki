import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Link, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, Book, MessageSquare, Image as ImageIcon, Clock, ChevronRight, Tag, X, Filter, Sparkles, Calendar, Camera } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';
import { describeImageForSearch } from '../services/aiService';
import { SmartImage } from '../components/SmartImage';

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [results, setResults] = useState<{
    wiki: any[];
    posts: any[];
    galleries: any[];
  }>({ wiki: [], posts: [], galleries: [] });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'wiki' | 'posts' | 'galleries'>('all');
  
  // Advanced Filters
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [contentType, setContentType] = useState<'all' | 'wiki' | 'posts' | 'galleries'>('all');

  // AI Image Search
  const [aiSearching, setAiSearching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const trendingTags = ['黄诗扶', '音乐作品', '演出经历', '同人创作', 'Live', '绝色', '2024'];

  useEffect(() => {
    if (initialQuery) {
      handleSearch(initialQuery);
    }
  }, [initialQuery]);

  const handleSearch = async (q: string, filtersOverride?: any) => {
    setLoading(true);
    const currentQuery = q || searchQuery;
    setSearchParams({ q: currentQuery });
    setSearchQuery(currentQuery);

    const filters = filtersOverride || { selectedTags, dateRange, contentType };

    try {
      const collections = ['wiki', 'posts', 'galleries'];
      const searchPromises = collections.map(async (col) => {
        if (filters.contentType !== 'all' && filters.contentType !== col) return [];

        const ref = collection(db, col);
        let qry = query(ref, orderBy('updatedAt', 'desc'), limit(100));
        
        // Firestore doesn't support complex text search + multiple filters well without indexes
        // So we fetch and filter client-side for this demo/prototype
        const snapshot = await getDocs(qry);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      });

      const [wikiDocs, postsDocs, galleriesDocs] = await Promise.all(searchPromises);

      const filterFn = (item: any) => {
        // Text Search
        const searchStr = (item.title || item.content || item.description || '').toLowerCase();
        const tagsStr = (item.tags || []).join(' ').toLowerCase();
        const categoryStr = (item.category || item.section || '').toLowerCase();
        const matchesText = !currentQuery || searchStr.includes(currentQuery.toLowerCase()) || tagsStr.includes(currentQuery.toLowerCase()) || categoryStr.includes(currentQuery.toLowerCase());

        // Tag Filter
        const matchesTags = filters.selectedTags.length === 0 || filters.selectedTags.every(tag => (item.tags || []).includes(tag));

        // Date Filter
        let matchesDate = true;
        if (filters.dateRange.start || filters.dateRange.end) {
          const itemDate = item.updatedAt?.toDate ? item.updatedAt.toDate() : new Date();
          if (filters.dateRange.start && itemDate < new Date(filters.dateRange.start)) matchesDate = false;
          if (filters.dateRange.end && itemDate > endOfDay(new Date(filters.dateRange.end))) matchesDate = false;
        }

        return matchesText && matchesTags && matchesDate;
      };

      setResults({
        wiki: wikiDocs.filter(filterFn),
        posts: postsDocs.filter(filterFn),
        galleries: galleriesDocs.filter(filterFn)
      });
    } catch (e) {
      console.error("Search error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAiSearching(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const description = await describeImageForSearch(base64, file.type);
        if (description) {
          handleSearch(description);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("AI Image Search error:", err);
    } finally {
      setAiSearching(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const totalResults = results.wiki.length + results.posts.length + results.galleries.length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto mb-16">
        <h1 className="text-5xl font-serif font-bold text-brand-olive mb-8 text-center">高级搜索</h1>
        
        <div className="bg-white rounded-[40px] p-8 shadow-xl border border-gray-100 mb-8">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSearch(searchQuery); }}
            className="relative group mb-6"
          >
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索百科、帖子或图集..."
              className="w-full px-14 py-6 bg-brand-cream/30 rounded-[32px] border-none focus:ring-4 focus:ring-brand-olive/10 transition-all text-xl font-serif"
            />
            <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-brand-olive/40 group-focus-within:text-brand-olive transition-colors" size={24} />
            
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={aiSearching}
                className="p-3 bg-brand-cream text-brand-olive rounded-2xl hover:bg-brand-olive hover:text-white transition-all"
                title="AI 图片搜索"
              >
                {aiSearching ? <Sparkles className="animate-spin" size={20} /> : <Camera size={20} />}
              </button>
              <button 
                type="submit"
                className="px-8 py-3 bg-brand-olive text-white rounded-2xl font-bold hover:bg-brand-olive/90 transition-all shadow-md"
              >
                搜索
              </button>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleImageSearch} accept="image/*" className="hidden" />
          </form>

          <div className="flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">热门:</span>
              {trendingTags.slice(0, 4).map(tag => (
                <button 
                  key={tag}
                  onClick={() => handleSearch(tag)}
                  className="px-4 py-1.5 bg-brand-cream text-brand-olive text-xs font-medium rounded-full hover:bg-brand-olive hover:text-white transition-all"
                >
                  #{tag}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={clsx(
                "flex items-center gap-2 text-sm font-bold transition-colors",
                showFilters ? "text-brand-olive" : "text-gray-400 hover:text-brand-olive"
              )}
            >
              <Filter size={18} /> {showFilters ? '隐藏筛选' : '高级筛选'}
            </button>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-8 pt-8 border-t border-gray-100"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-brand-olive/60 flex items-center gap-2">
                      <Tag size={14} /> 标签筛选
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {trendingTags.map(tag => (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={clsx(
                            "px-3 py-1 rounded-full text-xs transition-all",
                            selectedTags.includes(tag) 
                              ? "bg-brand-olive text-white" 
                              : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                          )}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-brand-olive/60 flex items-center gap-2">
                      <Calendar size={14} /> 时间范围
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        type="date" 
                        value={dateRange.start}
                        onChange={e => setDateRange({...dateRange, start: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-50 rounded-xl border-none text-xs focus:ring-2 focus:ring-brand-olive/20"
                      />
                      <input 
                        type="date" 
                        value={dateRange.end}
                        onChange={e => setDateRange({...dateRange, end: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-50 rounded-xl border-none text-xs focus:ring-2 focus:ring-brand-olive/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-brand-olive/60 flex items-center gap-2">
                      <Book size={14} /> 内容类型
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {['all', 'wiki', 'posts', 'galleries'].map(type => (
                        <button
                          key={type}
                          onClick={() => setContentType(type as any)}
                          className={clsx(
                            "px-3 py-1 rounded-full text-xs transition-all capitalize",
                            contentType === type 
                              ? "bg-brand-olive text-white" 
                              : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                          )}
                        >
                          {type === 'all' ? '全部' : type}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 flex justify-end gap-4">
                  <button 
                    onClick={() => {
                      setSelectedTags([]);
                      setDateRange({ start: '', end: '' });
                      setContentType('all');
                    }}
                    className="text-xs font-bold text-gray-400 hover:text-red-500"
                  >
                    重置筛选
                  </button>
                  <button 
                    onClick={() => handleSearch(searchQuery)}
                    className="px-6 py-2 bg-brand-cream text-brand-olive rounded-full text-xs font-bold hover:bg-brand-olive hover:text-white transition-all"
                  >
                    应用筛选
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {loading ? (
        <div className="space-y-8 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-white rounded-3xl border border-gray-100"></div>
          ))}
        </div>
      ) : initialQuery || selectedTags.length > 0 || dateRange.start || dateRange.end ? (
        <div className="space-y-12">
          <div className="flex flex-wrap gap-4 border-b border-gray-100 pb-6">
            {[
              { id: 'all', label: '全部', count: totalResults },
              { id: 'wiki', label: '百科', count: results.wiki.length },
              { id: 'posts', label: '帖子', count: results.posts.length },
              { id: 'galleries', label: '图集', count: results.galleries.length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={clsx(
                  "px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2",
                  activeTab === tab.id 
                    ? "bg-brand-olive text-white" 
                    : "bg-white text-gray-400 border border-gray-100 hover:border-brand-olive/20"
                )}
              >
                {tab.label} <span className="text-[10px] opacity-60 bg-black/10 px-1.5 py-0.5 rounded-full">{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="space-y-8">
            <AnimatePresence mode="wait">
              {(activeTab === 'all' || activeTab === 'wiki') && results.wiki.length > 0 && (
                <motion.section 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  <h2 className="text-sm font-bold text-brand-olive uppercase tracking-widest flex items-center gap-2">
                    <Book size={16} /> 百科页面
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {results.wiki.map(page => (
                      <Link 
                        key={page.id} 
                        to={`/wiki/${page.slug}`}
                        className="bg-white p-6 rounded-3xl border border-gray-100 hover:border-brand-olive/20 hover:shadow-lg transition-all group"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <span className="px-2 py-0.5 bg-brand-cream text-brand-olive text-[10px] font-bold uppercase tracking-wider rounded">{page.category}</span>
                        </div>
                        <h3 className="text-xl font-serif font-bold mb-2 group-hover:text-brand-olive transition-colors">{page.title}</h3>
                        <p className="text-gray-400 text-sm line-clamp-2 mb-4 italic leading-relaxed">
                          {page.content.replace(/[#*`]/g, '').substring(0, 100)}...
                        </p>
                        <div className="flex items-center justify-between text-gray-400 text-[10px]">
                          <span className="flex items-center gap-1"><Clock size={12} /> {page.updatedAt?.toDate ? format(page.updatedAt.toDate(), 'yyyy-MM-dd') : '刚刚'}</span>
                          <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </motion.section>
              )}

              {(activeTab === 'all' || activeTab === 'posts') && results.posts.length > 0 && (
                <motion.section 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  <h2 className="text-sm font-bold text-brand-olive uppercase tracking-widest flex items-center gap-2">
                    <MessageSquare size={16} /> 社区帖子
                  </h2>
                  <div className="space-y-4">
                    {results.posts.map(post => (
                      <Link 
                        key={post.id} 
                        to={`/forum/${post.id}`}
                        className="block bg-white p-6 rounded-3xl border border-gray-100 hover:border-brand-olive/20 hover:shadow-lg transition-all group"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-brand-cream text-brand-olive text-[10px] font-bold uppercase tracking-wider rounded">{post.section}</span>
                          <span className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={10} /> {post.updatedAt?.toDate ? format(post.updatedAt.toDate(), 'yyyy-MM-dd') : '刚刚'}</span>
                        </div>
                        <h3 className="text-xl font-serif font-bold group-hover:text-brand-olive transition-colors">{post.title}</h3>
                      </Link>
                    ))}
                  </div>
                </motion.section>
              )}

              {(activeTab === 'all' || activeTab === 'galleries') && results.galleries.length > 0 && (
                <motion.section 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  <h2 className="text-sm font-bold text-brand-olive uppercase tracking-widest flex items-center gap-2">
                    <ImageIcon size={16} /> 图集馆
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {results.galleries.map(gallery => (
                      <Link 
                        key={gallery.id} 
                        to={`/gallery`}
                        className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all group"
                      >
                        <div className="h-32 overflow-hidden">
                          <SmartImage src={gallery.images[0]?.url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        </div>
                        <div className="p-4">
                          <h3 className="text-sm font-serif font-bold truncate group-hover:text-brand-olive transition-colors">{gallery.title}</h3>
                          <p className="text-[10px] text-gray-400">{gallery.images.length} 张图片</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            {totalResults === 0 && !loading && (
              <div className="bg-white p-20 rounded-[40px] border border-gray-100 text-center">
                <SearchIcon size={48} className="mx-auto text-brand-olive/20 mb-6" />
                <p className="text-gray-400 italic">未找到符合筛选条件的结果</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white p-20 rounded-[40px] border border-gray-100 text-center">
          <Tag size={48} className="mx-auto text-brand-olive/20 mb-6" />
          <p className="text-gray-400 italic">输入关键词、上传图片或使用高级筛选开始探索</p>
        </div>
      )}
    </div>
  );
};

export default Search;
