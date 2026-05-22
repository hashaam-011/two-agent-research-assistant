FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY planner_agent/ ./planner_agent/
ENV PLANNER_HOST=0.0.0.0
ENV PLANNER_PORT=8000
ENV SEARCH_AGENT_URL=http://search-agent:8002
EXPOSE 8000
CMD ["python", "planner_agent/main.py"]
