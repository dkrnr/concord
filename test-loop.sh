#!/usr/bin/env bash
set -e
H="localhost:8787"

echo "=== 1. reset ==="
curl -s -X POST $H/debug/reset; echo

echo "=== 2. save night rule ==="
curl -s -X POST $H/saveRule -d '{"rule":{"id":"draft_6","apartmentId":"apt_401","name":"Cool room at night","sourceSentence":"cool the room to 24 at 10:40pm","trigger":{"kind":"time","at":"22:40"},"conditions":[],"actions":[{"deviceType":"ac","deviceId":"dev_ac_room","set":{"on":true,"temperature":24}}],"enabled":true,"createdAt":"2026-09-16T12:57:04.921Z"},"resolutions":[],"requestId":"r1"}'; echo

echo "=== 3. bootstrap feed ==="
curl -s -X POST $H/pollFeed -d '{"apartmentId":"apt_401"}'; echo

echo "=== 4. fire an event ==="
# TODO: replace /debug/fireNext with the real route from Claude Code
curl -s -X POST $H/debug/fireNextEvent; echo

echo "=== 5. poll feed again (look for a why-card) ==="
curl -s -X POST $H/pollFeed -d '{"apartmentId":"apt_401","cursor":"0"}'; echo

echo "=== DONE — copy a whyCard id from step 5, then run: ==="
echo "curl -s -X POST $H/postWhyOverride -d '{\"whyCardId\":\"PASTE_ID\",\"override\":\"never\",\"requestId\":\"o1\"}'"
