FROM python:3.14.4-bookworm

WORKDIR /app

RUN python -m venv sched_venv
ENV PATH="/app/sched_venv/bin:$PATH"

RUN pip install --no-cache-dir ortools msgspec

COPY scheduler.service.py /app/scheduler.service.py

EXPOSE 7270

CMD ["python", "scheduler.service.py"]
