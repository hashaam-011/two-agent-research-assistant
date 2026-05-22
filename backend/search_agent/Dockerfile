FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/search_agent/ ./search_agent/
ENV SEARCH_AGENT_HOST=0.0.0.0
ENV SEARCH_AGENT_PORT=8002
ENV MCP_SERVER_URL=http://mcp-server:8001/mcp
EXPOSE 8002
CMD ["python", "search_agent/main.py"]
