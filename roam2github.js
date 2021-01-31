const path = require('path')
const fs = require('fs-extra') // for mkdirp() and output() and remove() ~~and move()~~ and to promisfy all so don't have to use fs.promises
const puppeteer = require('puppeteer')
const extract = require('extract-zip')

const edn_formatter = require('./edn_formatter/edn_formatter').core.edn_formatter
log(edn_formatter)
var edn = `{:schema {:create/user {:db/valueType :db.type/ref, :db/cardinality :db.cardinality/one}, :node/subpages {:db/valueType :db.type/ref, :db/cardinality :db.cardinality/many}, :vc/blocks {:db/valueType :db.type/ref, :db/cardinality :db.cardinality/many}, :edit/seen-by {:db/valueType :db.type/ref, :db/cardinality :db.cardinality/many}, :window/id {:db/unique :db.unique/identity}, :attrs/lookup {:db/valueType :db.type/ref, :db/cardinality :db.cardinality/many}, :node/windows {:db/valueType :db.type/ref, :db/cardinality :db.cardinality/many}, :d/v {:db/valueType :db.type/ref, :db/cardinality :db.cardinality/one}, :block/clone {:db/valueType :db.type/ref, :db/cardinality :db.cardinality/one}, :node/sections {:db/valueType :db.type/ref, :db/cardinality :db.cardinality/many}, :harc/v {:db/valueType :db.type/ref, :db/cardinality :db.cardinality/many}, :node/title {:db/unique :db.unique/identity}, :block/refs {:db/valueType :db.type/ref, :db/cardinality :db.cardinality/many}, :harc/a {:db/valueType :db.type/ref, :db/cardinality :db.cardinality/many}, :edit/user {:db/valueType :db.type/ref, :db/cardinality :db.cardinality/one}, :block/subpage {:db/valueType :db.type/ref, :db/cardinality :db.cardinality/one}, :block/children {:db/valueType :db.type/ref, :db/cardinality :db.cardinality/many}, :block/focused-user {:db/valueType :db.type/ref, :db/cardinality :db.cardinality/one}, :create/seen-by {:db/valueType :db.type/ref, :db/cardinality :db.cardinality/many}, :block/uid {:db/unique :db.unique/identity}, :d/e {:db/valueType :db.type/ref, :db/cardinality :db.cardinality/one}, :d/a {:db/valueType :db.type/ref, :db/cardinality :db.cardinality/one}, :user/uid {:db/unique :db.unique/identity}, :node/links {:db/valueType :db.type/ref, :db/cardinality :db.cardinality/many}, :link/to {:db/valueType :db.type/ref, :db/cardinality :db.cardinality/one}, :user/email {:db/unique :db.unique/identity}, :query/results {:db/valueType :db.type/ref, :db/cardinality :db.cardinality/many}, :harc/e {:db/valueType :db.type/ref, :db/cardinality :db.cardinality/many}, :block/parents {:db/valueType :db.type/ref, :db/cardinality :db.cardinality/many}, :block/page {:db/valueType :db.type/ref, :db/cardinality :db.cardinality/one}, :version/id {:db/unique :db.unique/identity}}, :datoms [[1 :version/id "0.0.0" 536870913] [1 :version/nonce "uuidfdc21d6f-6e72-4ddc-a80f-583a49a2d242" 536870913] [1 :version/upgraded-nonce "uuidfdc21d6f-6e72-4ddc-a80f-583a49a2d242" 536870914] [2 :version/id "0.8.1" 536870914] [2 :version/nonce "uuid10c37e0c-409f-4585-bc21-337375512d6d" 536870919] [3 :block/uid "12mX8s2DW" 536870915] [3 :user/display-name "Erik Newhard" 536870915] [3 :user/photo-url "https://lh3.googleusercontent.com/a-/AOh14GiPJn3ovPV2ewfBUOVLsZUebHFkRvebL6nbRG2Sfg" 536870915] [3 :user/uid "PlMA638w7gW6AT6b1H1VNYEIJK43" 536870915] [4 :block/children 5 536870917] [4 :block/uid "01-30-2021" 536870916] [4 :create/time 1612054318689 536870916] [4 :create/user 3 536870916] [4 :edit/time 1612054318690 536870916] [4 :edit/user 3 536870916] [4 :log/id 1612054318688 536870916] [4 :node/title "January 30th, 2021" 536870916] [5 :block/open true 536870917] [5 :block/order 0 536870917] [5 :block/page 4 536870918] [5 :block/parents 4 536870918] [5 :block/string "test" 536870919] [5 :block/uid "hyMDPk3oi" 536870917] [5 :create/time 1612054320850 536870917] [5 :create/user 3 536870917] [5 :edit/time 1612054322951 536870919] [5 :edit/user 3 536870917]]}`
var test = edn_formatter.format(edn)
// fs.writeFileSync('test.txt', JSON.stringify(test))
fs.outputFile('test.edn', test)
log(test)

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

