#!/bin/bash
# Start TradeTerminal backend
set -e

cd "$(dirname "$0")"

# Copy env if not present
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  Created backend/.env from .env.example — fill in your API keys!"
fi

# Install dependencies if needed
if [ ! -d venv ]; then
  echo "Creating Python venv..."
  python3 -m venv venv
fi

source venv/bin/activate
pip install -q -r requirements.txt

echo "✅ Starting TradeTerminal backend on http://localhost:8000"
echo "   Demo mode: ${DEMO_MODE:-false}"
echo "   Runpod configured: $([ -n '$RUNPOD_API_KEY' ] && echo yes || echo no)"
echo ""
echo "   Demo routes (no API keys needed):"
echo "   - Spices / Nepal → India"
echo "   - Textiles / Bangladesh → Germany"
echo "   - Coffee / Ethiopia → Japan"
echo ""

python main.py
