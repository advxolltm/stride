import { Modal } from '@heroui/react'
import { useState } from 'react'
import type { Project } from '../../../store/features/project/project.types'
import { ProjectGeneralSettings } from './ProjectGeneralSettings'
import { ProjectMembersSettings } from './projectMembers/ProjectMembersSettings'
import { ProjectSettingsSidebar } from './ProjectSettingsSidebar'
import { ProjectSkillsSettings } from './projectSkills/ProjectSkillsSettings'

type Tab = 'general' | 'members' | 'skills'

interface ProjectSettingsModalProps {
    isOpen: boolean
    setIsOpen: (open: boolean) => void
    isOwner: boolean
    project: Project
}

export function ProjectSettingsModal({
    isOpen,
    isOwner,
    setIsOpen,
    project,
}: ProjectSettingsModalProps) {
    const [activeTab, setActiveTab] = useState<Tab>('general')

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open)

        if (!open) {
            setActiveTab('general')
        }
    }

    return (
        <Modal isOpen={isOpen} onOpenChange={handleOpenChange}>
            <Modal.Backdrop>
                <Modal.Container size="cover">
                    <Modal.Dialog className="pl-2">
                        <Modal.CloseTrigger />
                        <div className="flex h-full">
                            <ProjectSettingsSidebar
                                activeTab={activeTab}
                                onTabChange={setActiveTab}
                            />

                            <div className="flex-1 overflow-y-auto p-8">
                                {activeTab === 'general' && (
                                    <ProjectGeneralSettings
                                        isOwner={isOwner}
                                        project={project}
                                    />
                                )}
                                {activeTab === 'members' && (
                                    <ProjectMembersSettings
                                        isOwner={isOwner}
                                        project={project}
                                    />
                                )}
                                {activeTab === 'skills' && (
                                    <ProjectSkillsSettings
                                        isOwner={isOwner}
                                        project={project}
                                    />
                                )}
                            </div>
                        </div>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    )
}
