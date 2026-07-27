# syntax=docker/dockerfile:1

# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- serve stage ----
FROM nginx:alpine AS serve
# Default port for local runs; hosts like Render override PORT at runtime.
ENV PORT=8080
COPY --from=build /app/dist /usr/share/nginx/html
# nginx:alpine's entrypoint runs envsubst on templates -> /etc/nginx/conf.d/
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 8080
