# [Bot] How many succeeded and failed requests are there in the log file?
grep -o "succeeded" ./logs/imola-send.log | wc -l; grep -o "ApiError" ./logs/imola-send.log | wc -l

# [Parse] How about the progress?
head -n 3 ./logs/imola-send.log
tail -n 3 ./logs/imola-send.log
watch -n 1 tail -n 25 ./logs/baku-parsing.log
watch -n 1 tail -n 25 ./logs/imola-online.log

# [Parse] Check rows?
cat ./logs/baku-parsing.log | wc -l
cat ./logs/imola-parsing.log | wc -l