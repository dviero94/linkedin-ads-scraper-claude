const Apify = require('apify');
const { log } = Apify.utils;

Apify.main(async () => {
    // Ottieni i parametri di input
    const input = await Apify.getInput();
    const {
        csvUrl,
        maxConcurrency = 10,
        maxRequestsPerCrawl = 1000,
        proxyConfiguration = { useApifyProxy: true }
    } = input;

    // Crea una richiesta che scaricare e analizzare il file CSV
    const csvData = [];
    if (csvUrl) {
        log.info('Downloading CSV file...');
        try {
            const request = await Apify.utils.requestAsBrowser({ url: csvUrl });
            const parsedCsv = Apify.utils.parseCsv(request.body);
            
            for (const row of parsedCsv) {
                // Assicurati che la riga abbia un nome azienda valido
                if (row.companyName || row.Azienda || row.company_name || row.company || row['Company Name']) {
                    const companyName = row.companyName || row.Azienda || row.company_name || row.company || row['Company Name'];
                    const sector = row.Settore || row.settore || row.sector || '';
                    const nationality = row.Nazionalità || row.nazionalita || row.nationality || '';
                    
                    csvData.push({
                        companyName: companyName.trim(),
                        sector: sector ? sector.trim() : '',
                        nationality: nationality ? nationality.trim() : ''
                    });
                }
            }
            log.info(`Loaded ${csvData.length} companies from CSV file`);
        } catch (error) {
            log.error('Failed to download or parse CSV file', error);
            throw new Error('Failed to process the CSV file. Please check the URL and file format.');
        }
    } else {
        throw new Error('Missing CSV URL in input');
    }

    // Crea un'istanza di RequestList per gestire le URL da visitare
    const startUrls = csvData.map(company => ({
        url: `https://www.linkedin.com/ads/search?keywords=${encodeURIComponent(company.companyName)}`,
        userData: { 
            companyName: company.companyName,
            sector: company.sector,
            nationality: company.nationality
        }
    }));

    const requestList = await Apify.openRequestList('start-urls', startUrls);
    const requestQueue = await Apify.openRequestQueue();

    // Crea dataset per salvare i risultati
    const dataset = await Apify.openDataset();

    // Imposta la configurazione del proxy
    const proxyConfig = await Apify.createProxyConfiguration(proxyConfiguration);

    // Inizializza il crawler
    const crawler = new Apify.PuppeteerCrawler({
        requestList,
        requestQueue,
        proxyConfiguration: proxyConfig,
        maxRequestRetries: 3,
        maxConcurrency,
        maxRequestsPerCrawl,
        launchContext: {
            launchOptions: {
                headless: true,
                defaultViewport: { width: 1920, height: 1080 },
            },
        },
        handlePageFunction: async ({ request, page }) => {
            const { companyName, sector, nationality } = request.userData;
            log.info(`Processing company: ${companyName}`);

            // Attendi che la pagina carichi
            await page.waitForSelector('body', { timeout: 60000 });
            
            // Controlla se siamo sulla pagina di login
            const isLoginPage = await page.evaluate(() => {
                return window.location.href.includes('linkedin.com/login') || 
                       document.querySelector('.login-form') !== null;
            });

            if (isLoginPage) {
                throw new Error('LinkedIn richiede il login. È necessario utilizzare un proxy autenticato o cookie di sessione.');
            }

            // Attendi che gli annunci vengano caricati
            await page.waitForSelector('.feed-shared-update-v2, .no-results', { timeout: 30000 })
                .catch(() => log.info('Timeout waiting for ads or no results message'));

            // Controlla se non ci sono risultati
            const noResults = await page.evaluate(() => {
                const noResultsEl = document.querySelector('.no-results');
                return noResultsEl !== null;
            });

            if (noResults) {
                log.info(`No ads found for company: ${companyName}`);
                return;
            }

            // Esegui lo scroll per caricare più annunci
            await autoScroll(page);

            // Estrai i dati degli annunci
            const ads = await page.evaluate((companyData) => {
                const adElements = Array.from(document.querySelectorAll('.feed-shared-update-v2'));
                
                return adElements.map(adElement => {
                    // Estrai il testo dell'annuncio
                    let adText = '';
                    const textContainer = adElement.querySelector('.feed-shared-update-v2__description');
                    if (textContainer) {
                        adText = textContainer.innerText.trim();
                    }

                    // Estrai l'URL dell'immagine se presente
                    let imageUrl = '';
                    const imageElement = adElement.querySelector('.feed-shared-image__container img');
                    if (imageElement) {
                        imageUrl = imageElement.src;
                    }

                    // Verifica se c'è un video
                    const hasVideo = adElement.querySelector('.feed-shared-linkedin-video') !== null;

                    // Estrai il nome dell'azienda dall'annuncio se possibile, altrimenti usa quello dal CSV
                    let companyNameFromAd = '';
                    const companyElement = adElement.querySelector('.feed-shared-actor__name');
                    if (companyElement) {
                        companyNameFromAd = companyElement.innerText.trim();
                    }

                    return {
                        companyName: companyNameFromAd || companyData.companyName,
                        sector: companyData.sector,
                        nationality: companyData.nationality,
                        adText,
                        imageUrl,
                        hasVideo,
                        timestamp: new Date().toISOString(),
                    };
                });
            }, { companyName, sector, nationality });

            // Salva i dati estratti
            if (ads.length > 0) {
                log.info(`Found ${ads.length} ads for company: ${companyName}`);
                await dataset.pushData(ads);
            } else {
                log.info(`No ad data extracted for company: ${companyName}`);
            }
        },
        handleFailedRequestFunction: async ({ request, error }) => {
            log.error(`Request ${request.url} failed with error: ${error.message}`);
        },
    });

    log.info('Starting the scrape...');
    await crawler.run();
    log.info('Scrape finished.');

    // Ottieni tutti i dati raccolti
    const { items } = await dataset.getData();
    log.info(`Total ads extracted: ${items.length}`);

    // Esporta i dati in formato CSV
    if (items.length > 0) {
        // Crea una key store per salvare il file CSV
        const store = await Apify.openKeyValueStore('linkedin-ads-output');
        
        // Converti i dati in formato CSV
        const fields = ['companyName', 'sector', 'nationality', 'adText', 'imageUrl', 'hasVideo', 'timestamp'];
        const csv = await convertToCSV(items, fields);
        
        // Salva il file CSV nel key-value store
        await store.setValue('linkedin-ads.csv', csv, { contentType: 'text/csv' });
        
        // Crea anche un file JSON per riferimento
        await store.setValue('linkedin-ads.json', items, { contentType: 'application/json' });
        
        log.info('Data exported successfully to CSV and JSON files in the key-value store');
        log.info('You can download the CSV file from the "Key-value store" tab in your Apify console');
    } else {
        log.info('No data collected, CSV export skipped');
    }
});

// Funzione per eseguire lo scrolling automatico della pagina
async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight - window.innerHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 200);
        });
    });
}

// Funzione per convertire i dati in formato CSV
async function convertToCSV(items, fields) {
    // Aggiungi intestazioni
    let csv = fields.join(',') + '\n';
    
    // Aggiungi righe di dati
    for (const item of items) {
        const row = fields.map(field => {
            // Ottieni il valore del campo
            let value = item[field] || '';
            
            // Se il valore contiene virgole, virgolette o nuove righe, racchiudilo tra virgolette
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                // Sostituisci eventuali virgolette con doppie virgolette (standard CSV)
                value = value.replace(/"/g, '""');
                // Racchiudi tra virgolette
                value = `"${value}"`;
            }
            
            return value;
        }).join(',');
        
        csv += row + '\n';
    }
    
    return csv;
}
