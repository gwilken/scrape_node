#!/bin/bash

export IP=$(ifconfig eth0 | grep "inet " | awk -F" " '{print $2}')

node ./src/api/server.js
