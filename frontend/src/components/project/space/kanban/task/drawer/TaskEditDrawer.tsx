import { Drawer } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import type { Task } from '../../../../../../store/features/tasks/task.types'
import { TaskAssigneeField } from './fields/TaskAssigneeField'
import { TaskDescriptionField } from './fields/TaskDescriptionField'
import { TaskDueDateField } from './fields/TaskDueDateField'
import { TaskStatusField } from './fields/TaskStatusField'
import { TaskTitleField } from './fields/TaskTitleField'
interface TaskEditDrawerProps {
    task: Task | null
    isOpen: boolean
    onOpenChange: (open: boolean) => void
}

export function TaskEditDrawer({
    task,
    isOpen,
    onOpenChange,
}: TaskEditDrawerProps) {
    const { t } = useTranslation('space')

    if (!task) return null

    return (
        <Drawer isOpen={isOpen} onOpenChange={onOpenChange}>
            <Drawer.Backdrop>
                <Drawer.Content placement="right" className="w-full max-w-md">
                    <Drawer.Dialog>
                        <Drawer.Header>
                            <Drawer.Heading>
                                {t('tasks.drawer.detailsTitle')}
                            </Drawer.Heading>
                        </Drawer.Header>
                        <Drawer.Body className="flex flex-col gap-5">
                            <TaskTitleField task={task} />
                            <TaskDescriptionField task={task} />
                            <TaskDueDateField task={task} />
                            <TaskStatusField task={task} />
                            <TaskAssigneeField task={task} />
                            {/**TODO: Task skills are not implemented yet */}
                            {/* <TaskSkillsField task={task} /> */}
                        </Drawer.Body>
                    </Drawer.Dialog>
                </Drawer.Content>
            </Drawer.Backdrop>
        </Drawer>
    )
}
