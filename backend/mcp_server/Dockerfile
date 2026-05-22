FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/mcp_server/ ./mcp_server/
ENV MCP_HOST=0.0.0.0
ENV MCP_PORT=8001
EXPOSE 8001
CMD ["python", "mcp_server/main.py"]
