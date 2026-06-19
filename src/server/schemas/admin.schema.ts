import { z } from 'zod'
import { passwordSchema } from './auth.schema'
import {
  PROFILE_DISPLAY_NAME_MAX_LENGTH,
  PROFILE_SIGNATURE_MAX_LENGTH,
  WIKI_MAX_CONTENT_SIZE,
} from '../../lib/contentLimits'

export const backupRestoreSchema = z.object({
  password: z.string().min(1),
})

export const adminResetUserPasswordSchema = z.object({
  newPassword: passwordSchema,
})

const adminUserEmailSchema = z
  .string({ error: '邮箱不能为空' })
  .trim()
  .toLowerCase()
  .superRefine((value, ctx) => {
    if (!value) {
      ctx.addIssue({
        code: 'custom',
        message: '邮箱不能为空',
      })
      return
    }

    if (!z.email().safeParse(value).success) {
      ctx.addIssue({
        code: 'custom',
        message: '邮箱格式无效',
      })
    }
  })

const optionalAdminPasswordSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  passwordSchema.optional()
)

export const adminUpdateUserSchema = z
  .object({
    displayName: z
      .string({ error: '昵称必须是字符串' })
      .max(PROFILE_DISPLAY_NAME_MAX_LENGTH, `昵称不能超过${PROFILE_DISPLAY_NAME_MAX_LENGTH}个字符`)
      .optional(),
    signature: z
      .string({ error: '签名必须是字符串' })
      .max(PROFILE_SIGNATURE_MAX_LENGTH, `签名不能超过${PROFILE_SIGNATURE_MAX_LENGTH}个字符`)
      .optional(),
    bio: z
      .string({ error: '个人简介必须是字符串' })
      .max(WIKI_MAX_CONTENT_SIZE, '个人简介不能超过500KB')
      .optional(),
    email: adminUserEmailSchema.optional(),
    emailVerified: z.boolean({ error: '邮箱验证状态必须是布尔值' }).optional(),
    newPassword: optionalAdminPasswordSchema,
  })
  .refine(
    (value) =>
      value.displayName !== undefined ||
      value.signature !== undefined ||
      value.bio !== undefined ||
      value.email !== undefined ||
      value.emailVerified !== undefined ||
      value.newPassword !== undefined,
    '没有要更新的字段'
  )
