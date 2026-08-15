export function computeExpertSeoDirectives(currentData: any[], previousData: any[]) {
  const currentMap = new Map();
  const queryMap = new Map();

  currentData.forEach((row: any) => {
    const key = `${row.keys[0]}|${row.keys[1]}`;
    const query = row.keys[0];
    currentMap.set(key, row);
    
    if (!queryMap.has(query)) queryMap.set(query, []);
    queryMap.get(query).push(row);
  });

  const previousMap = new Map();
  previousData.forEach((row: any) => {
    const key = `${row.keys[0]}|${row.keys[1]}`;
    previousMap.set(key, row);
  });

  const rawCtrHits: any[] = [];
  const cannibalization: any[] = [];
  const strikingDistance: any[] = [];
  const contentDecay: any[] = [];
  const emergingTrends: any[] = [];
  const aeoAlignment: any[] = [];

  currentMap.forEach((currentRow, key) => {
    const previousRow = previousMap.get(key);
    const query = currentRow.keys[0];
    const page = currentRow.keys[1];

    // 1. CTR Interventions (Page 1, High Impressions, Low CTR)
    const ctr = currentRow.clicks / currentRow.impressions;
    if (currentRow.position <= 10 && currentRow.impressions > 100 && ctr < 0.02) {
      rawCtrHits.push({ query, page, position: currentRow.position, impressions: currentRow.impressions, ctr });
    }

    // 3. True Striking Distance
    if (currentRow.position >= 11 && currentRow.position <= 20 && currentRow.impressions > 500) {
      strikingDistance.push({ query, page, position: currentRow.position, impressions: currentRow.impressions });
    }

    // 4. Content Decay (Significant drop in clicks/impressions for top pages)
    if (previousRow && previousRow.clicks > 50) {
      const clickDrop = previousRow.clicks - currentRow.clicks;
      if (clickDrop > (previousRow.clicks * 0.3)) { // 30% drop
        contentDecay.push({ 
          query, 
          page, 
          currentClicks: currentRow.clicks, 
          prevClicks: previousRow.clicks,
          currentPos: currentRow.position,
          prevPos: previousRow.position,
          dropPercentage: (clickDrop / previousRow.clicks) * 100
        });
      }
    }

    // 5. Emerging Trends (New queries with high impressions)
    if (!previousRow && currentRow.impressions > 200) {
      emergingTrends.push({ query, page, impressions: currentRow.impressions, position: currentRow.position });
    }

    // 6. AEO Alignment / Intent Shift
    if (previousRow && previousRow.clicks > 15) {
      const prevImps = previousRow.impressions;
      const currentImps = currentRow.impressions;
      const prevClicks = previousRow.clicks;
      const currentClicks = currentRow.clicks;

      const impsStable = currentImps >= (prevImps * 0.8);
      const clicksCrashed = currentClicks <= (prevClicks * 0.2);

      if (impsStable && clicksCrashed) {
        aeoAlignment.push({
          query,
          page,
          prevClicks,
          currentClicks,
          prevImps,
          currentImps,
          position: currentRow.position
        });
      }
    }
  });

  // 2. Keyword Cannibalization
  queryMap.forEach((pages, query) => {
    if (pages.length > 1) {
      const competingPages = pages.filter((p: any) => p.impressions > 50).sort((a: any, b: any) => b.impressions - a.impressions);
      if (competingPages.length > 1) {
        const top1 = competingPages[0];
        const top2 = competingPages[1];
        if (top2.impressions > (top1.impressions * 0.5)) {
          cannibalization.push({
            query,
            pages: competingPages.map((p: any) => ({ url: p.keys[1], impressions: p.impressions, position: p.position }))
          });
        }
      }
    }
  });

  // Group CTR hits by page URL so one card = one page with all its underperforming queries
  const ctrPageMap = new Map<string, any>();
  rawCtrHits.forEach(hit => {
    if (!ctrPageMap.has(hit.page)) {
      ctrPageMap.set(hit.page, {
        page: hit.page,
        queries: [],
        totalImpressions: 0,
      });
    }
    const group = ctrPageMap.get(hit.page);
    group.queries.push({ query: hit.query, position: hit.position, impressions: hit.impressions, ctr: hit.ctr });
    group.totalImpressions += hit.impressions;
  });
  const ctrInterventions = Array.from(ctrPageMap.values()).map(group => {
    group.queries.sort((a: any, b: any) => b.impressions - a.impressions);
    // Primary query = highest impressions query for this page
    group.primaryQuery = group.queries[0].query;
    group.avgPosition = group.queries.reduce((s: number, q: any) => s + q.position, 0) / group.queries.length;
    group.avgCtr = group.queries.reduce((s: number, q: any) => s + q.ctr, 0) / group.queries.length;
    return group;
  });

  const pageMap = new Map();
  currentData.forEach((row: any) => {
    const page = row.keys[1];
    if (!pageMap.has(page)) pageMap.set(page, { url: page, clicks: 0, impressions: 0, queries: [] });
    const p = pageMap.get(page);
    p.clicks += row.clicks;
    p.impressions += row.impressions;
    p.queries.push({ query: row.keys[0], impressions: row.impressions });
  });

  const topPages = Array.from(pageMap.values())
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 50)
    .map(p => {
      p.queries.sort((a: any, b: any) => b.impressions - a.impressions);
      return { url: p.url, query: p.queries[0]?.query || '' };
    });

  return {
    ctrInterventions: ctrInterventions.sort((a, b) => b.totalImpressions - a.totalImpressions).slice(0, 15),
    cannibalization: cannibalization.sort((a, b) => b.pages.reduce((sum: number, p: any) => sum + p.impressions, 0) - a.pages.reduce((sum: number, p: any) => sum + p.impressions, 0)).slice(0, 15),
    strikingDistance: strikingDistance.sort((a, b) => b.impressions - a.impressions).slice(0, 15),
    contentDecay: contentDecay.sort((a, b) => (b.prevClicks - b.currentClicks) - (a.prevClicks - a.currentClicks)).slice(0, 15),
    emergingTrends: emergingTrends.sort((a, b) => b.impressions - a.impressions).slice(0, 15),
    aeoAlignment: aeoAlignment.sort((a, b) => b.prevClicks - a.prevClicks).slice(0, 15),
    topPages,
  };
}
