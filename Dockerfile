FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends unzip ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx vite build
ENV HOST=0.0.0.0 PORT=8787
EXPOSE 8787
# Stage data at build or mount a pre-staged /app/data volume:  docker compose run --rm app npm run stage
CMD ["node", "server/index.mjs"]
