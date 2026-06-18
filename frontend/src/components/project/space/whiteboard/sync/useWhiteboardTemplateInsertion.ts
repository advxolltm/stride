import { useState } from 'react'
import { toast } from '@heroui/react'
import {
    convertToExcalidrawElements,
    restoreElements,
} from '@excalidraw/excalidraw'
import { parseMermaidToExcalidraw } from '@excalidraw/mermaid-to-excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../../shared/utils/api/errors'
import { useCreateProjectWhiteboardElementsBulkMutation } from '../../../../../store/features/whiteboard/whiteboard.api'
import type { WhiteboardElement } from '../../../../../store/features/whiteboard/whiteboard.api.types'
import type { WhiteboardTemplateDefinition } from '../whiteboardTemplates'
import { buildExcalidrawElements } from './whiteboardSync.utils'

type UseWhiteboardTemplateInsertionArgs = {
    projectId?: string
    isReadOnly?: boolean
    whiteboardElements: WhiteboardElement[]
    refetchWhiteboardElements: () => Promise<unknown> | unknown
    getExcalidrawApi: () => ExcalidrawImperativeAPI | null
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
    isReadOnly = false,
    whiteboardElements,
    refetchWhiteboardElements,
    getExcalidrawApi,
}: UseWhiteboardTemplateInsertionArgs) => {
    const { t } = useTranslation('project')
    const [insertingTemplateId, setInsertingTemplateId] = useState<
        string | null
    >(null)
    const [createProjectWhiteboardElementsBulk] =
        useCreateProjectWhiteboardElementsBulkMutation()

    async function insertTemplate(template: WhiteboardTemplateDefinition) {
        if (!projectId || isReadOnly) {
            return false
        }

        setInsertingTemplateId(template.id)

        const { x, y } = getTemplateInsertOrigin(whiteboardElements)

        try {
            const templateElements =
                template.kind === 'mermaid'
                    ? convertToExcalidrawElements(
                          (
                              await parseMermaidToExcalidraw(
                                  template.mermaidDefinition,
                                  {
                                      flowchart: { curve: 'linear' },
                                      themeVariables: { fontSize: '18px' },
                                  },
                              )
                          ).elements,
                          {
                              regenerateIds: true,
                          },
                      )
                    : convertToExcalidrawElements(template.elements, {
                          regenerateIds: true,
                      })

            const positionedTemplateElements = templateElements.map((element) => ({
                ...element,
                x: element.x + x,
                y: element.y + y,
            }))
            const existingProps = buildExcalidrawElements(
                whiteboardElements,
                {},
            )
            const reconciledElements = restoreElements(
                [...existingProps, ...positionedTemplateElements],
                null,
                { repairBindings: true },
            )
            const placed = reconciledElements.slice(existingProps.length)
            const api = getExcalidrawApi()

            if (api) {
                api.updateScene({
                    elements: [
                        ...api.getSceneElementsIncludingDeleted(),
                        ...placed,
                    ],
                })
                api.scrollToContent(placed, {
                    fitToContent: true,
                    animate: true,
                })
            }

            await createProjectWhiteboardElementsBulk({
                projectId,
                body: placed.map((element) => ({
                    elementType: element.type,
                    props: element,
                    zIndex: 0,
                })),
            }).unwrap()

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
        } finally {
            setInsertingTemplateId(null)
        }
    }

    return {
        insertTemplate,
        insertingTemplateId,
        isInsertingTemplate: insertingTemplateId !== null,
    }
}
