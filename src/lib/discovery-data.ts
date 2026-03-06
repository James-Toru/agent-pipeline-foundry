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
        generate_prompt: "Build a pipeline that automatically qualifies inbound leads. When a new lead arrives in HubSpot, research their company online, score them against our ICP (company size 50-500 employees, B2B SaaS, Series A+), update the HubSpot contact with enrichment data and a lead score, create a follow-up task for high-priority leads, and notify the sales team on Slack.",
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
        generate_prompt: "Build a pipeline that monitors our HubSpot deal pipeline for stale deals. Scan all open deals, flag any with no activity in 7+ days, check if the contact has recent emails or meetings logged, send a Slack DM to the deal owner with context about what needs follow-up, and post a weekly pipeline health summary to our #sales channel.",
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
        generate_prompt: "Build a pipeline that generates personalized outbound emails for sales prospects. For each prospect from HubSpot, research their company and recent news online, write a personalized cold email that references specific company details, save it as a Gmail draft for the rep to review, and log the outreach attempt as a note on the HubSpot contact.",
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
        generate_prompt: "Build a pipeline that repurposes a blog post into multiple content pieces. Given a blog post URL, scrape the content, extract key themes and quotes, generate 5 social media posts for LinkedIn and Twitter, write a newsletter email snippet, save all generated content as a new page in our Notion content database, and post a summary to our #marketing Slack channel for team review.",
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
        generate_prompt: "Build a pipeline that monitors our competitors weekly. For each competitor (list: Competitor A, Competitor B, Competitor C), search the web for recent news, product updates, pricing changes, and new content. Analyze the findings for strategic moves and messaging shifts. Compile a competitive intelligence briefing, save it as a dated page in our Notion competitive intel database, and post a summary to #strategy on Slack.",
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
        generate_prompt: "Build a pipeline that generates a comprehensive marketing campaign brief. Given a product description and target market, research the audience demographics and trending topics, build 3 buyer personas, create a messaging framework with value propositions and positioning statements, recommend channels and budget allocation, and compile everything into a detailed campaign brief saved as a Notion page.",
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
        generate_prompt: "Build a pipeline that automates new client onboarding. When triggered with a client name, company, and email: create the company and contact in HubSpot with 'Onboarding' status, create a project page in Notion with sections for scope, timeline, and deliverables, find the next available 60-minute slot and create a kickoff meeting calendar invite, draft a welcome email with next steps, and notify our #projects Slack channel about the new client.",
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
        generate_prompt: "Build a pipeline that processes meeting notes into actionable outputs. Given a meeting transcript and attendee list: extract key discussion points and decisions, generate a concise summary, identify action items with owners and deadlines, create follow-up tasks in HubSpot for each action item, save the complete meeting notes to Notion, and send the summary with action items to all attendees via Slack.",
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
        generate_prompt: "Build a pipeline that generates a weekly status report every Friday. Pull deal pipeline metrics and new contacts from HubSpot, summarize this week's meetings and next week's schedule from Google Calendar, compile everything into a structured weekly report with highlights, metrics, and blockers, save it as a dated page in our Notion weekly reports database, and post the summary to #team-updates on Slack.",
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
        generate_prompt: "Build a pipeline that detects at-risk customers before they churn. For each active customer in HubSpot, check their last contact date, recent activity, and support ticket history. Calculate a health score (green/yellow/red). For any red-status customers, send a detailed alert to #customer-success on Slack with context on why they're at risk, generate a re-engagement plan, and create a follow-up task in HubSpot for the account owner.",
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
        generate_prompt: "Build a pipeline that tracks customer onboarding milestones. Read the onboarding checklist from our Notion database, check which milestones are completed, upcoming, or overdue. For upcoming milestones, send a reminder to the CS rep via Slack DM and the customer via email. For overdue milestones (3+ days late), escalate to the CS manager on Slack. Update the HubSpot contact with a progress note and post a weekly onboarding status summary to #customer-success.",
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
        generate_prompt: "Build a pipeline that screens job candidates automatically. Read candidate applications from a Google Sheet (columns: Name, Email, Resume URL, Years Experience, Skills). For each candidate, research their professional background online, score them against our requirements (5+ years experience, specific tech skills, B2B SaaS background), create a ranked shortlist page in Notion with scores and research notes, and send the top 5 candidates to the hiring manager on Slack.",
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
        generate_prompt: "Build a pipeline that automates new employee onboarding. Given the new hire's name, email, role, team, and start date: create a personal workspace page in Notion with links to the handbook, team resources, and 30-60-90 day plan template. Schedule orientation meetings with HR, their manager, and team leads using Google Calendar. Send a welcome email with first-day instructions. Post a welcome announcement with their photo and role in the team's Slack channel.",
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
        generate_prompt: "Build a pipeline that processes vendor invoices. Read invoice entries from a Google Sheet (columns: Vendor, Invoice Number, Amount, Line Items, Date). Match each invoice against purchase orders in a separate PO sheet. Flag any discrepancies in amounts or quantities. Send a Slack approval request with invoice details and any flags. Once approved, record the invoice in our Notion finance ledger with status and approval date.",
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
        generate_prompt: "Build a pipeline that conducts deep market research on a given topic. Search the web from multiple angles (market size, key players, trends, challenges, opportunities). Validate source credibility. Synthesize all findings into a structured analysis report with sections for executive summary, market overview, competitive landscape, trends, and recommendations. Save the report as a detailed page in our Notion research database.",
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
        generate_prompt: "Build a pipeline that creates a daily industry news digest. Search for the latest news on our key topics (AI, SaaS, enterprise software, automation). Filter for stories relevant to our business. Remove duplicates and rank by importance. Write concise summaries of the top 10 stories with key takeaways. Post the digest to #industry-news on Slack and archive it as a dated page in our Notion news database.",
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
        generate_prompt: "Build a pipeline that generates weekly project status reports. Read all project tasks and milestones from our Notion project database. Analyze completion rates and identify any tasks that are overdue or blocked. Flag at-risk deliverables and calculate overall project health (on track / at risk / behind). Generate a status report with progress metrics and risk flags. Post it to #project-updates on Slack and send a DM to project stakeholders with items needing their attention.",
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
        generate_prompt: "Build a pipeline that automatically routes support tickets. When a new ticket arrives (subject, description, customer email), classify it by category (billing, technical, feature request, bug report) and urgency (low, medium, high, critical). Search our Notion knowledge base for relevant articles. Draft an initial response using the knowledge base context. Route the ticket to the appropriate Slack channel (#support-billing, #support-technical, etc.) with the draft response. For critical tickets, create an escalation alert that requires manager approval.",
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
        generate_prompt: "Build a pipeline that keeps our knowledge base up to date. Analyze a batch of recently resolved support tickets (provided as input text). Identify common issues and solutions. Search our Notion knowledge base for existing articles on these topics. For any gaps or outdated articles, generate new KB articles with clear step-by-step solutions and troubleshooting guides. Publish them as new pages in the Notion knowledge base and notify #support on Slack about the new articles added.",
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
