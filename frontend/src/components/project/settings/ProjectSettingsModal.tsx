import { Modal } from '@heroui/react'
import { useState } from 'react'
import { ProjectGeneralSettings } from './ProjectGeneralSettings'
import { ProjectMembersSettings } from './ProjectMembersSettings'
import { ProjectSettingsSidebar } from './ProjectSettingsSidebar'

type Tab = 'general' | 'members'

interface ProjectSettingsModalProps {
    isOpen: boolean
    setIsOpen: (open: boolean) => void
    isOwner: boolean
}

export function ProjectSettingsModal({
    isOpen,
    isOwner,
    setIsOpen,
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
                    <Modal.Dialog className="p-0">
                        <Modal.CloseTrigger />
                        <div className="flex h-full">
                            <ProjectSettingsSidebar
                                activeTab={activeTab}
                                onTabChange={setActiveTab}
                            />

                            <div className="flex-1 overflow-y-auto p-8">
                                {activeTab === 'general' && (
                                    <ProjectGeneralSettings isOwner={isOwner} />
                                )}
                                {activeTab === 'members' && (
                                    <ProjectMembersSettings isOwner={isOwner} />
                                )}
                            </div>
                        </div>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    )
}
