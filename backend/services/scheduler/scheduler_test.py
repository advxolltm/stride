import sys
from timeit import default_timer as timer
import time
from functools import reduce
from dateutil.relativedelta import relativedelta
from datetime import datetime
import scheduler
from hypothesis import given, settings, assume, Phase
from hypothesis import strategies as st
from hypothesis.strategies import DrawFn, DataObject
import tracemalloc


def unique_by_name(s):
    return s.name

@st.composite
def weekday_datetime(draw: DrawFn, min_date: datetime, max_date: datetime) -> datetime:
    d = draw(st.datetimes(min_date, max_date))
    if d.weekday() >= 5:
        return d - relativedelta(days=2)
    else:
        return d

@st.composite
def asciitext(draw: DrawFn) -> str:
    return draw(st.text(st.characters(codec="ascii"), min_size=1))


@st.composite
def skill(draw: DrawFn) -> scheduler.Skill:
    skill_name = draw(asciitext())
    return scheduler.Skill(skill_name)


@st.composite
def user(draw: DrawFn, skills: list[scheduler.Skill]) -> scheduler.User:
    name = draw(asciitext())
    if len(skills) == 0:
        subset_skills = []
    else:
        subset_skills = draw(
            st.lists(st.sampled_from(skills), unique_by=unique_by_name)
        )
    weekly_hours = draw(st.integers(0, 144))
    return scheduler.User(name=name, skills=subset_skills, weekly_hours=weekly_hours)


@st.composite
def task(
    draw: DrawFn,
    skills: list[scheduler.Skill],
    min_date: datetime,
    max_date: datetime,
    min_skills=0,
) -> scheduler.Task:
    name = draw(asciitext())
    start_at = draw(weekday_datetime(min_date, max_date - relativedelta(days=1)))
    due_at = draw(weekday_datetime(start_at + relativedelta(days=1), max_date))
    max_hours = (due_at - start_at).seconds // 3600
    expected_hours = draw(st.integers(min_value=0, max_value=max_hours))
    needed_skills = draw(
        st.lists(st.sampled_from(skills), unique_by=unique_by_name, min_size=min_skills)
    )
    return scheduler.Task(
        name=name,
        start_at=start_at,
        due_at=due_at,
        expected_hours=expected_hours,
        needed_skills=list(needed_skills),
    )


@st.composite
def new_skill(draw: DrawFn, skills: list[scheduler.Skill]) -> scheduler.Skill:
    unique_skill_name: str = reduce(
        lambda acc, s: acc + s, map(lambda s: s.name, skills)
    )
    return scheduler.Skill(draw(asciitext()) + unique_skill_name)


@st.composite
def luigi(
    draw: DrawFn, skills: list[scheduler.Skill], min_date: datetime, max_date: datetime
) -> tuple[scheduler.User, scheduler.Task]:
    # we first define a new skill, that is not assigned to any user at all
    skill = draw(new_skill(skills))
    skill.name = "luigi-skill-" + skill.name

    # loser luigi is then the only one who gets this skill
    luigi = draw(user(skills))
    luigi.name = "luigi-" + luigi.name
    luigi.skills.append(skill)

    # we then define a task that requires this skill
    # since luigi is the only one who has that skill, he is the only one who could be assigned to the task
    luigi_task = draw(task(skills, min_date, max_date))
    luigi_task.needed_skills.append(skill)
    luigi_task.name = "luigi-task-" + luigi_task.name

    # however, luigi does provide enough working time to actually complete the task
    # TODO: maybe draw a random number, where (num * 40) * weeks < expected_work_time of the task
    if luigi_task.expected_hours == 0:
        luigi_task.expected_hours = 1
    luigi.weekly_hours = 0

    return (luigi, luigi_task)


