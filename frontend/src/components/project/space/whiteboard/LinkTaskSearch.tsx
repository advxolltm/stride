import { ListBox, SearchField } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Task } from "../../../../store/features/tasks/task.types";
import { useGetTasksForProjectQuery } from "../../../../store/features/tasks/task.api";
import { useParams } from "react-router-dom";

function taskMatchesSearch(task: Task, query: string): boolean {
    if (!query) {
        return true;
    }

    const searchableText = [
        task.title,
        task.description,
        ...((task.assignees ?? []).flatMap((assignee) => [
            assignee.user.fullName,
            assignee.user.username,
            assignee.user.email,
        ])),
        ...((task.skills ?? []).flatMap((skill) => [
            skill.name,
            skill.description,
        ])),
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    return searchableText.includes(query.toLowerCase());
}

interface LinkTaskSearchProps {
    onSelect: (task: Task) => void,
}

export default function LinkTaskSearch({
    onSelect
}: LinkTaskSearchProps) {
    const { t } = useTranslation('space');
    const [taskSearch, setTaskSearch] = useState('');
    const { projectId } = useParams();
    const { data: tasks = [], isLoading: isTasksLoading } =
        useGetTasksForProjectQuery(projectId!);

    if (isTasksLoading) {
        return (
            <div>Loading...</div>
        );
    }

    const filteredTasks = tasks.filter(t => taskMatchesSearch(t, taskSearch));

    return (
        <div className="flex flex-col h-full">
            <SearchField
                name="task-search"
                value={taskSearch}
                onChange={setTaskSearch}
                aria-label={t('tasks.actions.searchTasks')}
            >
                <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input
                        placeholder={t('tasks.actions.searchTasks')}
                    />
                    <SearchField.ClearButton />
                </SearchField.Group>
            </SearchField>
			<div className="max-h-100 overflow-y-auto">
				<ListBox
					items={filteredTasks}
					onAction={(key) => {
						const selectedTask = filteredTasks.find(t => t.id === key);

						if (selectedTask) {
							onSelect(selectedTask);
						}
					}}
				>
					{(task) => (
						<ListBox.Item key={task.id}>
							{task.title}
						</ListBox.Item>
					)}
				</ListBox>
			</div>
        </div>
    );
}
