// import axios from 'axios'
import puppeteer from 'puppeteer'
// import crypto from 'crypto'
import { customAlphabet } from 'nanoid'
import fs from 'fs'
import replace from 'replace-in-file'
import { exec } from 'child_process'
import Jimp from 'jimp'
// import slugify from 'slugify'
import cliProgress from 'cli-progress'
const j = Jimp
// import nesdb from './nesdb.js'
import getColors from 'get-image-colors'
const nanoid = customAlphabet('1234567890abcdef', 15)
const romDir = './roms'
const options = {
  files: 'index.html',
  from: /romFile = .*;/g,
  to: ``
}

let compiled = JSON.parse(fs.readFileSync('./results/compiled-nes-db.json'))

// Remove any duplicates
const uniqueGames = compiled.filter((value, index, self) =>
  index === self.findIndex((t) => (
    t.name === value.name
  ))
)

const gameNamesProcessed = []

const progressBar = new cliProgress.SingleBar({
    format: 'Capturing... {bar} {percentage}% | {value}/{total} | Game: {game} | ROM: {file} | ETA: {etaMinutes}m {etaSeconds}s',
    hideCursor: true
}, cliProgress.Presets.shades_classic);

const capture = async (games) => {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 50
  });
  // 25 sec each game
  const eachRunTime = 25
  let totalTime = games.length * eachRunTime
  progressBar.start(games.length)
  for (let game of games) {
    if (!gameNamesProcessed.includes(game.name)) {
      let minutes = Math.floor(totalTime / 60)
      let seconds = totalTime - minutes * 60
      progressBar.increment({
        game: game.name,
        file: game.filename,
        etaMinutes: minutes,
        etaSeconds: seconds
      })
      gameNamesProcessed.push(game.name)
      const gameFileName = game.slug
      const gameDir = 'screenshots/' + game.slug
      const screenshots = []
      try {
        // Replace in index
        options.to = `romFile = "roms/${game.filename}";`
        replace(options);
        if (!fs.existsSync(gameDir)) {
          fs.mkdirSync(gameDir)
          console.dir(`Directory created for ${game.name} (Folder: ${gameDir})`);
          console.log("\n");
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
        /**
        * Keyboard mapped as follows:
        * UP -> E | DOWN -> D | LEFT -> S | RIGHT -> F | A -> A | B -> Q
        */
        console.dir('Current action: Boot-up screenshot...waiting 2 seconds....')
        let screenshotComment = 'Game boot-up screen'
        await page.waitForTimeout(2000)
        let screenshotFileName = screenshotName(game, 'boot-up-screen')
        await page.screenshot({ path: screenshotFileName });
        screenshots.push({
          file: screenshotFileName,
          comment: screenshotComment
        })
        console.dir('Wrote screenshot for initial boot.');
        console.dir('Current action: Waiting 2 seconds for something to happen...')
        await page.waitForTimeout(2000)
        // console.dir('Waited 7 sec, taking intro screenshot');
        screenshotComment = 'Introduction'
        screenshotFileName = screenshotName(game, 'introduction')
        await page.screenshot({ path: screenshotFileName });
        screenshots.push({
          file: screenshotFileName,
          comment: screenshotComment
        })
        console.dir('Wrote screenshot for intro');

        console.dir('Current action: Waiting 3 seconds for something else to happen...')
        await page.waitForTimeout(3000)
        screenshotComment = 'Introduction continued'
        screenshotFileName = screenshotName(game, 'introduction-continued')
        await page.screenshot({ path: screenshotFileName });
        screenshots.push({
          file: screenshotFileName,
          comment: screenshotComment
        })
        console.dir('Wrote screenshot for second intro, which waited for 3 seconds to cater for late intros.');

        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000)
        screenshotComment = 'Main menu'
        screenshotFileName = screenshotName(game, 'main-menu')
        await page.screenshot({ path: screenshotFileName });
        screenshots.push({
          file: screenshotFileName,
          comment: screenshotComment
        })
        console.dir('Wrote screenshot for start pressed.');

        console.dir('Current action: Pressing start, waiting 5 seconds, then pressing start again...');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(5000)
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500)
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000)
        // Get through intro crap!
        console.dir('Current action: Get through crap by pressing A and B...');
        await page.keyboard.press('a');
        await page.waitForTimeout(100)
        await page.keyboard.press('q');
        await page.waitForTimeout(100)
        await page.keyboard.press('a');
        await page.waitForTimeout(100)
        await page.keyboard.press('q');
        await page.waitForTimeout(100)
        await page.keyboard.press('a');
        await page.waitForTimeout(100)
        await page.keyboard.press('q');
        await page.waitForTimeout(100)
        await page.keyboard.press('a');
        await page.waitForTimeout(100)
        await page.keyboard.press('a');
        await page.waitForTimeout(100)
        await page.keyboard.press('q');
        await page.waitForTimeout(100)
        await page.keyboard.press('q');

        // await manyInputs()
        // await page.keyboard.press('Enter');
        // await page.keyboard.press('Enter');
        await page.waitForTimeout(200)
        await page.keyboard.press('f');
        await page.waitForTimeout(200)
        await page.keyboard.press('a');
        await page.waitForTimeout(200)
        // await page.keyboard.press('Enter');
        await page.waitForTimeout(500)
        // await page.keyboard.press('Enter');
        await page.waitForTimeout(500)
        await page.keyboard.press('a');
        await page.keyboard.press('f');
        await page.keyboard.press('s');
        await page.waitForTimeout(1000)
        await page.keyboard.press('f');
        // console.dir('Several inputs a bunch of times before taking screenshot');
        screenshotComment = 'Introductory gameplay'
        screenshotFileName = screenshotName(game, 'gameplay')
        await page.screenshot({ path: screenshotFileName });
        screenshots.push({
          file: screenshotFileName,
          comment: screenshotComment
        })
        console.dir('Wrote screenshot for introductory gameplay');

        console.dir('Waiting 1 seconds before torrent of inputs');
        await page.waitForTimeout(1000)
        console.dir('Current action: Holding right and pressing A a couple of times.....');
        await page.keyboard.down('f'); // Hold right
        await page.keyboard.press('a'); // Press A (mimic shooting, or jumping)
        await page.waitForTimeout(200)
        await page.keyboard.press('a'); // Press A (mimic shooting, or jumping)
        await page.waitForTimeout(200)
        await page.keyboard.press('a'); // Press A (mimic shooting, or jumping)
        await page.waitForTimeout(200)
        await page.keyboard.press('a'); // Press A (mimic shooting, or jumping)
        screenshotComment = 'In-game gameplay'
        screenshotFileName = screenshotName(game, 'in-game-gameplay')
        await page.screenshot({ path: screenshotFileName });
        screenshots.push({
          file: screenshotFileName,
          comment: screenshotComment
        })
        console.dir('Wrote screenshot in the middle of action inputs.');
        await page.waitForTimeout(200)
        await page.keyboard.press('q'); // Press A (mimic shooting, or jumping)
        await page.waitForTimeout(200)
        await page.keyboard.press('q'); // Press A (mimic shooting, or jumping)
        await page.waitForTimeout(200)
        await page.keyboard.press('a'); // Press A (mimic shooting, or jumping)
        await page.waitForTimeout(200)
        await page.keyboard.press('a'); // Press A (mimic shooting, or jumping)
        await page.waitForTimeout(3000)
        await page.keyboard.up('f')
        // console.dir('Pressed right, taking right-pressed screenshot');
        screenshotComment = 'In-game gameplay continued'
        screenshotFileName = screenshotName(game, 'in-game-gameplay-continued')
        await page.screenshot({ path: screenshotFileName });
        screenshots.push({
          file: screenshotFileName,
          comment: screenshotComment
        })
        console.dir('Wrote screenshot for holding arrow right for 3-5 seconds and pressing A and B a couple of times.');
        console.log("\n");
        console.log("We're done here, lets go to the next game");
        console.dir('Closing browser, awaiting next game.');
        console.dir('--------------');
        console.log("\n");
        totalTime -= eachRunTime
        await page.close();
        // Fix header and focus
        const ingressImagePath = `screenshots/${game.slug}/header.png`
        const focusImagePath = `screenshots/${game.slug}/focus.png`
        const imageCandidate = screenshots[4].file
        // Ingress
        await j.read(imageCandidate)
          .then(res => {
            console.dir('Creating ingress/header image for game.');
            return res
              .autocrop()
              .scale(2, Jimp.RESIZE_NEAREST_NEIGHBOR)
              .cover(1000, 350)
              .write(ingressImagePath)
          })
          .catch(e => {
            console.dir('Error occurred while creating header');
            console.dir(e);
          })
          // Focus
          await j.read(imageCandidate)
            .then(res => {
              console.dir('Creating focus image for game.');
              // console.dir(res)
              return res
                .autocrop()
                .cover(320, 120)
                .write(focusImagePath)
            })
            .catch(e => {
              console.dir('Error occurred while creating focus');
              console.dir(e);
            })

        game.ingress = ingressImagePath
        game.focus = focusImagePath
        game.screenshots = screenshots
      } catch (e) {
        console.error('Error: ' + e);
      }
      fs.writeFile('results/compiled-nes-db.json', JSON.stringify(games), err => {
        if (err) {
          console.error('Failed to write ok-file. Is the directory there? Error: ' + err);
        } else {
          console.dir('Wrote updated compiled NES library file.');
        }
      })
      console.clear();
    } else {
      console.dir(`The game ${game.name} has already been processed (probably different region) and we're not running that game again`)
    }
  }
  // Close the browser once all fetches are complete
  await browser.close()
  progressBar.stop()
  console.dir('Finished');
};
capture(uniqueGames)

function screenshotName (game, filename) {
  return `screenshots/${game.slug}/${filename}-${nanoid()}.png`
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
