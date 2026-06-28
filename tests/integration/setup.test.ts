import { describe, beforeEach, afterEach, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../../server'
import { createTestUser, prisma } from './setup'

async function clearUsers() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE')
}

function findCookieValue(setCookieHeader: string | string[] | undefined, cookieName: string) {
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : []
  const targetCookie = cookies.find((cookie) => cookie?.startsWith(`${cookieName}=`))
  return targetCookie?.split(';')[0].split('=')[1]
}

describe('Setup API - 首次初始化', () => {
  beforeEach(async () => {
    await clearUsers()
  })

  afterEach(async () => {
    await clearUsers()
  })

  it('空用户表时返回需要初始化', async () => {
    const response = await request(app).get('/api/setup/status')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      initialized: false,
      requiresSetup: true,
    })
  })

  it('空用户表时公开功能显示注册关闭并拒绝普通注册', async () => {
    const featuresResponse = await request(app).get('/api/config/features')

    expect(featuresResponse.status).toBe(200)
    expect(featuresResponse.body.registrationEnabled).toBe(false)

    const registerResponse = await request(app).post('/api/auth/register').send({
      email: 'new_user@example.com',
      displayName: 'NewUser',
      password: 'ValidPassword123!',
    })

    expect(registerResponse.status).toBe(403)
    expect(registerResponse.body).toMatchObject({
      code: 'SETUP_REQUIRED',
      error: '系统尚未完成初始化，请先创建超级管理员',
    })
    await expect(prisma.user.count()).resolves.toBe(0)
  })

  it('空用户表时拒绝微信新用户登录，避免锁死初始化', async () => {
    const response = await request(app).post('/api/auth/wechat/login').send({
      code: 'mock:setup_blocked_wechat',
      displayName: '微信用户',
    })

    expect(response.status).toBe(403)
    expect(response.body).toMatchObject({
      code: 'SETUP_REQUIRED',
      error: '系统尚未完成初始化，请先创建超级管理员',
    })
    await expect(prisma.user.count()).resolves.toBe(0)
  })

  it('空用户表时创建首个超级管理员并登录', async () => {
    const agent = request.agent(app)
    const response = await agent.post('/api/setup/initialize').send({
      email: 'FirstAdmin@Example.com',
      displayName: '首位管理员',
      password: 'FirstAdmin123!',
    })

    expect(response.status).toBe(201)
    expect(response.body.user.email).toBe('firstadmin@example.com')
    expect(response.body.user.displayName).toBe('首位管理员')
    expect(response.body.user.role).toBe('super_admin')
    expect(findCookieValue(response.headers['set-cookie'], 'hsf_token')).toBeTruthy()
    expect(findCookieValue(response.headers['set-cookie'], 'XSRF-TOKEN')).toBeTruthy()

    const createdUser = await prisma.user.findUnique({
      where: { email: 'firstadmin@example.com' },
    })
    expect(createdUser?.role).toBe('super_admin')

    const meResponse = await agent.get('/api/auth/me')
    expect(meResponse.status).toBe(200)
    expect(meResponse.body.user.email).toBe('firstadmin@example.com')
  })

  it('已有任意用户时拒绝初始化', async () => {
    await createTestUser({ email: 'existing@example.com', role: 'user' })

    const response = await request(app).post('/api/setup/initialize').send({
      email: 'admin@example.com',
      displayName: '管理员',
      password: 'AdminPassword123!',
    })

    expect(response.status).toBe(409)
    expect(response.body.error).toBe('系统已完成初始化，请登录')

    const users = await prisma.user.findMany({
      orderBy: { email: 'asc' },
    })
    expect(users).toHaveLength(1)
    expect(users[0].email).toBe('existing@example.com')
    expect(users[0].role).toBe('user')
  })
})
