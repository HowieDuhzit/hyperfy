#!/bin/bash

# Hyperfy P2P CLI Wrapper
# Usage: ./hyperfy-p2p.sh <command>

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m' 
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Icons
INFO="🔵"
SUCCESS="✅"
WARNING="⚠️"
ERROR="❌"

log() {
    local level="$1"
    local message="$2"
    
    case $level in
        "info")
            echo -e "${CYAN}${INFO} ${message}${NC}"
            ;;
        "success")
            echo -e "${GREEN}${SUCCESS} ${message}${NC}"
            ;;
        "warning")
            echo -e "${YELLOW}${WARNING} ${message}${NC}"
            ;;
        "error")
            echo -e "${RED}${ERROR} ${message}${NC}"
            ;;
    esac
}

show_banner() {
    echo -e "${BLUE}"
    echo "🌍 Hyperfy P2P - Simple Virtual Worlds"
    echo "======================================"
    echo -e "${NC}"
}

check_node() {
    if ! command -v node &> /dev/null; then
        log "error" "Node.js is required but not installed"
        echo "Please install Node.js 18+ from: https://nodejs.org"
        exit 1
    fi
    
    local node_version=$(node --version)
    local major_version=$(echo $node_version | cut -d'.' -f1 | sed 's/v//')
    
    if [ "$major_version" -lt 18 ]; then
        log "error" "Node.js 18+ required, found $node_version"
        exit 1
    fi
    
    log "info" "Node.js $node_version ✓"
}

quick_setup() {
    show_banner
    log "info" "🚀 Quick P2P Setup Starting..."
    
    check_node
    
    cd "$SCRIPT_DIR"
    
    log "info" "Initializing P2P environment..."
    if ./bin/hyperfy-p2p init; then
        log "success" "P2P initialization complete!"
        echo ""
        log "info" "🎉 Ready to start! Run one of:"
        echo "  ./hyperfy-p2p.sh start    # Production mode"
        echo "  ./hyperfy-p2p.sh dev      # Development mode"
        echo ""
    else
        log "error" "Initialization failed"
        exit 1
    fi
}

quick_start() {
    show_banner
    log "info" "🚀 Starting Hyperfy P2P..."
    
    check_node
    cd "$SCRIPT_DIR"
    
    log "info" "Starting P2P services..."
    ./bin/hyperfy-p2p start
}

quick_dev() {
    show_banner
    log "info" "🛠️ Starting Hyperfy P2P in Development Mode..."
    
    check_node
    cd "$SCRIPT_DIR"
    
    log "info" "Starting development servers..."
    ./bin/hyperfy-p2p dev
}

show_help() {
    show_banner
    echo "SIMPLE COMMANDS:"
    echo "  ./hyperfy-p2p.sh setup     Complete P2P setup"
    echo "  ./hyperfy-p2p.sh start     Start P2P services"  
    echo "  ./hyperfy-p2p.sh dev       Development mode"
    echo ""
    echo "ADVANCED COMMANDS:"
    echo "  ./hyperfy-p2p.sh test      Validate P2P system"
    echo "  ./hyperfy-p2p.sh status    Show system status"
    echo "  ./hyperfy-p2p.sh bridge    Bridge service only"
    echo "  ./hyperfy-p2p.sh server    Server only"
    echo "  ./hyperfy-p2p.sh client    Client setup instructions"
    echo ""
    echo "ONE-LINER DEPLOYMENT:"
    echo "  ./hyperfy-p2p.sh setup && ./hyperfy-p2p.sh start"
    echo ""
    echo "Need the full CLI? Use: ./bin/hyperfy-p2p <command>"
}

# Main command handling
case "${1:-help}" in
    "setup"|"init")
        quick_setup
        ;;
    "start")
        quick_start
        ;;
    "dev"|"develop")
        quick_dev
        ;;
    "test"|"validate"|"status"|"bridge"|"server"|"client")
        check_node
        cd "$SCRIPT_DIR"
        ./bin/hyperfy-p2p "$1"
        ;;
    "help"|"--help"|"-h"|"")
        show_help
        ;;
    *)
        log "warning" "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac