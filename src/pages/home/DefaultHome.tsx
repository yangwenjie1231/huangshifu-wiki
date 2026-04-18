import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Book,
  MessageSquare,
  Music,
  Calendar,
  ArrowRight,
  Clock,
  Heart,
  Flame,
} from 'lucide-react';
import { format } from 'date-fns';
import { apiGet } from '../../lib/apiClient';
import { toDateValue } from '../../lib/dateUtils';
import { useTheme } from '../../context/ThemeContext';
import { withThemeSearch } from '../../lib/theme';
import GlassCard from '../../components/GlassCard';
import { AnimatedStat } from '../../components/home/AnimatedStat';
import { CategoryCard } from '../../components/home/CategoryCard';
import { HomeSkeleton } from '../../components/HomeSkeleton';
import type { HomeFeedResponse } from '../../types/home';

export const DefaultHome = () => {
  const { theme } = useTheme();
  const [feed, setFeed] = useState<HomeFeedResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  if (loading) {
    return <HomeSkeleton />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section - ywj 风格大字体 */}
      <section className="relative h-[70vh] min-h-[500px] rounded-[40px] overflow-hidden mb-12 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/35 via-white/20 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-12 sm:p-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-white text-display sm:text-[100px] font-serif font-bold mb-6 leading-tight">
              黄诗扶{' '}
              <span className="text-2xl sm:text-3xl font-normal english-text opacity-80 block sm:inline ml-0 sm:ml-4">
                Huang Shifu
              </span>
            </h1>
            <p className="text-white/80 text-xl font-serif italic max-w-2xl mb-10 leading-relaxed">
              "以诗入乐，以乐咏诗。在这里，探索关于黄诗扶的一切。"
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to={withThemeSearch('/wiki', theme)}
                className="px-8 py-4 bg-brand-primary text-gray-900 rounded-full font-bold hover:scale-105 transition-all flex items-center gap-2 shadow-lg"
              >
                进入百科 <ArrowRight size={20} />
              </Link>
              <Link
                to={withThemeSearch('/forum', theme)}
                className="px-8 py-4 bg-white/10 backdrop-blur-md border border-white/30 text-white rounded-full font-medium hover:bg-white/20 transition-all"
              >
                参与社区讨论
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Bento Grid Layout */}
      <section className="bento-grid mb-16">
        {/* 百科全书 */}
        <motion.div
          className="bento-item-large"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <GlassCard className="w-full p-6 sm:p-8">
            <div className="flex justify-between items-end mb-8">
              <div>
                <h2 className="text-4xl font-serif font-bold text-gray-900 mb-2">百科全书</h2>
                <p className="text-gray-500 italic">Wiki Encyclopedia</p>
              </div>
              <Link
                to={withThemeSearch('/wiki', theme)}
                className="text-brand-primary font-bold flex items-center gap-1 hover:underline"
              >
                查看全部 <ArrowRight size={16} />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                {
                  title: '人物介绍',
                  icon: <Book size={32} />,
                  desc: '生平经历、艺术风格与成就',
                  link: '/wiki?category=biography',
                },
                {
                  title: '音乐作品',
                  icon: <Music size={32} />,
                  desc: '原创、翻唱及合作曲目全收录',
                  link: '/music',
                },
                {
                  title: '专辑一览',
                  icon: <Book size={32} />,
                  desc: '历年发行专辑与EP详情',
                  link: '/wiki?category=album',
                },
                {
                  title: '活动记录',
                  icon: <Calendar size={32} />,
                  desc: '演出、直播与线下活动时间线',
                  link: '/wiki?category=event',
                },
              ].map((cat) => (
                <CategoryCard key={cat.title} cat={cat} theme={theme} />
              ))}
            </div>
          </GlassCard>
        </motion.div>

        {/* 热门帖子 */}
        {feed?.hotPosts && feed.hotPosts.length > 0 && (
          <motion.div
            className="bento-item-tall"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <GlassCard className="w-full p-6 sm:p-8 flex flex-col h-full">
              <div className="flex justify-between items-end mb-6">
                <h2 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-2">
                  <Flame size={20} className="text-orange-500" /> 热门帖子
                </h2>
                <Link
                  to={withThemeSearch('/forum?sort=hot', theme)}
                  className="text-brand-primary font-bold text-sm hover:underline"
                >
                  查看更多
                </Link>
              </div>
              <div className="space-y-4 flex-grow">
                {feed.hotPosts.slice(0, 4).map((post) => (
                  <Link
                    key={post.id}
                    to={withThemeSearch(`/forum/${post.id}`, theme)}
                    className="block p-4 rounded-2xl bg-brand-primary/5 border border-brand-primary/10 hover:border-brand-primary/30 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-brand-primary/20 text-brand-primary text-[10px] font-bold uppercase tracking-wider rounded">
                        {post.section === 'music'
                          ? '音乐讨论'
                          : post.section === 'news'
                            ? '动态资讯'
                            : post.section === 'fanart'
                              ? '二创交流'
                              : '问答区'}
                      </span>
                    </div>
                    <h4 className="text-base font-serif font-bold mb-2 group-hover:text-brand-primary transition-colors line-clamp-2">
                      {post.title}
                    </h4>
                    <div className="flex items-center gap-4 text-gray-400 text-sm">
                      <span className="flex items-center gap-1">
                        <MessageSquare size={14} /> {post.commentsCount || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart size={14} /> {post.likesCount || 0}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* 社区动态 */}
        <motion.div
          className="bento-item-large"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <GlassCard className="w-full p-6 sm:p-8">
            <div className="flex justify-between items-end mb-6">
              <h2 className="text-3xl font-serif font-bold text-gray-900">社区动态</h2>
              <Link
                to={withThemeSearch('/forum', theme)}
                className="text-brand-primary font-bold text-sm hover:underline"
              >
                更多讨论
              </Link>
            </div>
            <div className="space-y-4">
              {loading ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse"></div>
                ))
              ) : (feed?.recentPosts?.length ?? 0) > 0 ? (
                feed!.recentPosts.slice(0, 3).map((post) => (
                  <Link
                    key={post.id}
                    to={withThemeSearch(`/forum/${post.id}`, theme)}
                    className="block p-4 rounded-2xl bg-white border border-gray-100 hover:border-brand-primary/20 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-brand-primary/10 text-brand-primary text-[10px] font-bold uppercase tracking-wider rounded">
                        {post.section === 'music'
                          ? '音乐讨论'
                          : post.section === 'news'
                            ? '动态资讯'
                            : post.section === 'fanart'
                              ? '二创交流'
                              : '问答区'}
                      </span>
                      <span className="text-gray-400 text-xs flex items-center gap-1">
                        <Clock size={12} />
                        {toDateValue(post.updatedAt)
                          ? format(toDateValue(post.updatedAt)!, 'MM-dd HH:mm')
                          : '刚刚'}
                      </span>
                    </div>
                    <h4 className="text-lg font-serif font-bold mb-2 group-hover:text-brand-primary transition-colors">
                      {post.title}
                    </h4>
                    <div className="flex items-center gap-4 text-gray-400 text-sm">
                      <span className="flex items-center gap-1">
                        <MessageSquare size={14} /> {post.commentsCount || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart size={14} /> {post.likesCount || 0}
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center italic text-gray-400">
                  暂无社区动态
                </div>
              )}
            </div>
          </GlassCard>
        </motion.div>

        {/* 加入我们 */}
        <motion.div
          className="bento-item-tall"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <GlassCard className="w-full p-6 sm:p-8 text-gray-900 bg-gradient-to-br from-brand-primary to-brand-primary/80">
            <div className="mb-8">
              <h2 className="text-3xl font-serif font-bold mb-4">加入我们</h2>
              <p className="text-gray-800/70 font-serif italic leading-relaxed">
                "诗扶小筑是一个由粉丝自发维护的社区。无论你是资深乐迷，还是刚被圈粉的新人，这里都有你的位置。"
              </p>
            </div>
            <div className="space-y-4">
              <AnimatedStat value={1240} suffix="+" label="收录曲目" icon={<Music size={20} />} />
              <AnimatedStat
                value={5600}
                suffix="+"
                label="社区成员"
                icon={<MessageSquare size={20} />}
              />
              <Link
                to={withThemeSearch('/forum', theme)}
                className="mt-4 px-6 py-3 bg-white text-brand-primary rounded-full font-bold hover:bg-white/90 transition-all text-center block"
              >
                立即加入
              </Link>
            </div>
          </GlassCard>
        </motion.div>
      </section>
    </div>
  );
};

export default DefaultHome;
