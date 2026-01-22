FROM nginx:alpine

# Copy static assets to nginx html directory
COPY . /usr/share/nginx/html

# Expose port 80
EXPOSE 8080
