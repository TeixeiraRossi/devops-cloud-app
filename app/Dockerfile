FROM node:24-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY public ./public

ARG APP_VERSION=1.0
ENV NODE_ENV=production APP_VERSION=${APP_VERSION}
USER node
EXPOSE 3000
CMD ["node", "server.js"]
