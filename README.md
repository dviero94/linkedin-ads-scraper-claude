# linkedin-ads-scraper-claude
LinkedIn Ads Scraper - Guida all'Uso
Questo scraper è progettato per estrarre annunci pubblicitari da LinkedIn Ads Library per un elenco di aziende fornito tramite un file CSV.
Funzionalità

Estrazione di annunci pubblicitari per un elenco di aziende
Raccolta di informazioni come:

Nome dell'azienda
Testo dell'annuncio
URL dell'immagine dell'annuncio (se disponibile)
Identificazione annunci video


Esportazione dei dati in formato JSON
Possibilità di integrazione con Notion (da implementare separatamente)

Requisiti

Un account Apify
Un file CSV con l'elenco delle aziende da monitorare
Proxy adeguati (consigliato l'uso di Apify Proxy)

Configurazione del CSV
Il file CSV deve contenere almeno una colonna chiamata companyName con i nomi delle aziende da cercare. Un esempio è fornito nel file "Template CSV per le aziende".
Istruzioni per l'uso

Crea un nuovo attore in Apify

Accedi al tuo account Apify
Vai su "Actors" e clicca "Create new"
Dai un nome al tuo attore (es. "linkedin-ads-scraper")
Nella scheda "Source" incolla il codice del file "LinkedIn Ads Library Scraper"
Nella scheda "Input schema" incolla il contenuto dello schema di input


Prepara il file CSV

Crea un file CSV con l'elenco delle aziende seguendo il formato del template
Carica il file su un servizio di hosting o su Apify Storage


Esegui l'attore

Configura i parametri di input:

csvUrl: URL del file CSV contenente l'elenco delle aziende
maxConcurrency: Numero di pagine da elaborare in parallelo
maxRequestsPerCrawl: Limite massimo di richieste
proxyConfiguration: Configurazione del proxy (consigliato usare Apify Proxy)


Avvia l'attore e attendi il completamento


Accedi ai risultati

I risultati saranno disponibili nel dataset dell'esecuzione
Puoi esportarli in vari formati (JSON, CSV, Excel, ecc.)



Integrazione con Notion (futura implementazione)
Per l'integrazione con Notion, sarà necessario:

Creare un database Notion con la struttura appropriata
Ottenere un'API key Notion
Configurare l'ID del database Notion
Utilizzare lo script di integrazione fornito come un task separato in Apify

Limitazioni e Considerazioni

LinkedIn potrebbe limitare l'accesso alla sua Ads Library o richiedere l'autenticazione
È consigliabile utilizzare proxy di alta qualità per evitare blocchi
Il numero di annunci estratti potrebbe variare in base alla visibilità pubblica
LinkedIn potrebbe modificare la struttura della sua pagina, richiedendo aggiornamenti al codice

Risoluzione dei problemi

Se lo scraper non riesce ad accedere alla pagina degli annunci, potrebbe essere necessario aggiornare i selettori HTML
Se viene richiesto il login, verifica la configurazione del proxy
Per un elevato numero di aziende, considera di aumentare la concorrenza e il limite di richieste

Note aggiuntive

Lo scraper effettua ricerche basate sui nomi delle aziende, quindi risultati più precisi richiedono nomi aziendali accurati
Per risultati ottimali, considera di eseguire lo scraper in orari di minor traffico
Monitora regolarmente i log dell'esecuzione per identificare eventuali problemi
