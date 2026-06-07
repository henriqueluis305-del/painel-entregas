# ============================================================================
# Dockerfile — Reflex em container único (para Render web service free)
# ============================================================================
# O Reflex roda 2 processos: frontend estático (:3000) e backend websocket (:8000).
# O Render free expõe UMA porta, então usamos o Caddy como reverse-proxy:
# serve o front compilado e encaminha as rotas internas (_event/_upload/ping)
# para o backend.
#
# NOTA: ponto de partida baseado no padrão oficial do Reflex (docker-example).
# Validar/ajustar na fase de deploy (Fase 0).
# ============================================================================

FROM python:3.13-slim

RUN apt-get update && apt-get install -y --no-install-recommends caddy curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Compila o frontend estático em /app/.web/_static
RUN reflex export --frontend-only --no-zip

ENV PORT=8080
EXPOSE 8080

# Sobe backend (porta 8000) + Caddy (porta $PORT) servindo o front e fazendo proxy.
CMD reflex run --env prod --backend-only & \
    caddy run --config /app/Caddyfile --adapter caddyfile
