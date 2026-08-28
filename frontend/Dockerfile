FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# CRA 5 / webpack 4 needs the OpenSSL legacy provider on Node 17+.
# Empty API URL = same-origin requests, proxied by nginx.
ENV NODE_OPTIONS=--openssl-legacy-provider
ENV REACT_APP_API_URL=
ENV GENERATE_SOURCEMAP=false
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
