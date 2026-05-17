from uuid import UUID
import uuid
from dateutil.relativedelta import relativedelta
from hypothesis.strategies import DataObject
from hypothesis import given, strategies as st, settings, HealthCheck
from typing import Generator
from datetime import datetime, timedelta
from scheduler import schedule_tasks_to_members, User, Task, Skill
from scheduler_test import (
    skill_gen as skill_gen,
    user_gen as user_gen,
    task_gen as task_gen,
)
from timeit import default_timer as timer
import tracemalloc


def daterange_weekday_only(
    start_date: datetime, end_date: datetime
) -> Generator[datetime]:
    s = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    e = end_date.replace(hour=0, minute=0, second=0, microsecond=0)
    days = (e - s).days + 1
    for n in range(days):
        day = s + timedelta(n)
        if day.weekday() >= 5:
            continue
        yield day


def weekrange_weekday_only(
    start_date: datetime, end_date: datetime
) -> Generator[list[datetime]]:
    s = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    e = end_date.replace(hour=0, minute=0, second=0, microsecond=0)
    day = s
    week = []
    while day <= e:
        if day.weekday() >= 5:
            if day.weekday() == 6:
                if len(week) > 0:
                    yield week
                    week = []
            day += timedelta(1)
            continue

        week.append(day)
        day += timedelta(1)

    if len(week) > 0:
        yield week


def verify_task_assignment(assignments: list[tuple[User, Task]]) -> bool:
    user_date_map: dict[tuple[uuid.UUID, datetime], int] = {}

    for user, task in assignments:
        task_duration = task.expected_hours
        for date in daterange_weekday_only(task.start_at, task.due_at):
            if date not in user_date_map:
                user_date_map[user.identifier, date] = 0

            spend_time = min(8, task_duration)
            user_date_map[user.identifier, date] += spend_time
            task_duration -= spend_time

            if task_duration == 0:
                break

        if task_duration > 0:
            print("task could not be finished", task, "\nby user", user)
            print("tasks assigned to user: ")
            for user2, task2 in assignments:
                if user == user2:
                    print(f"  {task2}")
            return False

    tasks = [task for _, task in assignments]
    min_start = min([task.start_at for task in tasks])
    max_due = max([task.due_at for task in tasks])

    users = [user for user, _ in assignments]
    for user in users:
        for week in weekrange_weekday_only(min_start, max_due):
            spend_hours_of_week = sum(
                [user_date_map.get((user.identifier, date), 0) for date in week]
            )
            if spend_hours_of_week > user.weekly_hours:
                print(
                    f"user time overspent: week={week}, spend={spend_hours_of_week}, user={user}"
                )

                print("tasks assigned to user: ")
                for user2, task2 in assignments:
                    if user == user2:
                        print(f"  {task2}")
                return False

    return True


def work_week_days(day: datetime) -> list[datetime]:
    start_of_week = day - timedelta(days=day.weekday())
    return [start_of_week + timedelta(days=i) for i in range(5)]


def remaining_week_work_hours(
    user: User,
    user_date_map: dict[datetime, int],
    day: datetime,
) -> int:
    w = work_week_days(day)
    total_spent = 0
    for d in w:
        spent = user_date_map.get(d, 0)
        total_spent += spent

    return user.weekly_hours - total_spent


def user_has_time_for_task(
    user: User,
    task: Task,
    user_date_map: dict[datetime, int],
) -> bool:
    task_start = task.start_at
    task_due = task.due_at
    task_duration = task.expected_hours

    modified_dates = []

    for date in daterange_weekday_only(task_start, task_due):
        modified_dates.append((date, user_date_map.get(date, 0)))
        if date not in user_date_map:
            user_date_map[date] = 0

        available_time = remaining_week_work_hours(user, user_date_map, date)
        at_most_8_hours_per_day = min(8, available_time)
        spend_time = min(at_most_8_hours_per_day, task_duration)
        user_date_map[date] += spend_time
        task_duration -= spend_time

        if task_duration == 0:
            break

    can_assign = task_duration == 0

    for week in weekrange_weekday_only(task_start, task_due):
        spend_hours_of_week = sum(
            [user_date_map.get(date, 0) for date in week]
        )
        if spend_hours_of_week > user.weekly_hours:
            print(
                f"user time overspent: week={week}, spend={spend_hours_of_week}, user={user}"
            )
            return False

    if not can_assign:
        # restore in case the task did not fit after all
        for date, prev in modified_dates:
            user_date_map[date] = prev

    return can_assign


def greedy_schedule_tasks_to_members(
    users: list[User], tasks: list[Task]
) -> list[tuple[User, Task]]:
    result = []
    available_tasks = tasks

    for user in users:
        user_skills = {skill.identifier for skill in user.skills}
        user_date_map = {}

        for task in list(available_tasks):
            task_skills = {skill.identifier for skill in task.needed_skills}
            if task_skills.issubset(user_skills) and user_has_time_for_task(
                user, task, user_date_map
            ):
                result.append([user, task])
                available_tasks.remove(task)

    return result


min_size = 100
max_size = 100

