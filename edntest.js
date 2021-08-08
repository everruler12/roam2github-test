const path = require('path')
const fs = require('fs-extra')
const edn_format = require('edn-formatter').edn_formatter.core.format

const file_fullpath = 'edntest/ArtOfGig2.edn'
const file_fullpath2 = file_fullpath + ' reverse.edn'

formatEDN()

async function formatEDN() {

    const edn = await fs.readFile(file_fullpath, 'utf-8')

    /* after reversed file is outputed, test with this section and comment out the section below */
    // const edn2 = await fs.readFile(file_fullpath2, 'utf-8')
    // compareSubstrings(edn, edn2, 400, 300)
    /* ------------------------------------------------------- */

    const edn_prefix = '#datascript/DB '
    var new_edn = edn_prefix + edn_format(edn.replace(new RegExp('^' + edn_prefix), ''))
    checkFormattedEDN(edn, new_edn)

    log('- Saving formatted EDN')
}

function log(...messages) {
    const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '')
    console.log(timestamp, 'R2G', ...messages)
}

async function error(err) {
    log('ERROR -', err)
    console.timeEnd('R2G Exit after')
    // await page.screenshot({ path: path.join(download_dir, 'error.png' }) // will need to pass page as parameter... or set as parent scope
    process.exit(1)
}

function checkFormattedEDN(original, formatted) {
    const reverse_format = formatted
        .trim() // remove trailing line break
        .split('\n') // separate by line
        .map(line => line.trim()) // remove indents, and one extra space at end of second to last line
        .join(' ') // replace line breaks with a space

    fs.outputFile(file_fullpath2, reverse_format)

    if (original === reverse_format) {
        // log('(formatted EDN check successful)') // formatted EDN successfully reversed to match exactly with original EDN
        return true
    } else {
        error('EDN formatting error: mismatch with original')
        return false
    }
}

function compareSubstrings(str1, str2, sublength, offset) {
    if (!offset) offset = 0

    if (str1.length != str2.length)
        log('length mismatch')


    for (let i = offset; i < str1.length; i = i + sublength) {
        const start = i
        const end = i + sublength
        const substr1 = str1.substring(start, end)
        const substr2 = str2.substring(start, end)
        // log(start, end, substr1, substr2)
        if (substr1 == substr2)
            // log(true)
            1
        else {
            log(start, end)
            log(substr1)
            log(substr2)
            error(false)
        }
    }
}