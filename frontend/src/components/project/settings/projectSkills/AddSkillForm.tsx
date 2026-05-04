import {
    Button,
    FieldError,
    Input,
    Label,
    Surface,
    TextArea,
    TextField,
    toast,
} from '@heroui/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAddProjectSkillMutation } from '../../../../store/features/project/project.api'

interface AddSkillFormProps {
    projectId: string
}

export function AddSkillForm({ projectId }: Readonly<AddSkillFormProps>) {
    const { t } = useTranslation('project')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [nameError, setNameError] = useState('')

    const [addSkill, { isLoading }] = useAddProjectSkillMutation()

    const handleSave = async () => {
        if (!name.trim()) {
            setNameError(t('skillsSettings.nameRequired'))
            return
        }

        try {
            await addSkill({
                projectId,
                body: {
                    name: name.trim(),
                    description: description.trim() || null,
                },
            }).unwrap()
            toast.success(t('skillsSettings.addSuccess'))
            setName('')
            setDescription('')
            setNameError('')
        } catch {
            toast.danger(t('skillsSettings.addError'))
        }
    }

    return (
        <Surface
            variant="secondary"
            className="flex flex-col gap-3 rounded-xl border p-4"
        >
            <TextField
                value={name}
                onChange={(val) => {
                    setName(val)
                    if (nameError) setNameError('')
                }}
                isInvalid={!!nameError}
                className="w-full"
            >
                <Label>
                    {t('skillsSettings.nameLabel')}
                    <span className="text-danger ml-1">*</span>
                </Label>
                <Input placeholder={t('skillsSettings.namePlaceholder')} />
                <FieldError>{nameError}</FieldError>
            </TextField>

            <TextField
                value={description}
                onChange={setDescription}
                className="w-full"
            >
                <Label>{t('skillsSettings.descriptionLabel')}</Label>
                <TextArea
                    rows={3}
                    placeholder={t('skillsSettings.descriptionPlaceholder')}
                />
                <FieldError />
            </TextField>

            <div className="flex">
                <Button
                    variant="primary"
                    size="sm"
                    onPress={handleSave}
                    isPending={isLoading}
                >
                    {t('skillsSettings.save')}
                </Button>
            </div>
        </Surface>
    )
}
