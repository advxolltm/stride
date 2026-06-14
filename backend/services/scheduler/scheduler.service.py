import datetime
import msgspec
from typing import List
from ortools.sat.python import cp_model
import logging
import uuid
import http.server
import socketserver

LOGGER = logging.getLogger("SimpleLogger")
#logging.basicConfig(filename='myapp.log', level=logging.INFO)
LOGGER.setLevel(logging.DEBUG)

PORT = 7270
class Skill(msgspec.Struct):
    identifier: uuid.UUID
    name: str

class User(msgspec.Struct):
    identifier: uuid.UUID
    name: str
    skills: List[Skill]
    weekly_hours: int

class Task(msgspec.Struct):
    identifier: uuid.UUID
    name: str
    start_at: datetime.datetime
    due_at: datetime.datetime
    expected_hours: int
    needed_skills: List[Skill]

class Assignment(msgspec.Struct):
    user_id: uuid.UUID
    task_id: uuid.UUID

class InputPayload(msgspec.Struct):
    users: List[User]
    tasks: List[Task]
    assignments: List[Assignment]


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


def schedule_tasks_to_members(users: List[User], tasks: List[Task], assignments: List[Assignment]):
    SCALING_FACTOR = 1000
    if not users or not tasks:
        LOGGER.info("Need at least one user and one task.")
        return

    model = cp_model.CpModel()
    num_members = len(users)
    num_tasks = len(tasks)

    last_max_end = 0.0

    timeframe_start = min(tasks, key=lambda t: t.start_at).start_at
    timeframe_start = timeframe_start - datetime.timedelta(days=timeframe_start.weekday())

    job_assignment_presence = []
    user_interval_vars = []
    task_ending_times = []

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

                day_idx = min(task.due_at.weekday()+1, 5)
                max_end = (weeks_before_end * user.weekly_hours) + min(8 * day_idx, user.weekly_hours)

                # Find the value on the largest max_end normalized by working hours
                if float(max_end)/float(user.weekly_hours) > last_max_end:
                    last_max_end = float(max_end)/float(user.weekly_hours)

                # Create variables
                presence_var = model.NewBoolVar(f"present_job_{i}_{j}")
                start_var = model.NewIntVar(min_start, max_end, f"start_{i}_{j}")
                end_var = model.NewIntVar(min_start, max_end, f"end_{i}_{j}")
                duration = task.expected_hours

                # Loop over preexisting assignments and force them to be in the timeline for the assigned user
                for assignment in assignments:
                    if assignment.task_id == task.identifier and assignment.user_id == user.identifier:
                        model.Add(presence_var == 1)

                # Find the last end time for MAKESPAN calculation
                scaled_end = model.NewIntVar(0, max_end * SCALING_FACTOR, f"scaled_end_{i}_{j}")
                model.Add(scaled_end == end_var * SCALING_FACTOR)

                normalized_scaled_end = model.NewIntVar(0, max_end * SCALING_FACTOR, f"norm_end_scaled_{i}_{j}")
                model.AddDivisionEquality(normalized_scaled_end, scaled_end, user.weekly_hours)

                task_ending_times.append(normalized_scaled_end)

                LOGGER.info(f"start: {min_start}, end: {max_end}, duration: {task.expected_hours}")

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
        
        user_interval_vars.append(member_jobs)

        job_assignment_presence.append(member_job_presences)

    # Constraint: max one member per task
    for j in range(num_tasks):
        task_presences = [job_assignment_presence[i][j] for i in range(num_members)]
        model.AddAtMostOne(task_presences)

    # Objective: assign the most tasks possible
    all_assignments = [
        job_assignment_presence[i][j]
        for i in range(num_members) for j in range(num_tasks)
    ]

    # num_worked_per_user = [
    #     sum([presence * tasks[j].expected_hours
    #     for j, presence in enumerate(job_assignment_presence[i])])/users[i].weekly_hours
    #     for i in range(num_members)
    # ]

    max_ending_time = model.NewIntVar(0, int(last_max_end * SCALING_FACTOR+1), "max_ending_time")
    model.AddMaxEquality(max_ending_time, task_ending_times)

    # The max makes span is at (most last_max_end * SCALING_FACTOR+1) meaning each extra task assigned needs to add more than that to the Objective function to ensure that more tasks is always preferred
    model.Maximize(sum(all_assignments)*int(last_max_end * SCALING_FACTOR+2) - max_ending_time)

    #model.Maximize(sum(all_assignments))

    solver = cp_model.CpSolver()
    status = solver.Solve(model)

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        schedule_result = []
        for i, user in enumerate(users):
            for j, task in enumerate(tasks):
                # Check if the solver set this assignment to True (1)
                if solver.Value(job_assignment_presence[i][j]):
                    schedule_result.append(Assignment(user.identifier, task.identifier))
        return schedule_result
    else:
        return []

