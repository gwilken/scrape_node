#!/bin/bash

# export COMMAND_URL=http://status.gwilken.com:8888
export COMMAND_URL=http://127.0.0.1:8888;
export BASE_URL=https://www.wrecksite.eu
export SLEEP_MIN=60000
export SLEEP_MAX=120000
# export COOKIE=Vars=C20W92Pyure0HcAX9WjqcLZfQOMzvf3YoszoeI8U9RDwNmyuFgqZhtbpxpoA7Wsj77SzHnzQfPLUSSGPXkvu3SPLUS1Q==

node ./test.js
