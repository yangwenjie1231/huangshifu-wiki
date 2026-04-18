import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Book,
  Shield,
  Sparkles,
  ChevronRight,
  Music,
  Play,
  Gift,
  ArrowRight,
} from 'lucide-react';
import { apiGet } from '../../lib/apiClient';
import { useTheme } from '../../context/ThemeContext';
import { withThemeSearch } from '../../lib/theme';
import GlassCard from '../../components/GlassCard';
import type { BirthdayConfig } from '../../types/home';
import {
  academyHighlights,
  academyLecturers,
  academyCopyMappings,
} from '../../constants/academy';

export const AcademyHome = () => {
  const { theme } = useTheme();
  const [showEasterPanel, setShowEasterPanel] = useState(false);
  const [birthdayConfigs, setBirthdayConfigs] = useState<BirthdayConfig[]>([]);
  const [configsLoading, setConfigsLoading] = useState(true);

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const response = await apiGet<{ data: BirthdayConfig[] }>('/api/birthday/config');
        setBirthdayConfigs(response.data || []);
      } catch (error) {
        console.error('Error fetching birthday configs:', error);
      } finally {
        setConfigsLoading(false);
      }
    };
    fetchConfigs();
  }, []);

  // 按 type 分组配置
  const getConfigsByType = (type: string) =>
    birthdayConfigs.filter((c) => c.type === type).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="academy-home-wrap max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <section className="academy-hero-surface theme-header-image rounded-[32px] overflow-hidden min-h-[32rem] border border-[color:var(--color-theme-border)] relative">
        <div className="academy-hero-overlay absolute inset-0" />
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
            <Link
              to={withThemeSearch('/music', 'academy')}
              className="px-5 py-3 bg-[color:var(--color-theme-accent)] text-white rounded-full font-medium"
            >
              进入书院
            </Link>
            <Link
              to={withThemeSearch('/wiki', 'academy')}
              className="px-5 py-3 border border-[color:var(--color-theme-border)] rounded-full font-medium text-[color:var(--color-theme-accent-strong)] bg-white/70"
            >
              查看年谱
            </Link>
          </div>
        </div>
      </section>

      <section className="bento-grid">
        {academyHighlights.map((item, index) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <GlassCard className={index === 0 ? 'bento-item-large' : ''}>
              <Link
                to={withThemeSearch(item.href, 'academy')}
                className="w-full p-6 hover:-translate-y-0.5 transition-transform block"
              >
                <h2 className="text-2xl font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-2">
                  {item.title}
                </h2>
                <p className="text-[color:var(--color-theme-muted)] mb-4">{item.subtitle}</p>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--color-theme-accent)]">
                  前往 <ChevronRight size={14} />
                </span>
              </Link>
            </GlassCard>
          </motion.div>
        ))}
      </section>

      <section>
        <GlassCard className="w-full p-8 space-y-4">
          <h2 className="text-2xl font-serif font-bold text-[color:var(--color-theme-accent-strong)]">
            书院开篇
          </h2>
          <p className="leading-relaxed text-[color:var(--color-theme-text)]/90">
            黄诗扶，出生于上海，毕业于英国布里斯托大学，曾为上海师范大学音乐学院校友并回母校捐赠个人专辑。
            公开资料中，她的代表作包含《吹梦到西洲》《人间不值得》《九万字》等，适合作为生日特别版主题的公开文案依据。
          </p>
          <p className="leading-relaxed text-[color:var(--color-theme-text)]/90">
            生贺期间，这里将默认进入无感浏览状态，仅保留阅读、播放与浏览。
          </p>
          <button
            type="button"
            onClick={() => setShowEasterPanel((prev) => !prev)}
            className="academy-easter-button inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--color-theme-accent)]"
          >
            <Sparkles size={12} /> 书院暗号
          </button>
          {showEasterPanel && (
            <div className="academy-easter-panel rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-bold text-[color:var(--color-theme-accent-strong)]">
                彩蛋 · 夜读口令
              </h3>
              <p className="text-sm text-[color:var(--color-theme-muted)]">
                今夜口令为「吹梦到西洲」，在百科、论坛、音乐三处都能看到对应映射提示。
              </p>
            </div>
          )}
        </GlassCard>
      </section>

      {/* 跳转到招募页 */}
      <section>
        <GlassCard className="w-full p-6 text-center">
          <p className="text-[color:var(--color-theme-muted)] mb-4">上拉页面可前往「招募与培养」</p>
          <Link
            to="/recruit"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[color:var(--color-theme-accent)] text-white rounded-full font-bold hover:opacity-90 transition-opacity"
          >
            前往招募与培养 <ArrowRight size={16} />
          </Link>
        </GlassCard>
      </section>

      {/* 教务处文件通知公告 */}
      {getConfigsByType('notice').length > 0 && (
        <section>
          <GlassCard className="w-full p-6 border-l-4 border-l-red-600">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
                <Book size={32} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm text-red-600 font-bold mb-1">从前书院教务处文件</h3>
                <h2 className="text-xl font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-2">
                  {getConfigsByType('notice')[0]?.title || '关于黄诗扶全国巡演的通知'}
                </h2>
                <div className="text-sm text-[color:var(--color-theme-text)]/80 leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {getConfigsByType('notice')[0]?.content ||
                      '**公演吉期：** 2026 / 06 / 19-20 19:00\n\n**雅集地点：** 上海市 · 交通银行前滩31演艺中心\n\n*望各班学子奔走相告，共襄盛典。*'}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </GlassCard>
        </section>
      )}

      {/* 校史拾遗 */}
      {getConfigsByType('school_history').length > 0 && (
        <section>
          <GlassCard className="w-full p-6">
            <h2 className="text-2xl font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-4">
              校史拾遗
            </h2>
            {getConfigsByType('school_history').map((config) => (
              <div key={config.id} className="mb-4">
                <h3 className="text-lg font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-2">
                  {config.title}
                </h3>
                <div className="text-[color:var(--color-theme-text)]/80 leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{config.content}</ReactMarkdown>
                </div>
              </div>
            ))}
          </GlassCard>
        </section>
      )}

      {/* 荣誉校友 */}
      {getConfigsByType('honor_alumni').length > 0 && (
        <section>
          <GlassCard className="w-full p-6">
            <h2 className="text-2xl font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-4">
              荣誉校友
            </h2>
            {getConfigsByType('honor_alumni').map((config) => (
              <div key={config.id} className="mb-6 last:mb-0">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {`### ${config.title}\n\n${config.content}`}
                </ReactMarkdown>
              </div>
            ))}
          </GlassCard>
        </section>
      )}

      {/* 雅学之境 */}
      {getConfigsByType('campus').length > 0 && (
        <section>
          <GlassCard className="w-full p-6">
            <h2 className="text-2xl font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-4">
              雅学之境
            </h2>
            {getConfigsByType('campus').map((config) => (
              <div key={config.id} className="mb-6">
                <h3 className="text-lg font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-2">
                  {config.title}
                </h3>
                <div className="text-[color:var(--color-theme-text)]/80 leading-relaxed mb-4">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{config.content}</ReactMarkdown>
                </div>
                <div className="bg-gray-100 rounded-xl h-48 flex items-center justify-center">
                  <span className="text-gray-400 italic">图片待上传</span>
                </div>
              </div>
            ))}
          </GlassCard>
        </section>
      )}

      {/* 学子留言壁 */}
      {getConfigsByType('guestbook').length > 0 && (
        <section>
          <GlassCard className="w-full p-6">
            <h2 className="text-2xl font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-4">
              学子留言壁
            </h2>
            <p className="text-[color:var(--color-theme-muted)] mb-4">
              {getConfigsByType('guestbook')[0]?.title || '缘起从前，一见如故'}
            </p>
            <div className="space-y-3">
              <div className="p-4 bg-[color:var(--color-theme-accent)]/5 rounded-xl">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {getConfigsByType('guestbook')[0]?.content || '*暂无留言*'}
                </ReactMarkdown>
              </div>
            </div>
          </GlassCard>
        </section>
      )}

      {/* 联系我们 */}
      {getConfigsByType('contact').length > 0 && (
        <section>
          <GlassCard className="w-full p-6">
            <h2 className="text-2xl font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-2">
              联系我们
            </h2>
            <div className="text-[color:var(--color-theme-text)]/80">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {getConfigsByType('contact')[0]?.content ||
                  '**从前书院招生办**\n\n若有心求学，望拨打专线联络。\n\n- 【统理招生】卿主任\n- 【传书青鸟】123456789'}
              </ReactMarkdown>
            </div>
          </GlassCard>
        </section>
      )}

      {/* 生贺节目大观 */}
      {getConfigsByType('program').length > 0 && (
        <section>
          <GlassCard className="w-full p-6">
            <h2 className="text-2xl font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-2">
              生贺节目大观
            </h2>
            <p className="text-sm text-[color:var(--color-theme-muted)] mb-6">
              校园开放日：每年5月8日 · 节目档案陆续解锁中...
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { type: 'music', label: '音乐', icon: Music },
                { type: 'video', label: '视频', icon: Play },
                { type: 'dance', label: '舞蹈', icon: Sparkles },
                { type: 'easter', label: '彩蛋', icon: Gift },
              ].map(({ type, label, icon: Icon }) => {
                const program = getConfigsByType('program').find((p) => {
                  try {
                    return JSON.parse(p.content).category === type;
                  } catch {
                    return false;
                  }
                });
                return (
                  <div
                    key={type}
                    className="p-4 bg-gradient-to-br from-[color:var(--color-theme-accent)]/10 to-[color:var(--color-theme-accent)]/5 rounded-2xl text-center"
                  >
                    <Icon size={32} className="mx-auto mb-2 text-[color:var(--color-theme-accent)]" />
                    <h3 className="font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-1">
                      {label}
                    </h3>
                    {program ? (
                      <p className="text-sm text-[color:var(--color-theme-text)]/80">{program.title}</p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">敬请期待</p>
                    )}
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </section>
      )}

      <section className="bento-grid">
        {academyLecturers.map((lecturer, index) => (
          <motion.article
            key={lecturer.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <GlassCard className="w-full p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-theme-muted)] mb-2">
                {lecturer.focus}
              </p>
              <h3 className="text-lg font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-2">
                {lecturer.name}
              </h3>
              <p className="text-sm text-[color:var(--color-theme-text)]/90 leading-relaxed">
                {lecturer.desc}
              </p>
            </GlassCard>
          </motion.article>
        ))}
      </section>

      <section>
        <GlassCard className="w-full p-6">
          <h2 className="text-xl font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-4">
            书院文案映射
          </h2>
          <div className="overflow-x-auto">
            <table className="academy-mapping-table w-full border-collapse rounded-lg overflow-hidden text-sm">
              <thead>
                <tr>
                  <th className="border px-3 py-2 text-left">版块</th>
                  <th className="border px-3 py-2 text-left">默认文案</th>
                  <th className="border px-3 py-2 text-left">书院文案</th>
                </tr>
              </thead>
              <tbody>
                {academyCopyMappings.map((row) => (
                  <tr key={row.section}>
                    <td className="border px-3 py-2 font-medium">{row.section}</td>
                    <td className="border px-3 py-2 text-[color:var(--color-theme-muted)]">
                      {row.defaultCopy}
                    </td>
                    <td className="border px-3 py-2">{row.academyCopy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </section>
    </div>
  );
};

export default AcademyHome;
