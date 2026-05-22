FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV NEXT_PUBLIC_AGENT_URL=/api/agent
ENV PLANNER_URL=http://planner-agent:8000/agent
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
