#!/bin/bash
# Check SSH tunnel status for all three devices.
# Usage: ./scripts/check-tunnels.sh

echo "=== Tunnel Status $(date) ==="
DEAD=0
for PORT in 14370 14371 14372; do
  if nc -z -w 1 127.0.0.1 $PORT 2>/dev/null; then
    echo "  localhost:$PORT -> OK"
  else
    echo "  localhost:$PORT -> DEAD"
    DEAD=1
  fi
done

TUNNEL=$(ps aux | grep "ssh.*alsabah-synology.*1437" | grep -v grep | head -1)
if [ -n "$TUNNEL" ]; then
  echo "  SSH process: running"
else
  echo "  SSH process: NOT FOUND"
  DEAD=1
fi

if [ $DEAD -eq 1 ]; then
  echo ""
  echo "To re-establish tunnels:"
  echo "  export SSHPASS='...'"
  echo "  sshpass -e ssh -o StrictHostKeyChecking=no -f -N \\"
  echo "    -L 14372:192.168.100.83:4370 \\"
  echo "    -L 14371:192.168.100.74:4370 \\"
  echo "    -L 14370:192.168.100.81:4370 \\"
  echo "    DS423@alsabah-synology"
fi
