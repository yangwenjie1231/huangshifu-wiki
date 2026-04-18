# 1. 问题

Home.tsx 文件包含两个完全不同的主题实现（AcademyHome 和默认 Home），以及大量的UI组件定义，严重违反单一职责原则，导致文件体积过大、维护困难。

## 1.1. **职责过度耦合**

Home.tsx 文件（800+行）同时负责以下职责：

- **默认主题主页**：包含 Hero Section、Bento Grid 布局、百科入口、热门帖子、社区动态、加入我们等模块
- **书院主题主页**：包含书院山门、教务处文件通知、校史拾遗、荣誉校友、雅学之境、学子留言壁、联系我们、生贺节目大观等模块
- **共享UI组件**：AnimatedStat、CategoryCard 等组件定义
- **数据获取逻辑**：生日配置数据获取、首页Feed数据获取

这种职责过度耦合导致：
- 文件体积过大，难以理解和维护
- 两个主题的实现混合在一起，增加了认知负担
- 修改一个主题可能意外影响另一个主题
- 代码复用性差，共享组件和逻辑难以在其他地方使用

## 1.2. **组件定义混乱**

文件内部定义了多个UI组件，包括：

- `AnimatedStat`：动画统计组件
- `CategoryCard`：分类卡片组件
- `AcademyHome`：书院主题主页组件
- `Home`：默认主题主页组件

这些组件定义与页面逻辑混合在一起，违反了组件化原则，导致：
- 组件难以在其他页面复用
- 组件测试困难
- 组件职责不清晰

## 1.3. **数据获取逻辑分散**

文件中包含多个数据获取逻辑：

- 生日配置数据获取（仅在 AcademyHome 中使用）
- 首页Feed数据获取（仅在默认 Home 中使用）

这些逻辑分散在组件内部，难以：
- 统一管理数据获取
- 实现数据缓存
- 处理错误和加载状态

## 1.4. **类型定义重复**

文件内部定义了多个类型，包括：

- `AnimatedStatProps`
- `CategoryCardProps`
- `BirthdayConfig`

这些类型定义与组件定义混合在一起，不利于类型复用和管理。

---

# 2. 收益

通过重构 Home.tsx 文件，可以实现以下收益：

## 2.1. **提升代码可维护性**

- **文件体积减少**：将 Home.tsx 拆分为多个小文件，每个文件职责单一，文件体积控制在 200-300 行以内
- **职责清晰**：每个文件只负责一个主题或一个组件，修改时不会影响其他部分
- **代码可读性提升**：开发者可以快速定位需要修改的代码，减少理解成本

## 2.2. **提高组件复用性**

- **共享组件独立**：将 `AnimatedStat`、`CategoryCard` 等组件提取到独立的组件文件中，可以在其他页面复用
- **主题组件独立**：将 `AcademyHome` 和默认 `Home` 拆分为独立的文件，便于单独维护和测试
- **类型定义独立**：将类型定义提取到独立的类型文件中，便于类型复用

## 2.3. **改善代码组织结构**

- **清晰的目录结构**：建立清晰的文件组织结构，便于开发者快速定位代码
- **模块化设计**：每个模块职责单一，便于测试和维护
- **降低耦合度**：减少模块之间的依赖，提高代码的灵活性

## 2.4. **提升开发效率**

- **并行开发**：不同的开发者可以同时修改不同的主题，不会产生冲突
- **快速定位问题**：当出现问题时，可以快速定位到具体的文件和组件
- **便于代码审查**：代码审查时可以专注于单个文件，减少审查负担

---

# 3. 方案

采用组件拆分和模块化的方式，将 Home.tsx 文件拆分为多个小文件，每个文件职责单一。

## 3.1. **拆分共享组件**

将 `AnimatedStat` 和 `CategoryCard` 组件提取到独立的组件文件中。

### 实现步骤

1. 创建 `src/components/home/AnimatedStat.tsx` 文件
2. 创建 `src/components/home/CategoryCard.tsx` 文件
3. 将对应的组件代码移动到新文件中
4. 在 Home.tsx 中导入这些组件

### 代码示例（修改前）

```tsx
// Home.tsx
interface AnimatedStatProps {
  value: number;
  suffix?: string;
  label: string;
  icon: React.ReactNode;
}

const AnimatedStat: React.FC<AnimatedStatProps> = ({ value, suffix = "", label, icon }) => {
  const [ref, count, inView] = useAnimatedNumber<HTMLDivElement>(value);

  return (
    <div ref={ref} className="flex items-center gap-3 p-4 bg-white/20 rounded-2xl border border-white/20">
      <div className="w-10 h-10 rounded-full bg-white/40 flex items-center justify-center text-gray-900">
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold">
          {inView ? count.toLocaleString() : 0}
          {suffix}
        </p>
        <p className="text-xs text-gray-800/50">{label}</p>
      </div>
    </div>
  );
};
```

