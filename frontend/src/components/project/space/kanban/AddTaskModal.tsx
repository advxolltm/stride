import { Button, Modal } from '@heroui/react'
import { useState } from 'react'
import type { AssigneeOption, StatusOption } from './TaskFormFields'
import { TaskFormFields } from './TaskFormFields'
import type { Task, TaskStatus } from './types'
import { useTranslation } from 'react-i18next'

interface AddTaskModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    onSave: (task: Task) => void
    assignees: AssigneeOption[]
    labelOptions: string[]
    statusOptions: StatusOption[]
    defaultStatus?: TaskStatus
}

const DEFAULT_PROJECT_ID = 'p1'
const DEFAULT_CREATED_BY = 'u1'

function createTaskId() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID()
    }
    return `task-${Date.now()}`
}

export function AddTaskModal({
    isOpen,
    onOpenChange,
    onSave,
    assignees,
    labelOptions,
    statusOptions,
    defaultStatus = 'todo',
}: AddTaskModalProps) {
    const { t } = useTranslation('space')

    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [status, setStatus] = useState<TaskStatus>(defaultStatus)
    const [labels, setLabels] = useState<string[]>([])
    const [assigneeId, setAssigneeId] = useState('')

    function handleSave() {
        const assignee =
            assignees.find((option) => option.id === assigneeId) ?? assignees[0]

        if (!assignee) return

        const now = new Date().toISOString()
        const nextTask: Task = {
            id: createTaskId(),
            project_id: DEFAULT_PROJECT_ID,
            created_by: DEFAULT_CREATED_BY,
            title: title.trim(),
            description: description.trim() || undefined,
            status,
            position: 0,
            created_at: now,
            updated_at: now,
            assignee: {
                id: assignee.id,
                initials: assignee.initials,
                color: assignee.color,
            },
            labels: labels.length > 0 ? labels : [],
        }

        onSave(nextTask)
    }

    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Backdrop>
                <Modal.Container placement="auto">
                    <Modal.Dialog className="sm:max-w-md">
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading>
                                {t('tasks.modal.createTitle')}
                            </Modal.Heading>
                            <p className="text-muted mt-1 text-sm">
                                {t('tasks.modal.description')}
                            </p>
                        </Modal.Header>
                        <Modal.Body className="p-1">
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
                        </Modal.Body>
                        <Modal.Footer>
                            <Button
                                variant="ghost"
                                onPress={() => onOpenChange(false)}
                            >
                                {t('tasks.modal.cancel')}
                            </Button>
                            <Button
                                onPress={handleSave}
                                isDisabled={
                                    title.trim().length === 0 ||
                                    assignees.length === 0
                                }
                            >
                                {t('tasks.actions.add')}
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    )
}
