# NES Capture Project by The Retro Spirit
This project aims to capture information and screenshots automatically for every NES game originally released for the Nintendo Entertainment System. It does this by using a local server, the JSNES emulator and some database magic to fetch information on each game in the ROMS directory. Each game is then, in turn, run in the emulator and puppeteer fetches screenshots of the page. Rinse and repeat.

# Sources
NES Cart Database: http://bootgod.dyndns.org:7777/

# Note on accuracy
The results are only as good as its data. At time of writing, some games are unfortunately missing (http://bootgod.dyndns.org:7777/missing.php) - mostly Japanese games. In time though, they'll be added once information surfaces.

# Running
Start the local express server first, via npm run server. Verify the server can be reached via localhost:8000. Then, run the capture script, npm run capture. This will take as long as the length of your roms folder. Each run for each ROM usually takes a minute or so.

# More information
See The Retro Spirit, https://retro.gg and our Discord, https://discord.io/retrospirit
