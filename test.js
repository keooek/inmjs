//https://github.com/intoli/intoli-article-materials/tree/master/articles/not-possible-to-block-chrome-headless
// We'll use Puppeteer is our browser automation framework.
const puppeteer = require('puppeteer');
const {
  URL
} = require('url');
const url = require('url');
const fse = require('fs-extra');
const path = require('path');
const mongoose = require('mongoose');
const Vibbo = require('./models/vibbo');
const CREDS = require('./creds');
const nodemailer = require('nodemailer');
var cron = require('cron');
const log4js = require('log4js');

log4js.configure({
  appenders: { vibbo: { type: 'file', filename: 'log/vibbo.log' } },
  categories: { default: { appenders: ['vibbo'], level: 'info' } }
});
 
const logger = log4js.getLogger('vibbo');


//const testUrl = 'https://www.vibbo.com/venta-de-solo-pisos-bilbao/?ca=48_s&a=19&m=48020&itype=6&fPos=148&fOn=sb_location';
//start_index(url.parse(testUrl, true));

//logger.info(process.arch)
//process.exit(0)
const schedule = '00 00,06 8-23 * * 1-5'
logger.info('Cron schedule: ' + schedule);

var job = new cron.CronJob({
 cronTime: schedule, 
 //cronTime: '* * * * *', 
  onTick: function() {
    //logger.info('h')
    const testUrl = 'https://www.vibbo.com/venta-de-solo-pisos-bilbao/?ca=48_s&a=19&m=48020&itype=6&fPos=148&fOn=sb_location';
    start_index(url.parse(testUrl,true));
  },
  onComplete: function () {
    // This function is executed when the job stops 
  },
  start: true, // Start the job right now 
  timeZone: 'Europe/Madrid' // Time zone of this job. 
});
job.start();


const DB_URL = 'mongodb://localhost/propertyManagement';

if (mongoose.connection.readyState == 0) {
  //mongoose.connect(DB_URL);
  process.arch === 'arm' ? mongoose.connect(DB_URL, {
    useMongoClient: true,
  }) : mongoose.connect(DB_URL)
}


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
      Promise.resolve({
        state: Notification.permission
      }) :
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




async function start_index(urlpar) {
  //(async () => {
  // Launch the browser in headless mode and set up a page.
  let browser;

  if (process.arch === 'arm') {
    browser = await puppeteer.launch({
      args: ['--no-sandbox'],
      headless: true,
      executablePath: '/usr/bin/chromium-browser',
    });
  } else if (process.platform === "win32") {
    browser = await puppeteer.launch({
      args: ['--no-sandbox ', '--proxy-server="socks5://localhost:1080 '],
      headless: false,
    });
  } else {
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

  logger.info(urlpar.href);
  await page.goto(urlpar.href);
  await page.waitFor(6 * 1000);
  //https://fettblog.eu/scraping-with-puppeteer/
  //await page.goto(urlpar.href, {
  //  waitUntil: 'networkidle2'
  //});

  //Espera la carga
  await page.waitForSelector('div.list_ads_table > div');

  const ids = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('div.list_ads_table > div'))
    return links.map(link => link.id).slice(0, 100)
  })
  // A veces aparecen id no numericos que no son necesarios
  removeMatching(ids, /^[^0-9]/);
  //const ids = ["115467143"];
  logger.info(ids);


  //ids.forEach(ref => {
  //for (var ref of ids ) {
  for (var i = 0; i < ids.length; i++) {
    const ref = ids[i];
    const HREF_SELECTOR = '#\\3REFER > div > div.front > div.add-info > p.subject.subjectTop > a ';
    const refspace = ref.slice(0, 1) + ' ' + ref.slice(1, ref.length)
    let hrefSelector = HREF_SELECTOR.replace("REFER", refspace);
    logger.info('Selector: ' + hrefSelector);
    //Aunque el id sea 115436123, el selector lo pone como \31 15436123, la \\ es por caracter de escape
    //let hrefSelector = '#\\31 15436123 > div > div.front > div.add-info > p.subject.subjectTop > a'
    let href = await page.evaluate((sel) => {
      return document.querySelector(sel).getAttribute('href');
    }, hrefSelector);

    logger.info(ref + ' tiene href https:' + href);

    await upsertProperty({
      reference: ref,
      url: 'https:' + href,
      //  source: 'Vibbo',
      //  contact: seller,
      //  dateCrawled: new Date()
    });

  }

  //Lo creamos en otro loop ya que sino se cierra la pagina del indice
  for (var i = 0; i < ids.length; i++) {
    //const ref = ids[i];
    const item = await findprop(ids[i]);
    logger.info('Source: ' + item.source)
    if (!item.source) {
      logger.info('Referencia en bd ' + item.reference + ' con href ' + item.url)
      var waitTill = new Date(new Date().getTime() + 15 * 1000);
      while (waitTill > new Date()) {};
      logger.info('Opening: ' + item.url)
      await start_property(page, browser, item.reference, item.url);
    } else {
      logger.info('Pagina ya estaba parseada y los datos guardados los datos en bd' + item.reference);
    }
  }



  // Clean up.
  await browser.close()

  //setTimeout(async () => {
  //  await browser.close();
  //}, 60000 * 4);

  // Save a screenshot of the results.
  //await page.screenshot({path: 'headless-final-results.png'});

}

