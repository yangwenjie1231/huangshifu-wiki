import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp, orderBy, addDoc, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Book, Edit3, Plus, ChevronRight, Search, Tag, Clock, User as UserIcon, ArrowLeft, Save, X, Sparkles, History, Calendar } from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { summarizeWikiContent, generateWikiIntro } from '../services/aiService';
import { uploadImageToCDNs, getImageUrl } from '../services/imageService';
import MdEditor from 'react-markdown-editor-lite';
import MarkdownIt from 'markdown-it';
import 'react-markdown-editor-lite/lib/index.css';

const mdParser = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
});

// --- Wiki Internal Linking Component ---
const WikiMarkdown = ({ content }: { content: string }) => {
  // Pre-process internal links [[display|slug]] or [[slug]] to standard markdown links
  // This is safer than overriding the 'p' component which can break with HTML
  const processedContent = content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, p1, p2) => {
    const display = p1.trim();
    const slug = p2 ? p2.trim() : p1.trim();
    return `[${display}](/wiki/${slug})`;
  });

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        // Use Link from react-router-dom for internal links
        a: ({ href, children, ...props }) => {
          if (href?.startsWith('/wiki/')) {
            return (
              <Link 
                to={href} 
                className="text-brand-olive font-bold hover:underline decoration-brand-olive/30 underline-offset-4"
                {...props}
              >
                {children}
              </Link>
            );
          }
          return (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-brand-olive hover:underline"
              {...props}
            >
              {children}
            </a>
          );
        },
        // Support tables with Tailwind
        table: ({ children }) => (
          <div className="overflow-x-auto my-8">
            <table className="w-full border-collapse border border-gray-200 rounded-xl overflow-hidden">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-brand-cream/50 text-brand-olive">{children}</thead>,
        th: ({ children }) => <th className="border border-gray-200 px-4 py-3 text-left font-bold">{children}</th>,
        td: ({ children }) => <td className="border border-gray-200 px-4 py-3">{children}</td>,
        tr: ({ children }) => <tr className="hover:bg-gray-50 transition-colors">{children}</tr>
      }}
    >
      {processedContent}
    </ReactMarkdown>
  );
};

