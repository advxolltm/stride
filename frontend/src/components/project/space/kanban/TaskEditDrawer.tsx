import { Button, Drawer } from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AssigneeOption, StatusOption } from './TaskFormFields'
import { TaskFormFields } from './TaskFormFields'
import type { Task, TaskStatus } from './types'

interface TaskEditDrawerProps {
    task: Task | null
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    onSave: (task: Task) => void
    assignees: AssigneeOption[]
    labelOptions: string[]
    statusOptions: StatusOption[]
}

export function TaskEditDrawer({
    task,
    isOpen,
    onOpenChange,
    onSave,
    assignees,
    labelOptions,
    statusOptions,
}: TaskEditDrawerProps) {
    const { t } = useTranslation('space')

    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [status, setStatus] = useState<TaskStatus>('todo')
    const [labels, setLabels] = useState<string[]>([])
    const [assigneeId, setAssigneeId] = useState<string>('')

    function handleSave() {
        if (!task) return
        const nextAssignee =
            assignees.find((option) => option.id === assigneeId) ??
            task.assignee

        const nextTask: Task = {
            ...task,
            title: title.trim(),
            description: description.trim() || undefined,
            status,
            labels: labels.length > 0 ? labels : [],
            assignee: {
                id: nextAssignee.id,
                initials: nextAssignee.initials,
                color: nextAssignee.color,
            },
        }

        onSave(nextTask)
    }

    return (
        <Drawer isOpen={isOpen} onOpenChange={onOpenChange}>
            <Drawer.Backdrop>
                <Drawer.Content placement="right" className="w-full max-w-md">
                    <Drawer.Dialog>
                        <Drawer.CloseTrigger />
                        <Drawer.Header>
                            <Drawer.Heading>{t('tasks.drawer.detailsTitle')}</Drawer.Heading>
                        </Drawer.Header>
                        <Drawer.Body>
                            <TaskFormFields
                                title={title}
                                onTitleChange={setTitle}
                                description={description}
                                onDescriptionChange={setDescription}
                                status={status}
                                onStatusChange={setStatus}
                                labels={labels}
                                onLabelsChange={setLabels}
                                assigneeId={assigneeId}
                                onAssigneeChange={setAssigneeId}
                                assignees={assignees}
                                labelOptions={labelOptions}
                                statusOptions={statusOptions}
                            />
                        </Drawer.Body>
                        <Drawer.Footer>
                            <Button
                                variant="ghost"
                                onPress={() => onOpenChange(false)}
                            >
                                {t('tasks.drawer.cancel')}
                            </Button>
                            <Button
                                onPress={handleSave}
                                isDisabled={!task || title.trim().length === 0}
                            >
                                {t('tasks.drawer.save')}
                            </Button>
                        </Drawer.Footer>
                    </Drawer.Dialog>
                </Drawer.Content>
            </Drawer.Backdrop>
        </Drawer>
    )
}
