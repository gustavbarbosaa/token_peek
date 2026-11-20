FROM node:22-bookworm-slim AS development
WORKDIR /app
COPY package*.json ./
RUN HUSKY=0 npm ci --no-audit --no-fund
COPY . .
EXPOSE 1420
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM development AS build
RUN npm run build
