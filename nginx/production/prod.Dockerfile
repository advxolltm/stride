FROM nginx:1.27-alpine AS production

RUN rm /etc/nginx/conf.d/* 

COPY ./nginx.conf /etc/nginx/
COPY ./mime.types /etc/nginx/
COPY ./production/render-conf.sh /docker-entrypoint.d/40-render-production-conf.sh

RUN chmod +x /docker-entrypoint.d/40-render-production-conf.sh
