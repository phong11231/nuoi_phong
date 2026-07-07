#!/bin/bash
kill -9 $(pgrep apt-get) 2>/dev/null
rm -f /var/lib/dpkg/lock-frontend /var/lib/apt/lists/lock /var/cache/apt/archives/lock
dpkg --configure -a
apt-get update -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
cd /root
rm -rf phone-manager
git clone https://github.com/phong11231/nuoi_phong.git phone-manager
cd phone-manager
npm install
nohup node server.js > /root/server.log 2>&1 &
echo "DONE! Web chay tai http://$(curl -s ifconfig.me):3000"
