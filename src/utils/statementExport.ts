import type {B2BUser, LedgerEntry} from '../types';

export function filterLedgerByMonth(entries: LedgerEntry[], user: B2BUser, monthKey: string): LedgerEntry[] {
  const userEntries =
    user.role === 'ADMIN' ? entries : entries.filter((e) => e.userUid === user.uid);

  if (monthKey === 'ALL') return userEntries;
  return userEntries.filter((e) => e.createdAt.slice(0, 7) === monthKey);
}

export function getAvailableMonths(entries: LedgerEntry[], user: B2BUser): string[] {
  const userEntries =
    user.role === 'ADMIN' ? entries : entries.filter((e) => e.userUid === user.uid);
  const set = new Set<string>();
  const nowMonth = new Date().toISOString().slice(0, 7);
  set.add(nowMonth);
  userEntries.forEach((e) => {
    if (e.createdAt && e.createdAt.length >= 7) {
      set.add(e.createdAt.slice(0, 7));
    }
  });
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportStatementCsv(
  entries: LedgerEntry[],
  users: B2BUser[],
  activeUser: B2BUser,
  monthKey: string
) {
  const header = 'ID,Timestamp,Account,Reference,Type,Amount(INR),OpeningBalance(INR),ClosingBalance(INR),Remark\n';
  const rows = entries
    .map((e) => {
      const acc = users.find((u) => u.uid === e.userUid)?.name || e.userName || e.userUid;
      const ts = new Date(e.createdAt).toLocaleString('en-IN');
      return `${e.id},"${ts}","${acc}","${e.referenceId}",${e.txnType},${e.amount.toFixed(2)},${e.openingBalance.toFixed(2)},${e.closingBalance.toFixed(2)},"${e.remark.replace(/"/g, '""')}"`;
    })
    .join('\n');

  const csvContent = '\uFEFF' + header + rows;
  const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
  triggerDownload(blob, `krishna-recharge-statement-${activeUser.phone}-${monthKey}.csv`);
}

function escapePdfText(input: string): string {
  return input
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function padRight(str: string, len: number): string {
  const clean = str.length > len ? str.slice(0, len - 1) + '.' : str;
  return clean.padEnd(len, ' ');
}

function padLeft(str: string, len: number): string {
  const clean = str.length > len ? str.slice(0, len) : str;
  return clean.padStart(len, ' ');
}

export function exportStatementPdf(
  entries: LedgerEntry[],
  users: B2BUser[],
  activeUser: B2BUser,
  monthKey: string
) {
  const totalCredit = entries
    .filter((e) => e.txnType === 'CREDIT')
    .reduce((sum, e) => sum + e.amount, 0);
  const totalDebit = entries
    .filter((e) => e.txnType === 'DEBIT')
    .reduce((sum, e) => sum + e.amount, 0);

  const lines: string[] = [
    'KRISHNA RECHARGE - MONTHLY LEDGER STATEMENT',
    `Account: ${activeUser.name} (${activeUser.role}) | Shop: ${activeUser.shopName}`,
    `Phone: ${activeUser.phone} | Period: ${monthKey === 'ALL' ? 'All Available Months' : monthKey} | Generated: ${new Date().toISOString().slice(0, 10)}`,
    `Summary: Entries ${entries.length} | Credits INR ${totalCredit.toFixed(2)} | Debits INR ${totalDebit.toFixed(2)} | Balance INR ${activeUser.walletBalance.toFixed(2)}`,
    '-'.repeat(94),
    `${padRight('DATE', 11)} ${padRight('REF', 14)} ${padRight('TYPE', 7)} ${padLeft('AMOUNT', 11)} ${padLeft('CLOSING', 12)} ${padRight('REMARK', 34)}`,
    '-'.repeat(94),
  ];

  if (entries.length === 0) {
    lines.push('No ledger transactions recorded for the selected month.');
  } else {
    entries.forEach((e) => {
      const d = e.createdAt.slice(0, 10);
      const ref = e.referenceId || e.id;
      const amt = `${e.txnType === 'CREDIT' ? '+' : '-'}${e.amount.toFixed(2)}`;
      const close = e.closingBalance.toFixed(2);
      const acctSuffix =
        activeUser.role === 'ADMIN'
          ? ` [${users.find((u) => u.uid === e.userUid)?.name || e.userName}]`
          : '';
      const remark = `${e.remark}${acctSuffix}`;
      lines.push(
        `${padRight(d, 11)} ${padRight(ref, 14)} ${padRight(e.txnType, 7)} ${padLeft(amt, 11)} ${padLeft(close, 12)} ${padRight(remark, 34)}`
      );
    });
  }

  const linesPerPage = 46;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }

  const objects: string[] = [];
  const fontObjId = 3;
  const pageObjIds: number[] = [];

  let nextId = 4;
  const pageContentPairs = pages.map((pageLines) => {
    const contentId = nextId++;
    const pageId = nextId++;
    pageObjIds.push(pageId);
    return {pageLines, contentId, pageId};
  });

  objects[1] = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjIds.length} >>\nendobj\n`;
  objects[fontObjId] = '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n';

  pageContentPairs.forEach(({pageLines, contentId, pageId}, pageIndex) => {
    const textCommands = [
      'BT',
      '/F1 8.5 Tf',
      '36 800 Td',
      '14 TL',
      ...pageLines.map((line, idx) =>
        idx === 0 ? `(${escapePdfText(line)}) Tj` : `T* (${escapePdfText(line)}) Tj`
      ),
      `T* (Page ${pageIndex + 1} of ${pages.length}) Tj`,
      'ET',
    ].join('\n');

    objects[contentId] = `${contentId} 0 obj\n<< /Length ${textCommands.length} >>\nstream\n${textCommands}\nendstream\nendobj\n`;
    objects[pageId] = `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObjId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`;
  });

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let bytePos = 0;

  const pushStr = (s: string) => {
    const bytes = encoder.encode(s);
    chunks.push(bytes);
    bytePos += bytes.length;
  };

  pushStr('%PDF-1.4\n');
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = bytePos;
    pushStr(objects[id]);
  }

  const xrefPos = bytePos;
  pushStr(`xref\n0 ${objects.length}\n`);
  pushStr('0000000000 65535 f \n');
  for (let id = 1; id < objects.length; id++) {
    pushStr(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`);

  const blob = new Blob(chunks as BlobPart[], {type: 'application/pdf'});
  triggerDownload(blob, `krishna-recharge-statement-${activeUser.phone}-${monthKey}.pdf`);
}
