import { Avatar, Button } from '@heroui/react'

export function AvatarSection() {
    return (
        <div className="border-border bg-surface flex items-center gap-4 rounded-xl border p-6">
            <Avatar className="bg-primary text-primary-foreground" size="lg" />

            <div className="flex flex-col gap-1">
                <p className="font-medium">Profile photo</p>
                <p className="text-muted-foreground text-sm">
                    Upload a new avatar (JPG, PNG up to 2MB)
                </p>

                <Button size="sm" variant="ghost" className="mt-2 w-fit">
                    Change avatar
                </Button>
            </div>
        </div>
    )
}
