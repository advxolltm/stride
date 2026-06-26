from uuid import UUID
from sys import exit
import os
import uuid
from dateutil.relativedelta import relativedelta
from hypothesis.strategies import DataObject
from hypothesis import given, strategies as st, settings, HealthCheck
from typing import Generator
from datetime import timedelta
from scheduler import schedule_tasks_to_members, User, Task, Skill, Settings, Assignment
from scheduler_test import (
    skill_gen as skill_gen,
    user_gen as user_gen,
    task_gen as task_gen,
)
from timeit import default_timer as timer
import tracemalloc
import datetime


def daterange_weekday_only(
    start_date: datetime.datetime, end_date: datetime.datetime
) -> Generator[datetime.datetime]:
    s = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    e = end_date.replace(hour=0, minute=0, second=0, microsecond=0)
    days = (e - s).days + 1
    for n in range(days):
        day = s + timedelta(n)
        if day.weekday() >= 5:
            continue
        yield day


def weekrange_weekday_only(
    start_date: datetime.datetime, end_date: datetime.datetime
) -> Generator[list[datetime.datetime]]:
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
    user_date_map: dict[tuple[uuid.UUID, datetime.datetime], int] = {}

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


def work_week_days(day: datetime.datetime) -> list[datetime.datetime]:
    start_of_week = day - timedelta(days=day.weekday())
    return [start_of_week + timedelta(days=i) for i in range(5)]


