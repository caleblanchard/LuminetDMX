# Multi-stage build: build Angular frontend, then run Node backend serving static files

FROM node:18-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM node:18-alpine AS backend
WORKDIR /app
ENV NODE_ENV=production
COPY backend/package*.json ./
RUN npm ci --only=production
COPY backend/ .

RUN apk add --no-cache tzdata

RUN ln -sf /usr/share/zoneinfo/${TZ} /etc/localtime

# Copy built frontend into backend public directory
COPY --from=frontend-builder /frontend/dist/luminet-dmx/browser /app/public

EXPOSE 3000
CMD ["node", "server.js"]

