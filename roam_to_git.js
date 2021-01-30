const path = require('path')
const fs = require('fs-extra') // for mkdirp() and move() and to promisfy all so don't have to use fs.promises
const puppeteer = require('puppeteer')
const extract = require('extract-zip')

console.time('R2G Exit after')

// NEED better check, because .env could exist in repo. like check of secrets exist in process.env, if so, IS_GITHUB_ACTION = true, other wise try local .env, and check again
let IS_LOCAL

try {
    // check for local .env
    if (fs.existsSync(path.join(__dirname, '.env'))) {
        require('dotenv').config()
        IS_LOCAL = true
    } else {
        IS_LOCAL = false
    }
} catch (err) { error(`.env file existence error: ${err}`) }

const download_dir = path.join(__dirname, 'tmp')
const backup_dir = IS_LOCAL ? path.join(__dirname, 'backup') : getRepoPath()

const { RR_EMAIL, RR_PASSWORD, RR_GRAPH } = process.env

if (!RR_EMAIL) error('Secrets error: RR_EMAIL not found')
if (!RR_PASSWORD) error('Secrets error: RR_PASSWORD not found')
if (!RR_GRAPH) error('Secrets error: RR_GRAPH not found')

function getRepoPath() {
    // This works because actions/checkout@v2 duplicates repo name in path /home/runner/work/roam-backup/roam-backup
    const parent_dir = path.join(__dirname, '..')
    const repo_name = path.basename(parent_dir)
    return path.join(parent_dir, repo_name)
}

// fs.mkdirSync(backup_dir) // check if doesn't exist first!
// fs.writeFileSync(path.join(backup_dir, "test2.txt"), "Success? YES! 2")

init()

async function init() {
    try {
        // deleteDir(download_dir)

        log('Creating browser')
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] }) // to run in GitHub Actions
        // const browser = await puppeteer.launch({ headless: false }) // to test locally and see what's going on

        const page = await browser.newPage()
        await page._client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: download_dir })

        await roam_login(page)
        await roam_export(page)

        log('Closing browser')
        browser.close()

        await extract_json()
        // deleteDir(download_dir)

    } catch (err) { error(err) }

    console.timeEnd('R2G Exit after')
}

async function roam_login(page) {
    return new Promise(async (resolve, reject) => {
        try {

            log('Navigating to login page')
            await page.goto('https://roamresearch.com/#/signin')

            const email_selector = 'input[name="email"]'

            log('Waiting for email field')
            await page.waitForSelector(email_selector)

            log('Filling email field')
            await page.type(email_selector, RR_EMAIL)

            log('Filling password field')
            await page.type('input[name="password"]', RR_PASSWORD)

            log('Clicking "Sign In"')
            await page.evaluate(() => {
                [...document.querySelectorAll('button')].find(button => button.innerText == 'Sign In').click()
            })

            const login_error_selector = 'div[style="font-size: 12px; color: red;"]' // error message on login page
            const graphs_selector = '.my-graphs' // successful login, on graphs selection page

            await page.waitForSelector(login_error_selector + ', ' + graphs_selector)

            const error_el = await page.$(login_error_selector)
            if (error_el) {
                const error_message = await page.evaluate(el => el.innerText, error_el)
                reject(`Login error. Roam says: "${error_message}"`)
            } else if (await page.$(graphs_selector)) {
                log('Login successful')
                resolve()
            } else { // timeout
                reject('Login error: unknown')
            }

        } catch (err) { reject(err) }
    })
}

async function roam_export(page) {
    return new Promise(async (resolve, reject) => {
        try {

            log('Navigating to graph')
            await page.goto('https://roamresearch.com/404')// workaround to get disablecss and disablejs parameters to work by navigating away due to issue with puppeteer and # hash navigation (used in SPAs like Roam)
            await page.goto(`https://roamresearch.com/#/app/${RR_GRAPH}?disablecss=true&disablejs=true`)

            log('Waiting for graph to load')
            // CHECK if have permission to view graph
            // IDEAS check for .navbar for app
            // IDEAS wait for astrolabe spinner to stop
            // IDEAS allow multiple graphs
            await page.waitForSelector('.bp3-icon-more')

            // log('Clicking "Share, export and more"')
            await page.click('.bp3-icon-more')

            // log('Clicking "Export All"')
            await page.evaluate(() => {
                [...document.querySelectorAll('li .bp3-fill')].find(li => li.innerText == 'Export All').click()
            })

            // log('Waiting for export dialog')
            await page.waitForSelector('.bp3-dialog .bp3-button-text')

            // log('Clicking Export Format')
            await page.click('.bp3-dialog .bp3-button-text')


            // log('Clicking "JSON"')
            await page.evaluate(() => {
                [...document.querySelectorAll('.bp3-text-overflow-ellipsis')].find(dropdown => dropdown.innerText == 'JSON').click()
            })

            // log('Clicking "Export All"')
            await page.evaluate(() => {
                [...document.querySelectorAll('button')].find(button => button.innerText == 'Export All').click()
            })

            log('Waiting for download')
            await page.waitForSelector('.bp3-spinner')
            await page.waitForSelector('.bp3-spinner', { hidden: true })

            log('JSON downloaded')

            resolve()
        } catch (err) { reject(err) }
    })
}

async function extract_json() {
    return new Promise(async (resolve, reject) => {
        try {

            log('Checking download_dir')
            const files = await fs.readdir(download_dir)

            if (files.length === 0) {
                reject('Extraction error: download dir is empty')

            } else if (files) {
                log('Found', files)
                const file = files[0]

                const source = path.join(download_dir, file)
                const target = path.join(download_dir, '_extraction')

                log('Extracting JSON from ' + file)
                await extract(source, { dir: target })

                log('Extraction complete')


                // MOVE to repo dir and commit
                // NO, have to open, stringify(,null,2), then save to new file
                // change JSON downloaded log to Downloaded Roam-Export-1234567890.zip
                const json_filename = `${RR_GRAPH}.json`
                const oldPath = path.join(target, json_filename)
                const newPath = path.join(backup_dir, 'json', json_filename)

                log('Moving JSON to backup')
                await fs.move(oldPath, newPath, { overwrite: true })
                log('Moved')

                log('Deleting download_dir')
                await fs.rmdir(download_dir, { recursive: true })
                log('download_dir deleted')

                resolve()
            }

        } catch (err) { reject(err) }
    })
}

// async function deleteDownloads(dir) {
//     // if already doesn't exist, don't log
//     fs.rmdir(download_dir, { recursive: true })
//     log('download dir deleted')
// }

function log(...messages) {
    const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '')
    console.log(timestamp, 'R2G', ...messages)
}

function error(err) {
    log('ERROR -', err)
    console.timeEnd('R2G Exit after')
    process.exit(1)
}