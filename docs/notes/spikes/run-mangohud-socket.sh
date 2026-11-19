node sock.mjs & 
sleep 1
echo "== net + read module dir only (default module perms)"
node --permission --allow-net --allow-fs-read="$PWD" cli.mjs 2>&1 | grep -v -i -E "experimental|trace-warn"
echo "== + manifest filesystem permission"
node --permission --allow-net --allow-fs-read='*' --allow-fs-write='*' cli.mjs 2>&1 | grep -v -i -E "experimental|trace-warn"
wait
