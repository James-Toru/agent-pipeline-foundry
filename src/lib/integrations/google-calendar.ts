import { google } from "googleapis";
import { getGoogleAuthClient } from "@/lib/google-auth";

// ── Tools ─────────────────────────────────────────────────────────────────────

export async function calendarRead(
  input: Record<string, unknown>
): Promise<string> {
  const auth = getGoogleAuthClient();
  const calendar = google.calendar({ version: "v3", auth });

  const { data } = await calendar.events.list({
    calendarId: (input.calendar_id as string | undefined) ?? "primary",
    timeMin: (input.time_min as string | undefined) ?? undefined,
    timeMax: (input.time_max as string | undefined) ?? undefined,
    q: (input.query as string | undefined) ?? undefined,
    maxResults: (input.max_results as number | undefined) ?? 10,
    singleEvents: true,
    orderBy: "startTime",
  });

  return JSON.stringify({
    status: "success",
    events: data.items ?? [],
    count: data.items?.length ?? 0,
  });
}

export async function calendarWrite(
  input: Record<string, unknown>
): Promise<string> {
  const auth = getGoogleAuthClient();
  const calendar = google.calendar({ version: "v3", auth });
  const calendarId = "primary";
  const action = input.action as string;

  if (action === "cancel" || action === "delete") {
    await calendar.events.delete({
      calendarId,
      eventId: input.event_id as string,
    });
    return JSON.stringify({ status: "success", action: "cancelled" });
  }

  const attendeeList =
    (input.attendees as string | undefined)
      ?.split(",")
      .map((e) => ({ email: e.trim() })) ?? [];

  const eventBody = {
    summary: input.title as string,
    start: { dateTime: input.start as string },
    end: { dateTime: input.end as string },
    ...(attendeeList.length ? { attendees: attendeeList } : {}),
    ...(input.location ? { location: input.location as string } : {}),
    ...(input.description
      ? { description: input.description as string }
      : {}),
  };

  if (action === "update") {
    const { data } = await calendar.events.update({
      calendarId,
      eventId: input.event_id as string,
      requestBody: eventBody,
    });
    return JSON.stringify({
      status: "success",
      event_id: data.id,
      html_link: data.htmlLink,
    });
  }

  const { data } = await calendar.events.insert({
    calendarId,
    requestBody: eventBody,
  });
  return JSON.stringify({
    status: "success",
    event_id: data.id,
    html_link: data.htmlLink,
  });
}

export async function calendarFindSlot(
  input: Record<string, unknown>
): Promise<string> {
  const auth = getGoogleAuthClient();
  const calendar = google.calendar({ version: "v3", auth });

  const attendees = (input.attendees as string)
    .split(",")
    .map((e) => e.trim());
  const durationMs = (input.duration_minutes as number) * 60 * 1000;

  const { data } = await calendar.freebusy.query({
    requestBody: {
      timeMin: input.date_range_start as string,
      timeMax: input.date_range_end as string,
      timeZone: (input.timezone as string | undefined) ?? "UTC",
      items: attendees.map((a) => ({ id: a })),
    },
  });

  // Merge all busy intervals across attendees and find free slots
  const busyIntervals = attendees
    .flatMap((a) =>
      (data.calendars?.[a]?.busy ?? []).map((b) => ({
        start: new Date(b.start!).getTime(),
        end: new Date(b.end!).getTime(),
      }))
    )
    .sort((a, b) => a.start - b.start);

  const slots: Array<{ start: string; end: string }> = [];
  let current = new Date(input.date_range_start as string).getTime();
  const rangeEnd = new Date(input.date_range_end as string).getTime();

  for (const busy of busyIntervals) {
    if (current + durationMs <= busy.start && current < rangeEnd) {
      slots.push({
        start: new Date(current).toISOString(),
        end: new Date(current + durationMs).toISOString(),
      });
      if (slots.length >= 5) break;
    }
    current = Math.max(current, busy.end);
  }

  if (slots.length < 5 && current + durationMs <= rangeEnd) {
    slots.push({
      start: new Date(current).toISOString(),
      end: new Date(current + durationMs).toISOString(),
    });
  }

  return JSON.stringify({
    status: "success",
    available_slots: slots,
    count: slots.length,
  });
}
