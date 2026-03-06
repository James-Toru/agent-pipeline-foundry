import { getHubSpotClient } from "@/lib/hubspot-auth";

// Association entries use string IDs (HubSpot API requirement).
// The body cast via `as unknown as Parameters<method>[0]` avoids importing
// the SDK's internal AssociationSpecAssociationCategoryEnum type.
type AssocEntry = {
  to: { id: string };
  types: { associationCategory: string; associationTypeId: number }[];
};

// ── Tool 1: Read contacts ─────────────────────────────────────────────────────

export async function hubspotReadContacts(
  input: Record<string, unknown>
): Promise<string> {
  const client = getHubSpotClient();
  const response = await client.crm.contacts.searchApi.doSearch({
    query: (input.query as string | undefined) ?? "",
    limit: (input.limit as number | undefined) ?? 10,
    properties: [
      "firstname",
      "lastname",
      "email",
      "phone",
      "company",
      "jobtitle",
      "hs_lead_status",
      "lifecyclestage",
    ],
    filterGroups: [],
    sorts: [],
    after: "0",
  });
  return JSON.stringify({ status: "success", ...response });
}

// ── Tool 2: Write contact (create or update) ──────────────────────────────────

export async function hubspotWriteContact(
  input: Record<string, unknown>
): Promise<string> {
  const client = getHubSpotClient();
  const action = (input.action as string | undefined) ?? "create";

  if (action === "update") {
    const contactId = input.contact_id as string;
    const properties = (input.properties as Record<string, string>) ?? {};
    const response = await client.crm.contacts.basicApi.update(contactId, {
      properties,
    });
    return JSON.stringify({ status: "success", contact: response });
  }

  // Default: create
  const properties: Record<string, string> = {};
  if (input.email) properties.email = input.email as string;
  if (input.first_name) properties.firstname = input.first_name as string;
  if (input.last_name) properties.lastname = input.last_name as string;
  if (input.phone) properties.phone = input.phone as string;
  if (input.company) properties.company = input.company as string;
  if (input.job_title) properties.jobtitle = input.job_title as string;
  if (input.lead_status) properties.hs_lead_status = input.lead_status as string;
  if (input.lifecycle_stage)
    properties.lifecyclestage = input.lifecycle_stage as string;

  const response = await client.crm.contacts.basicApi.create({ properties });
  return JSON.stringify({ status: "success", contact: response });
}

// ── Tool 3: Read companies ────────────────────────────────────────────────────

export async function hubspotReadCompanies(
  input: Record<string, unknown>
): Promise<string> {
  const client = getHubSpotClient();
  const response = await client.crm.companies.searchApi.doSearch({
    query: (input.query as string | undefined) ?? "",
    limit: (input.limit as number | undefined) ?? 10,
    properties: [
      "name",
      "domain",
      "industry",
      "phone",
      "city",
      "country",
      "numberofemployees",
      "annualrevenue",
    ],
    filterGroups: [],
    sorts: [],
    after: "0",
  });
  return JSON.stringify({ status: "success", ...response });
}

// ── Tool 4: Write company (create) ────────────────────────────────────────────

export async function hubspotWriteCompany(
  input: Record<string, unknown>
): Promise<string> {
  const client = getHubSpotClient();
  const properties: Record<string, string> = {};
  if (input.name) properties.name = input.name as string;
  if (input.domain) properties.domain = input.domain as string;
  if (input.industry) properties.industry = input.industry as string;
  if (input.phone) properties.phone = input.phone as string;
  if (input.city) properties.city = input.city as string;
  if (input.country) properties.country = input.country as string;
  if (input.num_employees)
    properties.numberofemployees = String(input.num_employees);
  if (input.annual_revenue)
    properties.annualrevenue = String(input.annual_revenue);

  const response = await client.crm.companies.basicApi.create({ properties });
  return JSON.stringify({ status: "success", company: response });
}

// ── Tool 5: Read deals ────────────────────────────────────────────────────────

export async function hubspotReadDeals(
  input: Record<string, unknown>
): Promise<string> {
  const client = getHubSpotClient();
  const response = await client.crm.deals.searchApi.doSearch({
    query: (input.query as string | undefined) ?? "",
    limit: (input.limit as number | undefined) ?? 10,
    properties: [
      "dealname",
      "amount",
      "dealstage",
      "closedate",
      "pipeline",
      "hubspot_owner_id",
    ],
    filterGroups: [],
    sorts: [],
    after: "0",
  });
  return JSON.stringify({ status: "success", ...response });
}

// ── Tool 6: Write deal (create or update) ────────────────────────────────────

