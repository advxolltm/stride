import {
    Button,
    FieldError,
    Input,
    Label,
    ListBox,
    Select,
    TextArea,
    TextField,
} from '@heroui/react'
import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const AVAILABLE_SKILLS = [
    'React',
    'TypeScript',
    'Design',
    'Vue',
    'Node.js',
    'Python',
    'Figma',
]

export function GeneralSettings({ isOwner }: { isOwner: boolean }) {
    const { t } = useTranslation('project')

    const [isEditing, setIsEditing] = useState(false)

    const [name, setName] = useState('Marketing Campaign Q2')
    const [description, setDescription] = useState(
        'A collaborative project for the team to plan, organize, and execute together.',
    )

    const [skills, setSkills] = useState(['React', 'TypeScript', 'Design'])

    return (
        <div className="flex flex-col gap-8 p-2">
            <div className="flex items-center justify-between">
                <h2
                    className="text-base font-semibold"
                    style={{ color: 'var(--overlay-foreground)' }}
                >
                    {t('generalSettings.title')}
                </h2>

                {isOwner && !isEditing && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => setIsEditing(true)}
                        className="gap-1.5"
                        style={{ color: 'var(--muted)' }}
                    >
                        <Pencil size={13} />
                        {t('generalSettings.edit')}
                    </Button>
                )}
            </div>

            {!isEditing ? (
                <div className="space-y-5">
                    <div>
                        <p
                            className="mb-1 text-xs"
                            style={{ color: 'var(--muted)' }}
                        >
                            {t('generalSettings.projectName')}
                        </p>
                        <p className="text-sm">{name}</p>
                    </div>

                    <div>
                        <p
                            className="mb-1 text-xs"
                            style={{ color: 'var(--muted)' }}
                        >
                            {t('generalSettings.projectDescription')}
                        </p>
                        <p className="text-sm leading-relaxed">{description}</p>
                    </div>

                    <div>
                        <p
                            className="mb-2 text-xs"
                            style={{ color: 'var(--muted)' }}
                        >
                            {t('generalSettings.skills')}
                        </p>

                        <div className="flex flex-wrap gap-2">
                            {skills.map((skill) => (
                                <span
                                    key={skill}
                                    className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
                                    style={{
                                        background: 'var(--surface-secondary)',
                                        color: 'var(--surface-secondary-foreground)',
                                    }}
                                >
                                    {skill}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    <TextField
                        value={name}
                        onChange={setName}
                        className="w-full"
                    >
                        <Label>{t('generalSettings.nameLabel')}</Label>
                        <Input variant="secondary" />
                        <FieldError />
                    </TextField>

                    <TextField
                        value={description}
                        onChange={setDescription}
                        className="w-full"
                    >
                        <Label>{t('generalSettings.descriptionLabel')}</Label>
                        <TextArea variant="secondary" rows={3} />
                        <FieldError />
                    </TextField>

                    <Select
                        variant="secondary"
                        className="w-full"
                        placeholder={t('generalSettings.skillsPlaceholder')}
                        selectionMode="multiple"
                    >
                        <Label>{t('generalSettings.projectSkills')}</Label>

                        <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                        </Select.Trigger>

                        <Select.Popover>
                            <ListBox
                                selectionMode="multiple"
                                selectedKeys={new Set(skills)}
                                onSelectionChange={(keys) =>
                                    setSkills(Array.from(keys) as string[])
                                }
                                className="rounded-lg border"
                                style={{ borderColor: 'var(--border)' }}
                            >
                                {AVAILABLE_SKILLS.map((skill) => (
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

                    <div className="flex gap-2 pt-1">
                        <Button
                            variant="outline"
                            size="sm"
                            onPress={() => setIsEditing(false)}
                        >
                            {t('generalSettings.cancel')}
                        </Button>

                        <Button
                            variant="primary"
                            size="sm"
                            onPress={() => setIsEditing(false)}
                        >
                            {t('generalSettings.save')}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
