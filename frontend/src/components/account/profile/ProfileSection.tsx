import { ProfileAvatarUpload } from './ProfileAvatarUpload'
import { ProfileDetailsForm } from './ProfileDetailsForm'

export function ProfileSection() {
    return (
        <div className="flex flex-col gap-6">
            <ProfileAvatarUpload />
            <ProfileDetailsForm />
        </div>
    )
}
