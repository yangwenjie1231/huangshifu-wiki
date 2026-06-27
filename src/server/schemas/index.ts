export { validateBody } from './validate'
export {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendEmailVerificationSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
  passwordSchema,
} from './auth.schema'
export { userEmailUpdateSchema, userPasswordUpdateSchema } from './user.schema'
export {
  wikiCreateSchema,
  wikiUpdateSchema,
  wikiDeleteSchema,
  wikiRevisionSchema,
} from './wiki.schema'
export { postCreateSchema, postUpdateSchema, postDeleteSchema, postCommentSchema } from './post.schema'
export { galleryDeleteSchema } from './gallery.schema'
export {
  backupRestoreSchema,
  adminResetUserPasswordSchema,
  adminUpdateUserSchema,
  adminBatchGalleryImagesSchema,
  adminBatchSongCoversSchema,
  adminBatchAlbumCoversSchema,
  adminBatchEditLocksSchema,
  adminBatchMusicDisplaySchema,
} from './admin.schema'
