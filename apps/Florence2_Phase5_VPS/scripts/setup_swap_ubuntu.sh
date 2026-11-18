#!/usr/bin/env bash
set -euo pipefail
# Use only after verifying disk space and existing swap. Example: sudo bash scripts/setup_swap_ubuntu.sh 8
GB="${1:-8}"
[[ "$GB" =~ ^[0-9]+$ ]] && (( GB >= 1 && GB <= 64 )) || { echo 'Usage: script [1..64 GB]'; exit 2; }
if [[ -e /swapfile ]]; then echo '/swapfile already exists; not touching it'; exit 1; fi
required=$(( GB * 1024 * 1024 ))
avail=$(df --output=avail -k / | tail -1 | tr -d ' ')
if (( avail < required + 2*1024*1024 )); then echo 'Not enough free space (+2GB reserve)'; exit 1; fi
fallocate -l "${GB}G" /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
if ! grep -qE '^/swapfile[[:space:]]' /etc/fstab; then echo '/swapfile none swap sw 0 0' >> /etc/fstab; fi
free -h
