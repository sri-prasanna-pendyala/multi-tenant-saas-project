FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Accept build arg so REACT_APP_API_URL is baked into the React bundle
ARG REACT_APP_API_URL=http://localhost:5000/api
ENV REACT_APP_API_URL=$REACT_APP_API_URL

EXPOSE 3000

# Disable host check so Docker port mapping works
ENV DANGEROUSLY_DISABLE_HOST_CHECK=true
ENV WDS_SOCKET_HOST=localhost
ENV WATCHPACK_POLLING=true

CMD ["npm", "start"]
