import { toast } from '@heroui/react'
import { convertToExcalidrawElements } from '@excalidraw/excalidraw'
import { parseMermaidToExcalidraw } from '@excalidraw/mermaid-to-excalidraw'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../../shared/utils/api/errors'
import { useCreateProjectWhiteboardElementMutation } from '../../../../../store/features/whiteboard/whiteboard.api'
import type { WhiteboardElement } from '../../../../../store/features/whiteboard/whiteboard.api.types'
import type { WhiteboardTemplateDefinition } from '../whiteboardTemplates'

type UseWhiteboardTemplateInsertionArgs = {
    projectId?: string
    whiteboardElements: WhiteboardElement[]
    refetchWhiteboardElements: () => Promise<unknown> | unknown
}

const getTemplateInsertOrigin = (whiteboardElements: WhiteboardElement[]) => {
    if (whiteboardElements.length === 0) {
        return { x: 80, y: 80 }
    }

    const maxRight = whiteboardElements.reduce((currentMax, element) => {
        const width =
            typeof element.props.width === 'number' ? element.props.width : 0

        return Math.max(currentMax, element.props.x + width)
    }, 80)

    const minTop = whiteboardElements.reduce((currentMin, element) => {
        return Math.min(currentMin, element.props.y)
    }, 80)

    return {
        x: maxRight + 120,
        y: Math.max(minTop, 80),
    }
}

export const useWhiteboardTemplateInsertion = ({
    projectId,
    whiteboardElements,
    refetchWhiteboardElements,
}: UseWhiteboardTemplateInsertionArgs) => {
    const { t } = useTranslation('project')
    const [createProjectWhiteboardElement] =
        useCreateProjectWhiteboardElementMutation()

    async function insertTemplate(template: WhiteboardTemplateDefinition) {
        if (!projectId) {
            return false
        }

        const { x, y } = getTemplateInsertOrigin(whiteboardElements)
        const nextZIndex = whiteboardElements.reduce(
            (currentMax, element) => Math.max(currentMax, element.zIndex),
            -1,
        )

        try {
            const mermaidResult = await parseMermaidToExcalidraw(
                template.mermaidDefinition,
                {
                    flowchart: { curve: 'linear' },
                    themeVariables: { fontSize: '18px' },
                },
            )
            const templateElements = convertToExcalidrawElements(
                mermaidResult.elements,
                {
                    regenerateIds: true,
                },
            ).map((element) => ({
                ...element,
                x: element.x + x,
                y: element.y + y,
            }))

            await Promise.all(
                templateElements.map((element, index) =>
                    createProjectWhiteboardElement({
                        projectId,
                        body: {
                            elementType: element.type,
                            props: element,
                            zIndex: nextZIndex + index + 1,
                        },
                    }).unwrap(),
                ),
            )

            await refetchWhiteboardElements()
            toast.success(t('whiteboardPage.templateImportSuccess'))
            return true
        } catch (error) {
            toast.danger(
                getApiErrorMessage(
                    error,
                    t('whiteboardPage.templateImportError'),
                ),
            )
            return false
        }
    }

    return {
        insertTemplate,
    }
}
