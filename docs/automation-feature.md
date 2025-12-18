# Content Automation: The "Watchman" System

This document explains how the automatic article generation and scheduling system works, from the user clicking "Start Automation" to the final article being published.

---

## 1. High-Level Summary (The "Non-Tech" View)

Imagine you have a **Watchman** who walks past your content plan every hour. 

1. **The List**: When you generate a content plan, you get a 30-day "to-do list" of articles.
2. **The Automation Switch**: When you turn on automation, the Watchman starts his rounds.
3. **Checking the Date**: Every hour, the Watchman looks at your list. He asks: *"Is there anything scheduled for today (or earlier) that isn't written yet?"*
4. **Resuming (Missed Articles)**: If the automation was paused and you missed a few days, the Watchman sees those "past due" articles. Depending on your choice, he either:
   - **Gradual**: Writes them one-by-one (1 per hour) so you don't use all your credits at once.
   - **Skip**: Crosses them off the list and moves to the next future one.
   - **Reschedule**: Moves the whole calendar forward to start today.
5. **Writing**: Once he finds an article due, he sends it to the **AI Writer**.

---

## 2. Technical Architecture (The "Dev" View)

The system is built using **Trigger.dev (v3)** and **Supabase**.

### Core Components

#### A. Database Schema (`Supabase`)
- **`content_plans` table**: 
    - `plan_data` (JSONB): An array of objects where each object is a `ContentPlanItem`.
    - `automation_status`: `'active'`, `'paused'`, or `'completed'`.
    - `catch_up_mode`: `'gradual'`, `'skip'`, or `'reschedule'`.
- **`articles` table**: Stores the actual generated content.

#### B. The Watchman Task (`trigger/scheduler.ts`)
- **Type**: Scheduled Task (`schedules.create`).
- **Frequency**: Every hour (`cron: "0 * * * *"`).
- **Logic**:
  1. Fetches all tracks with `automation_status: 'active'`.
  2. Filters `plan_data` for items where `scheduled_date <= today` AND `status === 'pending'`.
  3. **Rate Limiting**: If `catch_up_mode === 'gradual'`, it only processes **one** item from the `itemsDue` list per hour.
  4. **Triggering**: It calls the `generate-blog-post` task for the selected item(s).
  5. **Self-Healing**: It checks if an article was already created for that keyword (pre-creation) to avoid duplicates.

#### C. The API Layer (`app/api/content-plan/automation/route.ts`)
- **GET**: Calculates how many articles were missed while the automation was paused.
- **POST**: Activates automation. If `action === 'reschedule'`, it actually modifies the `scheduled_date` fields inside the JSONB `plan_data` to shift the calendar.

---

## 3. Troubleshooting & FAQs

### "The automation is ON but nothing is happening."
- **Check article_status**: In the `articles` table, an article might be in `queued` or `researching` status. The Watchman won't trigger it again if it's already in progress.
- **Check Trigger.dev Logs**: Look for the `daily-content-watchman` task. It logs exactly how many articles it found due and why it did (or didn't) trigger them.

### "Why 1 article per hour?"
- This is the **Gradual Catch-up** mode. It's a safety feature to prevent 20+ articles from being triggered at once, which could hit your API rate limits or burn through credits in a single minute.

### "How does it know when it's done?"
- The Watchman checks if **all** items in the `plan_data` array have a status of either `published` or `skipped`. If so, it marks the plan as `completed`.
