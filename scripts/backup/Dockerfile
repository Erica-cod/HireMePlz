FROM postgres:16-alpine

RUN apk add --no-cache aws-cli

COPY backup.sh /backup.sh
RUN chmod +x /backup.sh

# Run backup daily at 02:00 UTC
RUN echo "0 2 * * * /backup.sh >> /var/log/backup.log 2>&1" > /etc/crontabs/root

CMD ["crond", "-f", "-l", "2"]
