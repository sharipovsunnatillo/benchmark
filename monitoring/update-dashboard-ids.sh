#!/bin/bash

# Script to update Grafana dashboard with current container IDs
# Run this script whenever you recreate containers

set -e

# Get container IDs
VIRTUAL_THREADS_ID=$(docker inspect --format='{{.Id}}' virtual-threads-app 2>/dev/null || echo "")
WEBFLUX_ID=$(docker inspect --format='{{.Id}}' webflux-app 2>/dev/null || echo "")

if [ -z "$VIRTUAL_THREADS_ID" ]; then
    echo "Error: virtual-threads-app container not found"
    echo "Make sure containers are running: docker-compose ps"
    exit 1
fi

if [ -z "$WEBFLUX_ID" ]; then
    echo "Error: webflux-app container not found"
    echo "Make sure containers are running: docker-compose ps"
    exit 1
fi

echo "Found container IDs:"
echo "  virtual-threads-app: $VIRTUAL_THREADS_ID"
echo "  webflux-app: $WEBFLUX_ID"

# Update the dashboard JSON file
DASHBOARD_FILE="./grafana/provisioning/dashboards/benchmark-dashboard.json"

if [ ! -f "$DASHBOARD_FILE" ]; then
    echo "Error: Dashboard file not found at $DASHBOARD_FILE"
    exit 1
fi

echo ""
echo "Updating dashboard queries..."

# Export variables for Python to access
export VIRTUAL_THREADS_ID
export WEBFLUX_ID
export DASHBOARD_FILE

# Use Python to update the JSON file reliably
python3 <<'PYTHON_SCRIPT'
import json
import os

# Get container IDs from environment
virtual_threads_id = os.environ['VIRTUAL_THREADS_ID']
webflux_id = os.environ['WEBFLUX_ID']
dashboard_file = os.environ['DASHBOARD_FILE']

# Read the dashboard file
with open(dashboard_file, 'r') as f:
    dashboard = json.load(f)

# Function to recursively replace in all string values
def replace_in_dict(obj, old_str, new_str):
    if isinstance(obj, dict):
        for key, value in obj.items():
            if isinstance(value, str):
                obj[key] = value.replace(old_str, new_str)
            elif isinstance(value, (dict, list)):
                replace_in_dict(value, old_str, new_str)
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            if isinstance(item, str):
                obj[i] = item.replace(old_str, new_str)
            elif isinstance(item, (dict, list)):
                replace_in_dict(item, old_str, new_str)

# Replace the placeholders with actual container IDs
# The JSON parser converts \" to " so we search for the unescaped version
replace_in_dict(dashboard, 'id="$virtual_threads_id"', f'id="/docker/{virtual_threads_id}"')
replace_in_dict(dashboard, 'id="$webflux_id"', f'id="/docker/{webflux_id}"')

# Write back the updated dashboard
with open(dashboard_file, 'w') as f:
    json.dump(dashboard, f, indent=2)

print("✓ Dashboard JSON updated successfully")
PYTHON_SCRIPT

if [ $? -ne 0 ]; then
    echo "Error: Failed to update dashboard file"
    exit 1
fi

echo ""
echo "Restarting Grafana to apply changes..."

# Navigate to project root for docker-compose
cd ..
docker-compose restart grafana

echo ""
echo "✓ Done! Dashboard is now updated with current container IDs."
echo ""
echo "Open Grafana at: http://localhost:3000"
echo "Dashboard: VT vs WebFlux"
