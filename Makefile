RUNNING_GPU = `squeue | grep temp_ | rev | cut -d' ' -f1 | rev | head -1`
RUNNING_JOB = `squeue | grep temp_ | tr -s ' ' | cut -d' ' -f2`

start_a30:
		@JOB_ID=$$(./vllm_serve_run_a30.sh ${MODEL} ${PORT} ${GPUS} ${CPUS} ${PERIOD} ${NODE} | sed -n 's/^JOB_ID=//p'); \
		if [ -z "$$JOB_ID" ]; then \
			echo "ERROR: Failed to capture JOB_ID from submission."; \
			exit 1; \
		fi; \
		echo "Waiting up to 30 seconds for job $$JOB_ID to start..."; \
		for i in {1..30}; do \
			STATE_CODE=$$(squeue -j $$JOB_ID --noheader -o "%t" 2>/dev/null || true); \
			if [ -z "$$STATE_CODE" ]; then \
				sleep 1; \
				continue; \
			fi; \
			if [ "$$STATE_CODE" = "R" ] || [ "$$STATE_CODE" = "CG" ]; then \
				STATE=$$(squeue -j $$JOB_ID --noheader -o "%t %R" 2>/dev/null || true); \
				echo "Job started: $$STATE"; \
				break; \
			fi; \
			if [ "$$STATE_CODE" = "PD" ]; then \
				if [ $$i -eq 30 ]; then \
					echo "ERROR: Job $$JOB_ID pending for 30 seconds. Canceling job..."; \
					scancel $$JOB_ID; \
					exit 1; \
				fi; \
				sleep 1; \
				continue; \
			fi; \
			sleep 1; \
		done
	@echo "Check status with 'make check'"
	@echo "Check if app is ready with 'make log', it should show 'INFO:     Application startup complete.'"

start_a40:
		@JOB_ID=$$(./vllm_serve_run_a40.sh ${MODEL} ${PORT} ${GPUS} ${CPUS} ${PERIOD} ${NODE} | sed -n 's/^JOB_ID=//p'); \
		if [ -z "$$JOB_ID" ]; then \
			echo "ERROR: Failed to capture JOB_ID from submission."; \
			exit 1; \
		fi; \
		echo "Waiting up to 30 seconds for job $$JOB_ID to start..."; \
		for i in {1..30}; do \
			STATE_CODE=$$(squeue -j $$JOB_ID --noheader -o "%t" 2>/dev/null || true); \
			if [ -z "$$STATE_CODE" ]; then \
				sleep 1; \
				continue; \
			fi; \
			if [ "$$STATE_CODE" = "R" ] || [ "$$STATE_CODE" = "CG" ]; then \
				STATE=$$(squeue -j $$JOB_ID --noheader -o "%t %R" 2>/dev/null || true); \
				echo "Job started: $$STATE"; \
				break; \
			fi; \
			if [ "$$STATE_CODE" = "PD" ]; then \
				if [ $$i -eq 30 ]; then \
					echo "ERROR: Job $$JOB_ID pending for 30 seconds. Canceling job..."; \
					scancel $$JOB_ID; \
					exit 1; \
				fi; \
				sleep 1; \
				continue; \
			fi; \
			sleep 1; \
		done
	@echo "Check status with 'make check'"
	@echo "Check if app is ready with 'make log', it should show 'INFO:     Application startup complete.'"

start_a100:
		@JOB_ID=$$(./vllm_serve_run_a100.sh ${MODEL} ${PORT} ${GPUS} ${CPUS} ${PERIOD} ${NODE} | sed -n 's/^JOB_ID=//p'); \
		if [ -z "$$JOB_ID" ]; then \
			echo "ERROR: Failed to capture JOB_ID from submission."; \
			exit 1; \
		fi; \
		echo "Waiting up to 30 seconds for job $$JOB_ID to start..."; \
		for i in {1..30}; do \
			STATE_CODE=$$(squeue -j $$JOB_ID --noheader -o "%t" 2>/dev/null || true); \
			if [ -z "$$STATE_CODE" ]; then \
				sleep 1; \
				continue; \
			fi; \
			if [ "$$STATE_CODE" = "R" ] || [ "$$STATE_CODE" = "CG" ]; then \
				STATE=$$(squeue -j $$JOB_ID --noheader -o "%t %R" 2>/dev/null || true); \
				echo "Job started: $$STATE"; \
				break; \
			fi; \
			if [ "$$STATE_CODE" = "PD" ]; then \
				if [ $$i -eq 30 ]; then \
					echo "ERROR: Job $$JOB_ID pending for 30 seconds. Canceling job..."; \
					scancel $$JOB_ID; \
					exit 1; \
				fi; \
				sleep 1; \
				continue; \
			fi; \
			sleep 1; \
		done
	@echo "Check status with 'make check'"
	@echo "Check if app is ready with 'make log', it should show 'INFO:     Application startup complete.'"

check: 
	@squeue

log: 
	@tail -f logs/slurm-${RUNNING_JOB}.out

stop:
	@scancel ${RUNNING_JOB}
	@echo "Stoped job ${RUNNING_JOB}"