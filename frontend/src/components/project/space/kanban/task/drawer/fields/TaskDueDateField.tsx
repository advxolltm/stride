import { useTranslation } from 'react-i18next'
import type { Task } from '../../../../../../../store/features/tasks/task.types'
import { TaskDateField } from './TaskDateField'

export function TaskDueDateField({ task }: Readonly<{ task: Task }>) {
    const { t } = useTranslation('space')

    return (
        <TaskDateField
            task={task}
            label={t('tasks.form.dueDate')}
            emptyLabel={t('tasks.form.noDueDate')}
            dateValue={task.dueDate}
            minDateValue={task.startDate}
            requestFieldName="due_date"
        />
    )
}
