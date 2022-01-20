import puppeteer from 'puppeteer'
import crypto from 'crypto'
import { customAlphabet } from 'nanoid'
import fs from 'fs'
import replace from 'replace-in-file'
import { exec } from 'child_process'
import slugify from 'slugify'
import cliProgress from 'cli-progress'
import nesdb from './nesdb.js'
const nanoid = customAlphabet('1234567890abcdef', 15)
const randomDir = './' + nanoid()
const romDir = './roms'
const options = {
  files: 'index.html',
  from: /romFile = .*;/g,
  to: ``
}
const slugCharsToRemove = /[*+~.()'"!:@#¤%&/]/g
const characterRemovalRegexp = /[\s-|&:\!;$%@"<>'()+,]/gi
const processed = []
const failed = []
const progressBar = new cliProgress.SingleBar({
    format: 'Capturing... {bar} {percentage}% | {value}/{total} | ROM: {file} | ETA: {etaMinutes}m {etaSeconds}s',
    hideCursor: true
}, cliProgress.Presets.shades_classic);

fs.readdir(romDir, (err, files) => {
  // Figure out meta data about each file
  files.forEach((file, index) => {
    let nameToFind = file.replace(/\s?\(.*\)(\.nes)/g, '')
    nameToFind = nameToFind.replace(characterRemovalRegexp, '').toLowerCase()
    // Due to naming conventions, : are - in filenames. Also names with 'n must have a space We must transform them back to find potential matches
    // Find the region (xyz)
    const regionMatch = file.match(/\(.*\)/)
    let region = ''
    // File has info about the region
    if (regionMatch.length) {
      region = regionMatch[0].toLowerCase().replace(/[{()}]/g, '');
    }
    console.dir('-- Current rom details ---');
    console.dir('Name: ' + nameToFind);
    console.dir('region: ' + region);

    const fileBuffer = fs.readFileSync(romDir + '/' + file)
    const hashSum = crypto.createHash('sha1')
    hashSum.update(fileBuffer)

    const fileChecksum = hashSum.digest('hex')

    if (region) {
      let gameInfo = nesdb.database.game
        .filter(e => {
          // Set region for entry to lowercase
          // Remove any funky chars in entry name to normalize
          // Then match
          const entryRegion = e._region.toLowerCase()
          let entryName = e._name.toLowerCase()
          // Remove problematic chars from names for easier matching
          entryName = entryName.replace(characterRemovalRegexp, '')
          return (entryRegion === region || entryRegion === 'usa') && (entryName === nameToFind)
        })
      if (gameInfo.length) {
        gameInfo = gameInfo[0]
        // console.dir(gameInfo);
        processed.push({
          name: gameInfo._name,
          slug: slugify(`${gameInfo._name}`, { lower: true, remove: slugCharsToRemove }),
          developer: gameInfo._developer,
          publisher: gameInfo._publisher,
          region: gameInfo._region,
          players: gameInfo._players === '1' ? 'Single Player' : 'Multiplayer',
          licensed: gameInfo._class,
          date: gameInfo._date,
          file: file,
          sha1: fileChecksum
        })
      } else {
        failed.push({
          game: nameToFind,
          file: file,
          sha1: fileChecksum,
          error: 'No game info found. Looked for name: ' + nameToFind + ' and region: ' + region
        })
      }
    } else {
      failed.push({
        game: nameToFind,
        file: file,
        sha1: hex,
        error: 'No region found'
      })
    }
  });
  const numberTotal = files.length
  const numberOk = processed.length
  const numberFailed = failed.length
  const percentageOk = (numberOk / numberTotal * 100).toFixed(2)
  const percentageFail = (numberFailed / numberTotal * 100).toFixed(2)
  console.dir(`Import stats`);
  console.dir(`There were ${numberTotal} ROMS in the ROM directory. Out of these:`);
  console.dir(`There were ${numberOk} ROMS that were ok (${percentageOk} %)`);
  console.dir(`There were ${numberFailed} ROMS that failed (${percentageFail} %)`);
  console.dir(`-----------------`);
  fs.writeFile('results/ok.json', JSON.stringify(processed), err => {
    if (err) {
      console.error('Failed to write ok-file. Is the directory there? Error: ' + err);
    } else {
      console.dir('Results file for OK imports written');
    }
  })
  fs.writeFile('results/failed.json', JSON.stringify(failed), err => {
    if (err) {
      console.error('Failed to write failed-file. Is the directory there? Error: ' + err);
    } else {
      console.dir('Results file for Failed imports written');
    }
  })
  capture(processed);
})
const capture = async (games) => {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 50
  });
  // 34 sec each game
  const eachRunTime = 34
  let totalTime = processed.length * eachRunTime
  progressBar.start(processed.length)
  for (let game of games) {
    let minutes = Math.floor(totalTime / 60)
    let seconds = totalTime - minutes * 60
    progressBar.increment({
      file: game.file,
      etaMinutes: minutes,
      etaSeconds: seconds
    })
    const gameFileName = game.slug
    const gameDir = 'screenshots/' + game.slug
    try {
      // Replace in index
      options.to = `romFile = "roms/${game.file}";`
      replace(options);
      if (!fs.existsSync(gameDir)) {
        fs.mkdirSync(gameDir)
      }
      const page = await browser.newPage();
      // Page must load completely first
      await page.goto("http://127.0.0.1:8000/", {
        'waitUntil': 'networkidle0'
      });
      // Initiate the start
      await page.setViewport({
        width: 512,
        height: 480
      })
      /** Keyboard mapped as follows:
      * UP -> E
      * DOWN -> D
      * LEFT -> S
      * RIGHT -> F
      * A -> A
      * B -> Q
      */
      await page.waitForTimeout(2000)
      // console.dir('Waited 2 sec, taking initial screenshot');
      await page.screenshot({ path: screenshotName(game, 'initial-boot') });
      await page.waitForTimeout(7000)
      // console.dir('Waited 7 sec, taking intro screenshot');
      await page.screenshot({ path: screenshotName(game, 'intro') });
      await page.waitForTimeout(7000)
      // console.dir('Waited another 7 sec, taking second intro screenshot');
      await page.screenshot({ path: screenshotName(game, 'second-intro') });
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(4000)
      // console.dir('Waited 4 sec after pressing enter, taking start-pressed screenshot');
      await page.screenshot({ path: screenshotName(game, 'start-pressed') });
      await page.waitForTimeout(2000)
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000)
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000)
      await page.keyboard.press('f');
      await page.waitForTimeout(1000)
      await page.keyboard.press('a');
      await page.waitForTimeout(1000)
      await page.keyboard.press('a');
      await page.keyboard.press('f');
      await page.keyboard.press('s');
      await page.waitForTimeout(4000)
      // await page.keyboard.press('a');
      await page.keyboard.press('f');
      // console.dir('Pressed enter twice, and A bunch of times before taking a-pressed screenshot');
      await page.screenshot({ path: screenshotName(game, 'a-pressed') });

      await page.keyboard.press('f');
      await page.keyboard.press('f');
      await page.keyboard.press('f');
      await page.waitForTimeout(3000)
      // console.dir('Pressed right, taking right-pressed screenshot');
      await page.screenshot({ path: screenshotName(game, 'arrow-right-pressed') });
      totalTime -= eachRunTime
      await page.close();
    } catch (e) {
      console.error('Error: ' + e);
    }
  }
  // Close the browser once all fetches are complete
  await browser.close()
  progressBar.stop()
  console.dir('Finished');
};

function screenshotName (game, type) {
  return `./screenshots/${game.slug}/${game.slug}-${type}-${nanoid()}.png`
}
// capture();
