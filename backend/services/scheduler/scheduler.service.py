import os
import datetime
import msgspec
from typing import List, Literal
from ortools.sat.python import cp_model
import logging
import uuid
import http.server
import time
import socketserver

logging.basicConfig(level=logging.DEBUG)
LOGGER = logging.getLogger("SimpleLogger")
#logging.basicConfig(filename='myapp.log', level=logging.INFO)
LOGGER.setLevel(logging.DEBUG)


def get_env_int(s: str, default: int) -> int:
    value = os.environ.get(s)
    if value is None:
        return default

    try:
        return int(value)
    except ValueError:
        return default


MAX_ALLOWED_TIMEOUT_SECONDS = get_env_int("SCHED_MAX_ALLOWED_TIMEOUT_SECONDS", 60)


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


class Settings(msgspec.Struct):
    """
    optimization_goals:
        Optimizes the scheduling according to the provided goals.
        Priority of the goals is implied by their order.
        The possible goals are:
            - 'min-makespan': Schedules such that the planned end of the last task is as early as possible
            - 'distribute-evenly': Schedules such that each person has as close to the same *relative* amount of work as possible
                Concretely, the relative amount of work for some person p is calculated as:
                    assigned_tasks[p].hours / p.weekly_hours
                In other words, a person with more weekly working hours should get proportionally more task-hours assigned compared to a person with less weekly working hours.
                Note: The scheduler can only approximate the relative workload since only whole integer solutions are possible!
            - 'max-tasks-scheduled': Schedules such that the number of tasks scheduled is maximized
            - 'max-hours-scheduled': Schedules such taht the number of task-hours scheduled is maximized

    timeout_seconds: The scheduler will stop after the given amount of seconds (or earlier if an optimal solution was already found) and return the current best solution it found
    """

    optimization_goals: List[
        Literal[
            "min-makespan",
            "distribute-evenly",
            "max-tasks-scheduled",
            "max-hours-scheduled",
        ]
    ]
    timeout_seconds: int = MAX_ALLOWED_TIMEOUT_SECONDS


class InputPayload(msgspec.Struct):
    users: List[User]
    tasks: List[Task]
    assignments: List[Assignment]
    settings: Settings


def user_has_skills(user: User, task: Task) -> bool:
    """Checks if a user has all the skills required for a task."""
    user_skill_names = {skill.name for skill in user.skills}
    for required_skill in task.needed_skills:
        if required_skill.name not in user_skill_names:
            return False
    return True


def full_working_weeks_until_date(
    planning_start: datetime.datetime, target_date: datetime.datetime
) -> int:
    """Calculates full weeks between two dates."""
    diff = target_date - planning_start
    return diff.days // 7


