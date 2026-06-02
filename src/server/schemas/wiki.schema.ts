import { z } from 'zod'

const wikiContentStatusSchema = z.enum(['draft', 'pending', 'published'])

export const wikiCreateSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  slug: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  relations: z.array(z.any()).optional(),
  status: wikiContentStatusSchema.optional(),
})

export const wikiUpdateSchema = wikiCreateSchema.partial()
