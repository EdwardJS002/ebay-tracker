import fs from 'fs'
import XLSX from 'xlsx'

import { Cluster } from 'puppeteer-cluster'

const data = fs.readFileSync('recherches.txt', 'utf8')
const elements = data.split(`\n`)

let results = []

const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: 3,
    monitor: true,
})

await cluster.task(async ({ page, data: element }) => {
    await page.goto(
        `https://www.ebay.fr/sch/i.html?_nkw=${encodeURI(
            element
        )}&_sop=15&_udhi=150&_blrs=recall_filtering`,
        { waitUntil: 'networkidle2' }
    )

    let urlLink = await page.evaluate(() => {
        return document.querySelector(
            '#srp-river-results > ul > li:nth-child(2) > div > div.s-item__info.clearfix > a'
        ).href
    })

    await page.goto(urlLink)

    let productTitle = await page.evaluate(() => {
        return document.querySelector(`#itemTitle`).innerHTML
    })

    let productPrice = await page.evaluate(() => {
        return document.querySelector(`#prcIsum`).innerHTML
    })

    let sellerName = await page.evaluate(() => {
        return document.querySelector(
            `#RightSummaryPanel > div:nth-child(3) > div.vim.x-about-this-seller > div > div:nth-child(2) > div > div:nth-child(1) > div > a:nth-child(1) > span`
        ).innerHTML
    })

    let productShippingCost = await page.evaluate(() => {
        return document.querySelector(`#fshippingCost > span`).innerHTML
    })

    page.close()

    let cleanTitle = productTitle.replace(
        '<span class="g-hdn">Détails sur  &nbsp;</span>',
        ''
    )

    let cleanPrice = parseFloat(productPrice.replace(',', '.'))

    let cleanExpedition = parseFloat(productShippingCost.replace(',', '.')) || 0

    let result = {
        Recherche: element,
        Titre: cleanTitle,
        Prix: cleanPrice,
        Expedition: cleanExpedition,
        Total: cleanPrice + cleanExpedition,
        Vendeur: sellerName,
        Lien: urlLink,
    }

    results.push(result)

    return result
})

elements.map((element) => {
    cluster.queue(element)
})

await cluster.idle()
await cluster.close()

var dataWS = XLSX.utils.json_to_sheet(results)
var wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, dataWS, 'Données')
XLSX.writeFile(wb, `Données.xlsx`)
