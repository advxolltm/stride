FROM python:3.14.4-bookworm

WORKDIR /app

# 1. Copy the code into the image so it exists natively inside the container
COPY . /app

# 2. Set up the virtual environment the Docker-native way
RUN python -m venv sched_venv
ENV PATH="/app/sched_venv/bin:$PATH"

RUN pip install --no-cache-dir ortools msgspec

EXPOSE 7270

CMD ["python", "scheduler.service.py"]