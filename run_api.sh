#!/bin/bash
#SBATCH --cpus-per-task=1 -t 168:00:00 --nodelist=cpu01

npm install
npm start