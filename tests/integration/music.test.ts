import { describe, beforeEach, afterEach, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../server'
import { prisma, createTestUser } from './setup'

describe('Music API - 音乐接口测试', () => {
  let adminUser: Awaited<ReturnType<typeof createTestUser>>

  function findCookieValue(setCookieHeader: string | string[] | undefined, cookieName: string) {
    const cookies = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : setCookieHeader
        ? [setCookieHeader]
        : []
    const targetCookie = cookies.find((cookie) => cookie?.startsWith(`${cookieName}=`))
    return targetCookie?.split(';')[0].split('=')[1]
  }

  async function createAuthenticatedAgent(email: string, password: string) {
    const agent = request.agent(app)
    const loginResponse = await agent.post('/api/auth/login').send({ email, password })

    expect(loginResponse.status).toBe(200)
    const xsrfToken = findCookieValue(loginResponse.headers['set-cookie'], 'XSRF-TOKEN')
    expect(xsrfToken).toBeTruthy()

    return {
      agent,
      xsrfToken: xsrfToken!,
    }
  }

  beforeEach(async () => {
    await prisma.musicTrack.deleteMany({
      where: {
        id: {
          startsWith: 'test-markdown-description-',
        },
      },
    })
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'test_music_desc_',
        },
      },
    })

    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    adminUser = await createTestUser({
      role: 'admin',
      email: `test_music_desc_admin_${suffix}@example.com`,
      displayName: `TestMusicDescAdmin_${suffix}`,
    })
  })

  afterEach(async () => {
    await prisma.musicTrack.deleteMany({
      where: {
        id: {
          startsWith: 'test-markdown-description-',
        },
      },
    })
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'test_music_desc_',
        },
      },
    })
  })

  it('更新歌曲描述时应保留 Markdown 源文本首尾空白', async () => {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const song = await prisma.musicTrack.create({
      data: {
        id: `test-markdown-description-${suffix}`,
        title: 'Markdown Description Test Song',
        artist: 'Markdown Description Test Artist',
        album: '',
        addedBy: adminUser.user.uid,
      },
    })
    const markdownDescription = '\n\n    const value = 1\n\n正文\n'
    const { agent, xsrfToken } = await createAuthenticatedAgent(
      adminUser.user.email,
      adminUser.plainPassword
    )

    const response = await agent
      .patch(`/api/music/${song.docId}`)
      .set('X-XSRF-TOKEN', xsrfToken)
      .send({ description: markdownDescription })

    expect(response.status).toBe(200)
    expect(response.body.song.description).toBe(markdownDescription)

    const updatedSong = await prisma.musicTrack.findUnique({
      where: { docId: song.docId },
      select: { description: true },
    })
    expect(updatedSong?.description).toBe(markdownDescription)
  })
})
