FROM mcr.microsoft.com/playwright:v1.49.1-noble

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

ENV NODE_ENV=production
ENV HEADLESS=true

CMD ["node", "dist/index.js"]
