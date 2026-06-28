import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const sectionCount = await prisma.section.count()

  if (sectionCount === 0) {
    await prisma.section.createMany({
      data: [
        { id: 'music', name: '音乐讨论', description: '作品、翻唱与现场讨论', order: 1 },
        { id: 'news', name: '动态资讯', description: '活动与官方动态', order: 2 },
        { id: 'fanart', name: '同人创作', description: '绘画、视频与二创', order: 3 },
        { id: 'qa', name: '问答区', description: '新手提问与经验分享', order: 4 },
      ],
    })
  }

}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