def testing():
    now = datetime.datetime.now()

    # Skills
    go_skill = Skill(identifier=uuid.uuid4(), name="Go")
    db_skill = Skill(identifier=uuid.uuid4(), name="Database")
    react_skill = Skill(identifier=uuid.uuid4(), name="React")

    # Users
    alice = User(identifier=uuid.uuid4(), name="Alice", skills=[go_skill], weekly_hours=40)
    bob = User(identifier=uuid.uuid4(), name="Bob", skills=[go_skill, db_skill], weekly_hours=40)

    LOGGER.info("=== TEST 1: Feasible Schedule ===")
    tasks_feasible = [
        Task(uuid.uuid4(), "Write API", now, now + datetime.timedelta(days=7), 20, [go_skill]),
        Task(uuid.uuid4(), "Setup DB", now, now + datetime.timedelta(days=7), 15, [db_skill]),
    ]
    schedule_tasks_to_members([alice, bob], tasks_feasible, [])


    LOGGER.info("=== TEST 2: Infeasible (Missing Skills) ===")
    tasks_missing_skills = [
        Task(uuid.uuid4(), "Build Frontend", now, now + datetime.timedelta(days=7), 20, [react_skill]),
    ]
    schedule_tasks_to_members([alice, bob], tasks_missing_skills, [])


    LOGGER.info("=== TEST 3: Infeasible (Too much work for one person) ===")
    # Bob is the only one with DB skills, but 1000 hours doesn't fit in his 40 hour week constraint logic
    tasks_too_much = [
        Task(uuid.uuid4(), "Massive DB Migration", now, now + datetime.timedelta(days=7), 1000, [db_skill]),
    ]
    schedule_tasks_to_members([alice, bob], tasks_too_much, [])

    LOGGER.info("=== TEST 4: Task starts earlier in week ===")
    tasks_feasible = [
        Task(uuid.uuid4(), "Write API", now - datetime.timedelta(days=5), now + datetime.timedelta(days=7), 20, [go_skill]),
        Task(uuid.uuid4(), "Setup DB", now - datetime.timedelta(days=2), now + datetime.timedelta(days=7), 15, [db_skill]),
    ]
    schedule_tasks_to_members([alice, bob], tasks_feasible, [])

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        
        post_data = self.rfile.read(content_length)
        
        LOGGER.info(f"Received POST data: {post_data.decode('utf-8')}")

        try:
            payload = msgspec.json.decode(post_data, type=InputPayload)


            LOGGER.info(f"Payload: {payload}")
            
            schedule = schedule_tasks_to_members(payload.users, payload.tasks, payload.assignments) # returns List[Assignment]
            resp = msgspec.json.encode(schedule)

            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            
            self.wfile.write(resp)

        except msgspec.ValidationError as e:
            LOGGER.info(f"Error: {e}")
            self.send_response(400)
            self.end_headers()
            self.wfile.write(f"Validation Error: {e}".encode())

if __name__ == "__main__":
    Handler = http.server.SimpleHTTPRequestHandler

    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        LOGGER.info(f"Serving at port {PORT}")
        httpd.serve_forever()
    
