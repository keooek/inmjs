//https://github.com/intoli/intoli-article-materials/tree/master/articles/not-possible-to-block-chrome-headless
// We'll use Puppeteer is our browser automation framework.
const puppeteer = require('puppeteer');
const {URL} = require('url');
const url = require('url');
const fse = require('fs-extra');
const path = require('path');
const mongoose = require('mongoose');
const Vibbo = require('./models/vibbo');

//console.log(process.arch)
//process.exit(0)

// This is where we'll put the code to get around the tests.
const preparePageForTests = async (page) => {
  // Pass the User-Agent Test.
  const userAgent = 'Mozilla/5.0 (X11; Linux x86_64)' +
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.39 Safari/537.36';
  await page.setUserAgent(userAgent);

  // Pass the Webdriver Test.
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  // Pass the Chrome Test.
  await page.evaluateOnNewDocument(() => {
    // We can mock this in as much depth as we need for the test.
    window.navigator.chrome = {
      runtime: {},
      // etc.
    };
  });

  // Pass the Permissions Test.
  await page.evaluateOnNewDocument(() => {
    const originalQuery = window.navigator.permissions.query;
    return window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
  });

  // Pass the Plugins Length Test.
  await page.evaluateOnNewDocument(() => {
    // Overwrite the `plugins` property to use a custom getter.
    Object.defineProperty(navigator, 'plugins', {
      // This just needs to have `length > 0` for the current test,
      // but we could mock the plugins too if necessary.
      get: () => [1, 2, 3, 4, 5],
    });
  });

  // Pass the Languages Test.
  await page.evaluateOnNewDocument(() => {
    // Overwrite the `plugins` property to use a custom getter.
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
  });
}


async function start(urlpar) {
//(async () => {
  // Launch the browser in headless mode and set up a page.
  let browser;

  if (process.arch === 'arm')   {
   browser = await puppeteer.launch({
    args: ['--no-sandbox'],
    headless: true,
    executablePath: '/usr/bin/chromium-browser',
  });
  }  else  {
   browser = await puppeteer.launch({
    args: ['--no-sandbox'],
    headless: false,
  });
  }
  
  const page = await browser.newPage();

  // Prepare for the tests (not yet implemented).
  await preparePageForTests(page);

 // event interface - callback
 // page.on('response', async (response) => {
 //   const urll = new URL(response.url());
 //   let filePath = path.resolve(`./output/${urll.hostname}${urll.pathname}`);
 //   if (path.extname(urll.pathname).trim() === '') {
 //     filePath = `${filePath}/index.html`;
 //   }
 //   await fse.outputFile(filePath, await response.buffer());
 // });

  // Navigate to the page that will perform the tests.
  //const testUrl = 'https://intoli.com/blog/' + 'not-possible-to-block-chrome-headless/chrome-headless-test.html';
  //const testUrl = 'https://www.vibbo.com/venta-de-solo-pisos-bilbao/?ca=48_s&a=19&m=48020&itype=6&fPos=148&fOn=sb_location';
  console.log(urlpar.href);
  await page.goto(urlpar.href);
  //https://fettblog.eu/scraping-with-puppeteer/
  //await page.goto(testUrl, {
  //  waitUntil: 'networkidle2'
  //});
  
  //console.log('Begin');
  
//  await page.waitForSelector('p.subject.subjectTop > a');
//
//  const ids = await page.evaluate(() => {
//    const links = Array.from(document.querySelectorAll('p.subject.subjectTop > a'))
//    return links.map(link => link.href).slice(0, 100)
//  })
//  console.log(ids);

  //Extraccion del identificador
  await page.waitForSelector('div.list_ads_table > div');

  const ids = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('div.list_ads_table > div'))
    return links.map(link => link.id).slice(0, 100)
  })
  // A veces aparecen id no numericos que no son necesarios
  removeMatching(ids,/^[^0-9]/);
  console.log(ids);

  //ids.forEach(ref => {
    //for (var ref of ids ) {
   for (var i = 0; i < ids.length; i++) {
        const ref = ids[i];
        const DB_URL = 'mongodb://localhost/propertyManagement';

        if (mongoose.connection.readyState == 0) {
          process.arch === 'arm' ? mongoose.connect(DB_URL, { useMongoClient: true, })  :  mongoose.connect(DB_URL)
        }

            const HREF_SELECTOR = '#\\3REFER > div > div.front > div.add-info > p.subject.subjectTop > a ';
            const refspace = ref.slice(0,1) + ' ' + ref.slice(1,ref.length)
            let hrefSelector = HREF_SELECTOR.replace("REFER", refspace);
            console.log('Selector: ' + hrefSelector);
            //Aunque el id sea 115436123, el selector lo pone como \31 15436123, la \\ es por caracter de escape
            //let hrefSelector = '#\\31 15436123 > div > div.front > div.add-info > p.subject.subjectTop > a'
            let href = await page.evaluate((sel) => {
                    return document.querySelector(sel).getAttribute('href');
            }, hrefSelector);

           console.log(ref + ' tiene href ' + href);


    const foundUser = Vibbo.findOne({reference: ref}, (err, userObj)=>{
        if(err){
            console.log('Error: ' + err)
        } else if (userObj){
            console.log('Referencia en bd ' + userObj.reference + ' con fecha ' + userObj.dateCrawled)
        } else {
            console.log('Referencia no encontrada en bd ' + ref);
/*            const HREF_SELECTOR = '#${ref} > div.user-list > div:nth-child(INDEX) > div.d-flex > div > a';

            let href = await page.evaluate((sel) => {
		    return document.querySelector(sel).getAttribute('href').replace('/', '');
            }, HREF_SELECTOR);

           console.log(ref + ' tiene href ' + href);
  */          
        }
    });

//  }) 
    }

