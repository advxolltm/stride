import { Button, Popover } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import LinkTaskSearch from './LinkTaskSearch'
import type { Task } from '../../../../store/features/tasks/task.types'

interface LinkTaskButtonProps {
	onSelect: (linkTaskChoice: Task) => void,
}

export function LinkTaskButton({
	onSelect,
}: LinkTaskButtonProps) {
    const { t } = useTranslation('project')
    const [isOpen, setIsOpen] = useState(false)

    return (
        <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
            <Popover.Trigger>
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-10 min-w-10 gap-0 -space-x-2 rounded-full border border-[var(--border)] bg-[color-mix(in_oklch,var(--surface)_94%,transparent)] px-2 text-[var(--foreground)] shadow-lg backdrop-blur-xl hover:bg-[var(--surface-secondary)]"
                >
					{t("whiteboardPage.region.linkTask")}
                </Button>

            </Popover.Trigger>
            <Popover.Content className="p-4 w-64"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex flex-col gap-3">
					<LinkTaskSearch 
						onSelect={(task) => {
							setIsOpen(false);
							onSelect(task);
						}}
					/>
                </div>
            </Popover.Content>
        </Popover>
    )
}
