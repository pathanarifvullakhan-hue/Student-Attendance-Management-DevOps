#!/bin/bash
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  echo "Installing dependencies for the first run..."
  npm install || exit 1
fi
npm start