/*
  ids.forEach(ref => {
     //  const container = document.querySelector("#${ref}")
     //  return container.querySelectorAll("div > div.front > div.add-info > p.subject.subjectTop > a.href")
     //console.log(hrefs)
     upsertProperty({
      reference: ref,
      dateCrawled: new Date()
     });
    console.log('Saved: ' + ref)
   })
*/

  //setTimeout(async () => {
  //  await browser.close();
  //}, 60000 * 4);

  // Save a screenshot of the results.
  //await page.screenshot({path: 'headless-final-results.png'});

  // Clean up.
  await browser.close()
//})();

}

function upsertProperty(propertyObj) {

	const DB_URL = 'mongodb://localhost/propertyManagement';
	
	if (mongoose.connection.readyState == 0) {
		//mongoose.connect(DB_URL);
	  process.arch === 'arm' ? mongoose.connect(DB_URL, { useMongoClient: true, })  :  mongoose.connect(DB_URL)
	}
	
	// if this email exists, update the entry, don't insert
	const conditions = { reference: propertyObj.reference };
	const options = { upsert: true, new: true, setDefaultsOnInsert: true };
	
	Vibbo.findOneAndUpdate(conditions, propertyObj, options, (err, result) => {
		if (err) throw err;
	});
}

function removeMatching(originalArray, regex) {
    var j = 0;
    while (j < originalArray.length) {
        if (regex.test(originalArray[j]))
            originalArray.splice(j, 1);
        else
            j++;
    }
    return originalArray;
}

const testUrl = 'https://www.vibbo.com/venta-de-solo-pisos-bilbao/?ca=48_s&a=19&m=48020&itype=6&fPos=148&fOn=sb_location';
start(url.parse(testUrl,true));

//process.exit(0)

//https://github.com/emadehsan/thal
//scrap login extract info in subpages + mongoose

//https://www.aymen-loukil.com/en/blog-en/google-puppeteer-tutorial-with-examples/
	//varios, example hrefs, download html file clean

