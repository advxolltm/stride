import { MessageCircle } from 'lucide-react'
import { ChatSpace } from '../components/project/space/chat/ChatSpace'
import { ProjectSpaceHeader } from '../components/project/space/ProjectSpaceHeader'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { ArchivedReadOnlyChip } from '../components/project/space/shared/ArchivedReadOnlyChip'
import { isProjectArchived } from '../shared/utils/projectStatus'
import { useGetProjectByIdQuery } from '../store/features/project/project.api'
import { skipToken } from '@reduxjs/toolkit/query'
import { useWatchProjectChatSocketQuery } from '../store/features/chat/chat.socket'

export function ChatPage() {
    const { t } = useTranslation('project')
    const { projectId } = useParams()
    useWatchProjectChatSocketQuery(projectId ?? skipToken)
    const { data: project } = useGetProjectByIdQuery(projectId ?? '', {
        skip: !projectId,
    })
    const isArchived = isProjectArchived(project)

    return (
        <div className="flex h-[calc(100dvh-7rem)] min-h-0 flex-col gap-6 overflow-hidden">
            <ProjectSpaceHeader
                title={t('spaces.chat')}
                description={t('spaces.chatDescription')}
                icon={MessageCircle}
                iconColor="green"
                rightContent={isArchived ? <ArchivedReadOnlyChip /> : undefined}
            />
            <ChatSpace />
        </div>
    )
}
