node fake-player.mjs > player.log 2>&1 &
sleep 2; cat player.log
echo "--- plain node"; node client.mjs
echo "--- permission model"
node --permission --allow-net --allow-fs-read="$PWD" client.mjs 2>&1 | grep -v -i experimental | grep -v trace-warnings
sleep 1; cat player.log
