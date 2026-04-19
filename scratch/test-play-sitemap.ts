import Sitemapper from "sitemapper";

async function test() {
    const robotsRes = await fetch("https://play.google.com/robots.txt");
    const robotsTxt = await robotsRes.text();
    const sitemapMatch = robotsTxt.match(/Sitemap:\s*(https?:\/\/[^\s]+)/i);
    const foundUrl = sitemapMatch?.[1]?.trim() || "https://play.google.com/sitemap.xml";
    console.log("Found sitemap:", foundUrl);

    const sitemapper = new Sitemapper({
        url: foundUrl,
        timeout: 15000,
    });
    
    const start = Date.now();
    try {
        const result = await Promise.race([
            sitemapper.fetch(),
            new Promise((_, r) => setTimeout(() => r(new Error("Hard timeout!")), 30000))
        ]) as { sites: string[] };
        console.log(`Finished in ${Date.now() - start}ms. Found ${result.sites?.length} URLs`);

    } catch (e: any) {
        console.error(`Failed after ${Date.now() - start}ms:`, e.message);
    }
}

test();
