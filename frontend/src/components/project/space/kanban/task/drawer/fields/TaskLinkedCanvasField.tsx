import { Label } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import type { Task } from '../../../../../../../store/features/tasks/task.types'
import { useTaskBoard } from '../../../context/useTaskBoard'
import { WhiteboardCanvas } from '../../../../whiteboard/canvas/WhiteboardCanvas'
import { useWhiteboardSync } from '../../../../whiteboard/sync/useWhiteboardSync'
import { useGetProjectWhiteboardElementsQuery, useWatchWhiteboardEventsQuery } from '../../../../../../../store/features/whiteboard/whiteboard.api'
import { useNavigate } from 'react-router-dom'
import { skipToken } from '@reduxjs/toolkit/query'
import type { WhiteboardLiveUpdateEventPayload } from '../../../../../../../store/features/whiteboard/whiteboard.socket.types'

const emptyLiveElementsById: Record<string, WhiteboardLiveUpdateEventPayload> = {};

export function TaskLinkedCanvasField({ task }: { task: Task }) {
    const { t } = useTranslation('space')
    const { projectId, isArchived } = useTaskBoard()

    const {
        data: whiteboardElements = [],
        isSuccess: isElementsReady,
    } = useGetProjectWhiteboardElementsQuery(projectId ?? '', {
        skip: !projectId,
        refetchOnMountOrArgChange: true,
    });

    const whiteboardEventsWS = useWatchWhiteboardEventsQuery(
        projectId && isElementsReady ? projectId : skipToken,
        {
            selectFromResult: ({ data }) => ({
                liveElementsById: data?.liveElementsById ?? emptyLiveElementsById,
            }),
        },
    );

    const liveElementsById = whiteboardEventsWS.liveElementsById;
    const {
        excalidrawElements,
    } = useWhiteboardSync({
        projectId,
        isReadOnly: isArchived,
        whiteboardElements,
        liveElementsById,
    });

    const navigate = useNavigate();

    function gotoCanvas() {
        navigate(`/project/${projectId}/whiteboard?focusTaskId=${task.id}`);
    }

    // Removes the remaining ui elements from the preview
    // idk why this isn't possible through the api...
    const css = `
		.excalidraw .dropdown-menu-button {
		  display: none !important;
		}

		.excalidraw .Island {
		  display: none !important;
		}
	`

    const targets = excalidrawElements.filter(e => e.customData?.taskLinkId === task.id);

    if (targets.length > 0) {
        return (
            <div className="flex flex-col gap-1.5 h-full">
                <div className="h-full">
                    <Label>{t("tasks.form.linkedWhiteboardRegion")}</Label>
                    <div className="flex h-full w-full min-h-50 min-w-50">
                        <div className="min-w-0 flex-1" onClick={gotoCanvas}>
                            <style>{css}</style>
                            <WhiteboardCanvas
                                ref={excalidrawApiRef => {
                                    if (!excalidrawApiRef) {
                                        return;
                                    }
                                    // NOTE: both the rectangle and the title above the rectangle have this id
                                    // 		 providing both to the scrollToContent(..., { fitToContent: true }) ensures
                                    // 		 that both (and by extension the actual content of the link) are properly in view
									excalidrawApiRef.scrollToContent(
										targets,
										{
											fitToViewport: true,
											viewportZoomFactor: 1
										}
									);
                                }}
                                key={projectId}
                                elements={excalidrawElements}
                                viewportStorageKey={
                                    projectId
                                        ? `whiteboard:${projectId}:viewport`
                                        : undefined
                                }
                                viewModeEnabled={true}
                                taskPreviewModeEnabled={true}
                            />
                        </div>
                    </div>
                </div>
            </div>
        )
    } else {
        return null;
    }
}