async function findprop(ref) {
  try {
    const item = await Vibbo.findOne({
      reference: ref
    });
    //logger.info(item);

    return (item);
  } catch (err) {
    console.error('NO ENCONTRADO');
  }
}

//publico
//start_property(115290798,'https://www.vibbo.com/vizcaya/piso-en-calle-travesia-arbolantxa-7/a115290798/?ca=48_s&st=s&c=58');
//inmobiliaria
//start_property(115290798,'https://www.vibbo.com/vizcaya/piso-en-plaza-luis-echevarria/a115456598/?ca=48_s&st=s&c=58');


async function start_property(page, browser, ref, href) {
  /*
    page.on('error', err=> {
      logger.info('error happen at the page: ', err);
    });

    page.on('pageerror', pageerr=> {
      logger.info('pageerror occurred: ', pageerr);
    })
  */
  await page.goto(href).catch(e => console.error('Catched: ' + e));
  await page.waitFor(6 * 1000);

  //Espera la carga
  const alwaysSelector = '#main > div.adview_mainInfo > div > div.adview_mainInfo__infoCol > div > div.titlePriceBox > h1';
  if (await page.$(alwaysSelector) !== null) logger.info('alwaysSelector found');
  else logger.info('alwaysSelector not found');

  await page.waitForSelector(alwaysSelector);

  const sellerSelector = '#main > div.adview_mainInfo > div > div.adview_mainInfo__infoCol > div > div.sellerBox > div.sellerBox__user > div.sellerBox__info > div.sellerBox__info__name';
  if (await page.$(sellerSelector) !== null) {
    logger.info('sellerSelector found');

    //const title = await page.title()
    //logger.info(title)

    //process.exit(0)

    let seller = await page.evaluate((sel) => {
      let element = document.querySelector(sel);
      return element ? element.innerHTML : null;
    }, sellerSelector);

    await upsertProperty({
      reference: ref,
      url: href,
      source: 'Vibbo',
      contact: seller,
      dateCrawled: new Date()
    });

    logger.info('Saved: ' + ref + ' ' + seller)
    await notify_mail(ref);

  } else {
    let seller = 'Inmobiliaria'
    await upsertProperty({
      reference: ref,
      url: href,
      source: 'Vibbo',
      contact: seller,
      dateCrawled: new Date()
    });
    logger.info('Saved: ' + ref + ' ' + seller)
  }

}


async function upsertProperty(propertyObj) {

  // if this email exists, update the entry, don't insert
  const conditions = {
    reference: propertyObj.reference
  };
  const options = {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true
  };

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



async function notify_mail(ref) {

  // find each person with a last name matching 'Ghost', selecting the `name` and `occupation` fields
  // Vibbo.findOne({ 'reference': ref }, {contact:true, source:true, url:true, dateClawled:true}, function (err, property) {
    const property = await findprop(ref);
    // Prints "Space Ghost is a talk show host".
    //logger.info('%s %s is a %s.', ref, property.url, property.dateCrawled);

    //logger.info(ref, property.url, property.dateCrawled, property.source, property.contact);
    logger.info(CREDS.username);

    if (property.contact !== 'Inmobiliaria') {

    var transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: CREDS.username,
        pass: CREDS.password
      }
    });
    
    const mailOptions = {
      from: CREDS.username, // sender address
      to: CREDS.usertest, // list of receivers
      subject: property.source + ' ' + property.contact + ' ' + property.reference, // Subject line
      html: '<p>Url: ' + property.url + ' ' + property.contact + '</p>' // plain text body
    };
    

    transporter.sendMail(mailOptions, function (err, info) {
      if (err)
        logger.info(err)
      else
        logger.info(info);
    });

  }

}




//process.exit(0)

//https://github.com/emadehsan/thal
//scrap login extract info in subpages + mongoose

//https://www.aymen-loukil.com/en/blog-en/google-puppeteer-tutorial-with-examples/
//varios, example hrefs, download html file clean