export async function hubspotWriteDeal(
  input: Record<string, unknown>
): Promise<string> {
  const client = getHubSpotClient();
  const action = (input.action as string | undefined) ?? "create";

  if (action === "update") {
    const dealId = input.deal_id as string;
    const properties = (input.properties as Record<string, string>) ?? {};
    const response = await client.crm.deals.basicApi.update(dealId, {
      properties,
    });
    return JSON.stringify({ status: "success", deal: response });
  }

  // Default: create
  const properties: Record<string, string> = {};
  if (input.deal_name) properties.dealname = input.deal_name as string;
  if (input.amount) properties.amount = String(input.amount);
  if (input.stage) properties.dealstage = input.stage as string;
  if (input.close_date) properties.closedate = input.close_date as string;
  properties.pipeline = (input.pipeline as string | undefined) ?? "default";
  if (input.owner_id) properties.hubspot_owner_id = input.owner_id as string;

  const associations: AssocEntry[] = [];
  if (input.contact_id) {
    associations.push({
      to: { id: String(input.contact_id) },
      types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }],
    });
  }
  if (input.company_id) {
    associations.push({
      to: { id: String(input.company_id) },
      types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 5 }],
    });
  }

  type DealCreateBody = Parameters<typeof client.crm.deals.basicApi.create>[0];
  const body = {
    properties,
    ...(associations.length > 0 ? { associations } : {}),
  } as unknown as DealCreateBody;

  const response = await client.crm.deals.basicApi.create(body);
  return JSON.stringify({ status: "success", deal: response });
}

// ── Tool 7: Create task ───────────────────────────────────────────────────────

export async function hubspotCreateTask(
  input: Record<string, unknown>
): Promise<string> {
  const client = getHubSpotClient();
  const properties: Record<string, string> = {};
  if (input.subject) properties.hs_task_subject = input.subject as string;
  if (input.body) properties.hs_task_body = input.body as string;
  properties.hs_task_status =
    (input.status as string | undefined) ?? "NOT_STARTED";
  properties.hs_task_priority =
    (input.priority as string | undefined) ?? "MEDIUM";
  properties.hs_timestamp =
    (input.due_date as string | undefined) ?? new Date().toISOString();
  if (input.owner_id) properties.hubspot_owner_id = input.owner_id as string;

  const associations: AssocEntry[] = [];
  if (input.contact_id) {
    associations.push({
      to: { id: String(input.contact_id) },
      types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 204 }],
    });
  }

  type ObjectCreateBody = Parameters<
    typeof client.crm.objects.basicApi.create
  >[1];
  const body = {
    properties,
    ...(associations.length > 0 ? { associations } : {}),
  } as unknown as ObjectCreateBody;

  const response = await client.crm.objects.basicApi.create("tasks", body);
  return JSON.stringify({ status: "success", task: response });
}

// ── Tool 8: Create note ───────────────────────────────────────────────────────

export async function hubspotCreateNote(
  input: Record<string, unknown>
): Promise<string> {
  const client = getHubSpotClient();
  const properties: Record<string, string> = {
    hs_note_body: input.body as string,
    hs_timestamp: new Date().toISOString(),
  };
  if (input.owner_id) properties.hubspot_owner_id = input.owner_id as string;

  const associations: AssocEntry[] = [];
  if (input.contact_id) {
    associations.push({
      to: { id: String(input.contact_id) },
      types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }],
    });
  }
  if (input.company_id) {
    associations.push({
      to: { id: String(input.company_id) },
      types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 190 }],
    });
  }
  if (input.deal_id) {
    associations.push({
      to: { id: String(input.deal_id) },
      types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 214 }],
    });
  }

  type ObjectCreateBody = Parameters<
    typeof client.crm.objects.basicApi.create
  >[1];
  const body = {
    properties,
    ...(associations.length > 0 ? { associations } : {}),
  } as unknown as ObjectCreateBody;

  const response = await client.crm.objects.basicApi.create("notes", body);
  return JSON.stringify({ status: "success", note: response });
}

// ── Tool 9: Send email (log engagement) ──────────────────────────────────────

export async function hubspotSendEmail(
  input: Record<string, unknown>
): Promise<string> {
  const client = getHubSpotClient();
  const properties: Record<string, string> = {
    hs_email_subject: input.subject as string,
    hs_email_text: input.body as string,
    hs_email_direction: (input.direction as string | undefined) ?? "EMAIL",
    hs_email_status: "SENT",
    hs_timestamp: new Date().toISOString(),
  };
  if (input.owner_id) properties.hubspot_owner_id = input.owner_id as string;

  const associations: AssocEntry[] = [];
  if (input.contact_id) {
    associations.push({
      to: { id: String(input.contact_id) },
      types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 198 }],
    });
  }

  type ObjectCreateBody = Parameters<
    typeof client.crm.objects.basicApi.create
  >[1];
  const body = {
    properties,
    ...(associations.length > 0 ? { associations } : {}),
  } as unknown as ObjectCreateBody;

  const response = await client.crm.objects.basicApi.create("emails", body);
  return JSON.stringify({ status: "success", email_engagement: response });
}

// ── Tool 10: Read pipeline stages ─────────────────────────────────────────────

export async function hubspotReadPipelineStages(
  input: Record<string, unknown>
): Promise<string> {
  const client = getHubSpotClient();
  const objectType = (input.object_type as string | undefined) ?? "deals";
  const response = await client.crm.pipelines.pipelinesApi.getAll(objectType);
  return JSON.stringify({ status: "success", pipelines: response.results });
}
