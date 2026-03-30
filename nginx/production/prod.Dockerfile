FROM nginx

RUN rm /etc/nginx/conf.d/* 

# Copy config files
# *.conf files in "conf.d/" dir get included in main config
COPY ./production/default.conf /etc/nginx/conf.d/default.conf
COPY ./nginx.conf /etc/nginx/
COPY ./mime.types /etc/nginx/

# RUN mkdir /var/www/letsencrypt
# TODO: Add SSL certificates for production
# COPY ./production/certs/www..ru.crt /etc/nginx/certs/
# COPY ./production/certs/www..ru.key /etc/nginx/certs/
