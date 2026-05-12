import datetime
from dataclasses import dataclass
from typing import List, Tuple
from ortools.sat.python import cp_model

# --- Models ---
@dataclass
class Skill:
    name: str

@dataclass
class User:
    name: str
    skills: List[Skill]
    weekly_hours: int

@dataclass
class Task:
    name: str
    start_at: datetime.datetime
    due_at: datetime.datetime
    expected_hours: int
    needed_skills: List[Skill]

# --- Helper Functions ---
def user_has_skills(user: User, task: Task) -> bool:
    """Checks if a user has all the skills required for a task."""
    user_skill_names = {skill.name for skill in user.skills}
    for required_skill in task.needed_skills:
        if required_skill.name not in user_skill_names:
            return False
    return True

def full_working_weeks_until_date(planning_start: datetime.datetime, target_date: datetime.datetime) -> int:
    """Calculates full weeks between two dates."""
    diff = target_date - planning_start
    return diff.days // 7


# --- The Main Scheduler ---
def schedule_tasks_to_members(users: List[User], tasks: List[Task]) -> List[Tuple[User, Task]]:
    if not users or not tasks:
        print("Need at least one user and one task.")
        return []

    model = cp_model.CpModel()
    num_members = len(users)
    num_tasks = len(tasks)

    # 
    timeframe_start = min(tasks, key=lambda t: t.start_at).start_at

    # 2D list to store the presence variables [User][Task]
    job_assignment_presence = []

    for i, user in enumerate(users):
        member_jobs = []
        member_job_presences = []

        for j, task in enumerate(tasks):
            if user_has_skills(user, task):
                # Calculate weeks
                weeks_before_task = full_working_weeks_until_date(timeframe_start, task.start_at)
                weeks_before_end = full_working_weeks_until_date(timeframe_start, task.due_at)

                time_left_in_week = (5 - min(task.start_at.weekday(), 5)) * 8
                # min start measures how much of their work time has passed at minimum when they can start the task
                min_start = (weeks_before_task * user.weekly_hours) + max(0, user.weekly_hours - time_left_in_week)
                
                # Python's weekday(): Mon=0, Sun=6 (Matches your Go logic exactly)
                day_idx = min(task.due_at.weekday()+1, 5)
                max_end = (weeks_before_end * user.weekly_hours) + min(8 * day_idx, user.weekly_hours)
                
                # Safeguard: Ensure max_end isn't smaller than min_start (prevents OR-Tools domain crash)
                max_end = max(min_start, max_end)

                # Create variables
                presence_var = model.NewBoolVar(f"present_job_{i}_{j}")
                start_var = model.NewIntVar(min_start, max_end, f"start_{i}_{j}")
                end_var = model.NewIntVar(min_start, max_end, f"end_{i}_{j}")
                duration = task.expected_hours

                # print(f"start: {min_start}, end: {max_end}, duration: {task.expected_hours}")

                # Create Optional Interval
                job = model.NewOptionalIntervalVar(
                    start_var, duration, end_var, presence_var, f"job_{i}_{j}"
                )
                
                member_jobs.append(job)
                member_job_presences.append(presence_var)

            else:
                # User lacks skills, force presence to False
                false_var = model.NewBoolVar(f"no_skill_{i}_{j}")
                model.Add(false_var == 0)
                member_job_presences.append(false_var)

        # Constraint: User cannot do two things at exactly the same time
        if member_jobs:
            model.AddNoOverlap(member_jobs)

        job_assignment_presence.append(member_job_presences)

    # Constraint: Each task is assigned to AT MOST one member
    for j in range(num_tasks):
        task_presences = [job_assignment_presence[i][j] for i in range(num_members)]
        model.AddAtMostOne(task_presences)

    # Objective: Maximize assigned tasks
    all_assignments = [
        job_assignment_presence[i][j] 
        for i in range(num_members) for j in range(num_tasks)
    ]
    model.Maximize(sum(all_assignments))

    # --- SOLVE ---
    solver = cp_model.CpSolver()
    status = solver.Solve(model)

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        res: List[Tuple[User, Task]] = []
        dbg(f"\nFeasible solution found! Status: {solver.StatusName(status)}")
        dbg("-" * 30)
        
        for i, user in enumerate(users):
            for j, task in enumerate(tasks):
                # Check if the solver set this assignment to True (1)
                if solver.Value(job_assignment_presence[i][j]):
                    # print(f"Assigned Task: '{task.name}' -> Member: '{user.name}'")
                    res.append((user, task))
                    
        dbg("-" * 30)
        dbg(f"Total tasks successfully assigned: {int(solver.ObjectiveValue())} out of {num_tasks}\n")
        return res
    else:
        dbg("\nNo solution found (INFEASIBLE).\n")
        return []


DEBUG = False

def dbg(msg):
    if DEBUG:
        print(msg)

