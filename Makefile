RUNNING_GPU = `squeue | grep temp_ | rev | cut -d' ' -f1 | rev | head -1`
RUNNING_JOB = `squeue | grep temp_ | tr -s ' ' | cut -d' ' -f2`

start_a30:
		@JOB_ID=$$(./vllm_serve_run_a30.sh ${MODEL} ${PORT} ${GPUS} ${CPUS} ${PERIOD} ${NODE} | sed -n 's/^JOB_ID=//p'); \
		if [ -z "$$JOB_ID" ]; then \
			echo "ERROR: Failed to capture JOB_ID from submission."; \
			exit 1; \
		fi; \
		echo "JOB_ID=$$JOB_ID"
	@echo "Check status with 'make check'"
	@echo "Use GET /api/models to derive state; pending >30s will auto-cancel."

start_a40:
		@JOB_ID=$$(./vllm_serve_run_a40.sh ${MODEL} ${PORT} ${GPUS} ${CPUS} ${PERIOD} ${NODE} | sed -n 's/^JOB_ID=//p'); \
		if [ -z "$$JOB_ID" ]; then \
			echo "ERROR: Failed to capture JOB_ID from submission."; \
			exit 1; \
		fi; \
		echo "JOB_ID=$$JOB_ID"
	@echo "Check status with 'make check'"
	@echo "Use GET /api/models to derive state; pending >30s will auto-cancel."

start_a100:
		@JOB_ID=$$(./vllm_serve_run_a100.sh ${MODEL} ${PORT} ${GPUS} ${CPUS} ${PERIOD} ${NODE} | sed -n 's/^JOB_ID=//p'); \
		if [ -z "$$JOB_ID" ]; then \
			echo "ERROR: Failed to capture JOB_ID from submission."; \
			exit 1; \
		fi; \
		echo "JOB_ID=$$JOB_ID"
	@echo "Check status with 'make check'"
	@echo "Use GET /api/models to derive state; pending >30s will auto-cancel."

check: 
	@squeue

log: 
	@tail -f logs/slurm-${RUNNING_JOB}.out

stop:
	@scancel ${RUNNING_JOB}
	@echo "Stoped job ${RUNNING_JOB}"