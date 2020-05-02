FROM node:lts

WORKDIR /var/www/service

COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 8080

CMD ["npm", "start"]