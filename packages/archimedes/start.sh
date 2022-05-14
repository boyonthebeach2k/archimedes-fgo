#!/bin/bash
git pull
npm ci
npm run build
npm start --workspace=packages/archimedes