### 代码示例（修改后）

```tsx
// src/components/home/AnimatedStat.tsx
import React from 'react';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';

interface AnimatedStatProps {
  value: number;
  suffix?: string;
  label: string;
  icon: React.ReactNode;
}

export const AnimatedStat: React.FC<AnimatedStatProps> = ({ value, suffix = "", label, icon }) => {
  const [ref, count, inView] = useAnimatedNumber<HTMLDivElement>(value);

  return (
    <div ref={ref} className="flex items-center gap-3 p-4 bg-white/20 rounded-2xl border border-white/20">
      <div className="w-10 h-10 rounded-full bg-white/40 flex items-center justify-center text-gray-900">
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold">
          {inView ? count.toLocaleString() : 0}
          {suffix}
        </p>
        <p className="text-xs text-gray-800/50">{label}</p>
      </div>
    </div>
  );
};
```

```tsx
// src/components/home/CategoryCard.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import type { ThemeName } from '../../lib/theme';
import { withThemeSearch } from '../../lib/theme';

interface CategoryCardProps {
  cat: {
    title: string;
    icon: React.ReactNode;
    desc: string;
    link: string;
  };
  theme: ThemeName;
}

export const CategoryCard: React.FC<CategoryCardProps> = React.memo(({ cat, theme }) => (
  <Link
    to={withThemeSearch(cat.link, theme)}
    className="flex items-start gap-4 p-4 rounded-2xl hover:bg-gray-50 transition-all group"
  >
    <div className="text-brand-primary group-hover:scale-110 transition-transform">
      {cat.icon}
    </div>
    <div>
      <h3 className="text-xl font-serif font-bold mb-1">
        {cat.title}
      </h3>
      <p className="text-gray-500 text-sm leading-relaxed">
        {cat.desc}
      </p>
    </div>
  </Link>
));
```

```tsx
// Home.tsx
import { AnimatedStat } from '../components/home/AnimatedStat';
import { CategoryCard } from '../components/home/CategoryCard';
```

---

## 3.2. **拆分主题组件**

将 `AcademyHome` 和默认 `Home` 拆分为独立的文件。

### 实现步骤

1. 创建 `src/pages/home/AcademyHome.tsx` 文件
2. 创建 `src/pages/home/DefaultHome.tsx` 文件
3. 将对应的组件代码移动到新文件中
4. 在 Home.tsx 中根据主题条件渲染对应的组件

### 代码示例（修改前）

```tsx
// Home.tsx
const AcademyHome = () => {
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

  // ... 大量的 JSX 代码
};

const Home = () => {
  const { isAcademy, theme } = useTheme();
  const { t } = useI18n();
  const [feed, setFeed] = useState<HomeFeedResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAcademy) {
      setLoading(false);
      return;
    }

    const fetchFeed = async () => {
      try {
        const data = await apiGet<HomeFeedResponse>("/api/home/feed");
        setFeed(data);
      } catch (e) {
        console.error("Error fetching home feed:", e);
      }
      setLoading(false);
    };
    fetchFeed();
  }, [isAcademy]);

  if (isAcademy) {
    return <AcademyHome />;
  }

  // ... 大量的 JSX 代码
};
```

### 代码示例（修改后）

```tsx
// src/pages/home/AcademyHome.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiGet } from '../../lib/apiClient';
import { useTheme } from '../../context/ThemeContext';
import { withThemeSearch } from '../../lib/theme';
import GlassCard from '../../components/GlassCard';
import { Book, Shield, Sparkles, ChevronRight, Music, Play, Gift, ArrowRight } from 'lucide-react';

interface BirthdayConfig {
  id: string;
  type: string;
  title: string;
  content: string;
  sortOrder: number;
  isActive: boolean;
}

const academyHighlights = [
  {
    title: "书院山门",
    subtitle: "入门即见诗乐相逢",
    href: "/wiki?category=biography",
  },
  // ... 其他高亮项
];

const academyLecturers = [
  {
    name: "掌灯讲师 · 清词",
    focus: "歌诗导读",
    desc: "负责书院导览与作品脉络梳理，适合第一次进入书院的访客。",
  },
  // ... 其他讲师
];

const academyCopyMappings = [
  {
    section: "百科 · 人物介绍",
    defaultCopy: "生平经历、艺术风格与成就",
    academyCopy: "年谱与师承脉络，先识其人再听其歌",
  },
  // ... 其他映射
];

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
      {/* ... 原有的 JSX 代码 */}
    </div>
  );
};
```

