import { TaskView } from "../taskview/TaskView";
import { ChatView } from "../chatview/ChatView";

export function WsView() {
    return (
        <div>
            <ChatView />
            <TaskView />
        </div>
    );
}
