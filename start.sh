#!/bin/bash

export IP=$(ifconfig eth0 | grep "inet " | awk -F" " '{print $2}')

cd src && 

npm i &&

node ./api/server.js
