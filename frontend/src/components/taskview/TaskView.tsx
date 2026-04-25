// TaskList.tsx
import { useSelector } from "react-redux";
import { type RootState } from "../../store/store";

export function TaskView() {
  const tasks = useSelector((state: RootState) => state.tasks);

  return (
    <div>
      <h2>Tasks</h2>
      {tasks.map((t) => (
	  	<p key={t.id}>{t.title} -- {t.description}</p>
      ))}
    </div>
  );
}
