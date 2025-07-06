#!/bin/bash

# Health monitoring and auto-restart script for tire storage system
# Runs every 5 minutes to check service health and restart if needed

LOG_FILE="/var/log/health_monitor.log"
EMAIL_ALERT=""
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""

# Function to log with timestamp
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> $LOG_FILE
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to check if a service is responding
check_service_health() {
    local service_name=$1
    local url=$2
    local expected_response=$3
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url")
    
    if [ "$response" = "$expected_response" ]; then
        return 0
    else
        return 1
    fi
}

# Function to check supervisor service status
check_supervisor_service() {
    local service_name=$1
    
    status=$(sudo supervisorctl status $service_name | awk '{print $2}')
    if [ "$status" = "RUNNING" ]; then
        return 0
    else
        return 1
    fi
}

# Function to restart all services
restart_all_services() {
    log_message "CRITICAL: Restarting all services due to health check failures"
    
    # Stop all services
    sudo supervisorctl stop all
    sleep 5
    
    # Kill any hanging processes
    sudo pkill -f "python.*server.py" || true
    sudo pkill -f "yarn.*start" || true
    sudo pkill -f "node.*start" || true
    sleep 5
    
    # Start all services
    sudo supervisorctl start all
    sleep 10
    
    log_message "Services restarted. Waiting for stabilization..."
    sleep 30
}

# Function to send alerts (implement as needed)
send_alert() {
    local message=$1
    log_message "ALERT: $message"
    
    # TODO: Implement email/telegram notifications if needed
    # Example: echo "$message" | mail -s "Tire Storage System Alert" $EMAIL_ALERT
}

# Main health check routine
main() {
    log_message "Starting health check..."
    
    failure_count=0
    
    # Check supervisor services
    services=("backend" "frontend" "mongodb" "nginx")
    for service in "${services[@]}"; do
        if ! check_supervisor_service $service; then
            log_message "ERROR: Service $service is not running"
            ((failure_count++))
        else
            log_message "OK: Service $service is running"
        fi
    done
    
    # Check backend API health
    if ! check_service_health "backend" "http://localhost:8001/api/login" "405"; then
        log_message "ERROR: Backend API not responding correctly"
        ((failure_count++))
    else
        log_message "OK: Backend API responding"
    fi
    
    # Check frontend health
    if ! check_service_health "frontend" "http://localhost:3000" "200"; then
        log_message "ERROR: Frontend not responding correctly"
        ((failure_count++))
    else
        log_message "OK: Frontend responding"
    fi
    
    # Check nginx proxy
    if ! check_service_health "nginx" "http://localhost" "200"; then
        log_message "ERROR: Nginx proxy not responding correctly"
        ((failure_count++))
    else
        log_message "OK: Nginx proxy responding"
    fi
    
    # Check external domain health
    if ! check_service_health "external" "https://baseshinomontaz.ru" "200"; then
        log_message "WARNING: External domain not responding correctly"
        # Don't count this as critical failure since it might be DNS/external issue
    else
        log_message "OK: External domain responding"
    fi
    
    # Take action based on failure count
    if [ $failure_count -eq 0 ]; then
        log_message "Health check completed successfully. All services healthy."
    elif [ $failure_count -le 2 ]; then
        log_message "WARNING: $failure_count services failing. Attempting individual restarts."
        
        # Try individual service restarts first
        for service in "${services[@]}"; do
            if ! check_supervisor_service $service; then
                log_message "Restarting individual service: $service"
                sudo supervisorctl restart $service
                sleep 5
            fi
        done
        
        send_alert "Minor service issues detected and individual restarts attempted"
    else
        log_message "CRITICAL: $failure_count services failing. Performing full system restart."
        restart_all_services
        send_alert "Critical system failure detected. Full restart performed."
    fi
    
    log_message "Health check completed.\n"
}

# Create log file if it doesn't exist
touch $LOG_FILE

# Run the main health check
main

# Clean up old log entries (keep last 1000 lines)
tail -1000 $LOG_FILE > $LOG_FILE.tmp && mv $LOG_FILE.tmp $LOG_FILE

exit 0