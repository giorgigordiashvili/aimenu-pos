# syntax=docker/dockerfile:1
# ---- build: export Expo web (static SPA) ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# EXPO_PUBLIC_* are baked at build time — passed as a build arg by compose.
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
RUN npx expo export --platform web --output-dir dist

# ---- serve: static files via Caddy (SPA fallback) ----
FROM caddy:2-alpine AS runner
COPY --from=builder /app/dist /srv
# SPA: serve files, fall back to index.html for client-side routes.
RUN printf ':80 {\n\troot * /srv\n\tencode gzip\n\ttry_files {path} /index.html\n\tfile_server\n}\n' > /etc/caddy/Caddyfile
EXPOSE 80
