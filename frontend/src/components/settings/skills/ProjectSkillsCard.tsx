import { Chip, Label, ListBox, Select } from '@heroui/react'

interface ProjectSkillsCardProps {
    project: {
        id: string
        name: string
        skills: string[]
        selected: string[]
    }
    onChange: (values: string[]) => void
}

export  function ProjectSkillsCard({
    project,
    onChange,
}: ProjectSkillsCardProps) {
    return (
        <div className="border-border bg-surface rounded-xl border p-4">
            <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium">{project.name}</h3>

                <span className="text-muted-foreground text-xs">
                    {project.selected.length} / {project.skills.length} selected
                </span>
            </div>

            <Select
                variant="secondary"
                selectionMode="multiple"
                value={project.selected}
                placeholder="Select skills"
            >
                <Label>Select skills</Label>

                <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                </Select.Trigger>

                <Select.Popover>
                    <ListBox
                        selectionMode="multiple"
                        selectedKeys={new Set(project.selected)}
                        onSelectionChange={(keys) =>
                            onChange(Array.from(keys) as string[])
                        }
                    >
                        {project.skills.map((skill) => (
                            <ListBox.Item
                                key={skill}
                                id={skill}
                                textValue={skill}
                            >
                                {skill}
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                        ))}
                    </ListBox>
                </Select.Popover>
            </Select>

            <div className="mt-3 flex flex-wrap gap-2">
                {project.selected.map((skill) => (
                    <Chip
                        key={skill}
                        variant="secondary"
                        color="accent"
                        className="cursor-pointer"
                        onClick={() =>
                            onChange(
                                project.selected.filter((s) => s !== skill),
                            )
                        }
                    >
                        {skill} ✕
                    </Chip>
                ))}
            </div>
        </div>
    )
}
