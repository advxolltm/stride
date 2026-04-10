import { AvatarSection } from './AvatarSection'
import { PersonalInfoForm } from './PersonalInfoForm'

export function ProfileTab() {
    return (
        <div className="flex flex-col gap-6">
            <AvatarSection />
            <PersonalInfoForm />
        </div>
    )
}
