// TODO output log file to backup repo with list of changed markdown filenames and overwritten files, in order to preserve privacy in public actions
const path = require('path')
const fs = require('fs-extra')
const edn_format = require('edn-formatter').edn_formatter.core.format

console.time('R2G Exit after')
init2()
async function init2() {
    log('- Formatting EDN (this can take a couple minutes for large graphs)') // This could take a couple minutes for large graphs
    const edn = await fs.readFile('./RBC3-How-To-Take-Smart-Notes.edn', 'utf-8')

    const edn_prefix = '#datascript/DB '
    var new_edn = edn_prefix + edn_format(edn.replace(new RegExp('^' + edn_prefix), ''))
    checkFormattedEDN(edn, new_edn)

    log('- Saving formatted EDN')
    await fs.outputFile('./out.edn', new_edn)
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

    if (original === reverse_format) {
        // log('(formatted EDN check successful)') // formatted EDN successfully reversed to match exactly with original EDN
        return true
    } else {
        error('EDN formatting error: mismatch with original')
        return false
    }
}