import Sitemapper from "sitemapper";

async function test() {
    console.log("Starting sitemapper for play.google.com");
    const sitemapper = new Sitemapper({
        url: "https://play.google.com/sitemap.xml",
        timeout: 15000,
    });
    
    const start = Date.now();
    try {
        const result = await Promise.race([
            sitemapper.fetch(),
            new Promise((_, r) => setTimeout(() => r(new Error("Hard timeout!")), 30000))
        ]) as { sites: string[] };
        console.log(`Finished in ${Date.now() - start}ms. Found ${result.sites.length} URLs`);

    } catch (e: any) {
        console.error(`Failed after ${Date.now() - start}ms:`, e.message);
    }
}

test();
