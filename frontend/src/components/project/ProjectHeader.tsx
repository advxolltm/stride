import { Button } from '@heroui/react'
import { Settings, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { InviteMembersDialog } from './InviteMembersDialog'
import { ProjectSettingsModal } from './projectSettings/ProjectSettingsModal'

interface ProjectHeaderProps {
    name: string
}

export function ProjectHeader({ name }: Readonly<ProjectHeaderProps>) {
    const { t } = useTranslation('project')
    const [isInviteOpen, setIsInviteOpen] = useState(false)
    const [isSettingsOpen, setSettingsOpen] = useState(false)

    return (
        <>
            <div className="border-b">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl font-bold tracking-tight">
                        {name}
                    </h1>

                    <div className="flex items-center gap-2">
                        <Button
                            onPress={() => setIsInviteOpen(true)}
                            className="flex items-center gap-2"
                        >
                            <UserPlus size={16} />
                            {t('header.invite')}
                        </Button>

                        <Button
                            onPress={() => setSettingsOpen(true)}
                            isIconOnly
                        >
                            <Settings color="white" size={18} />
                        </Button>
                    </div>
                </div>
            </div>

            <InviteMembersDialog
                isOpen={isInviteOpen}
                setIsOpen={setIsInviteOpen}
            />

            <ProjectSettingsModal
                isOpen={isSettingsOpen}
                setIsOpen={setSettingsOpen}
                isOwner={true}
            />
        </>
    )
}
