#!/bin/bash
source .env
#SBATCH --cpus-per-task=1 -t 168:00:00 --nodelist=$BACKEND_NODE

npm install
npm start