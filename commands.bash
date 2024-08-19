# How many succeeded and failed requests are there in the log file?
grep -o "succeeded" ./logs/imola-send.log | wc -l; grep -o "ApiError" ./logs/imola-send.log | wc -l

head -n 3 ./logs/imola-send.log
tail -n 3 ./logs/imola-send.log