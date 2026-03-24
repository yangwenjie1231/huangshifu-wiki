import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL;
  const superAdminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD;
  const superAdminName = process.env.SEED_SUPER_ADMIN_NAME || '超级管理员';

  if (!superAdminEmail || !superAdminPassword) {
    throw new Error('Missing SEED_SUPER_ADMIN_EMAIL or SEED_SUPER_ADMIN_PASSWORD in environment.');
  }

  const passwordHash = await bcrypt.hash(superAdminPassword, 12);

  await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {
      displayName: superAdminName,
      role: UserRole.super_admin,
      passwordHash,
    },
    create: {
      email: superAdminEmail,
      displayName: superAdminName,
      role: UserRole.super_admin,
      passwordHash,
      bio: '',
    },
  });

  const sectionCount = await prisma.section.count();

  if (sectionCount === 0) {
    await prisma.section.createMany({
      data: [
        { id: 'music', name: '音乐讨论', description: '作品、翻唱与现场讨论', order: 1 },
        { id: 'news', name: '动态资讯', description: '活动与官方动态', order: 2 },
        { id: 'fanart', name: '同人创作', description: '绘画、视频与二创', order: 3 },
        { id: 'qa', name: '问答区', description: '新手提问与经验分享', order: 4 },
      ],
    });
  }

  const announcementCount = await prisma.announcement.count();
  if (announcementCount === 0) {
    await prisma.announcement.create({
      data: {
        content: '欢迎来到诗扶小筑，本地后端已启用。',
        active: true,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