def schedule_tasks_to_members(
    users: List[User],
    tasks: List[Task],
    assignments: List[Assignment],
    settings: Settings,
) -> list[Assignment]:
    if not users or not tasks:
        LOGGER.info("Need at least one user and one task.")
        return []

    model = cp_model.CpModel()
    num_members = len(users)
    num_tasks = len(tasks)

    last_max_end = 0.0

    timeframe_start = min(tasks, key=lambda t: t.start_at).start_at
    timeframe_start = timeframe_start - datetime.timedelta(
        days=timeframe_start.weekday()
    )

    job_assignment_presence = []
    user_interval_vars = []
    task_ending_times = []

    preassignments = []
    preassignments_map: dict[int, tuple[int, int]] = {}

    for i, user in enumerate(users):
        member_jobs = []
        member_job_presences = []

        for j, task in enumerate(tasks):
            if user_has_skills(user, task):
                # Calculate weeks
                weeks_before_task = full_working_weeks_until_date(
                    timeframe_start, task.start_at
                )
                weeks_before_end = full_working_weeks_until_date(
                    timeframe_start, task.due_at
                )

                time_left_in_week = (5 - min(task.start_at.weekday(), 5)) * 8

                # min start measures how much of their work time has passed at minimum when they can start the task
                min_start = (weeks_before_task * user.weekly_hours) + max(
                    0, user.weekly_hours - time_left_in_week
                )

                day_idx = min(task.due_at.weekday() + 1, 5)
                max_end = (weeks_before_end * user.weekly_hours) + min(
                    8 * day_idx, user.weekly_hours
                )

                # Find the value on the largest max_end normalized by working hours
                if float(max_end) / float(user.weekly_hours) > last_max_end:
                    last_max_end = float(max_end) / float(user.weekly_hours)

                # Create variables
                presence_var = model.new_bool_var(f"present_job_{i}_{j}")
                start_var = model.new_int_var(min_start, max_end, f"start_{i}_{j}")
                end_var = model.new_int_var(min_start, max_end, f"end_{i}_{j}")
                duration = task.expected_hours

                # Prioritize preexisting assignments
                # Those tasks will receive an additional boolean variable v, 
                #   the solver will try to maximize the weighted sum of those, 
                #   i.e., v == 0 -> the preassigned task needed to be unassigned (or changed!), v == 1 -> the preassigned task keeps the assignment
                for assignment in assignments:
                    if assignment.task_id == task.identifier and assignment.user_id == user.identifier:
                        preassigned_var= model.new_bool_var(f"preassigned_job_{i}_{j}")
                        model.add_hint(preassigned_var, 1)

                        # The state of the pre-assignment is bound to the actual job assignment
                        model.add(preassigned_var == presence_var)
                        preassignments.append(preassigned_var)
                        preassignments_map[preassigned_var.index] = (i, j)


                # Find the last end time for MAKESPAN calculation
                scaled_end = model.new_int_var(0, max_end, f"scaled_end_{i}_{j}")
                model.add(scaled_end == end_var)

                normalized_scaled_end = model.new_int_var(
                    0, max_end, f"norm_end_scaled_{i}_{j}"
                )
                model.add_division_equality(
                    normalized_scaled_end, scaled_end, user.weekly_hours
                )

                task_ending_times.append(normalized_scaled_end)

                LOGGER.info(
                    f"start: {min_start}, end: {max_end}, duration: {task.expected_hours}"
                )

                # Create Optional Interval
                job = model.new_optional_interval_var(
                    start_var, duration, end_var, presence_var, f"job_{i}_{j}"
                )

                member_jobs.append(job)
                member_job_presences.append(presence_var)

            else:
                # User lacks skills, force presence to False
                false_var = model.new_bool_var(f"no_skill_{i}_{j}")
                model.add(false_var == 0)
                member_job_presences.append(false_var)

        # Constraint: User cannot do two things at exactly the same time
        if member_jobs:
            model.add_no_overlap(member_jobs)

        user_interval_vars.append(member_jobs)

        job_assignment_presence.append(member_job_presences)
 
    # Constraint: max one member per task
    for j in range(num_tasks):
        task_presences = [job_assignment_presence[i][j] for i in range(num_members)]
        model.add_at_most_one(task_presences)

    max_ending_time = model.new_int_var(0, int(last_max_end + 1), "max_ending_time")
    model.add_max_equality(max_ending_time, task_ending_times)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = settings.timeout_seconds

    task_hours_sum = sum(task.expected_hours for task in tasks)

    total_hours_var = model.new_int_var(0, task_hours_sum, "total_hours")

    start = time.time()

    # Before actually working on the optimization goals, we first search for a solution that maximizes the number of preassigned tasks
    # Once such a solution is found we proceed as usual

    solver.parameters.max_time_in_seconds = settings.timeout_seconds
    model.maximize(sum(preassignments) * 100_000)
    solver.solve(model)

    # These selected pre-assignments now need to be fixed
    for pvar in preassignments:
        if solver.value(pvar) == 1:
            user_idx, task_idx = preassignments_map[pvar.index]
            model.add(job_assignment_presence[user_idx][task_idx] == 1)

    status = None
    for optimization_goal in settings.optimization_goals:
        elapsed_time = time.time() - start
        if elapsed_time > settings.timeout_seconds:
            break

        solver.parameters.max_time_in_seconds = settings.timeout_seconds - elapsed_time

        # TODO(performance): add solver.AddHint where possible to speed-up subsequent solve calls
        match optimization_goal:
            case "min-makespan":
                model.minimize(max_ending_time)
                status = solver.solve(model)
                if solver.objective_value is not None:
                    model.add(max_ending_time <= round(solver.objective_value))
            case "distribute-evenly":
                USER_LOAD_PRECISION = 100
                user_loads = []
                for i in range(num_members):
                    if users[i].weekly_hours == 0:
                        continue

                    user_load_var = model.new_int_var(
                        0, task_hours_sum * USER_LOAD_PRECISION, f"user_load_{i}"
                    )
                    user_hours = sum(
                        [
                            presence * tasks[j].expected_hours
                            for j, presence in enumerate(job_assignment_presence[i])
                        ]
                    )
                    model.add_division_equality(
                        user_load_var,
                        user_hours * USER_LOAD_PRECISION,
                        users[i].weekly_hours,
                    )
                    user_loads.append(user_load_var)

                min_load = model.new_int_var(
                    0, task_hours_sum * USER_LOAD_PRECISION, "min_load"
                )
                max_load = model.new_int_var(
                    0, task_hours_sum * USER_LOAD_PRECISION, "max_load"
                )

                model.add_min_equality(min_load, user_loads)
                model.add_max_equality(max_load, user_loads)

                model.minimize(max_load - min_load)

                status = solver.solve(model)

                LOGGER.debug("load-minimization for %d", round(solver.objective_value))

                if solver.objective_value is not None:
                    model.add(max_load - min_load <= round(solver.objective_value))

            case "max-tasks-scheduled":
                # Objective: assign the most tasks possible
                all_assignments = [
                    job_assignment_presence[i][j]
                    for i in range(num_members)
                    for j in range(num_tasks)
                ]

                model.maximize(sum(all_assignments))
                status = solver.solve(model)

                if solver.objective_value is not None:
                    model.add(sum(all_assignments) >= round(solver.objective_value))
            case "max-hours-scheduled":
                total_hours_per_user = [
                    sum(
                        [
                            presence * tasks[j].expected_hours
                            for j, presence in enumerate(job_assignment_presence[i])
                        ]
                    )
                    for i in range(num_members)
                ]
                total_hours = sum(total_hours_per_user)
                model.add(total_hours_var == total_hours)
                model.maximize(total_hours_var)
                status = solver.solve(model)

                LOGGER.debug(
                    "max-hours-scheduled for %d (%s, %d)",
                    round(solver.objective_value),
                    type(total_hours_var),
                    solver.value(total_hours_var),
                )

                if solver.objective_value is not None:
                    model.add(total_hours_var >= round(solver.objective_value))

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        schedule_result: list[Assignment] = []
        for i, user in enumerate(users):
            for j, task in enumerate(tasks):
                # Check if the solver set this assignment to True (1)
                if solver.value(job_assignment_presence[i][j]):
                    schedule_result.append(Assignment(user.identifier, task.identifier))
        return schedule_result
    else:
        return []


