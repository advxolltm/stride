import { MessageCircle } from 'lucide-react'
import { ChatSpace } from '../components/project/space/chat/ChatSpace'
import { ProjectSpaceHeader } from '../components/project/space/ProjectSpaceHeader'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { ArchivedReadOnlyChip } from '../components/project/space/shared/ArchivedReadOnlyChip'
import { isProjectArchived } from '../shared/utils/projectStatus'
import { useGetProjectByIdQuery } from '../store/features/project/project.api'

export function ChatPage() {
    const { t } = useTranslation('project')
    const { projectId } = useParams()
    const { data: project } = useGetProjectByIdQuery(projectId ?? '', {
        skip: !projectId,
    })
    const isArchived = isProjectArchived(project)

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden touch-manipulation">
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