```tsx
// src/pages/home/DefaultHome.tsx
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../lib/i18n';
import { apiGet } from '../../lib/apiClient';
import { withThemeSearch } from '../../lib/theme';
import GlassCard from '../../components/GlassCard';
import { AnimatedStat } from '../../components/home/AnimatedStat';
import { CategoryCard } from '../../components/home/CategoryCard';
import {
  Book, MessageSquare, Music, Calendar, ArrowRight, Clock, Heart, Flame, Play
} from 'lucide-react';
import { format } from 'date-fns';
import { toDateValue } from '../../lib/dateUtils';
import type { HomeFeedResponse } from '../../types/api';

export const DefaultHome = () => {
  const { theme } = useTheme();
  const { t } = useI18n();
  const [feed, setFeed] = useState<HomeFeedResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const data = await apiGet<HomeFeedResponse>("/api/home/feed");
        setFeed(data);
      } catch (e) {
        console.error("Error fetching home feed:", e);
      }
      setLoading(false);
    };
    fetchFeed();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* ... 原有的 JSX 代码 */}
    </div>
  );
};
```

```tsx
// Home.tsx
import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { AcademyHome } from './home/AcademyHome';
import { DefaultHome } from './home/DefaultHome';
import { HomeSkeleton } from '../components/HomeSkeleton';

const Home = () => {
  const { isAcademy } = useTheme();

  if (isAcademy) {
    return <AcademyHome />;
  }

  return <DefaultHome />;
};

export default Home;
```

---

## 3.3. **提取类型定义**

将类型定义提取到独立的类型文件中。

### 实现步骤

1. 创建 `src/types/home.ts` 文件
2. 将 `BirthdayConfig` 等类型定义移动到新文件中
3. 在各个组件中导入这些类型

### 代码示例（修改后）

```tsx
// src/types/home.ts
export interface BirthdayConfig {
  id: string;
  type: string;
  title: string;
  content: string;
  sortOrder: number;
  isActive: boolean;
}

export interface AnimatedStatProps {
  value: number;
  suffix?: string;
  label: string;
  icon: React.ReactNode;
}

export interface CategoryCardProps {
  cat: {
    title: string;
    icon: React.ReactNode;
    desc: string;
    link: string;
  };
  theme: import('../lib/theme').ThemeName;
}
```

```tsx
// src/pages/home/AcademyHome.tsx
import type { BirthdayConfig } from '../../types/home';
```

```tsx
// src/components/home/AnimatedStat.tsx
import type { AnimatedStatProps } from '../../types/home';
```

---

## 3.4. **提取常量定义**

将 `academyHighlights`、`academyLecturers`、`academyCopyMappings` 等常量提取到独立的常量文件中。

### 实现步骤

1. 创建 `src/constants/academy.ts` 文件
2. 将常量定义移动到新文件中
3. 在 AcademyHome 组件中导入这些常量

### 代码示例（修改后）

```tsx
// src/constants/academy.ts
import { Book, Music, Calendar, MessageSquare, Play, Sparkles, Gift, ArrowRight, ChevronRight } from 'lucide-react';

export const academyHighlights = [
  {
    title: "书院山门",
    subtitle: "入门即见诗乐相逢",
    href: "/wiki?category=biography",
  },
  {
    title: "练习技艺的花园",
    subtitle: "音乐作品与修习人次",
    href: "/music",
  },
  {
    title: "游画廊",
    subtitle: "图集与起居陈设",
    href: "/gallery",
  },
  {
    title: "藏经阁 · 入梦课",
    subtitle: "新闻、采访与特别事迹",
    href: "/forum?section=news",
  },
];

export const academyLecturers = [
  {
    name: "掌灯讲师 · 清词",
    focus: "歌诗导读",
    desc: "负责书院导览与作品脉络梳理，适合第一次进入书院的访客。",
  },
  {
    name: "值案讲师 · 归墨",
    focus: "资料校勘",
    desc: "整理百科条目与出处映射，确保阅读链路清晰、引用一致。",
  },
  {
    name: "巡夜讲师 · 听雪",
    focus: "社群引导",
    desc: "维护论坛问答秩序，提供讨论提纲与新帖引导模板。",
  },
];

export const academyCopyMappings = [
  {
    section: "百科 · 人物介绍",
    defaultCopy: "生平经历、艺术风格与成就",
    academyCopy: "年谱与师承脉络，先识其人再听其歌",
  },
  {
    section: "论坛 · 动态资讯",
    defaultCopy: "参与社区讨论",
    academyCopy: "书院告示与近闻，先阅卷后议论",
  },
  {
    section: "音乐 · 曲目入口",
    defaultCopy: "原创、翻唱及合作曲目全收录",
    academyCopy: "按课序排听，配套条目可回溯",
  },
];
```

```tsx
// src/pages/home/AcademyHome.tsx
import { academyHighlights, academyLecturers, academyCopyMappings } from '../../constants/academy';
```

---

## 3.5. **目录结构**

重构后的目录结构如下：

