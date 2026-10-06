FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY index.js ./
COPY config.js ./
COPY core ./core
COPY plugins ./plugins
EXPOSE 10000
CMD ["npm","start"]