min_date = datetime(2026, 1, 1)
max_date = min_date + relativedelta(months=6)

max_examples = 1000


@settings(deadline=60 * 1000, max_examples=max_examples)
@given(st.data())
def test_valid(data: DataObject):
    skills = data.draw(st.lists(skill_gen(), min_size=min_size, max_size=max_size))

    users = data.draw(
        st.lists(
            user_gen(list(skills)),
            min_size=min_size,
            max_size=max_size,
        )
    )

    tasks = data.draw(
        st.lists(
            task_gen(list(skills), min_date, max_date),
            min_size=min_size,
            max_size=max_size,
        )
    )

    result_sched = schedule_tasks_to_members(list(users), list(tasks))
    result_greedy = greedy_schedule_tasks_to_members(list(users), list(tasks))

    assert len(result_sched) >= len(result_greedy)

    # if not verify_task_assignment(list(result_sched)):
    #     print("ILLEGAL SCHED!", result_sched)


# def test_c1():
#     u = [
#         User(
#             name="\x17\x08\x7f0Q\x05\x17",
#             skills=[Skill(name="\x16<B")],
#             weekly_hours=141,
#         ),
#         User(name="zpj", skills=[Skill(name="\x16<B")], weekly_hours=0),
#         User(name="[L|;%{\x1b", skills=[Skill(name="\x16<B")], weekly_hours=17),
#         User(name="\x036e ]4\x06\x7f", skills=[Skill(name="\x16<B")], weekly_hours=100),
#     ]
#
#     t = [
#         Task(
#             name="7",
#             start_at=datetime(2026, 3, 29, 18, 52, 15, 765264),
#             due_at=datetime(2026, 8, 4, 0, 59, 55, 804702),
#             expected_hours=0,
#             needed_skills=[Skill(name="\x16<B")],
#         )
#     ]
#
#     assert verify_task_assignment(schedule_tasks_to_members(u, t))


def cosim_scheduling(users: list[User], tasks: list[Task]):
    start_greedy = timer()
    tracemalloc.start()
    result_greedy = greedy_schedule_tasks_to_members(list(users), list(tasks))
    _, peak_greedy = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    end_greedy = timer()

    start_sched = timer()
    tracemalloc.start()
    result_sched = schedule_tasks_to_members(list(users), list(tasks))
    _, peak_sched = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    end_sched = timer()


    tasks_sched = [assignment.task_id for assignment in result_sched]
    tasks_sched_hours = []
    for taskid in tasks_sched:
        for task in tasks:
            if task.identifier == taskid:
                tasks_sched_hours.append(task.expected_hours)

    hours_sched = sum(tasks_sched_hours)
    hours_greedy = sum([task.expected_hours for _, task in result_greedy])

    print(
        f"{len(tasks)}, {len(users)}, {len(result_sched)}, {len(result_greedy)}, {end_sched - start_sched}, {end_greedy - start_greedy}, {peak_sched}, {peak_greedy}, {hours_sched}, {hours_greedy}"
    )

    if len(result_greedy) == 0 and len(result_sched) > 0:
        print("=== ALARM ===")
        print(users, tasks, result_sched)


@settings(
    deadline=None,
    max_examples=100,
    suppress_health_check=list(HealthCheck),
    derandomize=False,
)
@given(st.data())
def run(data: DataObject):
    skills = data.draw(st.lists(skill_gen(), min_size=5, max_size=5))

    users = data.draw(
        st.lists(
            user_gen(list(skills)),
            min_size=10,
            max_size=10,
        )
    )

    tasks = data.draw(
        st.lists(
            task_gen(list(skills), min_date, max_date),
            min_size=100,
            max_size=100,
        )
    )

    tasks = sorted(tasks, key=lambda task: task.expected_hours, reverse=True)

    cosim_scheduling(users, tasks)


# The first examples shows how the constraint based scheduler is able to schedule more (all) tasks
# while the greedy scheduler will make a worse decision (given the order of the tasks)
def run_example1():
    python_skill = Skill(uuid.uuid4(), "python")
    react_skill = Skill(uuid.uuid4(), "react")

    # Both alice and bob are able to work on react tasks, but only alice can be selected for a python task
    alice = User(
        uuid.uuid4(),
        name="Alice",
        skills=[python_skill, react_skill],
        weekly_hours=20,
    )

    bob = User(
        uuid.uuid4(),
        name="Bob",
        skills=[react_skill],
        weekly_hours=20,
    )

    users = [alice, bob]

    base = datetime(2025, 1, 2)

    tasks = [
        # Greedy:
        # Since alice is the first user, and "Frontend A" is the first task, and it is assignable to alice
        # It will also be assigned with the greedy solution
        # Constraint Solver: Assignes to Bob
        Task(
            uuid.uuid4(),
            name="Frontend A",
            start_at=base,
            due_at=base,
            expected_hours=10,
            needed_skills=[react_skill],
        ),
        # Greedy: Alice will then also get "Frontend B" as it still fits
        # Constraint Solver: Assignes to Bob
        Task(
            uuid.uuid4(),
            name="Frontend B",
            start_at=base,
            due_at=base + timedelta(days=1),
            expected_hours=10,
            needed_skills=[react_skill],
        ),
        # Greedy: "Backend" will remain unassigned
        # Constraint Solver: Assignes to Alice
        Task(
            uuid.uuid4(),
            name="Backend",
            start_at=base + timedelta(days=2),
            due_at=base + timedelta(days=3),
            expected_hours=20,
            needed_skills=[python_skill],
        ),
    ]

    cosim_scheduling(users, tasks)