const { R2G_EMAIL, R2G_PASSWORD, R2G_GRAPH } = process.env

if (!R2G_EMAIL) error('Secrets error: R2G_EMAIL not found')
if (!R2G_PASSWORD) error('Secrets error: R2G_PASSWORD not found')
if (!R2G_GRAPH) error('Secrets error: R2G_GRAPH not found')

function getRepoPath() {
    // This works because actions/checkout@v2 duplicates repo name in path /home/runner/work/roam-backup/roam-backup
    const parent_dir = path.join(__dirname, '..')
    const repo_name = path.basename(parent_dir)
    return path.join(parent_dir, repo_name)
}

// init()

async function init() {
    try {
        // deleteDir(download_dir)

        log('Creating browser')
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] }) // to run in GitHub Actions
        // const browser = await puppeteer.launch({ headless: false }) // to test locally and see what's going on

        const page = await browser.newPage()
        page.setDefaultTimeout(600000) // 10min
        await page._client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: download_dir })
        // await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3419.0 Safari/537.36'); // https://github.com/puppeteer/puppeteer/issues/1477#issuecomment-437568281

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

            log('Signing in')
            // log('Waiting for login form')
            await page.waitForSelector(email_selector)
            // possible refresh a second time on login screen https://github.com/MatthieuBizien/roam-to-git/issues/87#issuecomment-763281895

            // log('Filling email field')
            await page.type(email_selector, R2G_EMAIL)

            // log('Filling password field')
            await page.type('input[name="password"]', R2G_PASSWORD)

            // log('Clicking "Sign In"')
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
                log('Login successful!')
                resolve()
            } else { // timeout?
                reject('Login error: unknown')
            }

        } catch (err) { reject(err) }
    })
}

async function roam_export(page) {
    return new Promise(async (resolve, reject) => {
        try {

            // TODO allow multiple graphs

            log('Navigating to graph')
            await page.goto('https://roamresearch.com/404')// workaround to get disablecss and disablejs parameters to work by navigating away due to issue with puppeteer and # hash navigation (used in SPAs like Roam)
            await page.goto(`https://roamresearch.com/#/app/${R2G_GRAPH}?disablecss=true&disablejs=true`)

            // log('Waiting for graph to load')
            await page.waitForSelector('.loading-astrolabe')
            log('astrolabe spinning...')
            await page.waitForSelector('.loading-astrolabe', { hidden: true })
            log('astrolabe spinning stopped')

            // try {
            await page.waitForSelector('.roam-app') // add short timeout here, if fails, don't exit code 1, and instead CHECK if have permission to view graph
            // } catch (err) {
            //     await page.waitForSelector('.navbar') // Likely screen saying 'You do not have permission to view this database'
            //     reject()
            // }
            log('Graph loaded!')

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

            log('Waiting for JSON download to start')
            await page.waitForSelector('.bp3-spinner')
            await page.waitForSelector('.bp3-spinner', { hidden: true })

            log('Downloading JSON')
            const checkDownloads = async () => {
                const files = await fs.readdir(download_dir)

                if (files[0] && files[0].match(/\.zip$/)) { // contains .zip file
                    log('JSON container downloaded!', files[0])
                    resolve()
                } else checkDownloads()
            }
            checkDownloads()
            // TODO how to check multiple downloads?

        } catch (err) { reject(err) }
    })
}

async function extract_json() {
    return new Promise(async (resolve, reject) => {
        try {

            // log('Checking download_dir')
            const files = await fs.readdir(download_dir)

            if (files.length === 0) {
                reject('Extraction error: download dir is empty')

            } else if (files) {
                // log('Found', files)
                const file = files[0]

                const source = path.join(download_dir, file)
                const target = path.join(download_dir, '_extraction')

                log('Extracting JSON from ' + file)
                await extract(source, { dir: target })
                // log('Extraction complete')

                const json_filename = `${R2G_GRAPH}.json`
                const json_fullpath = path.join(target, json_filename)
                const new_json_fullpath = path.join(backup_dir, 'json', json_filename)

                log('Formatting JSON')
                const json = await fs.readJson(json_fullpath)
                const new_json = JSON.stringify(json, null, 2)

                // log('Saving formatted JSON')
                await fs.outputFile(new_json_fullpath, new_json)

                log('Cleaning up')
                // log('Deleting download_dir')
                await fs.remove(download_dir, { recursive: true })
                // log('download_dir deleted')

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

// IDEA commit screenshot if error instead of process.exit(1)
// await page.screenshot({path: `error ${timestamp}.png`}) // will need to pass page as parameter... or set as parent scope