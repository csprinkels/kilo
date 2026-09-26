#!/bin/zsh
# usage: capture.sh <udid> <outdir>
set -u
S=/private/tmp/claude-501/-Volumes-WorkFlow-Developer-apps-kilo/3678c57f-3f96-403b-b356-437d8d727ec3/scratchpad
UDID=$1; OUT=$2; mkdir -p $OUT
APP=$S/dd/Build/Products/Release-iphonesimulator/App.app
xcrun simctl boot $UDID 2>/dev/null; xcrun simctl bootstatus $UDID -b >/dev/null
xcrun simctl ui $UDID appearance light
xcrun simctl status_bar $UDID override --time "9:41" --dataNetwork wifi --wifiMode active --wifiBars 3 --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100
[[ -n "${ONLY:-}" ]] && PAIRS=(${=ONLY}) || PAIRS=("1-now:/" "2-weather:/weather/index.html" "3-roads:/traffic/index.html" "4-tsunami:/tsunami/index.html" "5-storms:/storms/index.html")
for pair in $PAIRS; do
  name=${pair%%:*}; route=${pair#*:}
  rm -rf $S/app-$UDID.app; cp -R $APP $S/app-$UDID.app
  plutil -replace server.appStartPath -string "$route" $S/app-$UDID.app/public/../capacitor.config.json 2>/dev/null || \
    python3 -c "import json,sys;p='$S/app-$UDID.app/capacitor.config.json';c=json.load(open(p));c.setdefault('server',{})['appStartPath']='$route';json.dump(c,open(p,'w'))"
  xcrun simctl terminate $UDID com.csprinkels.kilo 2>/dev/null
  xcrun simctl install $UDID $S/app-$UDID.app
  xcrun simctl launch $UDID com.csprinkels.kilo >/dev/null
  sleep 18
  xcrun simctl io $UDID screenshot --display=internal --type=png $OUT/$name.png >/dev/null 2>&1
  echo "$name $(sips -g pixelWidth -g pixelHeight $OUT/$name.png | awk '/pixel/{printf $2" "}')"
done