if __name__ == "__main__":
    now = datetime.datetime.now()

    # Skills
    go_skill = Skill(name="Go")
    db_skill = Skill(name="Database")
    react_skill = Skill(name="React")

    # Users
    alice = User(name="Alice", skills=[go_skill], weekly_hours=40)
    bob = User(name="Bob", skills=[go_skill, db_skill], weekly_hours=40)

    print("=== TEST 1: Feasible Schedule ===")
    tasks_feasible = [
        Task("Write API", now, now + datetime.timedelta(days=7), 20, [go_skill]),
        Task("Setup DB", now, now + datetime.timedelta(days=7), 15, [db_skill]),
    ]
    schedule_tasks_to_members([alice, bob], tasks_feasible)


    print("=== TEST 2: Infeasible (Missing Skills) ===")
    tasks_missing_skills = [
        Task("Build Frontend", now, now + datetime.timedelta(days=7), 20, [react_skill]),
    ]
    schedule_tasks_to_members([alice, bob], tasks_missing_skills)


    print("=== TEST 3: Infeasible (Too much work for one person) ===")
    # Bob is the only one with DB skills, but 100 hours doesn't fit in his 40 hour week constraint logic
    tasks_too_much = [
        Task("Massive DB Migration", now, now + datetime.timedelta(days=7), 1000, [db_skill]),
    ]
    schedule_tasks_to_members([alice, bob], tasks_too_much)

    print("=== TEST 4: Task starts earlier in week ===")
    tasks_feasible = [
        Task("Write API", now - datetime.timedelta(days=5), now + datetime.timedelta(days=7), 20, [go_skill]),
        Task("Setup DB", now - datetime.timedelta(days=2), now + datetime.timedelta(days=7), 15, [db_skill]),
    ]
    schedule_tasks_to_members([alice, bob], tasks_feasible)

    print("=== TEST 5: Task with no required skills === ")
    t5users = [User(name='0', skills=[], weekly_hours=0), User(name='wario-0', skills=[Skill(name='sM]'), Skill(name='0'), Skill(name='0sM]0')], weekly_hours=71)] 

    t5tasks = [Task(name='0', start_at=datetime.datetime(2026, 1, 1, 0, 0, 0, 2026, fold=1), due_at=datetime.datetime(2026, 1, 2, 0, 0, 0, 2026), expected_hours=0, needed_skills=[]), Task(name='wario-task-0', start_at=datetime.datetime(2026, 1, 1, 0, 1, 0, 2026), due_at=datetime.datetime(2026, 1, 2, 0, 1, 0, 2026), expected_hours=0, needed_skills=[Skill(name='0sM]0')]), Task(name='wario-task-\x16', start_at=datetime.datetime(2026, 8, 15, 19, 0, 23, 189627), due_at=datetime.datetime(2026, 9, 26, 21, 28, 4, 29648), expected_hours=0, needed_skills=[Skill(name='0sM]0')]), Task(name='wario-task-)\r2 8ML=', start_at=datetime.datetime(2026, 12, 18, 3, 45, 48, 972240), due_at=datetime.datetime(2027, 1, 1, 0, 0, fold=1), expected_hours=12, needed_skills=[Skill(name='0sM]0')]), Task(name='wario-task-.X]d\x15', start_at=datetime.datetime(2026, 5, 8, 1, 52, 59, 968696), due_at=datetime.datetime(2027, 1, 1, 0, 0, fold=1), expected_hours=1, needed_skills=[Skill(name='0sM]0')]), Task(name='wario-task-\x00Fx', start_at=datetime.datetime(2026, 4, 1, 8, 33, 23, 256779, fold=1), due_at=datetime.datetime(2026, 8, 22, 8, 59, 34, 294834, fold=1), expected_hours=0, needed_skills=[Skill(name='0sM]0')]), Task(name='wario-task-\x16`', start_at=datetime.datetime(2026, 3, 19, 12, 28, 58, 307065), due_at=datetime.datetime(2026, 4, 10, 10, 54, 34, 116022, fold=1), expected_hours=11, needed_skills=[Skill(name='0sM]0')]), Task(name='wario-task-\x05wt\x01n\x16P_?%+', start_at=datetime.datetime(2026, 7, 18, 11, 40, 30, 659157, fold=1), due_at=datetime.datetime(2026, 9, 17, 1, 25, 11, 891265), expected_hours=12, needed_skills=[Skill(name='0sM]0')]), Task(name='wario-task->', start_at=datetime.datetime(2026, 7, 17, 16, 28, 40, 466783), due_at=datetime.datetime(2026, 8, 27, 9, 49, 26, 805145, fold=1), expected_hours=14, needed_skills=[Skill(name='0sM]0')]), Task(name='wario-task-s+C;', start_at=datetime.datetime(2026, 2, 26, 2, 12, 17, 772252), due_at=datetime.datetime(2026, 5, 8, 6, 54, 1, 179209), expected_hours=2, needed_skills=[Skill(name='0sM]0')]), Task(name='wario-task-\x18ptX\x1c', start_at=datetime.datetime(2026, 12, 26, 10, 13, 19, 521798), due_at=datetime.datetime(2027, 1, 1, 0, 0), expected_hours=5, needed_skills=[Skill(name='0sM]0')]), Task(name='wario-task-\x03[MaDI*Sx;AFY~[%', start_at=datetime.datetime(2026, 2, 25, 3, 51, 53, 32703, fold=1), due_at=datetime.datetime(2027, 1, 1, 0, 0), expected_hours=13, needed_skills=[Skill(name='0sM]0')])]

    # tasks_feasible = [
    #     Task("Write API", now, now + datetime.timedelta(days=7), 20, []),
    #     Task("Setup DB", now, now + datetime.timedelta(days=7), 15, []),
    # ]
    schedule_tasks_to_members(t5users, t5tasks)
