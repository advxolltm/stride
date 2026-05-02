import { Button, toast } from '@heroui/react'
import { useRef } from 'react'

interface ProfileAvatarUploadProps {
    avatarUrl: string | null
    avatarFile: File | null
    avatarRemoved: boolean
    onAvatarChange: (file: File | null) => void
    onAvatarRemove: () => void
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png']
const MAX_SIZE_BYTES = 2 * 1024 * 1024

export function ProfileAvatarUpload({
    avatarUrl,
    avatarFile,
    avatarRemoved,
    onAvatarChange,
    onAvatarRemove,
}: Readonly<ProfileAvatarUploadProps>) {
    const inputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!ALLOWED_TYPES.includes(file.type)) {
            toast.danger('Only JPG and PNG files are allowed')
            return
        }

        if (file.size > MAX_SIZE_BYTES) {
            toast.danger('File must be under 2MB')
            return
        }

        onAvatarChange(file)
    }

    const handleRemove = () => {
        if (inputRef.current) {
            inputRef.current.value = ''
        }
        onAvatarRemove()
    }

    const previewSrc = avatarRemoved
        ? null
        : avatarFile
          ? URL.createObjectURL(avatarFile)
          : avatarUrl

    return (
        <div className="border-border bg-surface flex items-center gap-4 rounded-xl border p-6">
            {previewSrc ? (
                <img
                    src={previewSrc}
                    alt="Profile avatar"
                    className="h-20 w-20 rounded-full"
                />
            ) : (
                <div className="bg-primary text-primary-foreground flex h-20 w-20 items-center justify-center rounded-full border text-xl font-semibold">
                    ?
                </div>
            )}

            <div className="flex flex-col gap-1">
                <p className="font-medium">Profile photo</p>
                <p className="text-muted-foreground text-sm">
                    Upload a new avatar (JPG, PNG up to 2MB)
                </p>

                <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={handleFileChange}
                />

                <div className="mt-2 flex gap-2">
                    <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => inputRef.current?.click()}
                    >
                        Change avatar
                    </Button>
                    {(avatarFile || (!avatarRemoved && avatarUrl)) && (
                        <Button
                            size="sm"
                            variant="ghost"
                            onPress={handleRemove}
                        >
                            Remove
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}
