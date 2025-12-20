# HPC Model Manager Frontend

A single-page web application for managing HPC models through the API.

## Features

✅ **Model Management**
- Create new models with custom configurations
- Edit existing model settings
- Delete models (when stopped)
- View all models with real-time status updates

✅ **Job Control**
- Start models with custom run parameters
- Stop running models
- View current running configuration
- Track running time

✅ **History Tracking**
- View all job history
- View model-specific history
- See job configuration details

✅ **Real-time Updates**
- Auto-refresh every 5 seconds
- Live status indicators (Running, Stopped, Setting up)
- Running time counter

## Usage

### Starting the Frontend

1. Make sure your API server is running:
   ```bash
   npm start
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

3. The frontend will be displayed at the root URL (`/`)

### Configuration

The API base URL can be changed in the UI if your API is running on a different port or host. Simply update the "API URL" field in the action bar.

Default: `http://localhost:3000/api/models`

## UI Components

### Model Cards
Each model is displayed in a card showing:
- Model ID and status badge
- HuggingFace model name
- Default settings (port, GPUs, node)
- Current running configuration (when active)
- Action buttons (Run, Stop, Edit, Delete, History)

### Actions Available

**➕ Add Model**: Create a new model with custom settings
- Model ID (unique identifier)
- HuggingFace model name
- Port, GPUs, CPUs
- Target node
- Time period

**▶️ Run**: Start a model job
- Override default settings if needed
- Specify custom configuration for this run

**⏹️ Stop**: Stop a running model job

**✏️ Edit**: Modify model settings
- Update default configuration
- Changes apply to future runs

**🗑️ Delete**: Remove a model (only when stopped)

**📜 History**: View job history for a specific model

**📊 View History**: See all job history across all models

**🔄 Refresh**: Manually refresh model list

## Status Indicators

- 🟢 **Running**: Model is active and serving
- 🔴 **Stopped**: Model is not running
- 🟡 **Setting up**: Model is starting (Slurm job submitted)

## Browser Support

Works on all modern browsers:
- Chrome/Edge (recommended)
- Firefox
- Safari

## Technical Details

- **Zero dependencies**: Pure HTML, CSS, and vanilla JavaScript
- **Responsive design**: Works on desktop and tablet devices
- **Auto-refresh**: Updates model status every 5 seconds
- **REST API integration**: Full CRUD operations
- **Modal-based forms**: Clean UX for data entry

## Troubleshooting

**Models not loading?**
- Check that the API server is running
- Verify the API URL in the UI matches your server
- Check browser console for errors

**Can't start a model?**
- Ensure the model is in "Stopped" state
- Check that no other job is running for this model
- Verify Slurm is available on the server
- If a model stays in "Setting up" too long, it will be auto-canceled based on `TIMEOUT_SETTING_UP` in your `.env`.

**Delete button disabled?**
- Models can only be deleted when stopped
- Stop the model first, then delete
