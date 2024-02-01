const puppeteer = require("puppeteer");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const capitalize = (str, lower = false) =>
  (lower ? str.toLowerCase() : str).replace(/(?:^|\s|["'([{])+\S/g, match => match.toUpperCase());

async function downloadPDF(pdfURL, outputFilename, directory) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }

    const response = await axios({
        method: 'get',
        url: pdfURL,
        responseType: 'stream',
    });

    const writer = fs.createWriteStream(path.join(directory, outputFilename));

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

async function scrapeWebsite(browser, url, type, subject = null, topic = null, board=null) {
    const page = await browser.newPage();

    try {
        if (type === "subject") {
            await page.goto(url);
            await page.waitForSelector(".post-entry");

            const elementsHTML = await page.evaluate(() => {
                const allElements = Array.from(document.querySelectorAll('*'));
                return allElements.filter(element => {
                    return Array.from(element.classList).some(className => className.startsWith('one'));
                }).map(element => element.querySelector("a").href);
            });

            return elementsHTML;
        } else if (type === "exam-board" || type === "topic") {
            await page.goto(url);

            if (type === "exam-board") {
                await page.waitForSelector(".dropshadowboxes-container");
            } else if (type === "topic") {
                await page.waitForSelector(".files");
            }

            const elements = await page.$$((type === "exam-board") ? '.dropshadowboxes-container' : '.files', { timeout: 100000 });

            let hrefs = [];
            for (let element of elements) {
                let href;

                if (type === "exam-board") {
                    href = await page.evaluate(el => el.querySelector("a").href, element);
                } else if (type === "topic") {
                    let hrefArray = await page.evaluate(el => {
                        const anchors = Array.from(el.querySelectorAll('li a'));
                        return anchors.map(anchor => anchor.href);
                    }, element);

                    hrefArray = hrefArray.map(href => href.includes("pdf-pages") ? downloadPDF(decodeURIComponent(href.split("/?pdf=")[1]), decodeURIComponent(decodeURIComponent(href.split("/?pdf=")[1]).toString().split("/").slice(-1)[0]), `Subjects/Content/${subject}/${board}/${topic}`) : href);

                    hrefs.push(...hrefArray);
                }

                if (href) {
                    hrefs.push(href);
                }
            }

            return hrefs;
        }
    } catch (error) {
        console.error(error);
        return []; // Return an empty array to indicate failure
    }
}

(async () => {
    const browser = await puppeteer.launch();
    const subjects = ["physics", "biology", "chemistry", "economics", "geography", "english", "psychology"]

    for (let subject of subjects){
        try {
            const examboards = await scrapeWebsite(browser, `https://www.physicsandmathstutor.com/${subject}-revision/`, "subject");
    
            for (let examboard of examboards) {
                // console.log(examboard.split("/").slice(-2)[0].replace(/-/g, " "))
                const hrefs = await scrapeWebsite(browser, examboard, "exam-board");
    
                for (let href of hrefs) {
                    console.log(examboard.split("/").slice(-2)[0].replace(/-/g, " "))
                    console.log(href)
                //     // console.log(href)
                    
                    if(href.includes("revision") && !href.includes("practical-skills") && !href.includes("videos") ){
                        await scrapeWebsite(browser, href, "topic", capitalize(subject), capitalize(href.split("/").slice(-2)[0].replace(/-/g, " ")), board=`${capitalize(examboard.split("/").slice(-2)[0].replace(/-/g, " "))}`);
                    }
    
                //     for (let PDFhref of PDFhrefs) {
                //         // console.log(PDFhref);
                //     }
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    await browser.close()

    // try {
    //     const examboards = await scrapeWebsite(browser, "https://www.physicsandmathstutor.com/physics-revision/", "subject");

    //     for (let examboard of examboards) {
    //         const hrefs = await scrapeWebsite(browser, examboard, "exam-board");

    //         for (let href of hrefs) {
    //             const PDFhrefs = await scrapeWebsite(browser, href, "topic", "physics", capitalize(href.split("/").slice(-2)[0].replace(/-/g, " ")));

    //             for (let PDFhref of PDFhrefs) {
    //                 console.log(PDFhref);
    //             }
    //         }
    //     }
    // } catch (err) {
    //     console.error(err);
    // } finally {
    //     await browser.close();
    // }
})();
