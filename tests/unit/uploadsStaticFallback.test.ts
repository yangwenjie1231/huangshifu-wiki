import express from 'express'
import fs from 'fs'
import os from 'os'
import path from 'path'
import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'

describe('uploads static fallback', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => fs.promises.rm(dir, { recursive: true, force: true }))
    )
  })

  it('returns an empty 404 when upload file is missing', async () => {
    const uploadsDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'uploads-static-test-'))
    tempDirs.push(uploadsDir)

    const app = express()
    app.use('/uploads', express.static(uploadsDir))
    app.use('/uploads', (_req, res) => {
      res.status(404).end()
    })

    const response = await request(app).get('/uploads/missing-image.jpg')

    expect(response.status).toBe(404)
    expect(response.text).toBe('')
  })
})
