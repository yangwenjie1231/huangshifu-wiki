import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const birthdayConfigs = [
  {
    type: 'notice',
    title: '关于黄诗扶全国巡演（上海站）的通知',
    content: JSON.stringify({
      concertDate: '2026 / 06 / 19 19:00、2026 / 06 / 20 19:00',
      concertLocation: '上海市 · 交通银行前滩31演艺中心',
      callToAction: '望各班学子奔走相告，共襄盛典。',
    }),
    sortOrder: 1,
    isActive: true,
  },
  {
    type: 'school_history',
    title: '书院沿革',
    content: '从前书院始建于2020年，由一群热爱传统文化的年轻学子创立。书院以"诗情画意，扶摇直上"为训诫，致力于古风音乐的推广与传承。历经数载，已发展成为乐迷心中的精神家园。',
    sortOrder: 2,
    isActive: true,
  },
  {
    type: 'honor_alumni',
    title: '黄诗扶',
    content: JSON.stringify({
      titles: ['杰出校友', '首席荣誉院士', '古风音乐代言人'],
      representativeWorks: ['吹梦到西洲', '人间不值得', '九万字'],
      description: '黄诗扶，出生于上海，毕业于英国布里斯托大学。她的音乐融合古典诗词与现代旋律，开创了独特的"新古风"风格。',
    }),
    sortOrder: 3,
    isActive: true,
  },
  {
    type: 'campus',
    title: '校园环境',
    content: '从前书院坐落于虚拟空间，环境清幽雅致。院内设有音乐厅、图书馆、画室等多功能区域，为学子提供沉浸式的学习体验。春来秋去，诗意常在。',
    sortOrder: 4,
    isActive: true,
  },
  {
    type: 'guestbook',
    title: '缘起从前，一见如故',
    content: JSON.stringify([
      { nickname: '西洲客', content: '吹梦到西洲，入耳即入心。黄老师的歌声伴随我度过了无数个深夜。' },
      { nickname: '云中君', content: '第一次听到《人间不值得》就被圈粉了，期待今年的巡演！' },
      { nickname: '长安花', content: '从布里斯托到上海，黄老师一直是我们的骄傲。' },
    ]),
    sortOrder: 5,
    isActive: true,
  },
  {
    type: 'contact',
    title: '招生办联系方式',
    content: JSON.stringify({
      department: '从前书院招生办',
      description: '若有心求学，望拨打专线联络。',
      contacts: [
        { role: '统理招生', name: '卿主任' },
        { role: '传书青鸟', name: '123456789' },
      ],
    }),
    sortOrder: 6,
    isActive: true,
  },
  {
    type: 'program',
    title: '生日祝福曲',
    content: JSON.stringify({ category: 'music' }),
    sortOrder: 7,
    isActive: true,
  },
  {
    type: 'program',
    title: '幕后花絮',
    content: JSON.stringify({ category: 'video' }),
    sortOrder: 8,
    isActive: true,
  },
  {
    type: 'program',
    title: '特别舞蹈',
    content: JSON.stringify({ category: 'dance' }),
    sortOrder: 9,
    isActive: true,
  },
  {
    type: 'program',
    title: '彩蛋内容',
    content: JSON.stringify({ category: 'easter' }),
    sortOrder: 10,
    isActive: true,
  },
];

async function main() {
  console.log('开始初始化生贺配置数据...');

  for (const config of birthdayConfigs) {
    const existing = await prisma.birthdayConfig.findFirst({
      where: { type: config.type, title: config.title },
    });

    if (!existing) {
      await prisma.birthdayConfig.create({
        data: config,
      });
      console.log(`✓ 已创建: ${config.type} - ${config.title}`);
    } else {
      console.log(`○ 已存在: ${config.type} - ${config.title}`);
    }
  }

  console.log('生贺配置数据初始化完成！');
}

main()
  .catch((e) => {
    console.error('初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
