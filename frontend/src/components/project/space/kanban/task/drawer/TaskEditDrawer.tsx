import { Drawer } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import type { Task } from '../../../../../../store/features/tasks/task.types'
import { TaskAssigneeField } from './fields/TaskAssigneeField'
import { TaskDescriptionField } from './fields/TaskDescriptionField'
import { TaskDueDateField } from './fields/TaskDueDateField'
import { TaskSkillsField } from './fields/TaskSkillsField'
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
                <Drawer.Content placement="right">
                    <Drawer.Dialog className="w-full max-w-md">
                        <Drawer.CloseTrigger />
                        <Drawer.Header>
                            <Drawer.Heading>
                                {t('tasks.drawer.detailsTitle')}
                            </Drawer.Heading>
                        </Drawer.Header>
                        <Drawer.Body className="flex flex-col gap-5">
                            <TaskTitleField
                                key={`${task.id}:${task.title}`}
                                task={task}
                            />
                            <TaskDescriptionField task={task} />
                            <TaskDueDateField
                                key={`${task.id}:${task.dueDate ?? ''}`}
                                task={task}
                            />
                            <TaskStatusField task={task} />
                            <TaskAssigneeField task={task} />
                            <TaskSkillsField task={task} />
                        </Drawer.Body>
                    </Drawer.Dialog>
                </Drawer.Content>
            </Drawer.Backdrop>
        </Drawer>
    )
}
