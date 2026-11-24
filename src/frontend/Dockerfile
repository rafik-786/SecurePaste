FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .
ARG VITE_SOURCE_URL
ENV VITE_SOURCE_URL=$VITE_SOURCE_URL
RUN npm run build && rm -rf dist/.vite

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