def print_assignment(assignment: Assignment):
    LOGGER.debug("user (%s) -> task (%s)", assignment.user_id, assignment.task_id)


def print_assignments(assignments: list[Assignment]):
    LOGGER.debug("<FOUND ASSIGNMENTS (%d)>", len(assignments))
    for assignment in assignments:
        print_assignment(assignment)


def testing():

    settings = Settings(["max-hours-scheduled", "distribute-evenly"], 5)
    now = datetime.datetime.now()

    # Skills
    go_skill = Skill(identifier=uuid.uuid4(), name="Go")
    db_skill = Skill(identifier=uuid.uuid4(), name="Database")
    react_skill = Skill(identifier=uuid.uuid4(), name="React")

    # Users
    alice = User(
        identifier=uuid.uuid4(), name="Alice", skills=[go_skill], weekly_hours=40
    )
    bob = User(
        identifier=uuid.uuid4(),
        name="Bob",
        skills=[go_skill, db_skill],
        weekly_hours=40,
    )

    LOGGER.info("=== TEST 1: Feasible Schedule ===")
    tasks_feasible = [
        Task(
            uuid.uuid4(),
            "Write API",
            now,
            now + datetime.timedelta(days=7),
            20,
            [go_skill],
        ),
        Task(
            uuid.uuid4(),
            "Setup DB",
            now,
            now + datetime.timedelta(days=7),
            15,
            [db_skill],
        ),
    ]
    print_assignments(
        schedule_tasks_to_members([alice, bob], tasks_feasible, [], settings)
    )

    LOGGER.info("=== TEST 2: Infeasible (Missing Skills) ===")
    tasks_missing_skills = [
        Task(
            uuid.uuid4(),
            "Build Frontend",
            now,
            now + datetime.timedelta(days=7),
            20,
            [react_skill],
        ),
    ]
    print_assignments(
        schedule_tasks_to_members([alice, bob], tasks_missing_skills, [], settings)
    )

    LOGGER.info("=== TEST 3: Infeasible (Too much work for one person) ===")
    # Bob is the only one with DB skills, but 1000 hours doesn't fit in his 40 hour week constraint logic
    tasks_too_much = [
        Task(
            uuid.uuid4(),
            "Massive DB Migration",
            now,
            now + datetime.timedelta(days=7),
            1000,
            [db_skill],
        ),
    ]
    print_assignments(
        schedule_tasks_to_members([alice, bob], tasks_too_much, [], settings)
    )

    LOGGER.info("=== TEST 4: Task starts earlier in week ===")
    tasks_feasible = [
        Task(
            uuid.uuid4(),
            "Write API",
            now - datetime.timedelta(days=5),
            now + datetime.timedelta(days=7),
            20,
            [go_skill],
        ),
        Task(
            uuid.uuid4(),
            "Setup DB",
            now - datetime.timedelta(days=2),
            now + datetime.timedelta(days=7),
            15,
            [db_skill],
        ),
    ]
    print_assignments(
        schedule_tasks_to_members([alice, bob], tasks_feasible, [], settings)
    )


class CustomHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers["Content-Length"])

        post_data = self.rfile.read(content_length)

        LOGGER.info(f"Received POST data: {post_data.decode('utf-8')}")

        try:
            payload = msgspec.json.decode(post_data, type=InputPayload)

            LOGGER.info(f"Payload: {payload}")

            payload.settings.timeout_seconds = min(payload.settings.timeout_seconds, MAX_ALLOWED_TIMEOUT_SECONDS)

            schedule = schedule_tasks_to_members(
                payload.users, payload.tasks, payload.assignments, payload.settings
            )  # returns List[Assignment]
            resp = msgspec.json.encode(schedule)

            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()

            self.wfile.write(resp)

        except msgspec.ValidationError as e:
            LOGGER.info(f"Error: {e}")
            self.send_response(400)
            self.end_headers()
            self.wfile.write(f"Validation Error: {e}".encode())


if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        LOGGER.info(f"Serving at port {PORT}")
        httpd.serve_forever()
