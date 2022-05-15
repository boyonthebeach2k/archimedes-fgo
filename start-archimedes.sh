#!/bin/bash
git pull
npm update
npm run build -ws --if-present
npm start --workspace=packages/archimedes
