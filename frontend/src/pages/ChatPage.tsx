import { MessageCircle } from 'lucide-react'
import { ChatSpace } from '../components/project/space/chat/ChatSpace'
import { ProjectSpaceHeader } from '../components/project/space/ProjectSpaceHeader'
import { useTranslation } from 'react-i18next'

export function ChatPage() {
    const { t } = useTranslation('project')
    return (
        <div className="flex h-[calc(100dvh-7rem)] min-h-0 flex-col gap-6 overflow-hidden">
            <ProjectSpaceHeader
                title={t('spaces.chat')}
                description={t('spaces.chatDescription')}
                icon={MessageCircle}
                iconColor="green"
            />
            <ChatSpace />
        </div>
    )
}
