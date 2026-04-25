// ChatView.tsx
import { useSelector } from "react-redux";
import { type RootState } from "../../store/store";

export function ChatView() {
  const messages = useSelector((state: RootState) => state.chat.messages);

  return (
    <div>
      <h2>Chat</h2>
      {messages.map((m, idx) => (
		<p key={idx}>{m}</p>
      ))}
    </div>
  );
}
