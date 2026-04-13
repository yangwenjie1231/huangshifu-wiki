import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Music, Palette, Book, Hammer, Moon, ChevronRight } from "lucide-react";
import GlassCard from "../components/GlassCard";

const academyCourses = [
  {
    category: "音乐",
    title: "天韵阁",
    lecturers: "杜丽娘、柳梦梅",
    icon: Music,
  },
  {
    category: "美术",
    title: "丹青院",
    lecturers: "贾宝玉、林黛玉",
    icon: Palette,
  },
  {
    category: "国学",
    title: "文枢阁",
    lecturers: "梁山伯、祝英台",
    icon: Book,
  },
  {
    category: "劳技",
    title: "掠影廊",
    lecturers: "项羽、虞姬",
    icon: Hammer,
  },
  {
    category: "入梦",
    title: "藏经阁",
    lecturers: "教书先生卿卿",
    icon: Moon,
  },
];

const Recruit = () => {
  return (
    <div className="academy-home-wrap max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* 返回首页 */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-[color:var(--color-theme-accent)] hover:opacity-80 transition-opacity"
      >
        <ArrowLeft size={16} />
        <span className="text-sm font-medium">返回书院大堂</span>
      </Link>

      {/* Hero 区域 */}
      <section className="academy-hero-surface theme-header-image rounded-[32px] overflow-hidden min-h-[24rem] border border-[color:var(--color-theme-border)] relative">
        <div className="academy-hero-overlay absolute inset-0" />
        <div className="relative z-10 p-8 sm:p-12 lg:p-16 flex flex-col justify-end min-h-[24rem]">
          <h1 className="text-4xl sm:text-6xl font-serif font-bold leading-tight text-[color:var(--color-theme-accent-strong)] mb-4">
            招募与培养
          </h1>
          <p className="max-w-2xl text-lg sm:text-xl leading-relaxed text-[color:var(--color-theme-text)]/90">
            五处幻境，五堂必修。以梦为马，不负韶华。
          </p>
        </div>
      </section>

      {/* 招募与培养概述 */}
      <section>
        <GlassCard className="w-full p-6">
          <p className="text-[color:var(--color-theme-text)]/90 leading-relaxed">
            从前书院常年招收志同道合之学子，共研古风艺术之大美。无论您是热爱诗词歌赋，还是痴迷琴棋书画，这里都有您的一席之地。
          </p>
        </GlassCard>
      </section>

      {/* 招生与培养要求 */}
      <section className="bento-grid">
        <GlassCard className="w-full p-6">
          <h2 className="text-xl font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-4">
            招生要求
          </h2>
          <ul className="space-y-2 text-[color:var(--color-theme-text)]/80">
            <li className="flex items-start gap-2">
              <span className="text-[color:var(--color-theme-accent)]">·</span>
              <span>热爱传统文化</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[color:var(--color-theme-accent)]">·</span>
              <span>对古风艺术有独特的共鸣</span>
            </li>
          </ul>
        </GlassCard>

        <GlassCard className="w-full p-6">
          <h2 className="text-xl font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-4">
            培养要求
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[color:var(--color-theme-accent)] mb-1">核心科目</h3>
              <p className="text-[color:var(--color-theme-text)]/80">古曲鉴赏、作词韵律、古典声乐</p>
            </div>
            <div>
              <h3 className="text-sm font-bold text-[color:var(--color-theme-accent)] mb-1">综合能力</h3>
              <p className="text-[color:var(--color-theme-text)]/80">能领悟歌词内蕴的情节，可听见琴弦间的叹息</p>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* 就业率展示 */}
      <section>
        <GlassCard className="w-full p-6 text-center">
          <div className="inline-flex flex-col items-center">
            <span className="text-6xl font-serif font-bold text-[color:var(--color-theme-accent-strong)]">100%</span>
            <span className="text-sm text-[color:var(--color-theme-muted)] mt-2">毕业生就业率</span>
            <p className="text-xs text-[color:var(--color-theme-text)]/60 mt-4 max-w-md">
              （黄诗扶及其听众的专属数据）<br />
              毕业后均获得在精神世界里自留一片净土的能力
            </p>
          </div>
        </GlassCard>
      </section>

      {/* 书院五景·限定课程 */}
      <section>
        <div className="text-center mb-8">
          <h2 className="text-3xl font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-2">
            书院五景 · 限定课程
          </h2>
          <p className="text-[color:var(--color-theme-muted)]">
            五处幻境，五堂必修。特邀名师入梦传道。
          </p>
        </div>

        <div className="bento-grid">
          {academyCourses.map((course, index) => (
            <GlassCard key={course.category} className="w-full p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-[color:var(--color-theme-accent)]/10 rounded-xl flex items-center justify-center">
                  <course.icon size={24} className="text-[color:var(--color-theme-accent)]" />
                </div>
                <div className="flex-1">
                  <span className="text-xs uppercase tracking-wider text-[color:var(--color-theme-muted)] mb-1 block">
                    {course.category}
                  </span>
                  <h3 className="text-lg font-serif font-bold text-[color:var(--color-theme-accent-strong)] mb-1">
                    {course.title}
                  </h3>
                  <p className="text-sm text-[color:var(--color-theme-text)]/60 mb-2">
                    特邀导师：<span className="text-[color:var(--color-theme-accent)]">{course.lecturers}</span>
                  </p>
                  <p className="text-sm text-[color:var(--color-theme-text)]/70">
                    深入研习{course.category === '音乐' ? '古风音乐创作与演唱技巧' :
                           course.category === '美术' ? '传统书画与创意设计' :
                           course.category === '国学' ? '诗词歌赋与文学鉴赏' :
                           course.category === '劳技' ? '影像记录与手工艺术' :
                           '入梦修行与心灵感悟'}，传承古典美学。
                  </p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* 返回首页 */}
      <section className="text-center">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[color:var(--color-theme-accent)] text-white rounded-full font-bold hover:opacity-90 transition-opacity"
        >
          返回书院大堂 <ChevronRight size={16} />
        </Link>
      </section>
    </div>
  );
};

export default Recruit;
