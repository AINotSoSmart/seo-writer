Yes. The easiest founder mental model is:

> **You are not selling “8 articles/month.” You are selling a monthly AI-visibility diagnosis + a capped fix batch.**

The current product contract is **1 site, up to 25 tracked buyer questions, ChatGPT + Google AI Mode, and up to 8 create/refresh actions in one complete batch per billing cycle**. First 3 months are $99, then $189.

## What happens to one customer

### 1. Before paying

The customer gives you their site/product info, topics/product areas and competitors.

Then FlipAEO generates buyer questions like:

> “I have separate old photos of family members. What AI tool can make a realistic family portrait?”

They review those questions and keep the ones they actually care about, **up to 25**.

Those questions become durable. You are basically saying:

**“These are the buying situations we are going to monitor for you every month.”**

Then they pay.

---

### 2. After payment, the real product starts

FlipAEO asks those exact questions to:

**ChatGPT + Google AI Mode**

Then it records:

* Did they recommend the customer?
* Did they recommend a competitor?
* Who was recommended first?
* What websites/pages were cited?
* What did the AI actually answer?
* Which buyer questions are genuine visibility losses?

This becomes the customer's **AI Visibility report**.

So before you create a single article, they've already received something valuable:

> **“Here are the situations where buyers ask AI for a solution, and here is where you win or lose.”**

That measurement is deliberately the core paid product, not some decorative graph glued onto an article generator. The current subscription spec explicitly describes measurement as the paid product.

---

### 3. FlipAEO checks their existing website

This part is important.

Suppose 7 buyer questions are losses.

You **do not immediately create 7 new articles**.

The system checks the customer's sitemap/site first and may discover:

```text
Question A ─┐
Question B ─┼── existing /family-photo-maker page
Question C ─┘

Question D ───── no suitable page

Question E ───── Reddit / third-party opportunity
```

So the system groups them into actual work.

The customer then sees cards such as:

**REFRESH**
Improve `/family-photo-maker`
Reason: 3 measured questions map to this existing page.

**CREATE**
“Best way to restore badly damaged family photos”
Reason: no suitable existing page found.

**REPORT ONLY**
Competitor repeatedly appears in Reddit/community sources.

The actual UI already says:

> “We checked the sitemap first. Several measured questions may belong to one page, so each card consumes one action.”

And the customer can select **up to 8 actions**. Extras remain in backlog.

That is a much better product than “AI detected 17 gaps, congratulations, here are 17 more blog posts to pollute the internet.”

---

## 4. Customer explicitly chooses what FlipAEO should work on

This isn't hidden automation.

They get a **confirmation screen**.

For every proposed action they can see:

* create / refresh / report-only
* proposed title
* existing target URL when relevant
* why FlipAEO recommends it
* the actual buyer questions behind that recommendation

Then:

**Confirm 5 actions**

or 3, or 8.

They don't have to consume all eight.

And that's important commercially:

> **“Up to 8” does not mean you manufacture 8 pieces of work every month.**

If this month's measurement finds only 4 legitimate things worth fixing, they get 4.

---

# 5. Then production happens

Now the selected actions become the month's production batch.

There are two main types.

### CREATE

A genuine missing page/article.

Your existing research + evidence-grounded article pipeline generates and QAs the article.

### REFRESH

The customer **already has a page**, so FlipAEO must not create another competing article.

During the founding beta, this path is intentionally founder-assisted. Your founder dashboard shows the existing target page and asks you to prepare the appropriate replacement/patch. The supported refresh output is either a **full-page replacement** or **section patch**. It explicitly does not publish a second page.

This is one place where **you are still in the loop** right now.

---

# 6. Nothing is delivered halfway

This is one of the better architectural decisions in the repo.

Imagine this month the customer selected:

```text
1. Create Article A     ✅
2. Refresh Page B       ✅
3. Create Article C     ✅
4. Refresh Page D       ⏳
5. Create Article E     ✅
```

They do **not** get four items today and one random thing next Tuesday.

The cycle waits.

Once all five are ready, the entire cycle becomes **ready for founder review**.

Your private founder screen literally shows:

> **Batch release review**

You can open every create/refresh result and review it.

Then you press:

> **Approve complete batch**

Only then is the entire monthly batch released to the customer at once.

So during the founding beta, you have a quality-control kill switch between “AI produced something” and “customer received it.”

Good. AI remains surprisingly inventive at finding new ways to embarrass its operator.

---

# 7. What the customer finally receives

Their **Content Plan / Recurring Delivery Cycles** page shows each billing cycle separately.

For example:

**Aug 24 – Sep 24**

```text
5 / 8 selected actions
3 eligible actions retained in backlog

01 CREATE   Family photo restoration guide       Delivered
02 REFRESH  /family-photo-maker                   Delivered
03 CREATE   Restore scratched photos              Delivered
04 REFRESH  /old-photo-restoration                Delivered
05 CREATE   AI memorial family portrait guide     Delivered
```

For each delivered action, they can open:

> **Review and export draft**

And once the cycle is delivered they also get:

> **Download batch**

The batch export is the whole month's delivered work together.

Your current product spec also preserves the existing optional **WordPress draft** path for create actions. Refreshes stay attached to their existing URLs rather than creating duplicate posts.

---

# Then Month 2 happens

This is where the recurring value becomes much clearer.

You **do not regenerate another random 25 SEO keywords**.

The same buyer questions are measured again.

So FlipAEO can now see:

```text
Question A:
Month 1 → competitor recommended, customer absent
Month 2 → customer recommended

RESOLVED ✅
```

Or:

```text
Question B:
Month 1 → absent
→ we created/fixed page
Month 2 → still absent

MONITOR / reconsider later
```

Or:

```text
Question C:
Still losing
No work completed yet

BACKLOG / eligible this cycle
```

The system reconciles each month's result against the persistent opportunity rather than creating a fresh pile of disconnected “SEO ideas.” That persistent finding → action → remeasurement loop is the actual recurring product.

Then again:

**Measure → report → check site → grouped proposals → customer confirms up to 8 → produce → founder QA → deliver complete batch.**

And Month 3 repeats it.

---

## So what is the customer really buying?

I'd describe it internally like this:

| They pay for        | What they receive                                                             |
| ------------------- | ----------------------------------------------------------------------------- |
| **Monitoring**      | Up to 25 real buyer questions tracked across ChatGPT + Google AI Mode         |
| **Diagnosis**       | Exact situations where they're absent, competitors win, and sources get cited |
| **Prioritization**  | Site-aware create/refresh recommendations instead of generic “content gaps”   |
| **Production**      | Up to 8 confirmed fixes per billing cycle                                     |
| **Quality control** | Full batch reviewed before release during founding beta                       |
| **Delivery**        | Individual editable/exportable drafts + complete batch download               |
| **Continuity**      | Next month the same questions are measured again to see what changed          |

And one critical expectation to put into your own head:

### The subscription does **not** promise 8 articles.

It promises **up to 8 genuine actions**.

Some months might be:

**6 new articles + 2 refreshes**

Another:

**2 articles + 3 refreshes**

Another:

**3 valid actions total**

Potentially even a cycle with **no content actions** if the measurement produces only report-only findings. Your customer page explicitly handles that case.

That is the actual product you've built now. The recurring reason to pay is not *“please manufacture more content every 30 days.”* It is **“keep measuring where AI recommendations are sending my buyers, identify what I can realistically improve, and execute the highest-value fixes.”**
