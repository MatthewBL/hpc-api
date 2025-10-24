RUNNING_GPU = `squeue | grep temp_ | rev | cut -d' ' -f1 | rev | head -1`
RUNNING_JOB = `squeue | grep temp_ | tr -s ' ' | cut -d' ' -f2`

start_a30:
	@./vllm_serve_run_a30.sh ${MODEL} ${PORT} ${GPUS} ${CPUS} ${PERIOD} ${NODE}
	@sleep 1
	@echo "New job `squeue | grep temp_ | tr -s ' ' | cut -d' ' -f2` in GPU `squeue | grep temp_ | rev | cut -d' ' -f1 | rev | head -1`"
	@echo "Check status with 'make check'"
	@echo "Check if app is ready with 'make log', it should show 'INFO:     Application startup complete.'"

start_a40:
	@./vllm_serve_run_a40.sh ${MODEL} ${PORT} ${GPUS} ${CPUS} ${PERIOD} ${NODE}
	@sleep 1
	@echo "New job `squeue | grep temp_ | tr -s ' ' | cut -d' ' -f2` in GPU `squeue | grep temp_ | rev | cut -d' ' -f1 | rev | head -1`"
	@echo "Check status with 'make check'"
	@echo "Check if app is ready with 'make log', it should show 'INFO:     Application startup complete.'"

start_a100:
	@./vllm_serve_run_a100.sh ${MODEL} ${PORT} ${GPUS} ${CPUS} ${PERIOD} ${NODE}
	@sleep 1
	@echo "New job `squeue | grep temp_ | tr -s ' ' | cut -d' ' -f2` in GPU `squeue | grep temp_ | rev | cut -d' ' -f1 | rev | head -1`"
	@echo "Check status with 'make check'"
	@echo "Check if app is ready with 'make log', it should show 'INFO:     Application startup complete.'"

check: 
	@squeue

log: 
	@tail -f slurm-${RUNNING_JOB}.out

stop:
	@scancel ${RUNNING_JOB}
	@echo "Stoped job ${RUNNING_JOB}"