@st.composite
def wario(
    draw: DrawFn,
    skills: list[scheduler.Skill],
    tasks: list[scheduler.Task],
    min_date: datetime,
    max_date: datetime,
) -> tuple[scheduler.User, list[scheduler.Task]]:
    # we first define a new skill, that is not assigned to any user at all
    num_new_skills = draw(st.integers(min_value=1, max_value=10))
    wario_skills = []
    for _ in range(num_new_skills):
        new_s = draw(new_skill(skills))
        skills.append(new_s)
        wario_skills.append(new_s)

    # workaholic wario has all the skills and infinite working hours
    wario = draw(user([]))
    wario.name = "wario-" + wario.name
    wario.skills = skills

    # some tasks only contain skills that only wario has, they should be assignable too!
    wario_tasks = draw(st.lists(task(wario_skills, min_date, max_date, 1), min_size=1))
    for wt in wario_tasks:
        wt.name = "wario-task-" + wt.name

    # however, luigi does provide enough working time to actually complete the task

    tmp_tasks = tasks + wario_tasks
    wario.weekly_hours = sum(map(lambda t: t.expected_hours, tmp_tasks)) + 1

    return (wario, wario_tasks)


min_size = 1
max_size = 30

min_date = datetime(2026, 1, 1)
max_date = min_date + relativedelta(years=1)


@settings(deadline=60 * 1000)
@given(
    st.data(),
    st.lists(skill(), unique_by=unique_by_name, min_size=min_size, max_size=max_size),
)
def test_loser_luigi_scheduling(data: DataObject, skills: list[scheduler.Skill]):
    users = data.draw(
        st.lists(
            user(list(skills)),
            unique_by=unique_by_name,
            min_size=min_size,
            max_size=max_size,
        )
    )

    tasks = data.draw(
        st.lists(
            task(list(skills), min_date, max_date),
            unique_by=unique_by_name,
            min_size=min_size,
            max_size=max_size,
        )
    )

    random_luigi, random_luigi_task = data.draw(luigi(skills, min_date, max_date))
    users.append(random_luigi)
    tasks.append(random_luigi_task)

    result = scheduler.schedule_tasks_to_members(users, tasks)

    # luigi is not assigned to his task
    assert (random_luigi, random_luigi_task) not in result

    # the luigi task isn't assigned to anyone else either
    for _, t in result:
        assert t != random_luigi_task


@settings(deadline=60 * 1000)
@given(
    st.data(),
    st.lists(skill(), unique_by=unique_by_name, min_size=min_size, max_size=max_size),
)
def test_workaholic_wario_scheduling(data: DataObject, skills: list[scheduler.Skill]):
    users = data.draw(
        st.lists(
            user(list(skills)),
            unique_by=unique_by_name,
            min_size=min_size,
            max_size=max_size,
        )
    )

    tasks = data.draw(
        st.lists(
            task(list(skills), min_date, max_date),
            unique_by=unique_by_name,
            min_size=min_size,
            max_size=max_size,
        )
    )

    random_wario, random_wario_tasks = data.draw(
        wario(skills, tasks, min_date, max_date)
    )
    # print("wario: ", random_wario)
    # print("wario tasks: ", random_wario_tasks)

    users.append(random_wario)
    tasks.extend(random_wario_tasks)

    result = scheduler.schedule_tasks_to_members(users, tasks)

    # wario should be assigned to every "wario-task"
    for wt in random_wario_tasks:
        if (random_wario, wt) not in result:
            print(f"({random_wario}, {wt}) not in {result}")
        assert (random_wario, wt) in result

    # all tasks should be assigned
    # assigned_tasks = list(map(lambda x: x[1], result))
    # print(
    #     "tasks: ",
    #     len(tasks),
    #     tasks,
    #     "assigned tasks: ",
    #     len(assigned_tasks),
    #     assigned_tasks,
    #     "users: ",
    #     len(users),
    #     users,
    #     "result: ",
    #     result,
    # )
    # for t in tasks:
    #     assert t in assigned_tasks
