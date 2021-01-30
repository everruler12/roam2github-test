const path = require('path')
const fs = require('fs')
const puppeteer = require('puppeteer')
const extract = require('extract-zip')
const { resolve } = require('path')

console.time('R2G Exit after')

try {
    if (fs.existsSync(path.join(__dirname, '.env'))) {
        require('dotenv').config()
    }
} catch (err) {
    console.error(err)
}

// console.log(process.env.RR_EMAIL)

const RR_EMAIL = process.env.RR_EMAIL,
    RR_PASSWORD = process.env.RR_PASSWORD,
    RR_GRAPH = process.env.RR_GRAPH,
    temp_dir = path.join(__dirname, 'tmp')

init()

async function init() {
    try {
        // deleteDir(temp_dir)

        console.log('R2G Creating browser')
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] }) // to run in GitHub Actions https://github.com/ianwalter/puppeteer-container
        // const browser = await puppeteer.launch({ headless: false }) // to test on PC and see what's going on

        const page = await browser.newPage()
        await page._client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: temp_dir }) // https://stackoverflow.com/a/52440784 for windows you'd use a path like 'c:\\path\\to\\folder' instead of '/path/to/folder'; so use path.join(foo, bar)
        // page.on('console', consoleObj => console.log(consoleObj.text())) // for console.log() to work in page.evaluate() https://stackoverflow.com/a/46245945

        await roam_login(page)
        await roam_export(page)

        console.log('R2G Closing browser')
        await browser.close()

        await extract_json()
        // deleteDir(temp_dir)

    } catch (err) {
        console.log('R2G Error -', err)
        console.timeEnd('R2G Exit after')
        process.exit(1)
    }

    console.timeEnd('R2G Exit after')
}

async function roam_login(page) {
    return new Promise(async (resolve, reject) => {
        try {

            console.log('R2G Navigating to login page')
            await page.goto('https://roamresearch.com/#/signin')

            const email_selector = 'input[name="email"]'

            console.log('R2G Waiting for email field')
            await page.waitForSelector(email_selector)

            console.log('R2G Filling email field')
            await page.type(email_selector, RR_EMAIL)

            console.log('R2G Filling password field')
            await page.type('input[name="password"]', RR_PASSWORD)

            console.log('R2G Clicking "Sign In"')
            await page.evaluate(() => {
                [...document.querySelectorAll('button')].find(button => button.innerText == 'Sign In').click()
            })

            const login_error_selector = 'div[style="font-size: 12px; color: red;"]' // error message on login page
            const graphs_selector = '.my-graphs' // successful login, on graphs selection page

            await page.waitForSelector(login_error_selector + ', ' + graphs_selector)

            const error_el = await page.$(login_error_selector)
            if (error_el) {
                const error_message = await page.evaluate(el => el.innerText, error_el)
                reject(`Login error: ${error_message}`)
            } else if (await page.$(graphs_selector)) {
                console.log('R2G Login successful')
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

            console.log('R2G Navigating to graph')
            await page.goto('https://roamresearch.com/404')// workaround of navigating away to get disablecss and disablejs parameters to work due to issue with puppeteer and # hash navigation used in SPAs like Roam
            await page.goto(`https://roamresearch.com/#/app/${RR_GRAPH}?disablecss=true&disablejs=true`)

            console.log('R2G Waiting for graph to load')
            // CHECK if have permission to view graph
            // IDEAS check for .navbar for app
            // IDEAS wait for astrolabe spinner to stop
            await page.waitForSelector('.bp3-icon-more')

            // console.log('R2G Clicking "Share, export and more"')
            await page.click('.bp3-icon-more')

            // console.log('R2G Clicking "Export All"')
            await page.evaluate(() => {
                [...document.querySelectorAll('li .bp3-fill')].find(li => li.innerText == 'Export All').click()
            })

            // console.log('R2G Waiting for export dialog')
            await page.waitForSelector('.bp3-dialog .bp3-button-text')

            // console.log('R2G Clicking Export Format')
            await page.click('.bp3-dialog .bp3-button-text')


            // console.log('R2G Clicking "JSON"')
            await page.evaluate(() => {
                [...document.querySelectorAll('.bp3-text-overflow-ellipsis')].find(dropdown => dropdown.innerText == 'JSON').click()
            })

            // console.log('R2G Clicking "Export All"')
            await page.evaluate(() => {
                [...document.querySelectorAll('button')].find(button => button.innerText == 'Export All').click()
            })

            console.log('R2G Waiting for download')
            await page.waitForSelector('.bp3-spinner')
            await page.waitForSelector('.bp3-spinner', { hidden: true })

            console.log('R2G JSON downloaded')

            resolve()
        } catch (err) { reject(err) }
    })
}

async function extract_json() {
    return new Promise(async (resolve, reject) => {
        console.log('R2G Extracting JSON')

        await fs.readdir(temp_dir, async function (err, files) {
            if (err) {
                return console.log('Unable to scan directory: ' + err)
            }

            if (files.length === 0) {
                reject('Extraction error: temp dir is empty')
            } else if (files) {
                const file = files[0]

                const source = path.join(temp_dir, file)
                const target = path.join(temp_dir, '_extraction')

                try {
                    console.log('R2G Extracting ' + file)
                    await extract(source, { dir: target })

                    console.log('R2G Extraction complete')
                    resolve()
                } catch (err) {
                    reject(`Extraction error: ${err}`)
                }
            }
        })
    })
}

async function deleteDir(dir) {
    fs.rmdir(dir, { recursive: true }, (err) => {
        if (err) throw err
        console.log(`R2G temp dir deleted`)
    })
}

// async function wait(ms) {
//     await new Promise(resolve => setTimeout(resolve, ms))
// }