```
src/
├── components/
│   └── home/
│       ├── AnimatedStat.tsx
│       └── CategoryCard.tsx
├── pages/
│   ├── home/
│   │   ├── AcademyHome.tsx
│   │   └── DefaultHome.tsx
│   └── Home.tsx
├── constants/
│   └── academy.ts
└── types/
    └── home.ts
```

---

# 4. 回归范围

本次重构主要涉及 Home.tsx 文件的拆分，回归测试需要覆盖以下场景：

## 4.1. 主链路

### 默认主题主页

1. **用户访问默认主题主页**
   - 预期：正常显示 Hero Section、Bento Grid 布局、百科入口、热门帖子、社区动态、加入我们等模块
   - 关键检查点：页面布局正常、数据加载正常、动画效果正常

2. **用户点击百科入口**
   - 预期：跳转到百科页面，显示对应的分类内容
   - 关键检查点：跳转链接正确、分类参数正确传递

3. **用户点击热门帖子**
   - 预期：跳转到帖子详情页
   - 关键检查点：跳转链接正确、帖子ID正确传递

4. **用户点击社区动态**
   - 预期：跳转到论坛页面
   - 关键检查点：跳转链接正确

5. **用户点击"加入我们"**
   - 预期：跳转到论坛页面
   - 关键检查点：跳转链接正确

### 书院主题主页

1. **用户访问书院主题主页**
   - 预期：正常显示书院山门、教务处文件通知、校史拾遗、荣誉校友、雅学之境、学子留言壁、联系我们、生贺节目大观等模块
   - 关键检查点：页面布局正常、数据加载正常、动画效果正常

2. **用户点击"进入书院"**
   - 预期：跳转到音乐页面
   - 关键检查点：跳转链接正确

3. **用户点击"查看年谱"**
   - 预期：跳转到百科页面
   - 关键检查点：跳转链接正确

4. **用户点击书院高亮项**
   - 预期：跳转到对应的页面
   - 关键检查点：跳转链接正确

5. **用户点击"前往招募与培养"**
   - 预期：跳转到招募页面
   - 关键检查点：跳转链接正确

## 4.2. 边界情况

### 数据加载异常

1. **生日配置数据加载失败**
   - 触发条件：API 请求失败或返回错误数据
   - 预期系统行为：显示错误提示，不影响页面其他部分的渲染
   - 关键检查点：错误提示正确显示、页面其他部分正常渲染

2. **首页Feed数据加载失败**
   - 触发条件：API 请求失败或返回错误数据
   - 预期系统行为：显示错误提示，不影响页面其他部分的渲染
   - 关键检查点：错误提示正确显示、页面其他部分正常渲染

### 空数据状态

1. **生日配置数据为空**
   - 触发条件：API 返回空数组
   - 预期系统行为：不显示对应的模块，不影响页面其他部分的渲染
   - 关键检查点：对应的模块不显示、页面其他部分正常渲染

2. **首页Feed数据为空**
   - 触发条件：API 返回空数据
   - 预期系统行为：显示"暂无数据"提示
   - 关键检查点：提示正确显示、页面其他部分正常渲染

### 主题切换

1. **用户从默认主题切换到书院主题**
   - 触发条件：用户在主题设置中切换主题
   - 预期系统行为：页面重新渲染，显示书院主题主页
   - 关键检查点：页面正确切换、数据正确加载

2. **用户从书院主题切换到默认主题**
   - 触发条件：用户在主题设置中切换主题
   - 预期系统行为：页面重新渲染，显示默认主题主页
   - 关键检查点：页面正确切换、数据正确加载

### 响应式布局

1. **用户在移动设备上访问主页**
   - 触发条件：使用移动设备或模拟移动设备
   - 预期系统行为：页面布局适应移动设备，显示正常
   - 关键检查点：布局正常、交互正常、动画效果正常

2. **用户在平板设备上访问主页**
   - 触发条件：使用平板设备或模拟平板设备
   - 预期系统行为：页面布局适应平板设备，显示正常
   - 关键检查点：布局正常、交互正常、动画效果正常

3. **用户在桌面设备上访问主页**
   - 触发条件：使用桌面设备
   - 预期系统行为：页面布局适应桌面设备，显示正常
   - 关键检查点：布局正常、交互正常、动画效果正常

### 性能测试

1. **页面首次加载性能**
   - 触发条件：用户首次访问主页
   - 预期系统行为：页面加载时间在可接受范围内（< 3秒）
   - 关键检查点：FCP、LCP、TTI 等性能指标正常

2. **页面切换性能**
   - 触发条件：用户在主题之间切换
   - 预期系统行为：页面切换流畅，无卡顿
   - 关键检查点：切换时间在可接受范围内（< 1秒）

3. **组件渲染性能**
   - 触发条件：页面包含大量组件
   - 预期系统行为：组件渲染流畅，无卡顿
   - 关键检查点：FPS 稳定在 60 以上