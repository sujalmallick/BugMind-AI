FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Run as an unprivileged user: a compromised app process can't modify the
# image's code or system files. uploads/ is the only path it writes.
RUN useradd --create-home --uid 10001 bugmind \
    && mkdir -p /app/uploads \
    && chown -R bugmind:bugmind /app/uploads
USER bugmind
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --timeout 300"]
