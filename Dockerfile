FROM node:4.3.1
ADD . /opt/api
WORKDIR /opt/api
RUN npm install --loglevel warn
CMD ["npm", "start"]
