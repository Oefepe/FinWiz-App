// pt-BR currency parser. Never call parseFloat() directly on raw notification strings.

// Parses a single BRL amount token: "R$ 1.234,56" | "R$150,00" | "R150,00"
export function parseBRL(amountToken: string): number {
  const cleaned = amountToken
    .replace(/^R\$?\s?/, '') // strip R$, R, optional trailing space
    .trim()
    .replace(/\./g, '')      // remove pt-BR thousands separators
    .replace(',', '.');      // convert decimal separator

  if (!cleaned) throw new Error(`Cannot parse BRL amount from: "${amountToken}"`);
  const value = Number(cleaned);
  if (isNaN(value)) throw new Error(`Cannot parse BRL amount from: "${amountToken}"`);
  return value;
}

// Extracts and parses the first BRL amount token from arbitrary text.
// Handles: "R$ 1.234,56", "R$150,00", "R 1.234,56", "R1.234,56" (Itaú-style)
export function extractBRL(text: string): number | null {
  const match = /R\$?\s?[\d.,]+/.exec(text);
  if (!match) return null;
  const token = match[0];
  if (!token) return null;
  try {
    return parseBRL(token);
  } catch {
    return null;
  }
}
