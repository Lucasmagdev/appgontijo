#!/usr/bin/env bash
# Auto-sync das sondagens (cron no VPS, 1x/hora).
# 1) puxa cards novos do Pipefy + baixa arquivos que faltam no disco
# 2) geocodifica linhas novas pro mapa
# Lock evita rodadas sobrepostas (uma rodada longa nao colide com a proxima).
set -u
cd "$(dirname "$0")/.." || exit 1

exec 9>/tmp/sond-sync.lock
if ! flock -n 9; then
  echo "$(date '+%F %T') ja existe rodada em andamento, pulando"
  exit 0
fi

NODE="$(command -v node || echo /usr/bin/node)"
echo "==== $(date '+%F %T') sync sondagens ===="
"$NODE" scripts/sync-sondagens-pipefy.js --fill-disk
echo "---- geocode ----"
"$NODE" scripts/geocode-sondagens.js
echo "==== fim $(date '+%F %T') ===="
