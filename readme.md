# NES Capture Project by The Retro Spirit
This project aims to capture information and screenshots automatically for every NES game originally released for the Nintendo Entertainment System. It does this by using a local server, the JS-NES emulator and some database magic to fetch information on each game in the ROMS directory. Each game is then, in turn, run in the emulator and puppeteer fetches screenshots of the page. Rinse and repeat.

# Sources
NES Cart Database: http://bootgod.dyndns.org:7777/. There's a local copy (which this project uses) in `database/nesdb.js.`. There's a rudimentary coverdb (made for this project) found in `database/coverdb.js`.

# Note on accuracy
The results are only as good as its data. At time of writing, some games are unfortunately missing (http://bootgod.dyndns.org:7777/missing.php) - mostly Japanese games. In time though, they'll be added once information surfaces. Furthermore your ROM files must adhere to some kind of standard. If you use the No-intro NES ROM set, there are around 1400 or so that can be found using the NESDB.

# License
This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/">Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License</a>. For private use / study only. 
<a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/">
  <img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by-nc-sa/4.0/88x31.png" /></a>. 
  
  The project follows any licenses for any external sources used in the project. 

# Initial setup
Configure your API key (for remote API lookup) in src/config.js.

# Installing dependencies
Run `yarn` first to fetch required dependencies.

# Build the Database
Run `yarn build` to go through the ROMS you have put in the **roms directory** and build a compiled database with information from the NESDb and a remote source (Rawg.io). Games fetched from a remote source are cached and put in `gamedata/*` as json files so you don't have to fetch them again if you re-run the build script.

After the build is complete, the result can be found in `results/compiled-nes-db.json`.
ROMS that cannot be found are put in `results/failed.json`

# Capture screenshots
Once you have created the database:

Start the local server via `yarn ws`. This fires up a local webpage that you can access usually via http://localhost:8000. It contains an embed for the JNES emulator with a src to a ROM file.

Start capturing the local embedded NES emulator using puppeteer with `yarn capture`. Each run will replace the src to the ROM file for the NES embed with whatever is next from the `results/compiled-nes-db.json`.

Puppeteer has been configured with a set of inputs that usually fare well with the majority of NES games. You can alter them yourselves in  `src/build.js` if you need other inputs.

Each run takes around 30 seconds. The progress indicator will tell you the approximate time remaining until all your games have been captured screenshots for. The total time depends on the amount of files in the roms folder and how many of them were found when compiling the database.

After the capturing is finished, the script will update `results/compiled-nes-db.json` with the screenshots for each game. Screenshots will be saved to `screenshots`.

# More information
See The Retro Spirit, https://retro.gg and our Discord, https://discord.io/retrospirit. We're also on Twitter: https://twitter.com/dosspirit.
