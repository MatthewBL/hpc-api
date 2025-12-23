#!/usr/bin/env bash
set -euo pipefail

# Load .env into environment if present
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Submit job, exporting full environment for the script
sbatch --export=ALL --nodelist="${BACKEND_NODE}" run_api.sh
