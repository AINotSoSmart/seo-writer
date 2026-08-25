Most big issue for me is the cloro api used for ai questions. They have only free 500 creidts, which gets consumed in one and half run. Then their first plan starts at 35 dollar/month giving u lot of credits that doesn't roll over. Let's I paid but what if I don't get users in that month who can consume these creidts, then I ahve lost 35 dollar... And the 35 are huge for me when u r not able to use them. And I don't know any alternative... Do u know??

This is actually **much less bad than I thought**. I found two real alternatives that scrape the **consumer surfaces**, not the useless developer-API approximation your repo deliberately rejected.

| Provider        | ChatGPT real surface | Google AI Mode | Pricing model                                     | Fit for you                |
| --------------- | -------------------- | -------------- | ------------------------------------------------- | -------------------------- |
| **Bright Data** | ✅                    | ✅              | **5,000 free records/month**, then ~$1.50/1k PAYG | **Best**                   |
| **DataForSEO**  | ✅                    | ✅              | PAYG, no subscription, credits never expire       | Strong backup              |
| Cloro           | ✅                    | ✅              | 500 free credits, then $30/mo, credits expire     | Bad at your current volume |

### **1. Bright Data looks almost perfect for your situation**

Their current pricing advertises **5,000 scraper records every month free, no credit card**, covering their scraper APIs. They have dedicated **ChatGPT** and **Google AI Mode** scrapers returning answers, citations, links, country, etc. After free usage, it's pay-as-you-go at about **$1.50 / 1,000 delivered records**, with no monthly commitment. ([Bright Data][1])

Your current run is:

**25 questions × 2 engines = ~50 answer records.**

So, assuming one delivered answer maps to one billed record as their scraper pricing describes, **5,000 free records is roughly 100 full customer measurement runs/month.**

That is absurdly better for your current stage than Cloro.

For comparison, your repo uses **7 Cloro credits for ChatGPT + 4 for AI Mode = 11 credits/question**. So 25 questions = **275 credits/run**, which explains why the 500 free credits vanish after ~1.8 runs.  Cloro's public pricing currently shows 500 free credits and then $30/month with no rollover. ([cloro][2])

### **2. DataForSEO is another serious option**

This one surprised me too. They now have an actual **ChatGPT Scraper API**, explicitly saying it captures what users see in ChatGPT rather than calling OpenAI's model API. Standard jobs start at **$0.0012 per ChatGPT results page**, Priority $0.0024, Live $0.004. ([DataForSEO][3])

They also launched a real **Google AI Mode SERP API**, with text/source extraction and location targeting. ([DataForSEO Docs][4])

Big advantage: **no monthly subscription and purchased credits never expire**. Bad part for you: after the $1 free credit, DataForSEO currently says the minimum top-up is **$50**. So economically excellent, but still an annoying upfront expense. ([DataForSEO][3])

### What I would do

**Do NOT pay Cloro $30 yet.**

Use your remaining Cloro credits to benchmark maybe **10 identical buyer questions** against:

**Cloro vs Bright Data.**

Compare:

* brand mentions
* competitors named
* answer text
* citations
* ChatGPT results
* AI Mode results

If Bright Data is reasonably close, **replace Cloro with Bright Data and ship**.

Your `engines.ts` already centralizes the scraping-provider logic, so this is not another product pivot. It is swapping the data provider underneath the same `chatgpt-web` and `google-aimode` engine abstraction.

And importantly, **don't replace Cloro with OpenRouter/OpenAI/Gemini APIs** just because they're cheap. Your own repo documents why that's wrong: those API surfaces can produce materially different brand visibility than what actual users see.

**Bright Data is the first alternative I'd test. This may genuinely remove the $30/month blocker.**

[1]: https://brightdata.com/products/web-scraper/chatgpt?gspk=Nzg1Yzk4YTgwNjYx&gsxid=7gAkZBImU64BgK&ps_partner_key=Nzg1Yzk4YTgwNjYx&ps_xid=7gAkZBImU64BgK&utm_source=chatgpt.com "ChatGPT Scraper - 5K records/Month for Free"
[2]: https://cloro.dev/pricing/?utm_source=chatgpt.com "Pricing | cloro"
[3]: https://dataforseo.com/chatgpt-scraper-api?utm_source=chatgpt.com "ChatGPT Scraper API — Structured ChatGPT Response Data – DataForSEO"
[4]: https://docs.dataforseo.com/v3/serp/google/ai_mode/overview/?utm_source=chatgpt.com "serp/google/ai_mode/overview – DataForSEO API v.3"
