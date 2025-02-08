# Use an appropriate Node.js base image
FROM node:18-alpine

# Set ENV vairables
ENV SCREENSHOT_API none
ENV OPEN_IN_NEW_TAB false

# Set the working directory inside the container
WORKDIR /

# Copy package.json and package-lock.json (if it exists)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port your app listens on
EXPOSE 3000

# Define the command to run your app
CMD ["node", "index.js"]