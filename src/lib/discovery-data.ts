// ── Discovery Data ───────────────────────────────────────────────────────────
// Static data for the Workflow Discovery feature.
// Each department contains business problems with pre-built agent previews
// that can be sent directly to the Generate page.

export interface AgentPreview {
  role: string;
  description: string;
  tools: string[];
}

export interface BusinessProblem {
  id: string;
  pain_point: string;
  description: string;
  integrations: string[];
  agents_preview: AgentPreview[];
  estimated_minutes: number;
  tags: string[];
  trigger_type: "scheduled" | "manual_once" | "event";
  trigger_description: string;
  generate_prompt: string;
}

export interface Department {
  id: string;
  name: string;
  emoji: string;
  description: string;
  problems: BusinessProblem[];
}

export const DEPARTMENTS: Department[] = [
  {
    id: "sales",
    name: "Sales & Lead Generation",
    emoji: "\uD83D\uDCBC",
    description: "Close more deals with automated lead research, scoring, and outreach sequences.",
    problems: [
      {
        id: "lead-qualification",
        pain_point: "Manually qualifying inbound leads wastes hours every day",
        description: "Automatically qualify and score inbound leads by enriching them with company data, checking fit against your ICP, and routing hot leads to the right rep.",
        integrations: ["hubspot", "brave_search"],
        agents_preview: [
          { role: "Lead Ingestion Agent", description: "Pulls new inbound leads from HubSpot and normalizes contact data.", tools: ["hubspot_read_contacts"] },
          { role: "Company Research Agent", description: "Researches the lead's company using web search to gather size, industry, and funding info.", tools: ["web_search", "web_research"] },
          { role: "ICP Scoring Agent", description: "Scores each lead against your Ideal Customer Profile criteria and assigns a priority tier.", tools: [] },
          { role: "CRM Update Agent", description: "Writes the enriched data and score back to HubSpot and creates follow-up tasks for high-priority leads.", tools: ["hubspot_write_contact", "hubspot_create_task"] },
          { role: "Notification Agent", description: "Sends a Slack notification to the sales team when a hot lead is identified.", tools: ["slack_send_message"] },
        ],
        estimated_minutes: 3,
        tags: ["CRM", "Lead Scoring", "Automation"],
        trigger_type: "scheduled",
        trigger_description: "Runs every 30 minutes during business hours",
        generate_prompt: "Build a fully autonomous scheduled pipeline that qualifies inbound leads with zero manual input. Every 30 minutes during business hours the pipeline fetches all HubSpot contacts created in the last 30 minutes (using hubspot_read_contacts with a date filter). For each new lead it researches their company online via web_search, scores them against our ICP (company size 50-500 employees, B2B SaaS, Series A+), updates the HubSpot contact with enrichment data and a lead score, creates a follow-up task for high-priority leads, and notifies the sales team on Slack. The pipeline requires no runtime inputs — all data is fetched from HubSpot automatically.",
      },
      {
        id: "deal-pipeline-hygiene",
        pain_point: "Deals go stale in the pipeline without anyone noticing",
        description: "Monitor your deal pipeline for stale opportunities, missing next steps, and overdue follow-ups. Automatically nudge reps and update deal stages.",
        integrations: ["hubspot", "slack"],
        agents_preview: [
          { role: "Pipeline Scanner Agent", description: "Reads all open deals from HubSpot and identifies those with no activity in the last 7 days.", tools: ["hubspot_read_deals"] },
          { role: "Activity Checker Agent", description: "Cross-references deal contacts with recent email and meeting activity.", tools: ["hubspot_read_contacts"] },
          { role: "Nudge Agent", description: "Sends personalized reminders to deal owners via Slack with context on what needs attention.", tools: ["slack_send_dm"] },
          { role: "Report Agent", description: "Compiles a weekly pipeline health summary and posts it to the sales channel.", tools: ["slack_post_notification"] },
        ],
        estimated_minutes: 4,
        tags: ["CRM", "Pipeline Health", "Notifications"],
        trigger_type: "scheduled",
        trigger_description: "Runs daily at 8 AM and compiles a weekly summary on Fridays",
        generate_prompt: "Build a fully autonomous scheduled pipeline that monitors deal pipeline hygiene with zero manual input. Every morning at 8 AM the pipeline fetches all open deals from HubSpot (using hubspot_read_deals), identifies deals with no activity in 7+ days by comparing last-modified dates, cross-references each stale deal's contact for recent email or meeting activity (using hubspot_read_contacts), sends a Slack DM to each deal owner with context on what needs follow-up, and posts a weekly pipeline health summary to #sales every Friday. The pipeline requires no runtime inputs — all data is fetched from HubSpot automatically.",
      },
      {
        id: "outbound-sequence",
        pain_point: "Reps spend too long writing personalized outbound emails",
        description: "Research prospects, generate personalized outreach emails, and queue them as drafts for rep review before sending.",
        integrations: ["hubspot", "brave_search", "google_calendar"],
        agents_preview: [
          { role: "Prospect Research Agent", description: "Researches the prospect's company, recent news, and role using web search.", tools: ["web_search", "web_research"] },
          { role: "Copywriting Agent", description: "Writes a personalized cold email using the research findings and your brand voice guidelines.", tools: [] },
          { role: "Draft Agent", description: "Creates the email as a Gmail draft so the rep can review and send.", tools: ["gmail_draft"] },
          { role: "CRM Logger Agent", description: "Logs the outreach attempt in HubSpot with a note on the contact record.", tools: ["hubspot_create_note"] },
        ],
        estimated_minutes: 3,
        tags: ["Outbound", "Email", "Personalization"],
        trigger_type: "scheduled",
        trigger_description: "Runs daily at 7 AM to process new prospects",
        generate_prompt: "Build a fully autonomous scheduled pipeline that generates personalized outbound emails with zero manual input. Every morning at 7 AM the pipeline fetches all HubSpot contacts tagged 'outbound-queue' (using hubspot_read_contacts with a tag filter). For each prospect it researches their company and recent news online via web_search, writes a personalized cold email referencing specific company details, saves it as a Gmail draft for rep review, and logs the outreach attempt as a note on the HubSpot contact. The pipeline requires no runtime inputs — all prospect data is fetched from HubSpot automatically.",
      },
    ],
  },
  {
    id: "marketing",
    name: "Marketing & Content",
    emoji: "\uD83D\uDCE3",
    description: "Scale content production, monitor brand mentions, and automate campaign workflows.",
    problems: [
      {
        id: "content-repurposing",
        pain_point: "One blog post should become 10 pieces of content but never does",
        description: "Take a single long-form article and automatically generate social posts, email snippets, a summary thread, and a Notion content library entry.",
        integrations: ["notion", "slack"],
        agents_preview: [
          { role: "Content Ingestion Agent", description: "Reads the source article URL and extracts key themes, quotes, and statistics.", tools: ["web_scrape"] },
          { role: "Social Media Agent", description: "Generates 5 social media posts (LinkedIn, Twitter) from the article's key points.", tools: [] },
          { role: "Email Snippet Agent", description: "Creates a newsletter-ready summary paragraph with a compelling hook.", tools: [] },
          { role: "Notion Archiver Agent", description: "Creates a new entry in your Notion content database with all generated assets.", tools: ["notion_create_page"] },
          { role: "Distribution Agent", description: "Posts a summary to the marketing Slack channel with all generated content for review.", tools: ["slack_post_notification"] },
        ],
        estimated_minutes: 4,
        tags: ["Content", "Social Media", "Repurposing"],
        trigger_type: "event",
        trigger_description: "Triggered via webhook when a new blog post is published",
        generate_prompt: "Build a fully autonomous event-driven pipeline that repurposes blog posts with zero manual input. When triggered via webhook with a blog post URL, the pipeline scrapes the content using web_scrape, extracts key themes, quotes, and statistics, generates 5 social media posts for LinkedIn and Twitter, writes a newsletter email snippet, saves all generated content as a new page in our Notion content database, and posts a summary to #marketing on Slack for team review. The pipeline requires only the blog URL from the webhook payload — all content generation is autonomous.",
      },
      {
        id: "competitor-monitoring",
        pain_point: "We only find out about competitor moves weeks after they happen",
        description: "Monitor competitor websites and news for product launches, pricing changes, and messaging shifts. Get a weekly briefing delivered to Slack and Notion.",
        integrations: ["brave_search", "notion", "slack"],
        agents_preview: [
          { role: "Web Monitor Agent", description: "Searches for recent news, blog posts, and press releases for each competitor.", tools: ["web_search", "web_research"] },
          { role: "Analysis Agent", description: "Analyzes findings for product changes, pricing updates, messaging shifts, and strategic moves.", tools: [] },
          { role: "Report Agent", description: "Compiles a structured competitive intelligence briefing with action items.", tools: [] },
          { role: "Notion Agent", description: "Saves the report as a dated page in the Notion competitive intelligence database.", tools: ["notion_create_page"] },
          { role: "Slack Agent", description: "Posts a summary with key highlights to the strategy channel.", tools: ["slack_post_notification"] },
        ],
        estimated_minutes: 5,
        tags: ["Competitive Intel", "Research", "Monitoring"],
        trigger_type: "scheduled",
        trigger_description: "Runs every Monday at 9 AM",
        generate_prompt: "Build a fully autonomous scheduled pipeline that monitors competitors weekly with zero manual input. Every Monday at 9 AM the pipeline searches the web for recent news, product updates, pricing changes, and new content for each competitor in a hardcoded list (Competitor A, Competitor B, Competitor C — stored in the first agent's system prompt). It analyzes findings for strategic moves and messaging shifts, compiles a competitive intelligence briefing, saves it as a dated page in our Notion competitive intel database, and posts a summary to #strategy on Slack. The pipeline requires no runtime inputs — the competitor list is embedded in the agent configuration.",
      },
      {
        id: "campaign-brief",
        pain_point: "Creating campaign briefs takes a full day of research and writing",
        description: "Generate comprehensive campaign briefs from a simple product description, including audience research, messaging frameworks, and channel recommendations.",
        integrations: ["brave_search", "notion"],
        agents_preview: [
          { role: "Market Research Agent", description: "Researches the target market, audience demographics, and trending topics.", tools: ["web_search", "web_research"] },
          { role: "Audience Persona Agent", description: "Builds detailed buyer personas based on research findings.", tools: [] },
          { role: "Messaging Agent", description: "Creates a messaging framework with value props, positioning statements, and tone guidelines.", tools: [] },
          { role: "Brief Compiler Agent", description: "Assembles the full campaign brief and saves it to Notion.", tools: ["notion_create_page", "notion_append_content"] },
        ],
        estimated_minutes: 5,
        tags: ["Campaign Planning", "Research", "Strategy"],
        trigger_type: "manual_once",
        trigger_description: "Triggered manually with a product description",
        generate_prompt: "Build an autonomous pipeline that generates a comprehensive marketing campaign brief. The user provides a product description and target market at trigger time. The pipeline autonomously researches audience demographics and trending topics via web_search, builds 3 buyer personas, creates a messaging framework with value propositions and positioning statements, recommends channels and budget allocation, and compiles everything into a detailed campaign brief saved as a Notion page. After the initial trigger input, all research and generation is fully autonomous.",
      },
    ],
  },
  {
    id: "operations",
    name: "Operations & Workflow",
    emoji: "\u2699\uFE0F",
    description: "Streamline internal operations, automate repetitive processes, and reduce manual handoffs.",
    problems: [
      {
        id: "client-onboarding",
        pain_point: "New client onboarding involves 15 manual steps across 4 tools",
        description: "Automate the new client onboarding workflow: create records in the CRM, set up project spaces in Notion, schedule a kickoff meeting, and send a welcome sequence.",
        integrations: ["hubspot", "notion", "google_calendar", "slack"],
        agents_preview: [
          { role: "CRM Setup Agent", description: "Creates or updates the client company and contacts in HubSpot with onboarding status.", tools: ["hubspot_write_company", "hubspot_write_contact"] },
          { role: "Project Space Agent", description: "Creates a structured project page in Notion with sections for scope, timeline, and deliverables.", tools: ["notion_create_page", "notion_append_content"] },
          { role: "Scheduling Agent", description: "Finds an available time slot and creates a kickoff meeting invite.", tools: ["google_calendar_find_slot", "google_calendar_write"] },
          { role: "Welcome Email Agent", description: "Drafts a personalized welcome email with next steps and meeting details.", tools: ["gmail_draft"] },
          { role: "Team Notification Agent", description: "Notifies the project team on Slack about the new client and links to the Notion workspace.", tools: ["slack_send_message"] },
        ],
        estimated_minutes: 5,
        tags: ["Onboarding", "Multi-tool", "Automation"],
        trigger_type: "event",
        trigger_description: "Triggered when a HubSpot deal moves to 'Closed Won'",
        generate_prompt: "Build a fully autonomous event-driven pipeline that onboards new clients with zero manual input. When a HubSpot deal moves to 'Closed Won' (webhook trigger), the pipeline fetches the deal and associated contact/company data from HubSpot (using hubspot_read_deals and hubspot_read_contacts), updates the contact status to 'Onboarding', creates a project page in Notion with sections for scope, timeline, and deliverables, finds the next available 60-minute slot and creates a kickoff meeting calendar invite, drafts a welcome email with next steps, and notifies #projects on Slack. The pipeline requires no runtime inputs — all client data is fetched from HubSpot using the deal ID from the webhook payload.",
      },
      {
        id: "meeting-notes",
        pain_point: "Meeting notes sit in docs and never become action items",
        description: "Process meeting transcripts into structured summaries, extract action items, create follow-up tasks, and distribute to all attendees.",
        integrations: ["hubspot", "notion", "slack"],
        agents_preview: [
          { role: "Transcript Processor Agent", description: "Parses the raw meeting transcript and identifies key discussion points.", tools: [] },
          { role: "Summary Agent", description: "Generates a concise meeting summary with decisions made and open questions.", tools: [] },
          { role: "Action Item Agent", description: "Extracts action items with owners and deadlines, creates tasks in HubSpot.", tools: ["hubspot_create_task"] },
          { role: "Documentation Agent", description: "Saves the full meeting notes and summary to Notion.", tools: ["notion_create_page"] },
          { role: "Distribution Agent", description: "Sends the summary and action items to all attendees via Slack.", tools: ["slack_send_message"] },
        ],
        estimated_minutes: 3,
        tags: ["Meetings", "Task Management", "Documentation"],
        trigger_type: "event",
        trigger_description: "Triggered via webhook when a meeting recording is processed",
        generate_prompt: "Build a fully autonomous event-driven pipeline that processes meeting notes with zero manual input. When triggered via webhook with a meeting transcript (e.g. from a transcription service), the pipeline extracts key discussion points and decisions, reads the attendee list from the calendar event using google_calendar_read, generates a concise summary, identifies action items with owners and deadlines, creates follow-up tasks in HubSpot for each action item, saves the complete meeting notes to Notion, and sends the summary with action items to all attendees via Slack. The pipeline requires only the transcript from the webhook payload — attendee data is fetched from Google Calendar automatically.",
      },
      {
        id: "weekly-report",
        pain_point: "Pulling together the weekly status report takes 2 hours every Friday",
        description: "Automatically compile data from multiple sources into a formatted weekly status report and distribute it to stakeholders.",
        integrations: ["hubspot", "notion", "slack", "google_calendar"],
        agents_preview: [
          { role: "CRM Data Agent", description: "Pulls deal pipeline metrics, new contacts, and closed deals from HubSpot.", tools: ["hubspot_read_deals", "hubspot_read_contacts"] },
          { role: "Calendar Review Agent", description: "Summarizes meetings held this week and upcoming meetings for next week.", tools: ["google_calendar_read"] },
          { role: "Report Compiler Agent", description: "Combines all data into a structured weekly report with highlights and blockers.", tools: [] },
          { role: "Notion Publisher Agent", description: "Saves the report as a dated page in the Notion weekly reports database.", tools: ["notion_create_page"] },
          { role: "Distribution Agent", description: "Posts the report summary to Slack and highlights any items needing attention.", tools: ["slack_post_notification"] },
        ],
        estimated_minutes: 4,
        tags: ["Reporting", "Data Aggregation", "Scheduling"],
        trigger_type: "scheduled",
        trigger_description: "Runs every Friday at 4 PM",
        generate_prompt: "Build a fully autonomous scheduled pipeline that generates a weekly status report with zero manual input. Every Friday at 4 PM the pipeline fetches deal pipeline metrics and new contacts from HubSpot (using hubspot_read_deals and hubspot_read_contacts), reads this week's meetings and next week's schedule from Google Calendar (using google_calendar_read), compiles everything into a structured weekly report with highlights, metrics, and blockers, saves it as a dated page in our Notion weekly reports database, and posts the summary to #team-updates on Slack. The pipeline requires no runtime inputs — all data is fetched from HubSpot and Google Calendar automatically.",
      },
    ],
  },
  {
    id: "customer-success",
    name: "Customer Success",
    emoji: "\uD83E\uDD1D",
    description: "Proactively retain customers with health scoring, churn detection, and automated check-ins.",
    problems: [
      {
        id: "churn-detection",
        pain_point: "We only find out a customer is unhappy when they cancel",
        description: "Monitor customer engagement signals, score health, and alert the CS team before at-risk accounts churn.",
        integrations: ["hubspot", "slack"],
        agents_preview: [
          { role: "Engagement Scanner Agent", description: "Reads recent activity, support tickets, and last contact date for each customer.", tools: ["hubspot_read_contacts", "hubspot_read_companies"] },
          { role: "Health Scoring Agent", description: "Calculates a customer health score based on engagement frequency, sentiment, and usage patterns.", tools: [] },
          { role: "Risk Alert Agent", description: "Identifies at-risk accounts and sends detailed alerts to the CS team on Slack.", tools: ["slack_send_message"] },
          { role: "Action Plan Agent", description: "Generates a recommended re-engagement plan and creates tasks in HubSpot.", tools: ["hubspot_create_task", "hubspot_create_note"] },
        ],
        estimated_minutes: 4,
        tags: ["Retention", "Health Scoring", "Alerts"],
        trigger_type: "scheduled",
        trigger_description: "Runs daily at 9 AM",
        generate_prompt: "Build a fully autonomous scheduled pipeline that detects at-risk customers with zero manual input. Every morning at 9 AM the pipeline fetches all active customers from HubSpot (using hubspot_read_contacts and hubspot_read_companies), checks each customer's last contact date, recent activity, and support ticket history. It calculates a health score (green/yellow/red) for each customer. For any red-status customers it sends a detailed alert to #customer-success on Slack with context on why they're at risk, generates a re-engagement plan, and creates a follow-up task in HubSpot for the account owner. The pipeline requires no runtime inputs — all customer data is fetched from HubSpot automatically.",
      },
      {
        id: "onboarding-checklist",
        pain_point: "Customer onboarding milestones get missed without a system",
        description: "Track onboarding progress for new customers, send milestone reminders, and escalate if milestones are overdue.",
        integrations: ["hubspot", "notion", "slack", "google_calendar"],
        agents_preview: [
          { role: "Milestone Tracker Agent", description: "Checks the onboarding Notion database for milestone completion status.", tools: ["notion_read_pages"] },
          { role: "Reminder Agent", description: "Sends upcoming milestone reminders to the CS rep and the customer.", tools: ["gmail_send", "slack_send_dm"] },
          { role: "Escalation Agent", description: "Identifies overdue milestones and escalates to the CS manager.", tools: ["slack_send_message"] },
          { role: "Progress Report Agent", description: "Updates the customer record in HubSpot and posts a weekly progress summary.", tools: ["hubspot_create_note", "slack_post_notification"] },
        ],
        estimated_minutes: 4,
        tags: ["Onboarding", "Milestones", "Escalation"],
        trigger_type: "scheduled",
        trigger_description: "Runs daily at 8 AM",
        generate_prompt: "Build a fully autonomous scheduled pipeline that tracks customer onboarding milestones with zero manual input. Every morning at 8 AM the pipeline reads the onboarding checklist from our Notion database (using notion_read_pages), checks which milestones are completed, upcoming, or overdue by comparing due dates. For upcoming milestones it sends a reminder to the CS rep via Slack DM and the customer via email. For overdue milestones (3+ days late) it escalates to the CS manager on Slack. It updates the HubSpot contact with a progress note and posts a weekly onboarding status summary to #customer-success. The pipeline requires no runtime inputs — all milestone data is fetched from Notion automatically.",
      },
    ],
  },
  {
    id: "hr",
    name: "HR & People Ops",
    emoji: "\uD83D\uDC65",
    description: "Automate hiring workflows, employee onboarding, and internal communications.",
    problems: [
      {
        id: "candidate-screening",
        pain_point: "Screening 50 applications per role takes the entire week",
        description: "Automatically screen candidate applications against role requirements, research their background, and create a ranked shortlist.",
        integrations: ["brave_search", "notion", "slack"],
        agents_preview: [
          { role: "Application Parser Agent", description: "Reads candidate data from a Google Sheet and extracts key qualifications.", tools: ["sheets_read_rows"] },
          { role: "Background Research Agent", description: "Searches the web for each candidate's professional profile and publications.", tools: ["web_search"] },
          { role: "Scoring Agent", description: "Scores candidates against role requirements and ranks them by fit.", tools: [] },
          { role: "Shortlist Agent", description: "Creates a ranked shortlist page in Notion with scores and research summaries.", tools: ["notion_create_page", "notion_append_content"] },
          { role: "Notification Agent", description: "Alerts the hiring manager on Slack with the top 5 candidates.", tools: ["slack_send_message"] },
        ],
        estimated_minutes: 5,
        tags: ["Hiring", "Screening", "Research"],
        trigger_type: "scheduled",
        trigger_description: "Runs daily at 6 AM to process new applications",
        generate_prompt: "Build a fully autonomous scheduled pipeline that screens job candidates with zero manual input. Every morning at 6 AM the pipeline reads new candidate applications from a Google Sheet (columns: Name, Email, Resume URL, Years Experience, Skills) using sheets_read_rows. For each new candidate it researches their professional background online via web_search, scores them against requirements (5+ years experience, specific tech skills, B2B SaaS background), creates a ranked shortlist page in Notion with scores and research notes, and sends the top 5 candidates to the hiring manager on Slack. The pipeline requires no runtime inputs — all candidate data is fetched from Google Sheets automatically.",
      },
      {
        id: "employee-onboarding",
        pain_point: "New hire onboarding involves 20 manual setup steps",
        description: "Automate the new employee onboarding checklist: create accounts, set up workspace, schedule orientation meetings, and send welcome materials.",
        integrations: ["notion", "google_calendar", "slack"],
        agents_preview: [
          { role: "Workspace Setup Agent", description: "Creates the employee's Notion workspace with team resources and handbook links.", tools: ["notion_create_page", "notion_append_content"] },
          { role: "Orientation Scheduler Agent", description: "Schedules orientation meetings with HR, manager, and team leads.", tools: ["google_calendar_find_slot", "google_calendar_write"] },
          { role: "Welcome Agent", description: "Sends a welcome email with first-day instructions and login details.", tools: ["gmail_send"] },
          { role: "Team Announcement Agent", description: "Posts a welcome announcement in the team's Slack channel.", tools: ["slack_post_notification"] },
        ],
        estimated_minutes: 4,
        tags: ["Onboarding", "HR", "Setup"],
        trigger_type: "event",
        trigger_description: "Triggered when a new hire record is added to the HR spreadsheet",
        generate_prompt: "Build a fully autonomous event-driven pipeline that onboards new employees with zero manual input. When triggered via webhook (e.g. from an HR system or form submission), the pipeline reads the new hire's details (name, email, role, team, start date) from the HR Google Sheet using sheets_read_rows. It creates a personal workspace page in Notion with links to the handbook, team resources, and 30-60-90 day plan template. It schedules orientation meetings with HR, their manager, and team leads using Google Calendar. It sends a welcome email with first-day instructions and posts a welcome announcement in the team's Slack channel. The pipeline requires no manual input — all hire data is fetched from the Google Sheet automatically.",
      },
    ],
  },
  {
    id: "finance",
    name: "Finance & Invoicing",
    emoji: "\uD83D\uDCB0",
    description: "Automate invoice processing, expense tracking, and financial reporting workflows.",
    problems: [
      {
        id: "invoice-processing",
        pain_point: "Processing vendor invoices requires triple-checking across spreadsheets",
        description: "Automatically validate incoming invoices against purchase orders, flag discrepancies, and route for approval.",
        integrations: ["google_calendar", "slack", "notion"],
        agents_preview: [
          { role: "Invoice Reader Agent", description: "Reads invoice data from the Google Sheet and extracts key fields.", tools: ["sheets_read_rows"] },
          { role: "PO Matching Agent", description: "Cross-references invoice line items against purchase orders in the PO sheet.", tools: ["sheets_search"] },
          { role: "Validation Agent", description: "Flags discrepancies in amounts, quantities, or vendor details.", tools: [] },
          { role: "Approval Router Agent", description: "Sends validated invoices for approval via Slack with discrepancy details.", tools: ["slack_request_approval"] },
          { role: "Ledger Agent", description: "Records approved invoices in the Notion finance ledger.", tools: ["notion_create_page"] },
        ],
        estimated_minutes: 4,
        tags: ["Invoicing", "Validation", "Approvals"],
        trigger_type: "scheduled",
        trigger_description: "Runs every 2 hours during business hours",
        generate_prompt: "Build a fully autonomous scheduled pipeline that processes vendor invoices with zero manual input. Every 2 hours during business hours the pipeline reads new invoice entries from a Google Sheet (columns: Vendor, Invoice Number, Amount, Line Items, Date, Status) using sheets_read_rows, filtering for rows with Status='New'. It matches each invoice against purchase orders in a separate PO sheet using sheets_search. It flags any discrepancies in amounts or quantities. It sends a Slack approval request with invoice details and any flags. Once approved, it records the invoice in our Notion finance ledger and updates the sheet row status to 'Processed'. The pipeline requires no runtime inputs — all invoice data is fetched from Google Sheets automatically.",
      },
    ],
  },
  {
    id: "research",
    name: "Research & Analysis",
    emoji: "\uD83D\uDD2C",
    description: "Automate market research, data synthesis, and insight generation.",
    problems: [
      {
        id: "market-research",
        pain_point: "Market research reports take weeks to compile manually",
        description: "Automatically research a market topic, synthesize findings from multiple sources, and produce a structured analysis report.",
        integrations: ["brave_search", "notion"],
        agents_preview: [
          { role: "Search Agent", description: "Conducts targeted web searches across multiple angles of the research topic.", tools: ["web_search", "web_research"] },
          { role: "Source Validator Agent", description: "Evaluates source credibility and filters out low-quality content.", tools: [] },
          { role: "Synthesis Agent", description: "Combines findings into a coherent narrative with key insights and data points.", tools: [] },
          { role: "Report Agent", description: "Formats the analysis as a structured report and publishes to Notion.", tools: ["notion_create_page", "notion_append_content"] },
        ],
        estimated_minutes: 5,
        tags: ["Research", "Analysis", "Reports"],
        trigger_type: "manual_once",
        trigger_description: "Triggered manually with a research topic",
        generate_prompt: "Build an autonomous pipeline that conducts deep market research. The user provides a research topic at trigger time. The pipeline autonomously searches the web from multiple angles (market size, key players, trends, challenges, opportunities) using web_search and web_research, validates source credibility, synthesizes all findings into a structured analysis report with sections for executive summary, market overview, competitive landscape, trends, and recommendations, and saves the report as a detailed page in our Notion research database. After the initial topic input, all research and synthesis is fully autonomous.",
      },
      {
        id: "news-digest",
        pain_point: "Keeping up with industry news across 20 sources is impossible",
        description: "Aggregate news from multiple sources, filter for relevance, summarize key stories, and deliver a daily digest.",
        integrations: ["brave_search", "slack", "notion"],
        agents_preview: [
          { role: "News Aggregation Agent", description: "Searches multiple sources for the latest news on specified industry topics.", tools: ["web_search"] },
          { role: "Relevance Filter Agent", description: "Filters stories by relevance to your business and removes duplicates.", tools: [] },
          { role: "Summary Agent", description: "Writes concise summaries of the top stories with key takeaways.", tools: [] },
          { role: "Delivery Agent", description: "Posts the daily digest to Slack and archives it in Notion.", tools: ["slack_post_notification", "notion_create_page"] },
        ],
        estimated_minutes: 3,
        tags: ["News", "Monitoring", "Daily Digest"],
        trigger_type: "scheduled",
        trigger_description: "Runs daily at 7 AM",
        generate_prompt: "Build a fully autonomous scheduled pipeline that creates a daily industry news digest with zero manual input. Every morning at 7 AM the pipeline searches for the latest news on hardcoded key topics (AI, SaaS, enterprise software, automation — stored in the first agent's system prompt) using web_search. It filters for stories relevant to our business, removes duplicates, ranks by importance, and writes concise summaries of the top 10 stories with key takeaways. It posts the digest to #industry-news on Slack and archives it as a dated page in our Notion news database. The pipeline requires no runtime inputs — the topic list is embedded in the agent configuration.",
      },
    ],
  },
  {
    id: "project-management",
    name: "Project Management",
    emoji: "\uD83D\uDCCB",
    description: "Keep projects on track with automated status updates, risk detection, and stakeholder reporting.",
    problems: [
      {
        id: "project-status",
        pain_point: "Chasing project updates from 5 teams every week is exhausting",
        description: "Automatically gather project status from Notion boards, identify blockers and risks, and distribute a consolidated update to stakeholders.",
        integrations: ["notion", "slack"],
        agents_preview: [
          { role: "Status Collector Agent", description: "Reads project tasks and milestones from Notion databases.", tools: ["notion_read_pages"] },
          { role: "Risk Detection Agent", description: "Analyzes task statuses and timelines to identify blockers and at-risk deliverables.", tools: [] },
          { role: "Report Generator Agent", description: "Compiles a project status report with progress percentages and risk flags.", tools: [] },
          { role: "Distribution Agent", description: "Posts the report to the project Slack channel and notifies stakeholders.", tools: ["slack_post_notification", "slack_send_dm"] },
        ],
        estimated_minutes: 3,
        tags: ["Status Tracking", "Risk Detection", "Reporting"],
        trigger_type: "scheduled",
        trigger_description: "Runs every Friday at 3 PM",
        generate_prompt: "Build a fully autonomous scheduled pipeline that generates weekly project status reports with zero manual input. Every Friday at 3 PM the pipeline reads all project tasks and milestones from our Notion project database (using notion_read_pages). It analyzes completion rates, identifies overdue or blocked tasks, flags at-risk deliverables, and calculates overall project health (on track / at risk / behind). It generates a status report with progress metrics and risk flags, posts it to #project-updates on Slack, and sends a DM to project stakeholders with items needing their attention. The pipeline requires no runtime inputs — all project data is fetched from Notion automatically.",
      },
    ],
  },
  {
    id: "support",
    name: "Customer Support",
    emoji: "\uD83C\uDFE5",
    description: "Improve response times and quality with automated ticket routing, knowledge base updates, and escalation workflows.",
    problems: [
      {
        id: "ticket-routing",
        pain_point: "Support tickets sit in a queue without being routed to the right specialist",
        description: "Automatically classify incoming support tickets by topic and urgency, route them to the right team, and prepare initial response drafts.",
        integrations: ["slack", "notion"],
        agents_preview: [
          { role: "Ticket Classifier Agent", description: "Reads the ticket content and classifies it by category, product area, and urgency.", tools: [] },
          { role: "Knowledge Search Agent", description: "Searches the Notion knowledge base for relevant articles and past solutions.", tools: ["notion_search", "notion_read_pages"] },
          { role: "Response Drafter Agent", description: "Generates a draft response using knowledge base articles and the ticket context.", tools: [] },
          { role: "Routing Agent", description: "Routes the ticket to the appropriate specialist channel on Slack with the draft response.", tools: ["slack_send_message"] },
          { role: "Escalation Agent", description: "For urgent or complex tickets, creates an escalation alert with full context.", tools: ["slack_request_approval"] },
        ],
        estimated_minutes: 3,
        tags: ["Support", "Routing", "Knowledge Base"],
        trigger_type: "event",
        trigger_description: "Triggered via webhook when a new support ticket is created",
        generate_prompt: "Build a fully autonomous event-driven pipeline that routes support tickets with zero manual input. When triggered via webhook with a new support ticket (subject, description, customer email from the ticketing system), the pipeline classifies it by category (billing, technical, feature request, bug report) and urgency (low, medium, high, critical). It searches our Notion knowledge base for relevant articles using notion_search. It drafts an initial response using the knowledge base context. It routes the ticket to the appropriate Slack channel (#support-billing, #support-technical, etc.) with the draft response. For critical tickets it creates an escalation alert requiring manager approval. The pipeline requires only the ticket payload from the webhook — all knowledge base data is fetched from Notion automatically.",
      },
      {
        id: "kb-update",
        pain_point: "The knowledge base is always outdated because nobody has time to update it",
        description: "Analyze resolved support tickets to identify missing or outdated knowledge base articles, then generate and publish updates.",
        integrations: ["notion", "slack"],
        agents_preview: [
          { role: "Ticket Analyzer Agent", description: "Reviews recently resolved tickets to identify common issues and solutions.", tools: [] },
          { role: "Gap Detection Agent", description: "Compares ticket topics against existing Notion KB articles to find gaps.", tools: ["notion_search", "notion_read_pages"] },
          { role: "Article Generator Agent", description: "Writes new KB articles or updates for identified gaps.", tools: [] },
          { role: "Publisher Agent", description: "Publishes new articles to the Notion knowledge base and notifies the team.", tools: ["notion_create_page", "slack_post_notification"] },
        ],
        estimated_minutes: 5,
        tags: ["Knowledge Base", "Documentation", "Automation"],
        trigger_type: "scheduled",
        trigger_description: "Runs weekly on Sundays at 10 AM",
        generate_prompt: "Build a fully autonomous scheduled pipeline that keeps our knowledge base up to date with zero manual input. Every Sunday at 10 AM the pipeline reads recently resolved support tickets from the past week in our Notion support database (using notion_read_pages with a date filter and status='Resolved'). It identifies common issues and solutions, searches the existing Notion knowledge base for articles on these topics using notion_search. For any gaps or outdated articles it generates new KB articles with clear step-by-step solutions and troubleshooting guides. It publishes them as new pages in the Notion knowledge base and notifies #support on Slack about the new articles added. The pipeline requires no runtime inputs — all ticket data is fetched from Notion automatically.",
      },
    ],
  },
];

// Map integration IDs to display names
export const INTEGRATION_NAMES: Record<string, string> = {
  hubspot: "HubSpot",
  brave_search: "Brave Search",
  google_calendar: "Google",
  gmail: "Gmail",
  slack: "Slack",
  notion: "Notion",
};
