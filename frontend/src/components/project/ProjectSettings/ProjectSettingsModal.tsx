import { Modal } from '@heroui/react'
import { useState } from 'react'
import { GeneralSettings } from './GeneralSettings'
import { MembersSettings } from './MembersSettings'
import { SettingsSidebar } from './SettingsSidebar'

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
                            <SettingsSidebar
                                activeTab={activeTab}
                                onTabChange={setActiveTab}
                            />

                            <div className="flex-1 overflow-y-auto p-8">
                                {activeTab === 'general' && (
                                    <GeneralSettings isOwner={isOwner} />
                                )}
                                {activeTab === 'members' && (
                                    <MembersSettings isOwner={isOwner} />
                                )}
                            </div>
                        </div>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    )
}
