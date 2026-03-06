import { google } from "googleapis";
import { getGoogleAuthClient } from "@/lib/google-auth";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSheetsClient() {
  const auth = getGoogleAuthClient();
  return google.sheets({ version: "v4", auth });
}

function getDriveClient() {
  const auth = getGoogleAuthClient();
  return google.drive({ version: "v3", auth });
}

function parseA1Range(range: string): {
  startRowIndex: number;
  endRowIndex: number;
  startColumnIndex: number;
  endColumnIndex: number;
} {
  const match = range.match(/^([A-Z]+)(\d+)?(?::([A-Z]+)(\d+)?)?$/);
  if (!match) {
    return { startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 };
  }

  const colToIndex = (col: string): number =>
    col.split("").reduce((acc, char) => acc * 26 + char.charCodeAt(0) - 64, 0) - 1;

  const startCol = colToIndex(match[1]);
  const startRow = match[2] ? parseInt(match[2]) - 1 : 0;
  const endCol = match[3] ? colToIndex(match[3]) + 1 : startCol + 1;
  const endRow = match[4] ? parseInt(match[4]) : startRow + 1;

  return { startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: startCol, endColumnIndex: endCol };
}

function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const clean = hex.replace("#", "");
  return {
    red: parseInt(clean.slice(0, 2), 16) / 255,
    green: parseInt(clean.slice(2, 4), 16) / 255,
    blue: parseInt(clean.slice(4, 6), 16) / 255,
  };
}

// ── Tools ─────────────────────────────────────────────────────────────────────

export async function sheetsReadRows(input: Record<string, unknown>): Promise<string> {
  const sheets = getSheetsClient();
  const spreadsheetId = input.spreadsheet_id as string;
  const sheetName = (input.sheet_name as string | undefined) ?? "Sheet1";
  const range = input.range as string | undefined;
  const hasHeaderRow = (input.has_header_row as boolean | undefined) ?? true;
  const limit = (input.limit as number | undefined) ?? 100;

  const fullRange = range ? `${sheetName}!${range}` : sheetName;

  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: fullRange,
    valueRenderOption: "FORMATTED_VALUE",
  });

  const values = data.values ?? [];

  if (values.length === 0) {
    return JSON.stringify({
      summary: `No data found in ${sheetName}`,
      rows: [],
      total_rows: 0,
      headers: [],
    });
  }

  let headers: string[] = [];
  let dataRows: Record<string, string>[];

  if (hasHeaderRow) {
    headers = values[0].map((h: unknown) => String(h ?? ""));
    dataRows = values.slice(1, limit + 1).map((row: unknown[]) => {
      const obj: Record<string, string> = {};
      headers.forEach((header, i) => {
        obj[header] = row[i] !== undefined ? String(row[i]) : "";
      });
      return obj;
    });
  } else {
    dataRows = values.slice(0, limit).map((row: unknown[]) => {
      const obj: Record<string, string> = {};
      row.forEach((cell, i) => {
        obj[`col_${i + 1}`] = String(cell ?? "");
      });
      return obj;
    });
  }

  const preview = dataRows.slice(0, 5);
  const summaryLines = preview.map((row, i) => `Row ${i + 1}: ${JSON.stringify(row)}`).join("\n");
  const summary = `Read ${dataRows.length} rows from ${sheetName}:\n${summaryLines}${dataRows.length > 5 ? "\n..." : ""}`;

  return JSON.stringify({ summary, rows: dataRows, total_rows: dataRows.length, headers });
}

export async function sheetsWriteRows(input: Record<string, unknown>): Promise<string> {
  const sheets = getSheetsClient();
  const spreadsheetId = input.spreadsheet_id as string;
  const sheetName = (input.sheet_name as string | undefined) ?? "Sheet1";
  const rows = (input.rows as Record<string, unknown>[] | undefined) ?? [];
  const mode = (input.mode as string | undefined) ?? "append";
  const startRow = (input.start_row as number | undefined) ?? 2;
  const includeHeaders = (input.include_headers as boolean | undefined) ?? false;

  if (rows.length === 0) {
    return JSON.stringify({ status: "success", message: "No rows to write" });
  }

  const headers = Object.keys(rows[0]);
  const rowsAs2D: unknown[][] = [];

  if (includeHeaders) {
    rowsAs2D.push(headers);
  }
  for (const row of rows) {
    rowsAs2D.push(headers.map((h) => row[h] ?? ""));
  }

  if (mode === "append") {
    const { data } = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: sheetName,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: rowsAs2D },
    });
    return JSON.stringify({
      status: "success",
      message: `${rows.length} rows appended to ${sheetName} at ${data.updates?.updatedRange ?? "unknown range"}`,
    });
  } else {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A${startRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rowsAs2D },
    });
    return JSON.stringify({
      status: "success",
      message: `${rows.length} rows written to ${sheetName} starting at row ${startRow}`,
    });
  }
}

export async function sheetsUpdateCells(input: Record<string, unknown>): Promise<string> {
  const sheets = getSheetsClient();
  const spreadsheetId = input.spreadsheet_id as string;
  const sheetName = (input.sheet_name as string | undefined) ?? "Sheet1";
  const updates = (input.updates as Array<{ range: string; value: string | number | boolean }> | undefined) ?? [];

  if (updates.length === 0) {
    return JSON.stringify({ status: "success", message: "No updates to apply" });
  }

  const batchData = updates.map((u) => ({
    range: `${sheetName}!${u.range}`,
    values: [[u.value]],
  }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data: batchData },
  });

  return JSON.stringify({
    status: "success",
    message: `Updated ${updates.length} cell ranges in ${sheetName}`,
  });
}

