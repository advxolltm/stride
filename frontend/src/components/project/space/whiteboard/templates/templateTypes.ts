import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform'

interface WhiteboardTemplateBase {
    id: string
    title: string
    description: string
}

export type WhiteboardTemplateDefinition = WhiteboardTemplateBase &
    (
        | {
              kind: 'mermaid'
              mermaidDefinition: string
          }
        | {
              kind: 'excalidraw'
              elements: ExcalidrawElementSkeleton[]
          }
    )