// --- Wiki List Component ---
const WikiList = () => {
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'all';
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchPages = async () => {
      setLoading(true);
      try {
        const wikiRef = collection(db, 'wiki');
        let q = query(wikiRef, orderBy('updatedAt', 'desc'));
        if (category !== 'all') {
          q = query(wikiRef, where('category', '==', category), orderBy('updatedAt', 'desc'));
        }
        const snapshot = await getDocs(q);
        setPages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        console.error("Error fetching wiki pages:", e);
      }
      setLoading(false);
    };
    fetchPages();
  }, [category]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 className="text-5xl font-serif font-bold text-brand-olive mb-2">百科全书</h1>
          <p className="text-gray-500 italic">诗扶百科 · 记录每一个动人瞬间</p>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/wiki/timeline" className="px-6 py-3 bg-brand-cream text-brand-olive rounded-full font-medium hover:bg-brand-olive hover:text-white transition-all flex items-center gap-2 shadow-sm">
            <Calendar size={18} /> 时间轴视图
          </Link>
          {user && (
            <Link to="/wiki/new" className="px-6 py-3 bg-brand-olive text-white rounded-full font-medium hover:bg-brand-olive/90 transition-all flex items-center gap-2 shadow-md">
              <Plus size={18} /> 创建页面
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-12">
        {['all', 'biography', 'music', 'album', 'timeline', 'event'].map((cat) => (
          <Link
            key={cat}
            to={`/wiki?category=${cat}`}
            className={clsx(
              "px-6 py-2 rounded-full text-sm font-medium transition-all border capitalize",
              category === cat 
                ? "bg-brand-olive text-white border-brand-olive" 
                : "bg-white text-gray-500 border-gray-200 hover:border-brand-olive hover:text-brand-olive"
            )}
          >
            {cat === 'all' ? '全部' : 
             cat === 'biography' ? '人物介绍' :
             cat === 'music' ? '音乐作品' :
             cat === 'album' ? '专辑一览' :
             cat === 'timeline' ? '时间轴' :
             cat === 'event' ? '活动记录' : cat}
          </Link>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-48 bg-white rounded-[32px] animate-pulse border border-gray-100"></div>
          ))}
        </div>
      ) : pages.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {pages.map((page) => (
            <Link 
              key={page.id} 
              to={`/wiki/${page.slug}`}
              className="bg-white p-8 rounded-[32px] border border-gray-100 hover:border-brand-olive/20 hover:shadow-xl transition-all group"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2 py-1 bg-brand-cream text-brand-olive text-[10px] font-bold uppercase tracking-wider rounded">
                  {page.category === 'biography' ? '人物介绍' :
                   page.category === 'music' ? '音乐作品' :
                   page.category === 'album' ? '专辑一览' :
                   page.category === 'timeline' ? '时间轴' :
                   page.category === 'event' ? '活动记录' : page.category}
                </span>
              </div>
              <h3 className="text-2xl font-serif font-bold mb-4 group-hover:text-brand-olive transition-colors">{page.title}</h3>
              <p className="text-gray-400 text-sm line-clamp-2 mb-6 italic leading-relaxed">
                {page.content.replace(/[#*`]/g, '').substring(0, 100)}...
              </p>
              <div className="flex items-center justify-between text-gray-400 text-xs">
                <span className="flex items-center gap-1"><Clock size={12} /> {page.updatedAt?.toDate ? format(page.updatedAt.toDate(), 'yyyy-MM-dd') : '刚刚'}</span>
                <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white p-20 rounded-[40px] border border-gray-100 text-center">
          <Book size={48} className="mx-auto text-gray-200 mb-6" />
          <p className="text-gray-400 italic">暂无相关百科页面</p>
        </div>
      )}
    </div>
  );
};

// --- Wiki Page Component ---
const WikiPageView = () => {
  const { slug } = useParams();
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user, isAdmin } = useAuth();
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [backlinks, setBacklinks] = useState<any[]>([]);

  useEffect(() => {
    const fetchPage = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, 'wiki', slug!);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setPage(docSnap.data());
          
          // Fetch Backlinks
          const wikiRef = collection(db, 'wiki');
          const q = query(wikiRef, limit(100)); // Simplified: fetch all and filter client-side for [[slug]]
          const snapshot = await getDocs(q);
          const links = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as any))
            .filter(p => p.slug !== slug && p.content.includes(`[[${slug}]]`));
          setBacklinks(links);
        }
      } catch (e) {
        console.error("Error fetching page:", e);
      }
      setLoading(false);
    };
    fetchPage();
  }, [slug]);

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-20 text-center italic text-gray-400">加载中...</div>;
  if (!page) return <div className="max-w-4xl mx-auto px-4 py-20 text-center italic text-gray-400">页面未找到</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link to="/wiki" className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-olive mb-8 transition-colors">
        <ArrowLeft size={18} /> 返回百科列表
      </Link>

      <article className="bg-white rounded-[40px] p-8 sm:p-16 border border-gray-100 shadow-sm">
        <header className="mb-12 border-b border-gray-100 pb-12">
          <div className="flex items-center gap-3 mb-6">
            <span className="px-3 py-1 bg-brand-cream text-brand-olive text-xs font-bold uppercase tracking-widest rounded-full">
              {page.category === 'biography' ? '人物介绍' :
               page.category === 'music' ? '音乐作品' :
               page.category === 'album' ? '专辑一览' :
               page.category === 'timeline' ? '时间轴' :
               page.category === 'event' ? '活动记录' : page.category}
            </span>
            <span className="text-gray-300">/</span>
            <span className="text-gray-400 text-sm flex items-center gap-1"><Clock size={14} /> 最后更新: {page.updatedAt?.toDate ? format(page.updatedAt.toDate(), 'yyyy-MM-dd HH:mm') : '刚刚'}</span>
          </div>
          <div className="flex justify-between items-start gap-4">
            <h1 className="text-5xl sm:text-6xl font-serif font-bold text-brand-olive leading-tight">{page.title}</h1>
            <div className="flex gap-2">
              <button 
                onClick={async () => {
                  setSummarizing(true);
                  const s = await summarizeWikiContent(page.content);
                  setSummary(s);
                  setSummarizing(false);
                }}
                disabled={summarizing}
                className="p-3 bg-brand-cream text-brand-olive rounded-full hover:bg-brand-olive hover:text-white transition-all flex items-center gap-2"
                title="AI 摘要"
              >
                <Sparkles size={20} />
                {summarizing && <span className="text-xs">生成中...</span>}
              </button>
              {user && (
                <div className="flex gap-2">
                  {(page.category !== 'music' || isAdmin) && (
                    <>
                      <Link to={`/wiki/${slug}/history`} className="p-3 bg-brand-cream text-brand-olive rounded-full hover:bg-brand-olive hover:text-white transition-all" title="历史版本">
                        <History size={20} />
                      </Link>
                      <Link to={`/wiki/${slug}/edit`} className="p-3 bg-brand-cream text-brand-olive rounded-full hover:bg-brand-olive hover:text-white transition-all">
                        <Edit3 size={20} />
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {summary && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-12 p-8 bg-brand-olive/5 border border-brand-olive/10 rounded-3xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-brand-olive"></div>
            <h4 className="text-sm font-bold text-brand-olive uppercase tracking-widest mb-3 flex items-center gap-2">
              <Sparkles size={14} /> AI 摘要
            </h4>
            <p className="text-gray-600 italic leading-relaxed">{summary}</p>
            <button onClick={() => setSummary(null)} className="absolute top-4 right-4 text-gray-400 hover:text-brand-olive">
              <X size={16} />
            </button>
          </motion.div>
        )}

        <div className="prose prose-lg prose-stone max-w-none font-body leading-relaxed text-gray-700">
          <WikiMarkdown content={page.content} />
        </div>

        {backlinks.length > 0 && (
          <div className="mt-20 pt-12 border-t border-gray-100">
            <h4 className="text-sm font-bold text-brand-olive uppercase tracking-widest mb-6 flex items-center gap-2">
              <ChevronRight size={14} /> 引用本页的内容
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {backlinks.map(link => (
                <Link 
                  key={link.id} 
                  to={`/wiki/${link.slug}`}
                  className="p-4 bg-brand-cream/30 border border-brand-cream rounded-2xl hover:bg-brand-cream transition-all group"
                >
                  <p className="font-bold text-brand-olive group-hover:underline underline-offset-4">{link.title}</p>
                  <p className="text-xs text-gray-400 mt-1 truncate">{link.slug}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        <footer className="mt-20 pt-12 border-t border-gray-100 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-2 text-gray-400 text-sm italic">
            <Tag size={14} />
            {page.tags?.map((tag: string) => (
              <span key={tag} className="hover:text-brand-olive cursor-pointer px-2 py-0.5 bg-brand-cream/30 rounded-full text-[10px] font-bold uppercase tracking-wider">#{tag}</span>
            ))}
          </div>
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <UserIcon size={14} /> 编辑者: <span className="font-bold text-brand-olive">{page.lastEditorName || '匿名用户'}</span> <span className="text-[10px] opacity-50">({page.lastEditorUid?.substring(0, 8)})</span>
          </div>
        </footer>
      </article>
    </div>
  );
};

// --- Wiki Editor Component ---
const WikiEditor = () => {
  const { slug } = useParams();
  const isNew = !slug || slug === 'new';
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();
  
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    category: 'biography',
    content: '',
    tags: '',
    eventDate: ''
  });
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!isNew) {
      const fetchPage = async () => {
        const docRef = doc(db, 'wiki', slug!);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFormData({
            title: data.title,
            slug: data.slug,
            category: data.category,
            content: data.content,
            tags: data.tags?.join(', ') || '',
            eventDate: data.eventDate || ''
          });
        }
      };
      fetchPage();
    }
  }, [slug, isNew]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (formData.category === 'music' && !isAdmin) {
      alert("只有管理员可以修改音乐分类的内容");
      return;
    }
    
    setLoading(true);

    const pageData: any = {
      title: formData.title,
      slug: pageSlug,
      category: formData.category,
      content: formData.content,
      tags: formData.tags.split(',').map(t => t.trim()).filter(t => t),
      eventDate: formData.eventDate,
      lastEditorUid: user.uid,
      lastEditorName: profile?.displayName || user.displayName || '匿名用户',
      updatedAt: serverTimestamp(),
    };

    if (isNew) {
      pageData.createdAt = serverTimestamp();
    }

    try {
      const docRef = doc(db, 'wiki', pageSlug!);
      if (isNew) {
        await setDoc(docRef, pageData);
      } else {
        await updateDoc(docRef, pageData);
      }

      // Save Revision
      const revisionsRef = collection(db, 'wiki', pageSlug!, 'revisions');
      await addDoc(revisionsRef, {
        id: crypto.randomUUID(),
        pageSlug,
        title: formData.title,
        content: formData.content,
        editorUid: user.uid,
        editorName: profile?.displayName || user.displayName || '匿名用户',
        createdAt: serverTimestamp()
      });

      navigate(`/wiki/${pageSlug}`);
    } catch (e) {
      console.error("Error saving wiki page:", e);
      alert("保存失败，请检查网络或权限");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="bg-white rounded-[40px] p-8 sm:p-16 border border-gray-100 shadow-sm">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-serif font-bold text-brand-olive">{isNew ? '创建新百科' : '编辑百科'}</h1>
          <button onClick={() => navigate(-1)} className="p-2 text-gray-400 hover:text-red-500">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-brand-olive/60">标题</label>
              <input 
                type="text" 
                required
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                placeholder="例如：黄诗扶"
                className="w-full px-6 py-4 bg-brand-cream rounded-2xl border-none focus:ring-2 focus:ring-brand-olive/20 font-serif text-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-brand-olive/60">分类</label>
              <select 
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
                className="w-full px-6 py-4 bg-brand-cream rounded-2xl border-none focus:ring-2 focus:ring-brand-olive/20 font-serif text-xl appearance-none"
              >
                <option value="biography">人物介绍</option>
                <option value="music">音乐作品</option>
                <option value="album">专辑一览</option>
                <option value="timeline">时间线</option>
                <option value="event">活动记录</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-brand-olive/60">事件日期 (可选)</label>
              <input 
                type="date" 
                value={formData.eventDate}
                onChange={e => setFormData({...formData, eventDate: e.target.value})}
                className="w-full px-6 py-4 bg-brand-cream rounded-2xl border-none focus:ring-2 focus:ring-brand-olive/20 font-serif text-xl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase tracking-widest text-brand-olive/60">内容 (Markdown)</label>
              <button 
                type="button"
                onClick={async () => {
                  if (!formData.title) return alert("请先输入标题");
                  setGenerating(true);
                  const intro = await generateWikiIntro(formData.title);
                  if (intro) setFormData({ ...formData, content: intro + "\n\n" + formData.content });
                  setGenerating(false);
                }}
                disabled={generating}
                className="text-xs font-bold text-brand-olive flex items-center gap-1 hover:underline disabled:opacity-50"
              >
                <Sparkles size={12} /> {generating ? '生成中...' : 'AI 辅助写开头'}
              </button>
            </div>
            <div className="border border-gray-100 rounded-[32px] overflow-hidden">
              <MdEditor 
                style={{ height: '500px' }} 
                renderHTML={(text) => {
                  const processed = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, p1, p2) => {
                    const display = p1.trim();
                    const slug = p2 ? p2.trim() : p1.trim();
                    return `[${display}](/wiki/${slug})`;
                  });
                  return mdParser.render(processed);
                }} 
                value={formData.content}
                onChange={({ text }) => setFormData({...formData, content: text})}
                onImageUpload={async (file) => {
                  const imageId = await uploadImageToCDNs(file);
                  const urls = await getImageUrl(imageId);
                  return urls[0] || '';
                }}
                placeholder="在这里输入百科内容，支持 Markdown 语法..."
                config={{
                  view: {
                    menu: true,
                    md: true,
                    html: false
                  },
                  canView: {
                    menu: true,
                    md: true,
                    html: true,
                    fullScreen: true,
                    hideMenu: false
                  }
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-brand-olive/60">标签 (逗号分隔)</label>
            <input 
              type="text" 
              value={formData.tags}
              onChange={e => setFormData({...formData, tags: e.target.value})}
              placeholder="例如：古风, 原创, 歌手"
              className="w-full px-6 py-4 bg-brand-cream rounded-2xl border-none focus:ring-2 focus:ring-brand-olive/20"
            />
          </div>

          <div className="pt-8 flex justify-end">
            <button 
              type="submit" 
              disabled={loading}
              className="px-12 py-4 bg-brand-olive text-white rounded-full font-bold hover:bg-brand-olive/90 hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={20} /> {loading ? '保存中...' : '发布页面'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Wiki History Component ---
const WikiHistory = () => {
  const { slug } = useParams();
  const [revisions, setRevisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRevision, setSelectedRevision] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const revisionsRef = collection(db, 'wiki', slug!, 'revisions');
        const q = query(revisionsRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        setRevisions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        console.error("Error fetching history:", e);
      }
      setLoading(false);
    };
    fetchHistory();
  }, [slug]);

  const handleRollback = async (revision: any) => {
    if (!window.confirm(`确定要回滚到 ${format(revision.createdAt.toDate(), 'yyyy-MM-dd HH:mm')} 的版本吗？`)) return;
    
    try {
      const docRef = doc(db, 'wiki', slug!);
      await updateDoc(docRef, {
        title: revision.title,
        content: revision.content,
        updatedAt: serverTimestamp()
      });
      navigate(`/wiki/${slug}`);
    } catch (e) {
      console.error("Rollback error:", e);
      alert("回滚失败");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link to={`/wiki/${slug}`} className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-olive mb-8 transition-colors">
        <ArrowLeft size={18} /> 返回页面
      </Link>

      <div className="bg-white rounded-[40px] p-8 sm:p-12 border border-gray-100 shadow-sm">
        <h2 className="text-3xl font-serif font-bold text-brand-olive mb-8 flex items-center gap-3">
          <History size={28} /> 历史版本: {slug}
        </h2>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-50 rounded-2xl animate-pulse"></div>)}
          </div>
        ) : revisions.length > 0 ? (
          <div className="space-y-4">
            {revisions.map((rev, i) => (
              <div key={rev.id} className="p-6 bg-brand-cream/30 border border-brand-cream rounded-3xl flex items-center justify-between group hover:bg-brand-cream transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-brand-olive/10 flex items-center justify-center text-brand-olive font-bold">
                    {revisions.length - i}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-700">{format(rev.createdAt.toDate(), 'yyyy-MM-dd HH:mm:ss')}</p>
                    <p className="text-xs text-gray-400">编辑者: {rev.editorName} ({rev.editorUid.substring(0, 6)})</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setSelectedRevision(rev)}
                    className="px-4 py-2 bg-white text-brand-olive text-xs font-bold rounded-full border border-brand-olive/20 hover:bg-brand-olive hover:text-white transition-all opacity-0 group-hover:opacity-100"
                  >
                    预览内容
                  </button>
                  <button 
                    onClick={() => handleRollback(rev)}
                    className="px-4 py-2 bg-white text-brand-olive text-xs font-bold rounded-full border border-brand-olive/20 hover:bg-brand-olive hover:text-white transition-all opacity-0 group-hover:opacity-100"
                  >
                    回滚到此版本
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-400 italic py-12">暂无历史记录</p>
        )}
      </div>

      <AnimatePresence>
        {selectedRevision && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[40px] w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-serif font-bold text-brand-olive">版本预览</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    {format(selectedRevision.createdAt.toDate(), 'yyyy-MM-dd HH:mm:ss')} · 编辑者: {selectedRevision.editorName}
                  </p>
                </div>
                <button onClick={() => setSelectedRevision(null)} className="p-2 text-gray-400 hover:text-red-500">
                  <X size={24} />
                </button>
              </div>
              <div className="p-8 sm:p-12 overflow-y-auto flex-grow prose prose-stone max-w-none">
                <h1 className="text-4xl font-serif font-bold text-brand-olive mb-8">{selectedRevision.title}</h1>
                <WikiMarkdown content={selectedRevision.content} />
              </div>
              <div className="p-8 border-t border-gray-100 flex justify-end gap-4">
                <button 
                  onClick={() => setSelectedRevision(null)}
                  className="px-8 py-3 text-gray-500 font-bold hover:text-brand-olive"
                >
                  关闭
                </button>
                <button 
                  onClick={() => {
                    handleRollback(selectedRevision);
                    setSelectedRevision(null);
                  }}
                  className="px-8 py-3 bg-brand-olive text-white rounded-full font-bold hover:bg-brand-olive/90 transition-all shadow-lg"
                >
                  回滚到此版本
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Wiki Timeline Component ---
const WikiTimeline = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const wikiRef = collection(db, 'wiki');
        // Fetch pages that have an eventDate
        const q = query(wikiRef, orderBy('eventDate', 'asc'));
        const snapshot = await getDocs(q);
        const allEvents = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((p: any) => p.eventDate); // Ensure they have a date
        setEvents(allEvents);
      } catch (e) {
        console.error("Error fetching timeline events:", e);
      }
      setLoading(false);
    };
    fetchEvents();
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <Link to="/wiki" className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-olive mb-8 transition-colors">
        <ArrowLeft size={18} /> 返回百科列表
      </Link>

      <header className="mb-16 text-center">
        <h1 className="text-5xl font-serif font-bold text-brand-olive mb-4">艺术历程时间轴</h1>
        <p className="text-gray-500 italic">记录黄诗扶音乐生涯的每一个重要节点</p>
      </header>

      {loading ? (
        <div className="space-y-12">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-8 animate-pulse">
              <div className="w-32 h-8 bg-gray-100 rounded-full"></div>
              <div className="flex-grow h-32 bg-gray-50 rounded-[32px]"></div>
            </div>
          ))}
        </div>
      ) : events.length > 0 ? (
        <div className="relative border-l-2 border-brand-olive/20 ml-4 md:ml-32 pl-8 md:pl-12 space-y-16 pb-20">
          {events.map((event, idx) => (
            <motion.div 
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              {/* Date Indicator */}
              <div className="absolute -left-[41px] md:-left-[141px] top-0 flex items-center gap-4">
                <div className="hidden md:block w-24 text-right">
                  <span className="text-sm font-bold text-brand-olive bg-brand-cream px-3 py-1 rounded-full whitespace-nowrap">
                    {event.eventDate}
                  </span>
                </div>
                <div className="w-4 h-4 rounded-full bg-brand-olive border-4 border-white shadow-sm z-10"></div>
              </div>

              {/* Content Card */}
              <Link to={`/wiki/${event.slug}`} className="block group">
                <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-xl hover:border-brand-olive/20 transition-all">
                  <div className="md:hidden mb-4">
                    <span className="text-xs font-bold text-brand-olive bg-brand-cream px-2 py-1 rounded-full">
                      {event.eventDate}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-1 bg-brand-cream text-brand-olive text-[10px] font-bold uppercase tracking-wider rounded">
                      {event.category === 'biography' ? '人物介绍' :
                       event.category === 'music' ? '音乐作品' :
                       event.category === 'album' ? '专辑一览' :
                       event.category === 'timeline' ? '时间轴' :
                       event.category === 'event' ? '活动记录' : event.category}
                    </span>
                  </div>
                  <h3 className="text-2xl font-serif font-bold text-gray-800 group-hover:text-brand-olive transition-colors mb-4">
                    {event.title}
                  </h3>
                  <p className="text-gray-500 text-sm italic line-clamp-2 leading-relaxed">
                    {event.content.replace(/[#*`]/g, '').substring(0, 150)}...
                  </p>
                  <div className="mt-6 flex items-center gap-2 text-brand-olive text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                    查看详情 <ChevronRight size={14} />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-[40px] border border-gray-100">
          <Calendar size={48} className="mx-auto text-gray-200 mb-6" />
          <p className="text-gray-400 italic">暂无时间轴数据，请在编辑页面设置“事件日期”</p>
        </div>
      )}
    </div>
  );
};

const Wiki = () => {
  return (
    <Routes>
      <Route path="/" element={<WikiList />} />
      <Route path="/new" element={<WikiEditor />} />
      <Route path="/timeline" element={<WikiTimeline />} />
      <Route path="/:slug" element={<WikiPageView />} />
      <Route path="/:slug/edit" element={<WikiEditor />} />
      <Route path="/:slug/history" element={<WikiHistory />} />
    </Routes>
  );
};

export default Wiki;
