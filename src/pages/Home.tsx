import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Book, MessageSquare, Music, Calendar, ArrowRight, Clock, Heart, Shield, Sparkles, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { apiGet } from '../lib/apiClient';
import { toDateValue } from '../lib/dateUtils';
import { useTheme } from '../context/ThemeContext';
import { withThemeSearch } from '../lib/theme';

type HomeFeedResponse = {
  announcements: Array<{ id: string; content: string; link?: string; createdAt: string }>;
  hotPosts: any[];
  recentPosts: any[];
};

const academyHighlights = [
  { title: '书院山门', subtitle: '入门即见诗乐相逢', href: '/wiki?category=biography' },
  { title: '练习技艺的花园', subtitle: '音乐作品与修习人次', href: '/music' },
  { title: '游画廊', subtitle: '图集与起居陈设', href: '/gallery' },
  { title: '藏经阁 · 入梦课', subtitle: '新闻、采访与特别事迹', href: '/forum?section=news' },
];

const AcademyHome = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
    <section className="theme-header-image rounded-[32px] overflow-hidden min-h-[32rem] border border-[color:var(--color-theme-border)] relative">
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20" />
      <div className="relative z-10 p-8 sm:p-12 lg:p-16 flex flex-col justify-end min-h-[32rem]">
        <p className="inline-flex items-center gap-2 text-sm tracking-[0.3em] uppercase text-[color:var(--color-theme-accent-strong)]/80 mb-4">
          <Shield size={14} /> Once-Upon-An-Academy
        </p>
        <h1 className="text-5xl sm:text-7xl font-serif font-bold leading-tight text-[color:var(--color-theme-accent-strong)] mb-4">
          从前书院
        </h1>
        <p className="max-w-2xl text-lg sm:text-xl leading-relaxed text-[color:var(--color-theme-text)]/90 mb-6">
          歌诗相逢，入梦成课。这里是黄诗扶生日特别版书院，所有阅读、浏览与聆听都在一处静静展开。
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/music?theme=academy" className="px-5 py-3 bg-[color:var(--color-theme-accent)] text-white rounded-full font-medium">
            进入书院
          </Link>
          <Link to="/wiki?theme=academy" className="px-5 py-3 border border-[color:var(--color-theme-border)] rounded-full font-medium text-[color:var(--color-theme-accent-strong)] bg-white/70">
            查看年谱
          </Link>
        </div>
      </div>
    </section>

    <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {academyHighlights.map((item) => (
        <Link
          key={item.title}
          to={withThemeSearch(item.href, 'academy')}
          className="theme-surface theme-card p-6 hover:-translate-y-0.5 transition-transform"
        >
          <h2 className="text-2xl font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-2">{item.title}</h2>
          <p className="text-[color:var(--color-theme-muted)] mb-4">{item.subtitle}</p>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--color-theme-accent)]">
            前往 <ChevronRight size={14} />
          </span>
        </Link>
      ))}
    </section>

    <section className="theme-surface theme-card p-8 space-y-4">
      <h2 className="text-2xl font-serif font-bold text-[color:var(--color-theme-accent-strong)]">书院开篇</h2>
      <p className="leading-relaxed text-[color:var(--color-theme-text)]/90">
        黄诗扶，出生于上海，毕业于英国布里斯托大学，曾为上海师范大学音乐学院校友并回母校捐赠个人专辑。
        公开资料中，她的代表作包含《吹梦到西洲》《人间不值得》《九万字》等，适合作为生日特别版主题的公开文案依据。
      </p>
      <p className="leading-relaxed text-[color:var(--color-theme-text)]/90">
        生贺期间，这里将默认进入无感浏览状态，仅保留阅读、播放与浏览。
      </p>
    </section>
  </div>
);

