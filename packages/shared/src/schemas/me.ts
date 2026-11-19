import { z } from 'zod'
import { USER_ROLES } from '../catalog'
import { LOCALES } from '../locales'

/** The signed-in user. Contains the user's own PII only. */
export const meSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
  roles: z.array(z.enum(USER_ROLES)),
  locale: z.enum(LOCALES),
  /** Slug of the musician profile this user owns, if any. */
  musicianSlug: z.string().nullable(),
})
export type Me = z.infer<typeof meSchema>

/** Dev-only sign-in (AUTH_MODE=dev). Never mounted in production. */
export const devUserSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
  roles: z.array(z.enum(USER_ROLES)),
})
export const devUserListSchema = z.object({ items: z.array(devUserSchema) })
export const devSessionRequestSchema = z.object({ userId: z.uuid() }).strict()
export const devSessionSchema = z.object({ accessToken: z.string(), expiresIn: z.number().int().positive() })