def remaining_week_work_hours(
    user: User,
    user_date_map: dict[datetime.datetime, int],
    day: datetime.datetime,
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
    user_date_map: dict[datetime.datetime, int],
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
        spend_hours_of_week = sum([user_date_map.get(date, 0) for date in week])
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

min_date = datetime.datetime(2026, 1, 1)
max_date = min_date + relativedelta(months=6)

max_examples = 1000


@settings(
    deadline=60 * 1000,
    max_examples=max_examples,
    suppress_health_check=list(HealthCheck),
)
@given(st.data())
def test_valid(data: DataObject):
    settings = Settings(
        ["max-hours-scheduled", "distribute-evenly"],
        60,
    )

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

    result_sched = schedule_tasks_to_members(list(users), list(tasks), [], settings)
    print(result_sched)
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
    settings = Settings(
        ["max-tasks-scheduled", "distribute-evenly", "max-hours-scheduled"],
        60,
    )
    start_greedy = timer()
    tracemalloc.start()
    result_greedy = greedy_schedule_tasks_to_members(list(users), list(tasks))
    _, peak_greedy = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    end_greedy = timer()

    result_sched = []
    start_sched = 0
    end_sched = 0
    peak_sched = 0

    found_solution = False
    solution_tries = 0
    while not found_solution and solution_tries < 5:
        start_sched = timer()
        tracemalloc.start()
        result_sched = schedule_tasks_to_members(list(users), list(tasks), [], settings)
        _, peak_sched = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        end_sched = timer()
        if len(result_sched) > 0:
            found_solution = True
        else:
            solution_tries += 1

    tasks_sched = [assignment.task_id for assignment in result_sched]
    tasks_sched_hours = []
    for taskid in tasks_sched:
        for task in tasks:
            if task.identifier == taskid:
                tasks_sched_hours.append(task.expected_hours)

    hours_sched = sum(tasks_sched_hours)
    hours_greedy = sum([task.expected_hours for _, task in result_greedy])

    user_hours_sched = {}
    for assignment in result_sched:
        user = None
        for u in users:
            if u.identifier == assignment.user_id:
                user = u
                break

        task = None
        for t in tasks:
            if t.identifier == assignment.task_id:
                task = t
                break

        if user is None or task is None:
            continue

        curr = user_hours_sched.get(user.identifier, float(0))
        curr += (float(task.expected_hours) / float(user.weekly_hours))
        user_hours_sched[user.identifier] = curr
        
    user_hours_greedy = {}
    for (user, task) in result_greedy:
        curr = user_hours_greedy.get(user.identifier, float(0))
        curr += (float(task.expected_hours) / float(user.weekly_hours))
        user_hours_greedy[user.identifier] = curr

    user_hours_sched_span = max(user_hours_sched.values()) - min(user_hours_sched.values())
    user_hours_greedy_span = max(user_hours_greedy.values()) - min(user_hours_greedy.values())

    print(
        f"{len(tasks)}, {len(users)}, {len(result_sched)}, {len(result_greedy)}, {end_sched - start_sched}, {end_greedy - start_greedy}, {peak_sched}, {peak_greedy}, {hours_sched}, {hours_greedy}, {user_hours_sched_span}, {user_hours_greedy_span}", flush=True
    )

    # if len(result_greedy) > len(result_sched):
    #     print("=== ALARM ===")
    #     print(users, tasks, result_sched)
    #     exit(1)


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
    users = [
        User(
            identifier=UUID("6d8a4093-e200-4020-ac0a-c1b9fb5ea607"),
            name="#\x024\x1ejl",
            skills=[
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                )
            ],
            weekly_hours=39,
        ),
        User(
            identifier=UUID("3846970b-cc85-4b09-b09c-f5992a4434af"),
            name="\x1cK",
            skills=[
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
            ],
            weekly_hours=17,
        ),
        User(
            identifier=UUID("7f66ea95-1c71-4e21-9f54-85bd9ced6bf7"),
            name="\x1cK",
            skills=[
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
            ],
            weekly_hours=17,
        ),
        User(
            identifier=UUID("a4db04b3-49b6-4386-88c9-274700b9d98d"),
            name="F:}Q\x17\x0c*;F\x03\x08H",
            skills=[
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                )
            ],
            weekly_hours=28,
        ),
        User(
            identifier=UUID("32fbeb60-e5ce-4d24-8e2b-4072b7d207d2"),
            name="KzP4\x7f#fD\x12",
            skills=[
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
            ],
            weekly_hours=17,
        ),
        User(
            identifier=UUID("de314256-cc88-4ee8-bccb-c959a72a2278"),
            name="\x11",
            skills=[
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
            ],
            weekly_hours=21,
        ),
        User(
            identifier=UUID("e84d3c95-74af-40ad-a81d-ca079e08ba61"),
            name="{^k!",
            skills=[
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
            ],
            weekly_hours=22,
        ),
        User(
            identifier=UUID("bda09264-963e-4748-aa9d-0c24f82d80ef"),
            name="\x00F\t",
            skills=[
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
            ],
            weekly_hours=35,
        ),
        User(
            identifier=UUID("1c29a8e0-ea94-4f99-b72c-f3bd5387e808"),
            name="y",
            skills=[
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
            ],
            weekly_hours=12,
        ),
        User(
            identifier=UUID("b4074138-bd5d-4b12-bb01-01eb6a4841de"),
            name="c",
            skills=[
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
            ],
            weekly_hours=24,
        ),
    ]

    tasks = [
        Task(
            identifier=UUID("8a89716d-5826-4fb3-a6f8-8e6b52a83798"),
            name="\x068pi+k\x1e\x05l-\x06",
            start_at=datetime.datetime(2026, 4, 8, 14, 38, 35, 883145, fold=1),
            due_at=datetime.datetime(2026, 4, 13, 5, 9, 49, 712446),
            expected_hours=100,
            needed_skills=[],
        ),
        Task(
            identifier=UUID("c33b6910-ea0f-4152-90c8-41e02c60e068"),
            name="lc)\n\x06w35",
            start_at=datetime.datetime(2026, 4, 17, 4, 37, 41, 180957, fold=1),
            due_at=datetime.datetime(2026, 6, 23, 17, 3, 0, 960277),
            expected_hours=100,
            needed_skills=[
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
            ],
        ),
        Task(
            identifier=UUID("6e6c49d8-5eb0-4235-a421-3c77e3e690b7"),
            name="\x07]m\\6n+UT\x05",
            start_at=datetime.datetime(2026, 3, 14, 11, 27, 18, 955904),
            due_at=datetime.datetime(2026, 4, 24, 2, 2, 38, 510510, fold=1),
            expected_hours=99,
            needed_skills=[
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                )
            ],
        ),
        Task(
            identifier=UUID("8b0855a4-f6c9-4ada-be0e-79f0cb75eaab"),
            name="K",
            start_at=datetime.datetime(2026, 2, 10, 19, 21, 34, 251697, fold=1),
            due_at=datetime.datetime(2026, 3, 30, 20, 48, 7, 419016, fold=1),
            expected_hours=98,
            needed_skills=[
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                )
            ],
        ),
        Task(
            identifier=UUID("6b5ec3e7-436e-4910-9c60-8abf7d2d27d6"),
            name="-j\x14 ",
            start_at=datetime.datetime(2026, 1, 3, 21, 21, 52, 528549),
            due_at=datetime.datetime(2026, 4, 1, 21, 43, 17, 559318),
            expected_hours=96,
            needed_skills=[
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
            ],
        ),
        Task(
            identifier=UUID("ecfee559-785a-45e1-b0a6-9959e74a587d"),
            name="-Infinity",
            start_at=datetime.datetime(2026, 5, 18, 9, 0, 35, 215110),
            due_at=datetime.datetime(2026, 6, 7, 17, 47, 27, 886807),
            expected_hours=94,
            needed_skills=[
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
            ],
        ),
        Task(
            identifier=UUID("377ec9cd-e7e0-49d7-8ab8-7a7610ab81c7"),
            name="\x17$w4>Q;",
            start_at=datetime.datetime(2026, 3, 21, 4, 3, 5, 611542, fold=1),
            due_at=datetime.datetime(2026, 6, 10, 19, 13, 0, 566739),
            expected_hours=94,
            needed_skills=[
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
            ],
        ),
        Task(
            identifier=UUID("a27b3588-cd11-4620-95d5-92ca32bc9a0a"),
            name="--extension",
            start_at=datetime.datetime(2026, 6, 10, 3, 3, 23, 772661),
            due_at=datetime.datetime(2026, 6, 26, 4, 29, 9, 635331),
            expected_hours=94,
            needed_skills=[
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
            ],
        ),
        Task(
            identifier=UUID("7755daee-6416-4251-aa9e-c65a638c1c36"),
            name="WdU",
            start_at=datetime.datetime(2026, 5, 2, 21, 23, 7, 744566, fold=1),
            due_at=datetime.datetime(2026, 5, 15, 9, 47, 10, 433223, fold=1),
            expected_hours=94,
            needed_skills=[
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
            ],
        ),
        Task(
            identifier=UUID("ca41721a-c000-4f9b-961d-318cdce37cd8"),
            name="Y\x18\x15\x13bA;",
            start_at=datetime.datetime(2026, 1, 26, 14, 54, 35, 279595, fold=1),
            due_at=datetime.datetime(2026, 6, 19, 12, 21, 49, 223443, fold=1),
            expected_hours=91,
            needed_skills=[
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
            ],
        ),
        Task(
            identifier=UUID("4a5c3868-895d-46bb-8a95-8ff3acb5001a"),
            name="\x1b];\x05P",
            start_at=datetime.datetime(2026, 3, 11, 11, 28, 1, 931032, fold=1),
            due_at=datetime.datetime(2026, 3, 22, 16, 17, 44, 285318, fold=1),
            expected_hours=90,
            needed_skills=[
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
            ],
        ),
        Task(
            identifier=UUID("bcf2d72f-3dc0-4495-92f1-257557296bb0"),
            name="d",
            start_at=datetime.datetime(2026, 1, 31, 14, 12, 26, 148827, fold=1),
            due_at=datetime.datetime(2026, 6, 13, 17, 25, 22, 966236),
            expected_hours=89,
            needed_skills=[
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
            ],
        ),
        Task(
            identifier=UUID("c52d689b-fe9f-4e99-a685-0e3c87f375c4"),
            name="-Infinity",
            start_at=datetime.datetime(2026, 1, 24, 7, 40, 22, 699123, fold=1),
            due_at=datetime.datetime(2026, 2, 22, 13, 41, 26, 702194),
            expected_hours=89,
            needed_skills=[
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
            ],
        ),
        Task(
            identifier=UUID("5805f5cb-3f9c-441d-9080-3fc620f71803"),
            name="b",
            start_at=datetime.datetime(2026, 4, 13, 13, 12, 56, 204846),
            due_at=datetime.datetime(2026, 6, 17, 3, 45, 55, 74707, fold=1),
            expected_hours=88,
            needed_skills=[],
        ),
        Task(
            identifier=UUID("2069146e-f6e8-4784-af47-60564b4b979d"),
            name="BNLyL\x11c",
            start_at=datetime.datetime(2026, 5, 9, 0, 41, 26, 828769, fold=1),
            due_at=datetime.datetime(2026, 7, 1, 0, 0, fold=1),
            expected_hours=87,
            needed_skills=[
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
            ],
        ),
        Task(
            identifier=UUID("f87202f2-1987-4220-8a6a-b9140a34406c"),
            name="\x07",
            start_at=datetime.datetime(2026, 4, 30, 6, 13, 19, 590531),
            due_at=datetime.datetime(2026, 7, 1, 0, 0, fold=1),
            expected_hours=85,
            needed_skills=[
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
            ],
        ),
        Task(
            identifier=UUID("19737928-b01a-4043-bbfb-130510b8cbd1"),
            name="qp\x0bo\x01\\a",
            start_at=datetime.datetime(2026, 1, 26, 2, 48, 38, 53725, fold=1),
            due_at=datetime.datetime(2026, 2, 28, 6, 23, 13, 513253, fold=1),
            expected_hours=84,
            needed_skills=[],
        ),
        Task(
            identifier=UUID("bec0e058-c4e9-4ca0-8203-eb21497182aa"),
            name="PBS%",
            start_at=datetime.datetime(2026, 6, 3, 19, 0, 29, 672286),
            due_at=datetime.datetime(2026, 6, 22, 18, 18, 21, 646451, fold=1),
            expected_hours=83,
            needed_skills=[
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
            ],
        ),
        Task(
            identifier=UUID("94b045a1-1936-43e9-b14b-7bb620d74326"),
            name="\x11,S",
            start_at=datetime.datetime(2026, 1, 6, 11, 13, 41, 544887),
            due_at=datetime.datetime(2026, 4, 19, 1, 24, 25, 412535, fold=1),
            expected_hours=82,
            needed_skills=[
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
            ],
        ),
        Task(
            identifier=UUID("f383b46c-2fb4-4dda-b5f2-0465dc93f151"),
            name="OA;\x14\x01\x1e\x00I\x1a\x01",
            start_at=datetime.datetime(2026, 2, 8, 6, 28, 3, 641655, fold=1),
            due_at=datetime.datetime(2026, 6, 23, 13, 43, 40, 193703),
            expected_hours=81,
            needed_skills=[],
        ),
        Task(
            identifier=UUID("1753f595-70c2-4ed0-a937-8ee12c92859c"),
            name="\x12W\x1f",
            start_at=datetime.datetime(2026, 4, 30, 1, 31, 52, 352551, fold=1),
            due_at=datetime.datetime(2026, 5, 16, 13, 18, 28, 46151),
            expected_hours=79,
            needed_skills=[
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
            ],
        ),
        Task(
            identifier=UUID("c6c9a38e-6fab-4e56-808f-81ad9ae22636"),
            name="wW",
            start_at=datetime.datetime(2026, 2, 11, 17, 10, 38, 800564, fold=1),
            due_at=datetime.datetime(2026, 6, 25, 5, 23, 11, 125841),
            expected_hours=79,
            needed_skills=[
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
            ],
        ),
        Task(
            identifier=UUID("7aadb25d-61d3-48c6-b3a1-3c1faee6da04"),
            name="_scope_id",
            start_at=datetime.datetime(2026, 1, 8, 15, 49, 10, 893895),
            due_at=datetime.datetime(2026, 4, 18, 21, 24, 48, 366153),
            expected_hours=78,
            needed_skills=[
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
            ],
        ),
        Task(
            identifier=UUID("7c285ff9-f9c1-46cf-8926-6b4c8f46489c"),
            name="RF",
            start_at=datetime.datetime(2026, 1, 24, 1, 36, 54, 775652),
            due_at=datetime.datetime(2026, 4, 10, 19, 47, 52, 530012, fold=1),
            expected_hours=78,
            needed_skills=[
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                )
            ],
        ),
        Task(
            identifier=UUID("c749eaca-1e42-4c1d-ba39-22b7c0a4d54f"),
            name="\x17",
            start_at=datetime.datetime(2026, 6, 19, 3, 25, 18, 906810, fold=1),
            due_at=datetime.datetime(2026, 7, 1, 0, 0, fold=1),
            expected_hours=72,
            needed_skills=[
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
            ],
        ),
        Task(
            identifier=UUID("d1949dad-f20c-483a-a2b3-009627823c80"),
            name=":\x16\x04",
            start_at=datetime.datetime(2026, 1, 22, 10, 53, 37, 719401),
            due_at=datetime.datetime(2026, 2, 9, 21, 59, 59, 554161),
            expected_hours=67,
            needed_skills=[
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
            ],
        ),
        Task(
            identifier=UUID("d9f97c67-a0cd-4ddf-a0ea-3fae1246cd33"),
            name="}",
            start_at=datetime.datetime(2026, 2, 15, 9, 30, 43, 442520, fold=1),
            due_at=datetime.datetime(2026, 2, 28, 23, 34, 58, 268443),
            expected_hours=66,
            needed_skills=[
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
            ],
        ),
        Task(
            identifier=UUID("5af1cd7f-1d5e-48d2-ae6f-0e076eb09656"),
            name='(@}^M\x159a"',
            start_at=datetime.datetime(2026, 1, 20, 21, 6, 28, 543019, fold=1),
            due_at=datetime.datetime(2026, 7, 1, 0, 0, fold=1),
            expected_hours=65,
            needed_skills=[],
        ),
        Task(
            identifier=UUID("584cf020-552f-4966-bc54-f9fb54f98161"),
            name="=/#\x7f\x006\x0bd_a\r",
            start_at=datetime.datetime(2026, 1, 28, 16, 15, 20, 726635, fold=1),
            due_at=datetime.datetime(2026, 6, 27, 15, 59, 22, 53791),
            expected_hours=64,
            needed_skills=[
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
            ],
        ),
        Task(
            identifier=UUID("77b57f4f-274b-414f-b35b-9bc85cc2711d"),
            name="*",
            start_at=datetime.datetime(2026, 2, 9, 14, 29, 39, 243460),
            due_at=datetime.datetime(2026, 6, 24, 16, 21, 9, 546853, fold=1),
            expected_hours=60,
            needed_skills=[
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
            ],
        ),
        Task(
            identifier=UUID("3bcbab95-ca7f-44a8-a204-45f057a6ec1c"),
            name="y",
            start_at=datetime.datetime(2026, 3, 19, 20, 10, 49, 410131),
            due_at=datetime.datetime(2026, 3, 29, 11, 57, 15, 421608, fold=1),
            expected_hours=58,
            needed_skills=[
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
            ],
        ),
        Task(
            identifier=UUID("475eeec5-089a-4b8f-8471-212ac96e8e83"),
            name="!m",
            start_at=datetime.datetime(2026, 1, 30, 18, 27, 29, 683174, fold=1),
            due_at=datetime.datetime(2026, 3, 19, 2, 59, 50, 141536),
            expected_hours=57,
            needed_skills=[
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                )
            ],
        ),
        Task(
            identifier=UUID("30ddd92d-5ec8-4fe3-b360-1e2e3b1a2c7a"),
            name="Fr\x1f\x1a",
            start_at=datetime.datetime(2026, 2, 21, 21, 40, 21, 598842, fold=1),
            due_at=datetime.datetime(2026, 3, 16, 1, 38, 26, 313789, fold=1),
            expected_hours=56,
            needed_skills=[
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                )
            ],
        ),
        Task(
            identifier=UUID("865b5c99-6d22-4e4a-9317-ac275fd4fdca"),
            name="+RSa@[1",
            start_at=datetime.datetime(2026, 6, 10, 6, 21, 6, 534230),
            due_at=datetime.datetime(2026, 6, 13, 13, 42, 41, 814954, fold=1),
            expected_hours=55,
            needed_skills=[
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
            ],
        ),
        Task(
            identifier=UUID("f3fbb932-bbfa-4e7c-9442-1f1d75bb783a"),
            name="\x030\x13",
            start_at=datetime.datetime(2026, 3, 3, 21, 22, 55, 604279),
            due_at=datetime.datetime(2026, 4, 12, 6, 35, 23, 109375, fold=1),
            expected_hours=53,
            needed_skills=[
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
            ],
        ),
        Task(
            identifier=UUID("d9a16e9b-53f6-405a-a505-f1ace250ee64"),
            name="7Qo8 ,5-;\x1f",
            start_at=datetime.datetime(2026, 3, 11, 16, 15, 23, 538219),
            due_at=datetime.datetime(2026, 4, 17, 2, 31, 51, 132298, fold=1),
            expected_hours=51,
            needed_skills=[
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
            ],
        ),
        Task(
            identifier=UUID("2abef5eb-98ec-4bd2-a5eb-67c3ff1610d6"),
            name="~bp",
            start_at=datetime.datetime(2026, 3, 8, 16, 58, 39, 339069),
            due_at=datetime.datetime(2026, 5, 7, 15, 3, 1, 262144),
            expected_hours=51,
            needed_skills=[
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                )
            ],
        ),
        Task(
            identifier=UUID("4561dc2d-baf6-4aa0-879f-f61f6bb61a89"),
            name="w",
            start_at=datetime.datetime(2026, 2, 19, 11, 50, 13, 116527, fold=1),
            due_at=datetime.datetime(2026, 7, 1, 0, 0),
            expected_hours=49,
            needed_skills=[],
        ),
        Task(
            identifier=UUID("3158337a-8713-4de1-a243-4106efd5cd9c"),
            name="\x02ym\x136",
            start_at=datetime.datetime(2026, 5, 5, 19, 7, 16, 234327, fold=1),
            due_at=datetime.datetime(2026, 6, 5, 12, 41, 30, 628434),
            expected_hours=49,
            needed_skills=[
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
            ],
        ),
        Task(
            identifier=UUID("015d3363-0967-40d5-a8a1-a9ef13a5dc7b"),
            name="\\",
            start_at=datetime.datetime(2026, 2, 18, 19, 51, 14, 513672, fold=1),
            due_at=datetime.datetime(2026, 2, 25, 19, 39, 43, 414085, fold=1),
            expected_hours=49,
            needed_skills=[
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                )
            ],
        ),
        Task(
            identifier=UUID("5fe393c7-6126-456d-af10-0f1ec9d30fda"),
            name="\x1e3nv\x7f%[\x19RR",
            start_at=datetime.datetime(2026, 2, 1, 16, 8, 29, 381718, fold=1),
            due_at=datetime.datetime(2026, 2, 11, 8, 32, 36, 857392, fold=1),
            expected_hours=48,
            needed_skills=[
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
            ],
        ),
        Task(
            identifier=UUID("28c6f752-e9ab-4767-a229-ce66fd8cf1d6"),
            name="4G%\x13h*Z\x0b4h",
            start_at=datetime.datetime(2026, 1, 22, 10, 13, 37, 985957),
            due_at=datetime.datetime(2026, 6, 21, 15, 8, 15, 20632, fold=1),
            expected_hours=48,
            needed_skills=[
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                )
            ],
        ),
        Task(
            identifier=UUID("735297e2-d3a9-4009-bcbe-202b8265e658"),
            name="~",
            start_at=datetime.datetime(2026, 1, 22, 14, 2, 56, 640890),
            due_at=datetime.datetime(2026, 1, 29, 20, 13, 54, 752324, fold=1),
            expected_hours=47,
            needed_skills=[
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
            ],
        ),
        Task(
            identifier=UUID("b8350149-c1d2-41c1-a1d9-c8739b9a31ba"),
            name="+F",
            start_at=datetime.datetime(2026, 4, 17, 5, 35, 31, 510511),
            due_at=datetime.datetime(2026, 6, 27, 1, 41, 13, 248727, fold=1),
            expected_hours=46,
            needed_skills=[
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
            ],
        ),
        Task(
            identifier=UUID("aeb85e9b-ba6e-48ec-ac0f-7e4022d5f702"),
            name="L",
            start_at=datetime.datetime(2026, 4, 13, 4, 53, 5, 915713),
            due_at=datetime.datetime(2026, 6, 25, 13, 19, 3, 438026, fold=1),
            expected_hours=45,
            needed_skills=[],
        ),
        Task(
            identifier=UUID("9096569c-d5fd-42b2-88d5-d6aef797c2d3"),
            name="N0Q\x12 ",
            start_at=datetime.datetime(2026, 6, 10, 16, 32, 35, 669405),
            due_at=datetime.datetime(2026, 7, 1, 0, 0, fold=1),
            expected_hours=45,
            needed_skills=[
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
            ],
        ),
        Task(
            identifier=UUID("a55436ed-4695-412c-96d8-fcd5b6eea126"),
            name="hTu\tA7\x03P6Cj",
            start_at=datetime.datetime(2026, 5, 1, 23, 3, 43, 650002),
            due_at=datetime.datetime(2026, 7, 1, 0, 0),
            expected_hours=45,
            needed_skills=[
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
            ],
        ),
        Task(
            identifier=UUID("507f0911-33b2-47a8-a6bc-2ad00b7e5f4a"),
            name="bCD",
            start_at=datetime.datetime(2026, 2, 24, 3, 41, 35, 866792),
            due_at=datetime.datetime(2026, 6, 20, 19, 39, 58, 713296),
            expected_hours=45,
            needed_skills=[
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                )
            ],
        ),
        Task(
            identifier=UUID("129c98db-80a4-4b7d-9625-3a9d05e3bacf"),
            name="G?",
            start_at=datetime.datetime(2026, 4, 4, 13, 30, 2, 669981),
            due_at=datetime.datetime(2026, 4, 14, 5, 33, 57, 102323, fold=1),
            expected_hours=44,
            needed_skills=[],
        ),
        Task(
            identifier=UUID("520184c0-a23a-4eea-be7c-53ffa26fa143"),
            name="f%5Q\x13w8pKML\r,;",
            start_at=datetime.datetime(2026, 5, 10, 1, 43, 32, 223884),
            due_at=datetime.datetime(2026, 7, 1, 0, 0, fold=1),
            expected_hours=43,
            needed_skills=[
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
            ],
        ),
        Task(
            identifier=UUID("449c0a31-e638-45a1-97a8-9a9355f5affe"),
            name="P<mD9",
            start_at=datetime.datetime(2026, 2, 10, 4, 37, 19, 380804, fold=1),
            due_at=datetime.datetime(2026, 7, 1, 0, 0, fold=1),
            expected_hours=43,
            needed_skills=[
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                )
            ],
        ),
        Task(
            identifier=UUID("00c5bb7f-ddac-44be-b6b1-3a0786589450"),
            name="E\x0e<",
            start_at=datetime.datetime(2026, 2, 22, 17, 42, 20, 185739, fold=1),
            due_at=datetime.datetime(2026, 7, 1, 0, 0),
            expected_hours=40,
            needed_skills=[
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
            ],
        ),
        Task(
            identifier=UUID("ad21991d-bc08-471e-a20c-361451301ec3"),
            name="n\x0fBv\x01l",
            start_at=datetime.datetime(2026, 4, 26, 7, 21, 22, 17827, fold=1),
            due_at=datetime.datetime(2026, 5, 30, 5, 45, 16, 685982, fold=1),
            expected_hours=39,
            needed_skills=[
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
            ],
        ),
        Task(
            identifier=UUID("236f3b48-e984-4851-b04e-e73ba853bdb9"),
            name="g",
            start_at=datetime.datetime(2026, 1, 12, 18, 13, 49, 255714, fold=1),
            due_at=datetime.datetime(2026, 6, 17, 13, 9, 51, 968023),
            expected_hours=38,
            needed_skills=[
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
            ],
        ),
        Task(
            identifier=UUID("b90e257d-3fe3-45a6-b9ec-9612717245ef"),
            name="Rk9",
            start_at=datetime.datetime(2026, 1, 1, 10, 51, 56, 353503, fold=1),
            due_at=datetime.datetime(2026, 6, 8, 8, 47, 15, 186409),
            expected_hours=36,
            needed_skills=[],
        ),
        Task(
            identifier=UUID("45dcee8f-54b0-4725-93fb-aab0b693285c"),
            name=",./;'[]\\-=<>?:\"{}|_+!@#$%^&*()`~",
            start_at=datetime.datetime(2026, 1, 9, 21, 39, 19, 193844, fold=1),
            due_at=datetime.datetime(2026, 7, 1, 0, 0),
            expected_hours=35,
            needed_skills=[
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
            ],
        ),
        Task(
            identifier=UUID("2d2d6ec8-1462-48b1-a0de-38ab6d7756ca"),
            name="Ca\x0cz*%)\x053IQ\x11BjM;=Ou:",
            start_at=datetime.datetime(2026, 2, 24, 22, 14, 7, 758034),
            due_at=datetime.datetime(2026, 6, 20, 14, 21, 57, 665753),
            expected_hours=35,
            needed_skills=[],
        ),
        Task(
            identifier=UUID("8d6dfe61-fc7a-41bb-a8a2-20e7e58f9daf"),
            name=".Tn \x01d\r\x7fQ\x12|k0ZeH\x0bKQ\x16X`N\x7f\x17\x0fd",
            start_at=datetime.datetime(2026, 6, 24, 0, 0),
            due_at=datetime.datetime(2026, 7, 1, 0, 0),
            expected_hours=31,
            needed_skills=[
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
            ],
        ),
        Task(
            identifier=UUID("cb0a42c1-b226-4cce-a86d-5a092f211064"),
            name="\x1ar\x1c_]@7\x1f",
            start_at=datetime.datetime(2026, 2, 23, 6, 38, 52, 174654),
            due_at=datetime.datetime(2026, 5, 19, 14, 55, 40, 131652, fold=1),
            expected_hours=28,
            needed_skills=[
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                )
            ],
        ),
        Task(
            identifier=UUID("000a73c2-7880-4733-b683-b4c1b80d7570"),
            name="\\V",
            start_at=datetime.datetime(2026, 4, 4, 8, 33, 20, 193214),
            due_at=datetime.datetime(2026, 7, 1, 0, 0, fold=1),
            expected_hours=27,
            needed_skills=[
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                )
            ],
        ),
        Task(
            identifier=UUID("4ca81571-e636-4242-bbdb-572845e43572"),
            name="o\x05C",
            start_at=datetime.datetime(2026, 4, 1, 9, 43, 30, 424280, fold=1),
            due_at=datetime.datetime(2026, 4, 10, 14, 34, 9, 272697, fold=1),
            expected_hours=26,
            needed_skills=[
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
            ],
        ),
        Task(
            identifier=UUID("f32dbbc4-b380-4fff-82aa-811ae379de90"),
            name="\x1c(O",
            start_at=datetime.datetime(2026, 2, 7, 13, 38, 44, 112219, fold=1),
            due_at=datetime.datetime(2026, 4, 13, 17, 15, 49, 312865, fold=1),
            expected_hours=26,
            needed_skills=[],
        ),
        Task(
            identifier=UUID("2281165c-2cac-4b14-8942-2b08904c819e"),
            name="h1\x0ck>",
            start_at=datetime.datetime(2026, 1, 21, 8, 57, 6, 935934, fold=1),
            due_at=datetime.datetime(2026, 1, 27, 12, 19, 8, 824093, fold=1),
            expected_hours=25,
            needed_skills=[
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
            ],
        ),
        Task(
            identifier=UUID("82c579cd-9a20-43cc-8205-2b86e10a397f"),
            name="\x08\x07",
            start_at=datetime.datetime(2026, 3, 3, 19, 50, 39, 918741, fold=1),
            due_at=datetime.datetime(2026, 4, 21, 4, 5, 42, 40296),
            expected_hours=25,
            needed_skills=[
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                )
            ],
        ),
        Task(
            identifier=UUID("42ab6719-470c-4c87-a7a4-249c18a08d8f"),
            name="b\x7f\nn",
            start_at=datetime.datetime(2026, 3, 17, 11, 10, 56, 611357),
            due_at=datetime.datetime(2026, 7, 1, 0, 0),
            expected_hours=24,
            needed_skills=[
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
            ],
        ),
        Task(
            identifier=UUID("2dfc6ed5-1874-4985-b9e4-0885c936ec63"),
            name="\x0fX",
            start_at=datetime.datetime(2026, 4, 29, 23, 32, 3, 205346),
            due_at=datetime.datetime(2026, 4, 30, 23, 35, 19, 566693),
            expected_hours=24,
            needed_skills=[
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
            ],
        ),
        Task(
            identifier=UUID("6ce333a8-a493-4d8e-9799-c575af7ee7cb"),
            name="DYPXq\x18\x1e",
            start_at=datetime.datetime(2026, 5, 6, 19, 50, 56, 560146),
            due_at=datetime.datetime(2026, 5, 27, 17, 34, 22, 756823),
            expected_hours=24,
            needed_skills=[
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
            ],
        ),
        Task(
            identifier=UUID("8843a5d4-e8d6-43eb-ae93-0ceaa95434d7"),
            name="z{AdR>*:\x7f36Ea4\x0ca",
            start_at=datetime.datetime(2026, 6, 9, 0, 57, 41, 670729, fold=1),
            due_at=datetime.datetime(2026, 6, 27, 11, 24, 51, 916175),
            expected_hours=23,
            needed_skills=[
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                )
            ],
        ),
        Task(
            identifier=UUID("0364c01b-b0f8-4710-a4bc-e7a3afba6428"),
            name="zvv\x11",
            start_at=datetime.datetime(2026, 6, 7, 6, 26, 16, 621365, fold=1),
            due_at=datetime.datetime(2026, 6, 14, 13, 26, 4, 357954),
            expected_hours=22,
            needed_skills=[
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
            ],
        ),
        Task(
            identifier=UUID("1ab46faa-538b-41c5-a1de-318f957e9c2d"),
            name='j\x1baMm_["mTd"',
            start_at=datetime.datetime(2026, 1, 21, 8, 57, 6, 935934, fold=1),
            due_at=datetime.datetime(2026, 4, 11, 23, 56, 13, 510509),
            expected_hours=20,
            needed_skills=[],
        ),
        Task(
            identifier=UUID("4441e362-87db-4696-a1bf-c31c82d15a4f"),
            name="\x13D%",
            start_at=datetime.datetime(2026, 1, 19, 12, 15, 13, 723581, fold=1),
            due_at=datetime.datetime(2026, 4, 25, 3, 23, 48, 828332, fold=1),
            expected_hours=19,
            needed_skills=[
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
            ],
        ),
        Task(
            identifier=UUID("6fc0dfd8-3f2b-45d5-bf3a-7cb8df04c198"),
            name="U\x13IG\x135f~",
            start_at=datetime.datetime(2026, 1, 6, 1, 36, 56, 476812),
            due_at=datetime.datetime(2026, 3, 3, 1, 27, 29, 469826),
            expected_hours=18,
            needed_skills=[
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
            ],
        ),
        Task(
            identifier=UUID("df40aae1-47e6-4c36-92c9-02aa90147441"),
            name="eeb\x03::\x1dB\x00\x1dUDm.`\x01",
            start_at=datetime.datetime(2026, 1, 18, 20, 53, 59, 765087, fold=1),
            due_at=datetime.datetime(2026, 1, 28, 16, 1, 36, 56480, fold=1),
            expected_hours=18,
            needed_skills=[
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                )
            ],
        ),
        Task(
            identifier=UUID("bbe86a6f-689b-4bdc-b9ee-e27a42e979be"),
            name="w]l",
            start_at=datetime.datetime(2026, 2, 4, 6, 23, 33, 253383, fold=1),
            due_at=datetime.datetime(2026, 4, 5, 15, 4, 21, 799915),
            expected_hours=18,
            needed_skills=[
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
            ],
        ),
        Task(
            identifier=UUID("940d01ac-f04c-4af2-8ee8-34e8c4cdc646"),
            name="nD\x05r<\x03",
            start_at=datetime.datetime(2026, 4, 23, 20, 56, 20, 550864, fold=1),
            due_at=datetime.datetime(2026, 4, 24, 20, 58, 27, 200),
            expected_hours=16,
            needed_skills=[
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
            ],
        ),
        Task(
            identifier=UUID("78e10ae5-63f7-4889-b62a-aad9ba919777"),
            name="y.u'\x02m\x1c",
            start_at=datetime.datetime(2026, 2, 5, 17, 55, 8, 262143, fold=1),
            due_at=datetime.datetime(2026, 2, 24, 18, 6, 3, 706115),
            expected_hours=16,
            needed_skills=[
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
            ],
        ),
        Task(
            identifier=UUID("ecba5838-b6e3-4437-b91b-bbdfa8bc4ab0"),
            name="x",
            start_at=datetime.datetime(2026, 5, 27, 1, 29, 42, 698664, fold=1),
            due_at=datetime.datetime(2026, 5, 31, 8, 51, 38, 596395, fold=1),
            expected_hours=15,
            needed_skills=[],
        ),
        Task(
            identifier=UUID("6b3ca26c-d4a1-4a43-be1b-8a63a77489c4"),
            name="Nd\x1f",
            start_at=datetime.datetime(2026, 6, 9, 5, 32, 48, 303069, fold=1),
            due_at=datetime.datetime(2026, 6, 19, 23, 25, 23, 87910, fold=1),
            expected_hours=14,
            needed_skills=[
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
            ],
        ),
        Task(
            identifier=UUID("c02094b0-b24d-49f7-aa0b-f56cdc5c2add"),
            name="e\x14\x16,\x00\x1e=",
            start_at=datetime.datetime(2026, 4, 2, 11, 34, 1, 737812, fold=1),
            due_at=datetime.datetime(2026, 4, 28, 9, 5, 13, 218371),
            expected_hours=13,
            needed_skills=[
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
            ],
        ),
        Task(
            identifier=UUID("7c1d2583-e8d1-4b89-8be2-67c0e9b39147"),
            name="y\x14}_",
            start_at=datetime.datetime(2026, 2, 6, 17, 3, 8, 453807, fold=1),
            due_at=datetime.datetime(2026, 6, 17, 19, 33, 15, 710722, fold=1),
            expected_hours=13,
            needed_skills=[],
        ),
        Task(
            identifier=UUID("49075e8f-651f-41f7-9fc5-ca862f7ba766"),
            name="HS",
            start_at=datetime.datetime(2026, 1, 28, 0, 48, 19, 466392),
            due_at=datetime.datetime(2026, 1, 29, 9, 29, 18, 5631, fold=1),
            expected_hours=13,
            needed_skills=[
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                )
            ],
        ),
        Task(
            identifier=UUID("9cc70ee1-59df-446e-a262-576a4f7301b4"),
            name=";\x7f.@FHL",
            start_at=datetime.datetime(2026, 2, 17, 9, 41, 51, 647854),
            due_at=datetime.datetime(2026, 5, 13, 7, 9, 13, 48226),
            expected_hours=13,
            needed_skills=[
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                )
            ],
        ),
        Task(
            identifier=UUID("70f4faed-8a4c-41bf-b7f9-c7abec2392d4"),
            name="9",
            start_at=datetime.datetime(2026, 3, 29, 14, 40, 26, 425616, fold=1),
            due_at=datetime.datetime(2026, 3, 30, 18, 38, 4, 57705, fold=1),
            expected_hours=11,
            needed_skills=[
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
            ],
        ),
        Task(
            identifier=UUID("e9199d65-c52e-460a-8812-2de66d449b8a"),
            name="p\r",
            start_at=datetime.datetime(2026, 1, 24, 8, 27, 46, 239),
            due_at=datetime.datetime(2026, 4, 5, 17, 8, 19, 278395),
            expected_hours=11,
            needed_skills=[],
        ),
        Task(
            identifier=UUID("941a6076-a82f-4c4b-8eac-794d33923c90"),
            name="@y\x13[p",
            start_at=datetime.datetime(2026, 1, 26, 4, 12, 6, 722575, fold=1),
            due_at=datetime.datetime(2026, 7, 1, 0, 0),
            expected_hours=10,
            needed_skills=[
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
            ],
        ),
        Task(
            identifier=UUID("0bbe6775-f9c6-414a-8170-b0f31f3007ac"),
            name="2h",
            start_at=datetime.datetime(2026, 4, 27, 23, 1, 6, 828822, fold=1),
            due_at=datetime.datetime(2026, 4, 28, 23, 30, 44, 434652),
            expected_hours=10,
            needed_skills=[
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                )
            ],
        ),
        Task(
            identifier=UUID("8a939946-95f9-40c5-acc0-45954243ed0c"),
            name="\\jgL",
            start_at=datetime.datetime(2026, 2, 24, 10, 7, 58, 91427, fold=1),
            due_at=datetime.datetime(2026, 5, 5, 22, 10, 56, 28357, fold=1),
            expected_hours=9,
            needed_skills=[
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                )
            ],
        ),
        Task(
            identifier=UUID("50c3f71a-dc07-4289-924f-2e0116e63a20"),
            name="e@mF",
            start_at=datetime.datetime(2026, 3, 26, 22, 50, 26, 743460),
            due_at=datetime.datetime(2026, 4, 27, 3, 47, 22, 819812),
            expected_hours=9,
            needed_skills=[],
        ),
        Task(
            identifier=UUID("85da6969-2feb-4088-83a1-b32a8ab8d6ce"),
            name="{",
            start_at=datetime.datetime(2026, 1, 18, 7, 41, 42, 224900, fold=1),
            due_at=datetime.datetime(2026, 4, 10, 21, 58, 25, 376762, fold=1),
            expected_hours=8,
            needed_skills=[],
        ),
        Task(
            identifier=UUID("f70a1995-6045-45d6-b072-9c57d3b64739"),
            name="n\x122cQ",
            start_at=datetime.datetime(2026, 4, 6, 16, 41, 18, 231296),
            due_at=datetime.datetime(2026, 7, 1, 0, 0, fold=1),
            expected_hours=8,
            needed_skills=[
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
            ],
        ),
        Task(
            identifier=UUID("62dc21b5-6e76-4ee6-abfc-7697919fa7f3"),
            name="g",
            start_at=datetime.datetime(2026, 3, 16, 3, 7, 37, 331607),
            due_at=datetime.datetime(2026, 7, 1, 0, 0),
            expected_hours=8,
            needed_skills=[
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
            ],
        ),
        Task(
            identifier=UUID("e57b0309-52ae-4aa0-8083-a2614a1c0c9d"),
            name="\x13",
            start_at=datetime.datetime(2026, 2, 8, 21, 8, 13, 21401),
            due_at=datetime.datetime(2026, 6, 24, 5, 34, 24, 378503),
            expected_hours=6,
            needed_skills=[
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
            ],
        ),
        Task(
            identifier=UUID("1674abd9-e549-4d6c-af2a-00a4d318b2e4"),
            name="None",
            start_at=datetime.datetime(2026, 3, 14, 0, 7, 59, 73642, fold=1),
            due_at=datetime.datetime(2026, 3, 18, 18, 6, 0, 524289),
            expected_hours=5,
            needed_skills=[
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
            ],
        ),
        Task(
            identifier=UUID("1f8575f9-e7b2-4b48-9292-a92b1afe39be"),
            name="J)x",
            start_at=datetime.datetime(2026, 6, 9, 5, 58, 30, 575886),
            due_at=datetime.datetime(2026, 7, 1, 0, 0),
            expected_hours=5,
            needed_skills=[
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
            ],
        ),
        Task(
            identifier=UUID("1a4cfe59-8750-4843-baa5-56d05c7d5a42"),
            name="U&",
            start_at=datetime.datetime(2026, 1, 28, 17, 53, 21, 521539, fold=1),
            due_at=datetime.datetime(2026, 6, 25, 3, 7, 1, 659809),
            expected_hours=5,
            needed_skills=[
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
            ],
        ),
        Task(
            identifier=UUID("fd78e665-3e43-47ae-92db-c18612cc7289"),
            name="9.5\x163eY",
            start_at=datetime.datetime(2026, 6, 24, 0, 0, fold=1),
            due_at=datetime.datetime(2026, 6, 30, 22, 48, 46, 614698),
            expected_hours=5,
            needed_skills=[
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("f84e501d-7aa5-4282-88c3-a5edf8a5b75d"), name="\x00"
                ),
                Skill(
                    identifier=UUID("9b1e2587-e240-4633-a88c-10d7ca2d446c"),
                    name=" \x1a",
                ),
            ],
        ),
        Task(
            identifier=UUID("56d6d0c5-286b-4355-b142-981af32f4c6c"),
            name="MODULE__BLAKE2_STATE",
            start_at=datetime.datetime(2026, 4, 5, 2, 23, 37, 458928, fold=1),
            due_at=datetime.datetime(2026, 4, 20, 16, 7, 59, 640184, fold=1),
            expected_hours=5,
            needed_skills=[],
        ),
        Task(
            identifier=UUID("616f4220-f442-488e-9c71-f448784ea852"),
            name="p\r",
            start_at=datetime.datetime(2026, 4, 12, 14, 16, 41, 687469),
            due_at=datetime.datetime(2026, 5, 3, 3, 46, 5, 818436, fold=1),
            expected_hours=3,
            needed_skills=[
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
            ],
        ),
        Task(
            identifier=UUID("b54d8916-5d85-4a25-8b1f-17600a1d3986"),
            name="wOQ=G?\x06\x1c\x0fv8L",
            start_at=datetime.datetime(2026, 6, 19, 12, 11, 25, 283316, fold=1),
            due_at=datetime.datetime(2026, 6, 20, 17, 20, 10, 288787),
            expected_hours=2,
            needed_skills=[
                Skill(
                    identifier=UUID("2a9b8350-aeed-4f8a-9331-6142e7f0ab01"), name="\x00"
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
            ],
        ),
        Task(
            identifier=UUID("12435568-7ed8-4b43-9c30-a0aa7a18c699"),
            name="7e\x10AW_5",
            start_at=datetime.datetime(2026, 6, 17, 22, 56, 7, 881313),
            due_at=datetime.datetime(2026, 7, 1, 0, 0, fold=1),
            expected_hours=1,
            needed_skills=[
                Skill(
                    identifier=UUID("d9759af2-b66e-439f-8fcc-dccd91c198d5"),
                    name="%\x1e/m2",
                ),
                Skill(
                    identifier=UUID("86592a8b-c19d-4ba2-8d50-16869319d328"),
                    name=" \x1a",
                ),
            ],
        ),
    ]

    cosim_scheduling(users, tasks)


def run_examples():
    run_example1()


def main():
    run()
    # run_examples()


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
