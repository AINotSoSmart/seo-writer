import { subDays, format, eachDayOfInterval } from 'date-fns';
import { createClient } from "@/utils/supabase/server";

export async function getGscSites(accessToken: string) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch('https://searchconsole.googleapis.com/webmasters/v3/sites', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('GSC API Error Response:', errorData);
      throw new Error(`GSC_API_ERROR:${response.status}:${response.statusText}:${errorData}`);
    }
    const data = await response.json();
    return data.siteEntry || [];
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('GSC API request timed out. Please try again.');
    }
    console.error('Error fetching GSC sites:', error);
    throw new Error(error.message || 'Failed to fetch GSC sites');
  }
}

export async function getGscDataByDateRange(accessToken: string, siteUrl: string, startDate: string, endDate: string) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    const response = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: ['date', 'query', 'page'],
        rowLimit: 25000,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('GSC API Error Response:', errorData);
      throw new Error(`GSC_API_ERROR:${response.status}:${response.statusText}:${errorData}`);
    }
    const data = await response.json();
    return data.rows || [];
  } catch (error: any) {
    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
      throw new Error('The request timed out after 90 seconds. Please try again or select a smaller date range.');
    }
    console.error('Error fetching GSC data:', error);
    throw new Error(error.message || 'Failed to fetch GSC data');
  }
}

export async function getCachedGscData(userId: string, siteUrl: string, days: number) {
  const supabase = await createClient();
  const today = new Date();
  
  // We need data for the current period (days) and previous period (days)
  const totalDaysNeeded = days * 2;
  
  // The GSC data is usually delayed by 2-3 days, so we start from 3 days ago
  const endDate = subDays(today, 3);
  const startDate = subDays(today, 3 + totalDaysNeeded - 1);
  
  const dateRange = eachDayOfInterval({ start: startDate, end: endDate }).map(d => format(d, 'yyyy-MM-dd'));
  
  // 1. Fetch cached dates from our Supabase gsc_daily_cache table
  const { data: cachedRows, error: cacheError } = await supabase
    .from('gsc_daily_cache')
    .select('date, data')
    .eq('user_id', userId)
    .eq('site_url', siteUrl)
    .in('date', dateRange);

  if (cacheError) {
    console.error("Error fetching cache from Supabase:", cacheError);
  }

  const cachedData = new Map<string, any[]>();

  if (cachedRows) {
    cachedRows.forEach(row => {
      cachedData.set(row.date, row.data as any[]);
    });
  }

  // 3. Aggregate data for current and previous periods
  const currentStartDate = format(subDays(today, 3 + days - 1), 'yyyy-MM-dd');
  const currentEndDate = format(subDays(today, 3), 'yyyy-MM-dd');
  const previousStartDate = format(subDays(today, 3 + totalDaysNeeded - 1), 'yyyy-MM-dd');
  const previousEndDate = format(subDays(today, 3 + days), 'yyyy-MM-dd');
  
  const currentDataMap = new Map<string, any>();
  const previousDataMap = new Map<string, any>();
  
  cachedData.forEach((rows, date) => {
    const isCurrent = date >= currentStartDate && date <= currentEndDate;
    const isPrevious = date >= previousStartDate && date <= previousEndDate;
    
    if (isCurrent || isPrevious) {
      const targetMap = isCurrent ? currentDataMap : previousDataMap;
      
      rows.forEach(row => {
        const query = row.keys[1];
        const page = row.keys[2];
        const key = `${query}|${page}`;
        
        if (!targetMap.has(key)) {
          targetMap.set(key, {
            keys: [query, page],
            clicks: 0,
            impressions: 0,
            ctr: 0,
            position: 0,
            count: 0
          });
        }
        
        const agg = targetMap.get(key);
        agg.clicks += row.clicks;
        agg.impressions += row.impressions;
        agg.position += (row.position * row.impressions); // Weighted position
        agg.count += 1;
      });
    }
  });
  
  // Finalize aggregation (calculate CTR and average position)
  const finalizeAggregation = (map: Map<string, any>) => {
    return Array.from(map.values()).map(agg => {
      agg.ctr = agg.impressions > 0 ? agg.clicks / agg.impressions : 0;
      agg.position = agg.impressions > 0 ? agg.position / agg.impressions : 0;
      return agg;
    });
  };
  
  return {
    currentData: finalizeAggregation(currentDataMap),
    previousData: finalizeAggregation(previousDataMap)
  };
}
