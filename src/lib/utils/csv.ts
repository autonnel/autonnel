// Quoting stops delimiter injection but NOT formula interpretation: a spreadsheet evaluates a cell
// beginning with =, +, - or @ regardless of quotes, so buyer-controlled text must be prefixed with
// an apostrophe. Leading whitespace, tab and CR are checked too — spreadsheet parsers skip them
// when looking for the first significant character.
const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@']);

export function startsWithSpreadsheetFormula(value: string): boolean {
  for (const char of value) {
    if (char === ' ' || char === '\t' || char === '\r' || char === '\n') continue;
    return FORMULA_TRIGGERS.has(char);
  }
  return false;
}

export function csvCell(value: string): string {
  const neutralized = startsWithSpreadsheetFormula(value) ? `'${value}` : value;
  return `"${neutralized.replace(/"/g, '""')}"`;
}