def run_examples():
    run_example1()


def main():
    # run()
    run_examples()


if __name__ == "__main__":
    main()
    # [User(name="0", skills=[], weekly_hours=0)][
    #     Task(
    #         name="Q:",
    #         start_at=datetime.datetime(2026, 1, 1, 0, 0, 0, 16),
    #         due_at=datetime.datetime(2026, 1, 5, 0, 0, 0, 1),
    #         expected_hours=1,
    #         needed_skills=[],
    #     )
    # ]
    # s = [
    #     Skill(name='\x16<B')]
    #
    #    u = [ User(name='\x17\x08\x7f0Q\x05\x17',
    #      skills=[Skill(name='\x16<B')],
    #      weekly_hours=141),
    #     User(name='zpj',
    #      skills=[ Skill(name='\x16<B')],
    #      weekly_hours=0),
    #     User(name='[L|;%{\x1b',
    #      skills=[ Skill(name='\x16<B') ],
    #      weekly_hours=17),
    #     User(name='\x036e ]4\x06\x7f',
    #      skills=[ Skill(name='\x16<B') ],
    #      weekly_hours=100)]
    #
    #    t = [
    #     Task(name='7',
    #      start_at=datetime.datetime(2026, 3, 29, 18, 52, 15, 765264),
    #      due_at=datetime.datetime(2026, 8, 4, 0, 59, 55, 804702),
    #      expected_hours=0,
    #      needed_skills=[Skill(name='\x16<B')])]


# task could not be finished Task(name='J\x12+lo\x17\x1f/Tc\\\x08', start_at=datetime.datetime(2026, 9, 29, 0, 47, 55, 11016), due_at=datetime.datetime(2026, 9, 30, 14, 22, 0, 5185), expected_hours=12, needed_skills=[Skill(name='\x16<B')])
# by user User(name='[L|;%{\x1b', skills=[Skill(name='S-'), Skill(name='>\x1b*dCO'), Skill(name="(g,+PL #Y'\x12pa\x05\x01"), Skill(name='\x16<B'), Skill(name='jw\x0e[*\x05~'), Skill(name="O|908:[\x0epc46x\x10;\x1e$dEa\x13a#G1)\x01'sz~u2d\x1f\x16"), Skill(name='}?\x054')], weekly_hours=17)

# [
#     User(
#         identifier=UUID("58b06cf4-043f-4916-b998-334951c088d1"),
#         name="9",
#         skills=[
#             Skill(
#                 identifier=UUID("b0d95fd1-114c-4766-b49f-c7a0a062ad51"),
#                 name="(\r]?]1]?",
#             ),
#             Skill(
#                 identifier=UUID("e70b2988-0477-4a1f-8ecd-b23842335a80"), name="!\x0c$|M"
#             ),
#             Skill(
#                 identifier=UUID("524a19dc-49ec-4f55-8517-b1a02acab2bf"),
#                 name="%6nR+MW\x16h\nH!X7}\x08^\x1eQC",
#             ),
#             Skill(
#                 identifier=UUID("524a19dc-49ec-4f55-8517-b1a02acab2bf"),
#                 name="%6nR+MW\x16h\nH!X7}\x08^\x1eQC",
#             ),
#             Skill(
#                 identifier=UUID("e70b2988-0477-4a1f-8ecd-b23842335a80"), name="!\x0c$|M"
#             ),
#             Skill(
#                 identifier=UUID("b0d95fd1-114c-4766-b49f-c7a0a062ad51"),
#                 name="(\r]?]1]?",
#             ),
#             Skill(identifier=UUID("64d4b694-e634-4b8a-b140-5206823a7aa1"), name="\r4H"),
#             Skill(
#                 identifier=UUID("b0d95fd1-114c-4766-b49f-c7a0a062ad51"),
#                 name="(\r]?]1]?",
#             ),
#             Skill(identifier=UUID("b39edef9-510d-43a9-a398-968dea7f4a4a"), name="else"),
#         ],
#         weekly_hours=15,
#     )
# ][
#     Task(
#         identifier=UUID("7785bbe5-83cd-4eb1-9515-bbfbd5219dd9"),
#         name="\x10g\x02",
#         start_at=datetime.datetime(2026, 2, 1, 7, 34, 1, 546738),
#         due_at=datetime.datetime(2026, 3, 1, 0, 0),
#         expected_hours=30,
#         needed_skills=[],
#     ),
# ][
#     Assignment(
#         user_id=UUID("58b06cf4-043f-4916-b998-334951c088d1"),
#         task_id=UUID("7785bbe5-83cd-4eb1-9515-bbfbd5219dd9"),
#     )
# ]
