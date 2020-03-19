#!/bin/bash

export IP=$(ifconfig eth0 | grep "inet " | awk -F" " '{print $2}')
export COOKIE=Vars=NRqlVnt8NU7Yme6lenvbctyv4dS25G8qtoEYSZKv3M/vGSyvs01RrJzdUtHyKd0NmdBkA7GPLUS1OEIa7Xv8Smg1A==
export COMMAND_URL=http://status.gwilken.com:8888
# export COMMAND_URL=http://127.0.0.1:8888
export BASE_URL=https://www.wrecksite.eu
export SLEEP_MIN=2000
export SLEEP_MAX=5000
# export SLACK_URL=https://hooks.slack.com/services/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
export USER_AGENT="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_2) AppleWebKit/527.16 (KHTML, like Gecko) Chrome/63.0.3282.19 Safari/536.36"

node ./scrape.js
