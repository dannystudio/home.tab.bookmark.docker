# syntax=docker.io/docker/dockerfile:1.7-labs

# Use an appropriate Node.js base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /

# Copy package.json and package-lock.json (if it exists)
COPY package*.json ./
COPY verdana.ttf /usr/share/fonts/

# Install dependencies
RUN npm install --production

# Copy the rest of the application code
COPY --exclude=*.ttf . .

# Expose the port your app listens on
EXPOSE 3000

# Define the command to run your app
CMD ["node", "index.js"]