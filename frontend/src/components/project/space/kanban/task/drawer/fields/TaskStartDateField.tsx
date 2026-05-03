import { useTranslation } from 'react-i18next'
import type { Task } from '../../../../../../../store/features/tasks/task.types'
import { TaskDateField } from './TaskDateField'

export function TaskStartDateField({ task }: Readonly<{ task: Task }>) {
    const { t } = useTranslation('space')

    return (
        <TaskDateField
            task={task}
            label={t('tasks.form.startDate')}
            emptyLabel={t('tasks.form.noStartDate')}
            dateValue={task.startDate}
            maxDateValue={task.dueDate}
            requestFieldName="start_date"
        />
    )
}
