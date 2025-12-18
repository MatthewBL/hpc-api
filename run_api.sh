#!/bin/bash
#SBATCH --cpus-per-task=1 -t 168:00:00 --nodelist=c03

# Ensure we run from the repository directory (where this script lives)
cd "$(dirname "$0")"

npm install
npm start