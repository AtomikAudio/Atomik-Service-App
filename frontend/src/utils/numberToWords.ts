const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t]}${o ? ` ${ONES[o]}` : ''}`;
}

function threeDigits(n: number): string {
  if (n >= 100) {
    const rest = n % 100;
    return `${ONES[Math.floor(n / 100)]} Hundred${rest ? ` ${twoDigits(rest)}` : ''}`;
  }
  return twoDigits(n);
}

/** Indian numbering (crore/lakh/thousand) amount → words, e.g. "Six Thousand Four Hundred Ninety". */
export function numberToIndianWords(value: number): string {
  let n = Math.round(Math.abs(value));
  if (n === 0) return 'Zero';

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = n;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));
  return parts.join(' ');
}

/** "INR <amount> Only" for the invoice's amount-in-words lines. */
export function amountInWordsINR(value: number): string {
  return `INR ${numberToIndianWords(value)} Only`;
}
