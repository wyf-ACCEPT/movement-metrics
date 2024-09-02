# [Bot] How many succeeded and failed requests are there in the log file?
grep -o "succeeded" ./logs/imola-send.log | wc -l; grep -o "ApiError" ./logs/imola-send.log | wc -l

# [Parse] How about the progress?
head -n 3 ./logs/imola-send.log
tail -n 3 ./logs/imola-send.log

# [Parse] Check rows?
cat ./logs/baku-parsing.log | wc -l
cat ./logs/imola-parsing.log | wc -l

# [Parse] Online parse
nohup node ./scripts/online-baku.js &
nohup node ./scripts/online-imola.js &
watch -n 1 tail -n 25 ./logs/baku-online.log
watch -n 1 tail -n 25 ./logs/imola-online.log
watch -n 1 tail -n 25 ./nohup.out
tail -n 20 ./nohup.out
grep -C 20 warn nohup.out 
