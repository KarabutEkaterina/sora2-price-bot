FROM node:14-alpine

RUN apk update

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm install

COPY src /app/src

CMD ["node", "--require", "ts-node/register", "src/main.ts" ]