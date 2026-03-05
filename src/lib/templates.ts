import type { PipelineSpec } from "@/types/pipeline";
import { v4 as uuidv4 } from "uuid";

export interface PipelineTemplate {
  name: string;
  description: string;
  category: string;
  icon: string;
  spec: PipelineSpec;
}

function makeSpec(
  partial: Omit<PipelineSpec, "pipeline_id" | "version" | "created_at">
): PipelineSpec {
  return {
    pipeline_id: uuidv4(),
    version: 1,
    created_at: new Date().toISOString(),
    ...partial,
  };
}

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  // ── 1. Customer Onboarding ──────────────────────────────────────────────
  {
    name: "Customer Onboarding Email Sequence",
    description:
      "Automatically sends a welcome email, schedules an onboarding call, and follows up after 3 days.",
    category: "Sales",
    icon: "O",
    spec: makeSpec({
      name: "Customer Onboarding Email Sequence",
      description:
        "Automatically sends a welcome email, schedules an onboarding call, and follows up after 3 days.",
      triggers: ["manual", "webhook"],
      schedule: null,
      input_schema: {
        customer_name: {
          type: "string",
          required: true,
          description: "Full name of the new customer",
        },
        customer_email: {
          type: "string",
          required: true,
          description: "Customer email address",
        },
        product_name: {
          type: "string",
          required: true,
          description: "Name of the purchased product or plan",
        },
      },
      agents: [
        {
          agent_id: "welcome_email_drafter",
          archetype: "Copywriter",
          role: "Welcome Email Drafter",
          system_prompt:
            "You are a professional email copywriter for a SaaS company. Your task is to draft a warm, personalized welcome email for a new customer. Include a brief introduction to the product, next steps, and a friendly tone. The email should be concise (under 200 words) and include a clear call-to-action to book an onboarding call. Output the email as JSON with fields: subject, body_html, body_text.",
          tools: ["gmail_draft"],
          inputs: {
            customer_name: "Name of the new customer",
            customer_email: "Customer email address",
            product_name: "Name of the purchased product",
          },
          outputs: {
            subject: "Email subject line",
            body_html: "HTML formatted email body",
            body_text: "Plain text email body",
          },
          requires_approval: true,
          approval_message:
            "Review the welcome email draft before it is sent to the customer.",
          on_failure: "retry_3x_then_notify",
          guardrails: {
            max_tokens: 2000,
            max_runtime_seconds: 30,
            temperature: 0.5,
          },
        },
        {
          agent_id: "email_sender",
          archetype: "Outreach",
          role: "Email Sender",
          system_prompt:
            "You are an email delivery agent. Your task is to send the drafted welcome email to the customer using Gmail. Use the provided email content (subject, body) and recipient address. Confirm successful delivery in your output. Output JSON with fields: sent, message_id.",
          tools: ["gmail_send"],
          inputs: {
            customer_email: "Recipient email address",
            subject: "Email subject from drafter",
            body_html: "Email body from drafter",
          },
          outputs: {
            sent: "Whether the email was sent successfully",
            message_id: "Gmail message ID",
          },
          requires_approval: false,
          approval_message: null,
          on_failure: "retry_3x_then_notify",
          guardrails: {
            max_tokens: 1000,
            max_runtime_seconds: 30,
            temperature: 0.1,
          },
        },
        {
          agent_id: "onboarding_scheduler",
          archetype: "Scheduler",
          role: "Onboarding Call Scheduler",
          system_prompt:
            "You are a scheduling assistant. Your task is to find an available 30-minute slot in the next 5 business days on the company Google Calendar and create an onboarding meeting invitation. Include the customer name in the event title. Output JSON with fields: event_id, scheduled_time, calendar_link.",
          tools: ["google_calendar_find_slot", "google_calendar_write"],
          inputs: {
            customer_name: "Customer name for the meeting title",
            customer_email: "Customer email to invite",
          },
          outputs: {
            event_id: "Google Calendar event ID",
            scheduled_time: "Scheduled date and time",
            calendar_link: "Link to the calendar event",
          },
          requires_approval: false,
          approval_message: null,
          on_failure: "skip_and_continue",
          guardrails: {
            max_tokens: 1500,
            max_runtime_seconds: 45,
            temperature: 0.1,
          },
        },
        {
          agent_id: "followup_trigger",
          archetype: "Notification",
          role: "3-Day Follow-up Trigger",
          system_prompt:
            "You are a pipeline scheduling agent. Your task is to set up a follow-up trigger that will fire in 3 days to check in with the customer. Create a scheduled trigger with the customer details as payload. Output JSON with fields: scheduled, trigger_time.",
          tools: ["schedule_trigger"],
          inputs: {
            customer_name: "Customer name",
            customer_email: "Customer email",
          },
          outputs: {
            scheduled: "Whether the trigger was set",
            trigger_time: "When the follow-up will fire",
          },
          requires_approval: false,
          approval_message: null,
          on_failure: "skip_and_continue",
          guardrails: {
            max_tokens: 1000,
            max_runtime_seconds: 15,
            temperature: 0.1,
          },
        },
      ],
      orchestration: {
        flow: [
          { from: "START", to: "welcome_email_drafter", condition: null },
          {
            from: "welcome_email_drafter",
            to: "email_sender",
            condition: null,
          },
          {
            from: "welcome_email_drafter",
            to: "onboarding_scheduler",
            condition: null,
          },
          { from: "email_sender", to: "followup_trigger", condition: null },
          { from: "onboarding_scheduler", to: "followup_trigger", condition: null },
          { from: "followup_trigger", to: "END", condition: null },
        ],
        parallel_groups: [["email_sender", "onboarding_scheduler"]],
      },
      error_handling: {
        global_fallback: "notify_human",
        retry_policy: "exponential",
        max_retries: 3,
        alert_on_failure: true,
      },
      meta: {
        gaps_filled: [
          "Added approval gate before sending welcome email",
          "Added 3-day follow-up trigger for customer engagement",
        ],
        assumptions: [
          "Gmail and Google Calendar are configured with valid OAuth credentials",
          "Onboarding calls are 30 minutes on the company default calendar",
        ],
        recommended_enhancements: [
          "Add CRM integration to update customer status",
          "Add A/B testing for email subject lines",
        ],
      },
    }),
  },

  // ── 2. Lead Research & Enrichment ───────────────────────────────────────
  {
    name: "Lead Research & Enrichment",
    description:
      "Takes a company name, researches it online, enriches with key data, and produces a summary report.",
    category: "Research",
    icon: "R",
    spec: makeSpec({
      name: "Lead Research & Enrichment",
      description:
        "Takes a company name, researches it online, enriches with key data, and produces a summary report.",
      triggers: ["manual"],
      schedule: null,
      input_schema: {
        company_name: {
          type: "string",
          required: true,
          description: "Name of the company to research",
        },
        focus_areas: {
          type: "string",
          required: false,
          description:
            "Comma-separated areas to focus on (e.g. funding, team size, tech stack)",
        },
      },
      agents: [
        {
          agent_id: "web_researcher",
          archetype: "Research",
          role: "Web Researcher",
          system_prompt:
            "You are a thorough business research analyst. Given a company name and optional focus areas, perform web searches to gather comprehensive information about the company. Look for: company overview, recent news, funding history, key people, product offerings, and competitive landscape. Output JSON with fields: company_overview, recent_news, funding, key_people, products, competitors.",
          tools: ["web_search", "web_scrape"],
          inputs: {
            company_name: "Company to research",
            focus_areas: "Optional focus areas",
          },
          outputs: {
            company_overview: "Brief company description",
            recent_news: "Recent news and developments",
            funding: "Funding history and investors",
            key_people: "Key executives and founders",
            products: "Main products and services",
            competitors: "Key competitors",
          },
          requires_approval: false,
          approval_message: null,
          on_failure: "retry_3x_then_notify",
          guardrails: {
            max_tokens: 4000,
            max_runtime_seconds: 300,
            temperature: 0.3,
          },
        },
        {
          agent_id: "data_enricher",
          archetype: "Enrichment",
          role: "Data Enricher",
          system_prompt:
            "You are a data enrichment specialist. Take the raw research data and enrich it with structured, actionable insights. Calculate company maturity score (1-10), identify decision makers, determine best outreach channel, and suggest talking points for sales. Output JSON with fields: maturity_score, decision_makers, outreach_channel, talking_points, enriched_data.",
          tools: [],
          inputs: {
            company_overview: "Company description",
            recent_news: "Recent developments",
            funding: "Funding history",
            key_people: "Key people",
            products: "Products",
            competitors: "Competitors",
          },
          outputs: {
            maturity_score: "Company maturity score 1-10",
            decision_makers: "List of decision makers to target",
            outreach_channel: "Recommended outreach channel",
            talking_points: "Suggested talking points",
            enriched_data: "Full enriched company profile",
          },
          requires_approval: false,
          approval_message: null,
          on_failure: "skip_and_continue",
          guardrails: {
            max_tokens: 3000,
            max_runtime_seconds: 60,
            temperature: 0.3,
          },
        },
        {
          agent_id: "report_generator",
          archetype: "Report",
          role: "Report Generator",
          system_prompt:
            "You are a report writer. Take the enriched company data and produce a clean, well-formatted summary report suitable for a sales team. The report should include: executive summary, key findings, recommended approach, and risk factors. Output JSON with fields: report_title, executive_summary, key_findings, recommended_approach, risk_factors.",
          tools: ["pipeline_notify"],
          inputs: {
            enriched_data: "Full enriched company profile",
            maturity_score: "Maturity score",
            decision_makers: "Decision makers",
            talking_points: "Talking points",
          },
          outputs: {
            report_title: "Title of the research report",
            executive_summary: "Executive summary paragraph",
            key_findings: "List of key findings",
            recommended_approach: "Sales approach recommendation",
            risk_factors: "Potential risks to consider",
          },
          requires_approval: false,
          approval_message: null,
          on_failure: "retry_3x_then_notify",
          guardrails: {
            max_tokens: 3000,
            max_runtime_seconds: 45,
            temperature: 0.4,
          },
        },
      ],
      orchestration: {
        flow: [
          { from: "START", to: "web_researcher", condition: null },
          { from: "web_researcher", to: "data_enricher", condition: null },
          { from: "data_enricher", to: "report_generator", condition: null },
          { from: "report_generator", to: "END", condition: null },
        ],
        parallel_groups: [],
      },
      error_handling: {
        global_fallback: "notify_human",
        retry_policy: "exponential",
        max_retries: 3,
        alert_on_failure: true,
      },
      meta: {
        gaps_filled: [
          "Added data enrichment step between research and report",
          "Added maturity scoring for lead prioritization",
        ],
        assumptions: [
          "Brave Search API is configured for web research",
          "Reports are consumed by the sales team",
        ],
        recommended_enhancements: [
          "Add CRM write-back to update lead records automatically",
          "Add email notification with the report attached",
        ],
      },
    }),
  },

  // ── 3. Daily Inbox Digest ───────────────────────────────────────────────
  {
    name: "Daily Inbox Digest",
    description:
      "Reads unread emails, classifies by priority, and sends a summarized digest.",
    category: "Productivity",
    icon: "D",
    spec: makeSpec({
      name: "Daily Inbox Digest",
      description:
        "Reads unread emails, classifies by priority, and sends a summarized digest.",
      triggers: ["schedule"],
      schedule: "0 8 * * 1-5",
      input_schema: {
        recipient_email: {
          type: "string",
          required: true,
          description: "Email address to send the digest to",
        },
      },
      agents: [
        {
          agent_id: "inbox_reader",
          archetype: "Ingestion",
          role: "Inbox Reader",
          system_prompt:
            "You are an email ingestion agent. Read the most recent unread emails from the Gmail inbox (up to 50). For each email, extract: sender, subject, received date, and a brief snippet. Output JSON with field: emails (array of objects with sender, subject, received_at, snippet).",
          tools: ["gmail_read"],
          inputs: {},
          outputs: { emails: "Array of email summaries" },
          requires_approval: false,
          approval_message: null,
          on_failure: "retry_3x_then_notify",
          guardrails: {
            max_tokens: 4000,
            max_runtime_seconds: 45,
            temperature: 0.1,
          },
        },
        {
          agent_id: "email_classifier",
          archetype: "Classification",
          role: "Email Classifier",
          system_prompt:
            "You are an email classification agent. Take a list of emails and classify each one into priority levels: urgent, important, normal, low. Also tag each with a category: action_required, fyi, meeting, newsletter, other. Output JSON with field: classified_emails (array with original fields plus priority and category).",
          tools: [],
          inputs: { emails: "Array of emails to classify" },
          outputs: { classified_emails: "Emails with priority and category" },
          requires_approval: false,
          approval_message: null,
          on_failure: "skip_and_continue",
          guardrails: {
            max_tokens: 3000,
            max_runtime_seconds: 30,
            temperature: 0.2,
          },
        },
        {
          agent_id: "digest_writer",
          archetype: "Summarization",
          role: "Digest Writer",
          system_prompt:
            "You are a digest summary writer. Take classified emails and produce a clean, scannable daily digest. Group by priority. For each email, write a one-line summary. Include counts per category at the top. The digest should be readable in under 2 minutes. Output JSON with fields: digest_subject, digest_html, digest_text, stats (object with counts).",
          tools: ["gmail_send"],
          inputs: {
            classified_emails: "Classified email list",
            recipient_email: "Where to send the digest",
          },
          outputs: {
            digest_subject: "Digest email subject",
            digest_html: "HTML digest content",
            stats: "Email statistics",
          },
          requires_approval: false,
          approval_message: null,
          on_failure: "retry_3x_then_notify",
          guardrails: {
            max_tokens: 3000,
            max_runtime_seconds: 30,
            temperature: 0.3,
          },
        },
      ],
      orchestration: {
        flow: [
          { from: "START", to: "inbox_reader", condition: null },
          { from: "inbox_reader", to: "email_classifier", condition: null },
          { from: "email_classifier", to: "digest_writer", condition: null },
          { from: "digest_writer", to: "END", condition: null },
        ],
        parallel_groups: [],
      },
      error_handling: {
        global_fallback: "notify_human",
        retry_policy: "linear",
        max_retries: 2,
        alert_on_failure: true,
      },
      meta: {
        gaps_filled: [
          "Added email classification step for priority sorting",
          "Added statistics summary at the top of digest",
        ],
        assumptions: [
          "Gmail is the primary email provider",
          "Digest runs Mon-Fri at 8 AM",
        ],
        recommended_enhancements: [
          "Add ability to auto-archive low priority emails",
          "Add Slack notification alongside email digest",
        ],
      },
    }),
  },

  // ── 4. Meeting Notes Processor ──────────────────────────────────────────
  {
    name: "Meeting Notes Processor",
    description:
      "Takes meeting notes, extracts action items, creates calendar follow-ups, and emails the summary.",
    category: "Productivity",
    icon: "M",
    spec: makeSpec({
      name: "Meeting Notes Processor",
      description:
        "Takes meeting notes, extracts action items, creates calendar follow-ups, and emails the summary.",
      triggers: ["manual"],
      schedule: null,
      input_schema: {
        meeting_notes: {
          type: "string",
          required: true,
          description: "Raw meeting notes or transcript",
        },
        attendee_emails: {
          type: "string",
          required: true,
          description: "Comma-separated email addresses of attendees",
        },
        meeting_title: {
          type: "string",
          required: true,
          description: "Title of the meeting",
        },
      },
      agents: [
        {
          agent_id: "notes_analyzer",
          archetype: "Analysis",
          role: "Meeting Notes Analyzer",
          system_prompt:
            "You are a meeting analysis specialist. Take raw meeting notes and extract: key decisions made, action items (with owner and deadline if mentioned), open questions, and a concise summary. Output JSON with fields: summary, decisions, action_items (array with task, owner, deadline), open_questions.",
          tools: [],
          inputs: {
            meeting_notes: "Raw meeting notes",
            meeting_title: "Meeting title",
          },
          outputs: {
            summary: "Meeting summary",
            decisions: "Key decisions",
            action_items: "Action items with owners",
            open_questions: "Unresolved questions",
          },
          requires_approval: false,
          approval_message: null,
          on_failure: "retry_3x_then_notify",
          guardrails: {
            max_tokens: 3000,
            max_runtime_seconds: 45,
            temperature: 0.2,
          },
        },
        {
          agent_id: "followup_creator",
          archetype: "Scheduler",
          role: "Follow-up Creator",
          system_prompt:
            "You are a scheduling agent. Take action items from a meeting and create calendar events for any that have deadlines. Create a single follow-up meeting if there are open questions. Output JSON with fields: events_created (count), follow_up_scheduled (boolean).",
          tools: ["google_calendar_write", "google_calendar_find_slot"],
          inputs: {
            action_items: "Action items with deadlines",
            open_questions: "Open questions requiring follow-up",
            attendee_emails: "Attendee emails for calendar invites",
          },
          outputs: {
            events_created: "Number of calendar events created",
            follow_up_scheduled: "Whether a follow-up was scheduled",
          },
          requires_approval: false,
          approval_message: null,
          on_failure: "skip_and_continue",
          guardrails: {
            max_tokens: 2000,
            max_runtime_seconds: 60,
            temperature: 0.1,
          },
        },
        {
          agent_id: "summary_emailer",
          archetype: "Outreach",
          role: "Summary Emailer",
          system_prompt:
            "You are an email delivery agent. Take the meeting summary, decisions, and action items, and compose a clean follow-up email to all attendees. The email should be professional, concise, and include all action items with their owners. Send the email via Gmail. Output JSON with fields: sent, recipients_count.",
          tools: ["gmail_send"],
          inputs: {
            summary: "Meeting summary",
            decisions: "Key decisions",
            action_items: "Action items list",
            attendee_emails: "Recipients",
            meeting_title: "For the email subject",
          },
          outputs: {
            sent: "Whether email was sent",
            recipients_count: "Number of recipients",
          },
          requires_approval: true,
          approval_message:
            "Review the meeting summary email before sending to all attendees.",
          on_failure: "escalate_to_human",
          guardrails: {
            max_tokens: 2000,
            max_runtime_seconds: 30,
            temperature: 0.2,
          },
        },
      ],
      orchestration: {
        flow: [
          { from: "START", to: "notes_analyzer", condition: null },
          { from: "notes_analyzer", to: "followup_creator", condition: null },
          { from: "notes_analyzer", to: "summary_emailer", condition: null },
          { from: "followup_creator", to: "END", condition: null },
          { from: "summary_emailer", to: "END", condition: null },
        ],
        parallel_groups: [["followup_creator", "summary_emailer"]],
      },
      error_handling: {
        global_fallback: "notify_human",
        retry_policy: "exponential",
        max_retries: 2,
        alert_on_failure: true,
      },
      meta: {
        gaps_filled: [
          "Added parallel execution for calendar and email tasks",
          "Added approval gate before emailing attendees",
        ],
        assumptions: [
          "Meeting notes are provided as free-form text",
          "All attendees should receive the summary email",
        ],
        recommended_enhancements: [
          "Add integration with note-taking tools (Notion, Google Docs)",
          "Add automatic Slack channel update with summary",
        ],
      },
    }),
  },

  // ── 5. Competitor Monitoring ────────────────────────────────────────────
  {
    name: "Weekly Competitor Monitor",
    description:
      "Monitors competitors for news, pricing changes, and product updates on a weekly schedule.",
    category: "Research",
    icon: "C",
    spec: makeSpec({
      name: "Weekly Competitor Monitor",
      description:
        "Monitors competitors for news, pricing changes, and product updates on a weekly schedule.",
      triggers: ["schedule", "manual"],
      schedule: "0 9 * * 1",
      input_schema: {
        competitors: {
          type: "string",
          required: true,
          description:
            "Comma-separated list of competitor company names to monitor",
        },
        report_email: {
          type: "string",
          required: true,
          description: "Email address to send the weekly report to",
        },
      },
      agents: [
        {
          agent_id: "competitor_scanner",
          archetype: "Research",
          role: "Competitor Scanner",
          system_prompt:
            "You are a competitive intelligence researcher. For each competitor in the provided list, search for: recent news (last 7 days), product updates or launches, pricing changes, blog posts, and social media activity. Be thorough but focus on business-relevant updates. Output JSON with field: competitor_data (array of objects with name, news, product_updates, pricing_changes, notable_activity).",
          tools: ["web_search", "web_scrape", "web_research"],
          inputs: { competitors: "List of competitor names" },
          outputs: {
            competitor_data: "Structured data per competitor",
          },
          requires_approval: false,
          approval_message: null,
          on_failure: "retry_3x_then_notify",
          guardrails: {
            max_tokens: 4000,
            max_runtime_seconds: 180,
            temperature: 0.2,
          },
        },
        {
          agent_id: "threat_analyzer",
          archetype: "Analysis",
          role: "Threat Analyzer",
          system_prompt:
            "You are a competitive threat analyst. Take the raw competitor data and assess: threat level (1-5) for each competitor, key takeaways, recommended actions for the team, and overall market sentiment. Output JSON with fields: assessments (array with name, threat_level, key_takeaway), recommended_actions, market_sentiment.",
          tools: [],
          inputs: {
            competitor_data: "Raw competitor research data",
          },
          outputs: {
            assessments: "Per-competitor threat assessments",
            recommended_actions: "Actions for the team",
            market_sentiment: "Overall market sentiment",
          },
          requires_approval: false,
          approval_message: null,
          on_failure: "skip_and_continue",
          guardrails: {
            max_tokens: 3000,
            max_runtime_seconds: 45,
            temperature: 0.3,
          },
        },
        {
          agent_id: "report_emailer",
          archetype: "Report",
          role: "Report Emailer",
          system_prompt:
            "You are a report delivery agent. Take the competitor assessments and recommended actions, format them into a professional weekly competitive intelligence report, and send it via email. The report should have clear sections per competitor and a summary of recommended actions at the top. Output JSON with fields: sent, report_title.",
          tools: ["gmail_send"],
          inputs: {
            assessments: "Competitor threat assessments",
            recommended_actions: "Recommended actions",
            market_sentiment: "Market sentiment",
            report_email: "Recipient email",
          },
          outputs: {
            sent: "Whether the report was sent",
            report_title: "Title of the sent report",
          },
          requires_approval: false,
          approval_message: null,
          on_failure: "retry_3x_then_notify",
          guardrails: {
            max_tokens: 3000,
            max_runtime_seconds: 30,
            temperature: 0.3,
          },
        },
      ],
      orchestration: {
        flow: [
          { from: "START", to: "competitor_scanner", condition: null },
          { from: "competitor_scanner", to: "threat_analyzer", condition: null },
          { from: "threat_analyzer", to: "report_emailer", condition: null },
          { from: "report_emailer", to: "END", condition: null },
        ],
        parallel_groups: [],
      },
      error_handling: {
        global_fallback: "notify_human",
        retry_policy: "exponential",
        max_retries: 3,
        alert_on_failure: true,
      },
      meta: {
        gaps_filled: [
          "Added threat level scoring for prioritization",
          "Added recommended actions section for actionability",
        ],
        assumptions: [
          "Competitors are publicly listed companies with web presence",
          "Report runs every Monday at 9 AM",
        ],
        recommended_enhancements: [
          "Add Slack notification for high-threat alerts",
          "Store historical data in Supabase for trend tracking",
        ],
      },
    }),
  },

  // ── 6. Content Publishing Pipeline ──────────────────────────────────────
  {
    name: "Content Publishing Pipeline",
    description:
      "Takes a topic, researches it, writes a blog draft, reviews for quality, and sends for approval.",
    category: "Marketing",
    icon: "P",
    spec: makeSpec({
      name: "Content Publishing Pipeline",
      description:
        "Takes a topic, researches it, writes a blog draft, reviews for quality, and sends for approval.",
      triggers: ["manual"],
      schedule: null,
      input_schema: {
        topic: {
          type: "string",
          required: true,
          description: "Blog post topic or title",
        },
        target_audience: {
          type: "string",
          required: true,
          description: "Target audience for the content",
        },
        tone: {
          type: "string",
          required: false,
          description: "Writing tone (e.g. professional, casual, technical)",
        },
      },
      agents: [
        {
          agent_id: "topic_researcher",
          archetype: "Research",
          role: "Topic Researcher",
          system_prompt:
            "You are a content research specialist. Given a blog topic, perform web research to gather: key facts and statistics, expert opinions, recent developments, and competing articles. Focus on finding unique angles and data points. Output JSON with fields: research_summary, key_facts, data_points, unique_angles, competing_articles.",
          tools: ["web_search", "web_research"],
          inputs: {
            topic: "Blog topic to research",
            target_audience: "Who the content is for",
          },
          outputs: {
            research_summary: "Summary of research findings",
            key_facts: "Important facts and statistics",
            data_points: "Relevant data points",
            unique_angles: "Unique angles to explore",
          },
          requires_approval: false,
          approval_message: null,
          on_failure: "retry_3x_then_notify",
          guardrails: {
            max_tokens: 4000,
            max_runtime_seconds: 120,
            temperature: 0.3,
          },
        },
        {
          agent_id: "content_writer",
          archetype: "Copywriter",
          role: "Content Writer",
          system_prompt:
            "You are an expert blog content writer. Using the research provided, write a comprehensive, engaging blog post (800-1200 words). Include an attention-grabbing introduction, clear sections with subheadings, relevant data points, and a strong conclusion with CTA. Match the specified tone and target audience. Output JSON with fields: title, meta_description, content_html, word_count.",
          tools: [],
          inputs: {
            topic: "Blog topic",
            target_audience: "Target audience",
            tone: "Writing tone",
            research_summary: "Research findings",
            key_facts: "Key facts to include",
            unique_angles: "Angles to explore",
          },
          outputs: {
            title: "Blog post title",
            meta_description: "SEO meta description",
            content_html: "Full blog post in HTML",
            word_count: "Total word count",
          },
          requires_approval: false,
          approval_message: null,
          on_failure: "retry_3x_then_notify",
          guardrails: {
            max_tokens: 4000,
            max_runtime_seconds: 60,
            temperature: 0.6,
          },
        },
        {
          agent_id: "quality_reviewer",
          archetype: "QA",
          role: "Quality Reviewer",
          system_prompt:
            "You are an editorial quality reviewer. Review the blog post for: grammar and spelling errors, factual accuracy, tone consistency, SEO best practices, readability, and overall quality. Provide a quality score (1-10) and specific feedback. Output JSON with fields: quality_score, grammar_issues, factual_concerns, seo_feedback, readability_score, overall_feedback, approved.",
          tools: [],
          inputs: {
            title: "Blog title",
            content_html: "Blog content to review",
            target_audience: "Target audience",
          },
          outputs: {
            quality_score: "Quality score 1-10",
            overall_feedback: "Summary feedback",
            approved: "Whether the post passes quality review",
          },
          requires_approval: true,
          approval_message:
            "Review the blog post and quality assessment. Approve to proceed with publishing.",
          on_failure: "escalate_to_human",
          guardrails: {
            max_tokens: 2000,
            max_runtime_seconds: 30,
            temperature: 0.2,
          },
        },
        {
          agent_id: "publish_notifier",
          archetype: "Notification",
          role: "Publish Notifier",
          system_prompt:
            "You are a notification agent. After the blog post has been approved, send a notification to the dashboard confirming the post is ready for publishing. Include the title, quality score, and a summary. Output JSON with fields: notified, message.",
          tools: ["pipeline_notify"],
          inputs: {
            title: "Blog title",
            quality_score: "Quality score",
            overall_feedback: "Quality feedback",
          },
          outputs: {
            notified: "Whether notification was sent",
            message: "Notification message",
          },
          requires_approval: false,
          approval_message: null,
          on_failure: "skip_and_continue",
          guardrails: {
            max_tokens: 1000,
            max_runtime_seconds: 15,
            temperature: 0.1,
          },
        },
      ],
      orchestration: {
        flow: [
          { from: "START", to: "topic_researcher", condition: null },
          { from: "topic_researcher", to: "content_writer", condition: null },
          { from: "content_writer", to: "quality_reviewer", condition: null },
          { from: "quality_reviewer", to: "publish_notifier", condition: null },
          { from: "publish_notifier", to: "END", condition: null },
        ],
        parallel_groups: [],
      },
      error_handling: {
        global_fallback: "notify_human",
        retry_policy: "exponential",
        max_retries: 2,
        alert_on_failure: true,
      },
      meta: {
        gaps_filled: [
          "Added quality review step before publishing",
          "Added SEO optimization check in quality review",
        ],
        assumptions: [
          "Content is published as a blog post",
          "Approval is required before any external publication",
        ],
        recommended_enhancements: [
          "Add image generation agent for featured images",
          "Add social media post drafting agent",
          "Integrate with CMS API for direct publishing",
        ],
      },
    }),
  },
];
