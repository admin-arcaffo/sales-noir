import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const year = parseInt(searchParams.get('year') || '', 10);
  const month = parseInt(searchParams.get('month') || '', 10);

  if (!token || !year || !month || month < 1 || month > 12) {
    return new NextResponse('Parâmetros inválidos', { status: 400 });
  }

  const org = await prisma.organization.findUnique({ where: { reportToken: token } });
  if (!org) {
    return new NextResponse('Token inválido', { status: 404 });
  }

  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59, 999);

  const deals = await prisma.closedDeal.findMany({
    where: {
      organizationId: org.id,
      closedAt: { gte: from, lte: to },
    },
    include: { contact: { select: { name: true } } },
    orderBy: { closedAt: 'asc' },
  });

  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  function computeFirstPaymentDate(closedAt: Date, day: number | null): Date {
    if (!day || day < 1) return closedAt;
    const candidate = new Date(closedAt.getFullYear(), closedAt.getMonth(), day);
    if (candidate > closedAt) return candidate;
    const next = new Date(closedAt.getFullYear(), closedAt.getMonth() + 1, day);
    if (next.getMonth() > (closedAt.getMonth() + 1) % 12) {
      return new Date(closedAt.getFullYear(), closedAt.getMonth() + 2, 0);
    }
    return next;
  }

  function computeFirstPaymentValue(totalValue: number, installmentCount: number | null, hasSignal: boolean, signalValue: number | null): number {
    if (hasSignal) return signalValue ?? 0;
    if (installmentCount && installmentCount > 0) return totalValue / installmentCount;
    return totalValue;
  }

  const fmtDate = (d: Date) => d.toLocaleDateString('pt-BR');

  const rows = deals.map((deal) => {
    const fpDate = deal.hasSignal ? deal.closedAt : computeFirstPaymentDate(deal.closedAt, deal.firstPaymentDate);
    const fpValue = computeFirstPaymentValue(deal.totalValue, deal.installmentCount, deal.hasSignal, deal.signalValue);
    return {
      Nome: deal.contact.name,
      'Valor total': Number(deal.totalValue.toFixed(2)),
      'Data 1o pagamento': fmtDate(fpDate),
      'Valor 1o pagamento': Number(fpValue.toFixed(2)),
      Sinal: deal.hasSignal ? Number((deal.signalValue || 0).toFixed(2)) : 0,
      'Total de parcelas': deal.installmentCount || 1,
      'Tempo de projeto': deal.projectDuration || '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 30 },
    { wch: 15 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
    { wch: 18 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Relatorio');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  const body = new Uint8Array(buf);

  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(year, month - 1));

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="relatorio-${monthName}-${year}.xlsx"`,
    },
  });
}
