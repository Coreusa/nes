import axios from 'axios'
import puppeteer from 'puppeteer'
import crypto from 'crypto'
import { customAlphabet } from 'nanoid'
import fs from 'fs'
import replace from 'replace-in-file'
import { exec } from 'child_process'
import slugify from 'slugify'
import cliProgress from 'cli-progress'
import nesdb from './../database/nesdb.js'
import coverDb from './../database/coverdb.js'
import FormData from 'form-data'
import config from './config.js'
const nanoid = customAlphabet('1234567890abcdef', 15)
const randomDir = './' + nanoid()
const romDir = './roms'
const resultFilename = 'compiled-nes-db'

const slugCharsToRemove = /[*+~.(),'"!:@#¤%/]/g
const characterRemovalRegexp = /[\s-|:\!;$%@"<>'()+,]/gi
const progressBar = new cliProgress.SingleBar({
    format: 'Capturing... {bar} {percentage}% | {value}/{total} | ROM: {file} | ETA: {etaMinutes}m {etaSeconds}s',
    hideCursor: true
}, cliProgress.Presets.shades_classic);

async function buildDatabase () {
  const processed = []
  const failed = []
    fs.readdir(romDir, async (err, files) => {
    // Figure out meta data about each file
    for (const file of files) {
      let result = file
    // files.forEach((file, index) => {
      let nameToFind = file.replace(/\s?\(.*\)(\.nes)/g, '')
      const originalName = nameToFind
      nameToFind = nameToFind.replace(characterRemovalRegexp, '').toLowerCase()
      // Due to naming conventions, : are - in filenames. Also names with 'n must have a space We must transform them back to find potential matches
      // Find the region (xyz)
      const regionMatch = file.match(/\(.*\)/)
      let region = ''
      // File has info about the region
      if (regionMatch && regionMatch.length) {
        region = regionMatch[0].toLowerCase().replace(/[{()}]/g, '');
      }
      console.log("--------------------------");
      console.dir('-- Current rom details ---');
      console.dir('Game Name: ' + originalName);
      console.dir('Name to find (cleaned): ' + nameToFind);
      console.dir('Region: ' + region);

      const fileBuffer = fs.readFileSync(romDir + '/' + file)
      const hashSum = crypto.createHash('sha1')
      hashSum.update(fileBuffer)

      const fileChecksum = hashSum.digest('hex')
      if (!region) {
        failed.push({
          game: nameToFind,
          file: file,
          sha1: hex,
          error: 'No region found'
        })
      } else {
        let gameData = {}
        let remoteGameInfo = {}
        let gameInfo = nesdb.database.game
          .filter(e => {
            // Set region for entry to lowercase. Remove any funky chars in entry name to normalize, then match
            let entryName = e._name.toLowerCase()
            // Some ROM names have been switched, so try and check those too
            let entryNameSwitched = e._name.split(' ').reverse().join(' ').toLowerCase()
            let altEntryName = e?._altname
            const entryRegion = e._region.toLowerCase()
            if (altEntryName) {
              altEntryName = altEntryName.toLowerCase()
            }
            // Remove problematic chars from names for easier matching
            entryName = entryName.replace(characterRemovalRegexp, '')
            // return (entryRegion === region || entryRegion === 'usa') && (entryName === nameToFind || entryName.startsWith(nameToFind))
            return (originalName === e._name || entryName === nameToFind || altEntryName === nameToFind || entryNameSwitched === nameToFind || entryName === originalName.toLowerCase() || entryName.startsWith(nameToFind))
          })
        // Information about the game found in NESDb
        if (gameInfo.length) {
          console.dir('Found in NESDB: Yes');
          gameInfo = gameInfo[0]
          const filename = slugify(`${originalName}`, { lower: true, remove: slugCharsToRemove })

          // Convert idiotic naming of files to proper. I.e "Adventures of Billy Bayou, The" -> "The Adventures of Billy Bayou"
          if (/(.)+, the/i.test(gameInfo._name.toLowerCase())) {
            gameInfo._name = 'The ' + gameInfo._name.replace(', The', '')
          }
          if (/(.)+, disney\'s/.test(gameInfo._name.toLowerCase())) {
            gameInfo._name = "Disney's " + gameInfo._name.replace(', Disney\'s', '')
          }

          // There is no developer
          if (!gameInfo._developer.length && gameInfo._publisher.length) {
            // Set the dev to the same as publisher
            gameInfo._developer = gameInfo._publisher
          }
          if (gameInfo._developer.length && !gameInfo._publisher.length) {
            // Set the dev to the same as publisher
            gameInfo._publisher = gameInfo._developer
          }
          if (!gameInfo._developer.length && !gameInfo._publisher.length) {
            gameInfo._developer = 'Unknown'
            gameInfo._publisher = 'Unknown'
          }

          let remoteData = null
          const gameSearchResultsFilePath = `gamedata/${filename}.json`
          if (fs.existsSync(gameSearchResultsFilePath)) {
            console.dir('Game data file: Found. Using cached version.');
            const fileContents = fs.readFileSync(gameSearchResultsFilePath, 'utf8')
            if (fileContents && fileContents.length) {
              const cachedFileContents = JSON.parse(fileContents)
              remoteData = {
                game_id: cachedFileContents.id,
                name: cachedFileContents.name,
                release_date: cachedFileContents.released,
                modes: cachedFileContents.tags,
                rating: cachedFileContents.esrb_rating,
                categories: cachedFileContents.genres
              }
            } else {
              console.dir('Cached game file is empty');
            }
          } else {
            console.dir('Game data file: Not found. Fetching...');
            let results = {}
            const remote = await searchForGame(originalName)
              .then(res => {
                if (res.data && res.data.results.length && res.data.results[0] !== undefined) {
                  // Write what we actually need from results
                  results = res.data.results[0]
                  remoteData = {
                    game_id: results.id,
                    name: results.name,
                    release_date: results.released,
                    modes: results.tags,
                    rating: results.esrb_rating,
                    categories: results.genres
                  }
                }
                createFile(gameSearchResultsFilePath, results)
              })
          }
          // Do another request to RAWG to get the game entry with description as it's not included when searching
          let descriptionFromRemoteSource = false
          let descriptionTextFromRemoteSource = ''
          const gameDetailsFilePath = `gamedata/${filename}-game-details.json`
          if (fs.existsSync(gameDetailsFilePath)) {
            const fileContents = fs.readFileSync(gameDetailsFilePath, 'utf8')
            console.dir('Game details file: Found. Using cached file...');
            if (fileContents && fileContents.length) {
              console.dir('Cached file has content: Yes');
              const cachedFileContents = JSON.parse(fileContents)
              descriptionTextFromRemoteSource = cachedFileContents.description_raw
              descriptionFromRemoteSource = true
            }
          } else {
            console.dir('Game data file: Not found. Fetching...');
            if (remoteData && 'game_id' in remoteData) {
              const gameDetailsRes = await getGameDetails(remoteData.game_id)
                .then(res => {
                  console.dir(res.data);
                  if (res.data && res.data.description_raw && res.data.description_raw !== undefined) {
                    descriptionTextFromRemoteSource = res.data.description_raw
                  }
                  createFile(gameDetailsFilePath, res.data)
                  descriptionFromRemoteSource = true
                })
            } else {
              console.dir('Game data file had no game id present and was skipped');
            }
          }
          let gameDescriptionAlternatives = []
          let categorySupplementalText = ''
          let categorySupplementalTextStart = ''
          let licenceText = ''
          let gameDeveloperPublisherText = `developed by ${gameInfo._developer} and published by ${gameInfo._publisher}`
          if (gameInfo?._class === 'Unlicensed') {
            licenceText = 'an unlicensed'
          } else if (gameInfo?._class === 'Licensed') {
            licenceText = 'a licensed'
          }

          if (gameInfo._developer.toLowerCase() === gameInfo._publisher.toLowerCase()) {
            gameDeveloperPublisherText = `both developed and published by ${gameInfo._developer}`
          }
          // There are categories present
          if (remoteData && remoteData.categories && 'categories' in remoteData && remoteData.categories.length) {
            categorySupplementalText = remoteData.categories.map(e => e.name.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' and $1')
            categorySupplementalText = categorySupplementalText.replace('platformer', 'platform')
            if (categorySupplementalText.startsWith('a') || categorySupplementalText.startsWith('e') || categorySupplementalText.startsWith('i') || categorySupplementalText.startsWith('o')) {
              categorySupplementalTextStart = 'an ' + categorySupplementalText
            } else {
              categorySupplementalTextStart = 'a ' + categorySupplementalText
            }

            gameDescriptionAlternatives = [
              // <Game> is a <categories> game released in <year> for the NES, developed by <developer> and published by <publisher>
              `${gameInfo._name} is ${licenceText} ${categorySupplementalText} game released in ${gameInfo._date.substring(0, 4)} for the NES, ${gameDeveloperPublisherText}.`,
              // Release in <year> for the NES, <Game> is a <categories> game. It was developed by <developer> and published by <publisher>
              `Released in ${gameInfo._date.substring(0, 4)} for the NES, ${gameInfo._name} is ${licenceText} ${categorySupplementalText} game. It was ${gameDeveloperPublisherText}.`,
              // A <categories> game developed by <developer> and published by <publisher>. Released for the NES in <year>.
              `${capitalizeFirstLetter(categorySupplementalTextStart)} game ${gameDeveloperPublisherText}. It's ${licenceText} game released in ${gameInfo._date.substring(0, 4)} for the NES.`,
              `${capitalizeFirstLetter(gameDeveloperPublisherText)}, ${gameInfo._name} is ${licenceText} ${categorySupplementalText} game that was released in ${gameInfo._date.substring(0, 4)} for the NES.`,
            ]
          } else {
            // If we have no categories, we cannot use those when composing description alternatives. So fork up some new ones.
            gameDescriptionAlternatives = [
              // <Game> is a <categories> game released in <year> for the NES, developed by <developer> and published by <publisher>
              `${gameInfo._name} is ${licenceText} game released in ${gameInfo._date.substring(0, 4)} for the NES, ${gameDeveloperPublisherText}.`,
              // Release in <year> for the NES, <Game> is a <categories> game. It was developed by <developer> and published by <publisher>
              `Released in ${gameInfo._date.substring(0, 4)} for the NES. It is ${licenceText} game ${gameDeveloperPublisherText}.`,
              // A <categories> game developed by <developer> and published by <publisher>. Released for the NES in <year>.
              `${gameInfo._name} was ${gameDeveloperPublisherText}. Released in ${gameInfo._date.substring(0, 4)} for the NES.`,
              `${capitalizeFirstLetter(gameDeveloperPublisherText)}, ${gameInfo._name} is ${licenceText} game that was released in ${gameInfo._date.substring(0, 4)} for the NES.`,
            ]
          }


          let gameDescription = gameDescriptionAlternatives[Math.floor(Math.random() * gameDescriptionAlternatives.length)]
          // Supplement description
          if ('_altname' in gameInfo) {
            gameDescription += ` Also known as ${gameInfo._altname} in ${gameInfo._region}.`
          }

          let gameCover = coverDb.data.filter(e => e.name.toLowerCase() === gameInfo._name.toLowerCase())
          if (gameCover.length > 0) {
            gameCover = gameCover[0].cover
          } else {
            gameCover = null
          }
          let gameEntry = {
            name: gameInfo._name,
            slug: slugify(`${gameInfo._name}`, { lower: true, remove: slugCharsToRemove }),
            description: gameDescription,
            alternateDescription: descriptionTextFromRemoteSource,
            alternateDescriptionFromRemoteSource: descriptionFromRemoteSource,
            developer: gameInfo._developer,
            publisher: gameInfo._publisher,
            cover: gameCover,
            cover2: gameInfo._catalog,
            categories: (remoteData && ('categories' in remoteData)) ? remoteData.categories : null,
            alias: '_altname' in gameInfo ? gameInfo._altname : null,
            region: gameInfo._region,
            players: gameInfo._players,
            licensed: gameInfo._class,
            date: gameInfo._date,
            filename: file,
            sha1: fileChecksum,
            remoteInfo: remoteData
          }

          processed.push(gameEntry)
        } else {
          console.dir('Found in NESDB: No');
          console.dir(`The game ${nameToFind} was not found in NESDB and thus skipped.`)
          failed.push({
            originalFilename: originalName,
            game: nameToFind,
            file: file,
            sha1: fileChecksum,
            error: 'No game info found. Looked for name: ' + nameToFind + ' and region: ' + region
          })
        }
        console.log("--------------------------");
        console.log("\n");
      }
    }
    const numberTotal = files.length
    const numberOk = processed.length
    const numberFailed = failed.length
    const percentageOk = (numberOk / numberTotal * 100).toFixed(2)
    const percentageFail = (numberFailed / numberTotal * 100).toFixed(2)
    const uniqueGames = processed.filter((value, index, self) =>
      index === self.findIndex((t) => (
        t.name === value.name
      ))
    )
    console.dir(`Import stats`);
    console.dir(`There were ${numberTotal} ROMS in the ROM directory. Out of these:`);
    console.dir(`There were ${numberFailed} ROMS that failed (${percentageFail} %)`);
    console.dir(`There were ${numberOk} ROMS that were ok (${percentageOk} %)`);
    console.dir(`-----> Out of the OK ROMS, there were ${uniqueGames.length} unique game names`);
    console.dir(`-----> Out of the OK ROMS, there were ${(processed.length - uniqueGames.length)} duplicate game names that was skipped`);
    console.dir(`-----------------`);
    console.log("\n");
    fs.writeFile(`results/${resultFilename}.json`, JSON.stringify(uniqueGames), err => {
      if (err) {
        console.error('Failed to write ok-file. Is the directory there? Error: ' + err);
      } else {
        console.dir(`Results file ${resultFilename} for OK imports written`);
      }
    })
    fs.writeFile('results/failed.json', JSON.stringify(failed), err => {
      if (err) {
        console.error('Failed to write failed-file. Is the directory there? Error: ' + err);
      } else {
        console.dir('Results file for Failed imports written');
      }
    })
  })
  return true
}

await buildDatabase()
  .then(res => {
    console.dir('Finished creating database');
    console.log("\n");
  })


async function searchForGame (term) {
  console.dir('----- FETCHING GAME BECAUSE NOT PRESENT IN CACHE AS JSON -----');
  return axios.get(`https://api.rawg.io/api/games?search=${term}&search_precise=true&search_exact=false&platforms=49&key=${config.rawgApiKey}`)
}

async function getGameDetails (id) {
  console.dir('----- FETCHING GAME DETAILS BECAUSE NOT PRESENT IN CACHE AS JSON -----');
  return axios.get(`https://api.rawg.io/api/games/${id}?key=${config.rawgApiKey}`)
}

function createFile (filename, data) {
  return fs.writeFile(filename, JSON.stringify(data), err => {
    if (err) {
      console.error('Failed to write ok-file. Is the directory there? Error: ' + err);
      return
    } else {
      console.dir('File written');
    }
  })
}

function capitalizeFirstLetter (string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
