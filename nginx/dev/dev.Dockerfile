FROM nginx

RUN rm /etc/nginx/conf.d/* 

# Copy config files
# *.conf files in "conf.d/" dir get included in main config
COPY ./dev/default.conf /etc/nginx/conf.d/default.conf
COPY ./nginx.conf /etc/nginx/
COPY ./mime.types /etc/nginx/