export async function sheetsCreateSpreadsheet(input: Record<string, unknown>): Promise<string> {
  const sheets = getSheetsClient();
  const drive = getDriveClient();
  const title = input.title as string;
  const sheetNames = (input.sheets as string[] | undefined) ?? ["Sheet1"];
  const headersMap = (input.headers as Record<string, string[]> | undefined) ?? {};
  const shareWith = (input.share_with as string[] | undefined) ?? [];

  const { data } = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: sheetNames.map((name) => ({ properties: { title: name } })),
    },
  });

  const spreadsheetId = data.spreadsheetId!;

  for (const [sheetName, headerRow] of Object.entries(headersMap)) {
    if (headerRow.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [headerRow] },
      });
    }
  }

  for (const email of shareWith) {
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: { role: "reader", type: "user", emailAddress: email },
    });
  }

  return JSON.stringify({
    summary: `Spreadsheet '${title}' created`,
    spreadsheet_id: spreadsheetId,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    sheets: sheetNames,
  });
}

export async function sheetsSearch(input: Record<string, unknown>): Promise<string> {
  const sheetName = (input.sheet_name as string | undefined) ?? "Sheet1";
  const searchColumn = input.search_column as string;
  const searchValue = String(input.search_value ?? "").toLowerCase();
  const matchType = (input.match_type as string | undefined) ?? "contains";
  const returnColumns = input.return_columns as string[] | undefined;

  const rawResult = await sheetsReadRows({
    spreadsheet_id: input.spreadsheet_id,
    sheet_name: sheetName,
    has_header_row: true,
    limit: 10000,
  });

  const parsed = JSON.parse(rawResult) as { rows: Record<string, string>[]; headers: string[] };

  let matches = parsed.rows.filter((row) => {
    const cellValue = (row[searchColumn] ?? "").toLowerCase();
    switch (matchType) {
      case "exact":
        return cellValue === searchValue;
      case "starts_with":
        return cellValue.startsWith(searchValue);
      default:
        return cellValue.includes(searchValue);
    }
  });

  if (returnColumns && returnColumns.length > 0) {
    matches = matches.map((row) => {
      const filtered: Record<string, string> = {};
      returnColumns.forEach((col) => {
        filtered[col] = row[col] ?? "";
      });
      return filtered;
    });
  }

  const preview = matches.slice(0, 5);
  const summaryLines = preview.map((row, i) => `Row ${i + 1}: ${JSON.stringify(row)}`).join("\n");
  const summary = `Found ${matches.length} rows where ${searchColumn} ${matchType} '${input.search_value}':\n${summaryLines}${matches.length > 5 ? "\n..." : ""}`;

  return JSON.stringify({ summary, matches, total_matches: matches.length });
}

export async function sheetsFormatCells(input: Record<string, unknown>): Promise<string> {
  const sheets = getSheetsClient();
  const spreadsheetId = input.spreadsheet_id as string;
  const sheetName = (input.sheet_name as string | undefined) ?? "Sheet1";
  const range = input.range as string;
  const format = (input.format as Record<string, unknown>) ?? {};

  const { data: spreadsheet } = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetMeta = spreadsheet.sheets?.find((s) => s.properties?.title === sheetName);
  if (!sheetMeta) {
    throw new Error(`Sheet '${sheetName}' not found`);
  }
  const sheetId = sheetMeta.properties?.sheetId ?? 0;

  const { startRowIndex, endRowIndex, startColumnIndex, endColumnIndex } = parseA1Range(range);

  const cellFormat: Record<string, unknown> = {};

  if (format.bold !== undefined || format.italic !== undefined || format.font_size !== undefined || format.text_color) {
    const textFormat: Record<string, unknown> = {};
    if (format.bold !== undefined) textFormat.bold = format.bold;
    if (format.italic !== undefined) textFormat.italic = format.italic;
    if (format.font_size !== undefined) textFormat.fontSize = format.font_size;
    if (format.text_color) textFormat.foregroundColor = hexToRgb(format.text_color as string);
    cellFormat.textFormat = textFormat;
  }

  if (format.background_color) {
    cellFormat.backgroundColor = hexToRgb(format.background_color as string);
  }

  if (format.horizontal_alignment) {
    cellFormat.horizontalAlignment = format.horizontal_alignment;
  }

  if (format.number_format) {
    const patterns: Record<string, string> = {
      TEXT: "@",
      NUMBER: "#,##0.##",
      CURRENCY: '"$"#,##0.00',
      DATE: "M/D/YYYY",
      PERCENT: "0.00%",
    };
    const fmt = (format.number_format as string).toUpperCase();
    cellFormat.numberFormat = {
      type: fmt === "TEXT" ? "TEXT" : "NUMBER",
      pattern: patterns[fmt] ?? "#,##0.##",
    };
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex },
            cell: { userEnteredFormat: cellFormat },
            fields: "userEnteredFormat",
          },
        },
      ],
    },
  });

  return JSON.stringify({
    status: "success",
    message: `Formatting applied to ${range} in ${sheetName}`,
  });
}
