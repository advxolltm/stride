import { z } from 'zod'

export const UserSchema = z.object({
    id: z.string(),
    username: z.string(),
    email: z.string(),
    fullName: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    avatarSmallUrl: z.string().nullable().optional(),
    isSuperuser: z.boolean(),
})

export type User = z.infer<typeof UserSchema>
