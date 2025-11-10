#!/bin/bash
#SBATCH --cpus-per-gpu=1 --gpus=a30:1 -t 08:00:00 --nodelist=gpu02

npm install
npm start