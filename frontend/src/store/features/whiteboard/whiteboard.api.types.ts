import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { z } from 'zod'

const ExcalidrawElementSchema = z.custom<ExcalidrawElement>()

export const ApiWhiteboardSchema = z.object({
    id: z.string(),
    projectId: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
})

export type ApiWhiteboard = z.infer<typeof ApiWhiteboardSchema>

export const ApiWhiteboardElementSchema = z.object({
    id: z.string(),
    whiteboardId: z.string(),
    createdBy: z.string().nullable(),
    elementType: z.string(),
    props: ExcalidrawElementSchema,
    zIndex: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
})

export type ApiWhiteboardElement = z.infer<typeof ApiWhiteboardElementSchema>
export const ApiWhiteboardElementListSchema = z.array(ApiWhiteboardElementSchema)

export const WhiteboardSchema = ApiWhiteboardSchema
export type Whiteboard = z.infer<typeof WhiteboardSchema>

export const WhiteboardElementSchema = ApiWhiteboardElementSchema
export type WhiteboardElement = z.infer<typeof WhiteboardElementSchema>

export const CreateWhiteboardElementRequestSchema = z.object({
    elementType: z.string(),
    props: ExcalidrawElementSchema,
    zIndex: z.number(),
})

export type CreateWhiteboardElementRequest = z.infer<
    typeof CreateWhiteboardElementRequestSchema
>

export const UpdateWhiteboardElementRequestSchema = z.object({
    elementType: z.string().optional(),
    props: ExcalidrawElementSchema.optional(),
    zIndex: z.number().optional(),
})

export type UpdateWhiteboardElementRequest = z.infer<
    typeof UpdateWhiteboardElementRequestSchema
>
