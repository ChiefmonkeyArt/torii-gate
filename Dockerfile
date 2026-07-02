# syntax=docker/dockerfile:1
#
# Torii Quest — self-hosting image.
# Multi-stage: builds the static Vite game, then serves it with Caddy.
# Caddy also reverse-proxies /relay -> the strfry sidecar (see docker-compose.yml).
#
# Build:   docker compose build
# Run:     docker compose up -d

## ---- Stage 1: build the static game (dist/) ----
FROM node:20-alpine AS build
WORKDIR /app

# Install deps first for layer caching
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build (build:continuum + vite build -> dist/)
COPY . .
RUN npm run build

## ---- Stage 2: serve with Caddy ----
FROM caddy:2-alpine

# Caddyfile is read by the official image from /etc/caddy/Caddyfile
COPY Caddyfile /etc/caddy/Caddyfile

# Baked static build (immutable, served from S3-less local file_server)
COPY --from=build /app/dist /srv

EXPOSE 80 443
