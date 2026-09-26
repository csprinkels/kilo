#!/bin/zsh
# usage: render.sh <iphone|ipad> <name> <out.png> [extra query]
S=${0:A:h}; C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [[ $1 == iphone ]]; then W=1320 H=2868; else W=2064 H=2752; fi
"$C" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --force-device-scale-factor=1 \
  --virtual-time-budget=8000 --window-size=$W,$H --screenshot=$3 "file://$S/template.html?d=$1&n=$2$4" >/dev/null 2>&1