const Home = () => {
  const { isAcademy } = useTheme();
  const [feed, setFeed] = useState<HomeFeedResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAcademy) {
      setLoading(false);
      return;
    }

    const fetchFeed = async () => {
      try {
        const data = await apiGet<HomeFeedResponse>('/api/home/feed');
        setFeed(data);
      } catch (e) {
        console.error('Error fetching home feed:', e);
      }
      setLoading(false);
    };
    fetchFeed();
  }, [isAcademy]);

  if (isAcademy) {
    return <AcademyHome />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <section className="relative h-[70vh] min-h-[500px] rounded-[40px] overflow-hidden mb-20 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/35 via-white/20 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-12 sm:p-20">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <h1 className="text-white text-6xl sm:text-8xl font-serif font-bold mb-6 leading-tight">
              黄诗扶 <span className="text-3xl sm:text-4xl font-normal italic opacity-80 block sm:inline ml-0 sm:ml-4">Huang Shifu</span>
            </h1>
            <p className="text-white/80 text-xl font-serif italic max-w-2xl mb-10 leading-relaxed">
              “以诗入乐，以乐咏诗。在这里，探索关于黄诗扶的一切。”
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/wiki" className="px-8 py-4 bg-brand-primary text-gray-900 rounded-full font-bold hover:scale-105 transition-all flex items-center gap-2 shadow-lg">
                进入百科 <ArrowRight size={20} />
              </Link>
              <Link to="/forum" className="px-8 py-4 bg-white/10 backdrop-blur-md border border-white/30 text-white rounded-full font-medium hover:bg-white/20 transition-all">
                参与社区讨论
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mb-24">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-4xl font-serif font-bold text-gray-900 mb-2">百科全书</h2>
            <p className="text-gray-500 italic">Wiki Encyclopedia</p>
          </div>
          <Link to="/wiki" className="text-brand-primary font-bold flex items-center gap-1 hover:underline">
            查看全部 <ArrowRight size={16} />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { title: '人物介绍', icon: <Book size={32} />, desc: '生平经历、艺术风格与成就', color: 'bg-white', link: '/wiki?category=biography' },
            { title: '音乐作品', icon: <Music size={32} />, desc: '原创、翻唱及合作曲目全收录', color: 'bg-white', link: '/music' },
            { title: '专辑一览', icon: <Book size={32} />, desc: '历年发行专辑与EP详情', color: 'bg-white', link: '/wiki?category=album' },
            { title: '活动记录', icon: <Calendar size={32} />, desc: '演出、直播与线下活动时间线', color: 'bg-white', link: '/wiki?category=event' },
          ].map((cat, i) => (
            <motion.div key={cat.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} viewport={{ once: true }} className={`${cat.color} p-8 rounded-[32px] hover:shadow-xl transition-all group cursor-pointer border border-gray-100 hover:border-brand-primary/20`}>
              <div className="text-brand-primary mb-6 group-hover:scale-110 transition-transform">{cat.icon}</div>
              <h3 className="text-2xl font-serif font-bold mb-3">{cat.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">{cat.desc}</p>
              <Link to={cat.link} className="w-10 h-10 rounded-full bg-brand-cream border border-gray-100 flex items-center justify-center text-brand-primary group-hover:bg-brand-primary group-hover:text-gray-900 transition-all">
                <ArrowRight size={18} />
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {feed?.hotPosts && feed.hotPosts.length > 0 && (
        <section className="mb-24">
          <div className="flex justify-between items-end mb-8">
            <h2 className="text-3xl font-serif font-bold text-gray-900 flex items-center gap-2">🔥 热门帖子</h2>
            <Link to="/forum?sort=hot" className="text-brand-primary font-bold text-sm hover:underline">查看更多</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {feed.hotPosts.slice(0, 3).map((post) => (
              <Link key={post.id} to={`/forum/${post.id}`} className="block bg-gradient-to-br from-brand-primary/5 to-brand-primary/10 p-6 rounded-3xl border border-brand-primary/10 hover:border-brand-primary/30 transition-all cursor-pointer group">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-1 bg-brand-primary/20 text-brand-primary text-[10px] font-bold uppercase tracking-wider rounded">{post.section === 'music' ? '音乐讨论' : post.section === 'news' ? '动态资讯' : post.section === 'fanart' ? '同人创作' : '问答区'}</span>
                </div>
                <h4 className="text-lg font-serif font-bold mb-2 group-hover:text-brand-primary transition-colors line-clamp-2">{post.title}</h4>
                <div className="flex items-center gap-4 text-gray-400 text-sm">
                  <span className="flex items-center gap-1"><MessageSquare size={14} /> {post.commentsCount || 0}</span>
                  <span className="flex items-center gap-1"><Heart size={14} /> {post.likesCount || 0}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2">
          <div className="flex justify-between items-end mb-8">
            <h2 className="text-3xl font-serif font-bold text-gray-900">社区动态</h2>
            <Link to="/forum" className="text-brand-primary font-bold text-sm hover:underline">更多讨论</Link>
          </div>
          <div className="space-y-4">
            {loading ? (
              [1, 2, 3].map(i => <div key={i} className="h-24 bg-white rounded-3xl animate-pulse border border-gray-100"></div>)
            ) : (feed?.recentPosts?.length ?? 0) > 0 ? (
              feed!.recentPosts.slice(0, 5).map((post) => (
                <Link key={post.id} to={`/forum/${post.id}`} className="block bg-white p-6 rounded-3xl border border-gray-100 hover:border-brand-primary/20 transition-all cursor-pointer group">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-1 bg-brand-primary/10 text-brand-primary text-[10px] font-bold uppercase tracking-wider rounded">
                      {post.section === 'music' ? '音乐讨论' : post.section === 'news' ? '动态资讯' : post.section === 'fanart' ? '同人创作' : '问答区'}
                    </span>
                    <span className="text-gray-400 text-xs flex items-center gap-1"><Clock size={12} /> {toDateValue(post.updatedAt) ? format(toDateValue(post.updatedAt)!, 'MM-dd HH:mm') : '刚刚'}</span>
                  </div>
                  <h4 className="text-xl font-serif font-bold mb-2 group-hover:text-brand-primary transition-colors">{post.title}</h4>
                  <div className="flex items-center gap-4 text-gray-400 text-sm">
                    <span className="flex items-center gap-1"><MessageSquare size={14} /> {post.commentsCount || 0}</span>
                    <span className="flex items-center gap-1"><Heart size={14} /> {post.likesCount || 0}</span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="bg-white p-12 rounded-3xl border border-gray-100 text-center italic text-gray-400">暂无社区动态</div>
            )}
          </div>
        </div>

        <div className="bg-brand-primary rounded-[40px] p-10 text-gray-900 flex flex-col justify-between h-full min-h-[400px] shadow-xl">
          <div>
            <h2 className="text-3xl font-serif font-bold mb-6">加入我们</h2>
            <p className="text-gray-800/70 font-serif italic leading-relaxed mb-8">“诗扶小筑是一个由粉丝自发维护的社区。无论你是资深乐迷，还是刚被圈粉的新人，这里都有你的位置。”</p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-white/20 rounded-2xl border border-white/20">
              <div className="w-10 h-10 rounded-full bg-white/40 flex items-center justify-center"><Music size={20} /></div>
              <div>
                <p className="text-sm font-bold">1,240+</p>
                <p className="text-xs text-gray-800/50">收录曲目</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-white/20 rounded-2xl border border-white/20">
              <div className="w-10 h-10 rounded-full bg-white/40 flex items-center justify-center"><MessageSquare size={20} /></div>
              <div>
                <p className="text-sm font-bold">5,600+</p>
                <p className="text-xs text-gray-800/50">社区成员</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
