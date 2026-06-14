FROM python:3.14.4-bookworm

# Source - https://stackoverflow.com/a/25423366
# Posted by Anubhav Sinha, modified by community. See post 'Timeline' for change history
# Retrieved 2026-05-11, License - CC BY-SA 3.0

SHELL ["/bin/bash", "-c"]


WORKDIR /app

RUN python -m venv sched_venv
RUN source sched_venv/bin/activate
RUN pip install ortools msgspec

EXPOSE 7270

CMD ["python", "scheduler.service.py"]