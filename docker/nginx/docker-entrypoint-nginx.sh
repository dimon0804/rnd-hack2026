#!/bin/sh
set -e
export DEPLOY_DOMAIN="${DEPLOY_DOMAIN:-rnd-hack.clv-digital.tech}"
envsubst '${DEPLOY_DOMAIN}' < /etc/nginx/templates/nginx.prod.conf.template > /etc/nginx/nginx.conf
exec nginx -g 'daemon off;'
