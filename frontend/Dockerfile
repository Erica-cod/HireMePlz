FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json next.config.mjs next-env.d.ts ./
COPY app ./app
COPY components ./components
COPY lib ./lib
COPY types ./types

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
