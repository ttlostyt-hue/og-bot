# Use the official, lightweight Node.js image
FROM node:20-slim

# Set the working directory inside the server
WORKDIR /app

# Copy the package.json file first
COPY package.json ./

# Install the Discord.js dependency
RUN npm install

# Copy the rest of your files (like bot.js)
COPY . .

# The command to start the bot
CMD ["node", "bot.js"]