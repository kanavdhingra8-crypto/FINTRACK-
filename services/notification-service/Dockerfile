FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node src ./src
USER node

EXPOSE 4003
CMD ["npm", "start"]
