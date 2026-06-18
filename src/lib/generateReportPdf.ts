import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DashboardStats, ChartsData, Sapi, TransaksiKeuangan, Kesehatan, BeratBadan } from '@/src/types/index';

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

function createHeader(doc: jsPDF, title: string, userName: string): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, pageWidth, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`Laporan ${title}`, 14, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Dicetak oleh: ${userName}`, 14, 26);
  doc.text(`Tanggal: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 32);
  return 45;
}

function addFooter(doc: jsPDF, fileName: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `SIPETIK - ${fileName} | Halaman ${i} dari ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
  }
}

function addPageIfNeeded(doc: jsPDF, y: number, threshold = 250): number {
  if (y > threshold) {
    doc.addPage();
    return 15;
  }
  return y;
}

const tableStyles = {
  headStyles: { fillColor: [16, 185, 129] as [number, number, number], textColor: 255, fontStyle: 'bold' as const },
  styles: { fontSize: 9, cellPadding: 3 },
  alternateRowStyles: { fillColor: [245, 250, 248] as [number, number, number] },
};

export function generateReportPdf(
  stats: DashboardStats,
  chartsData: ChartsData,
  userName: string
) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = createHeader(doc, 'Peternakan SIPETIK', userName);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Ringkasan Statistik', 14, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Metrik', 'Nilai']],
    body: [
      ['Total Sapi', stats.totalSapi.toString()],
      ['Biaya Pakan (Bulan Ini)', formatCurrency(stats.totalFeedCostThisMonth)],
      ['Total Pengeluaran', formatCurrency(stats.totalExpenses)],
      ['Rerata ADG', `${stats.avgAdg} kg/hari`],
      ['Jadwal Kesehatan Pending', stats.activeReminders.toString()],
    ],
    theme: 'grid',
    ...tableStyles,
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  if (chartsData.growth.length > 0) {
    y = addPageIfNeeded(doc, y);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Tren Pertumbuhan Berat Rata-rata', 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Tanggal', 'Berat Rata-rata (kg)']],
      body: chartsData.growth.map(g => [g.name, g.weight.toString()]),
      theme: 'grid',
      ...tableStyles,
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  if (chartsData.feedWeekly.length > 0) {
    y = addPageIfNeeded(doc, y);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Biaya Pakan Mingguan', 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Periode', 'Biaya']],
      body: chartsData.feedWeekly.map(f => [f.name, formatCurrency(f.cost)]),
      theme: 'grid',
      ...tableStyles,
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  if (chartsData.healthReminders.length > 0) {
    y = addPageIfNeeded(doc, y);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Jadwal Kesehatan Pending', 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Tanggal', 'Jenis', 'Sapi', 'Catatan']],
      body: chartsData.healthReminders.map(h => [
        new Date(h.tanggal).toLocaleDateString('id-ID'),
        h.jenis,
        h.sapi?.nama_sapi || '-',
        h.catatan || '-',
      ]),
      theme: 'grid',
      ...tableStyles,
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  if (chartsData.topPerformers.length > 0) {
    y = addPageIfNeeded(doc, y);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Performa Pertumbuhan Sapi', 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Nama Sapi', 'Kode', 'ADG Harian']],
      body: chartsData.topPerformers.map(p => [p.name, p.id, p.weight]),
      theme: 'grid',
      ...tableStyles,
    });
  }

  addFooter(doc, 'Ringkasan Dashboard');
  doc.save(`laporan-dashboard-${new Date().toISOString().split('T')[0]}.pdf`);
}

export function generateKeuanganPdf(data: TransaksiKeuangan[], userName: string) {
  const doc = new jsPDF('p', 'mm', 'a4');
  let y = createHeader(doc, 'Keuangan', userName);

  const totalPemasukan = data.filter(d => d.tipe === 'pemasukan').reduce((s, d) => s + d.nominal, 0);
  const totalPengeluaran = data.filter(d => d.tipe === 'pengeluaran').reduce((s, d) => s + d.nominal, 0);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Ringkasan Keuangan', 14, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Metrik', 'Nilai']],
    body: [
      ['Total Pemasukan', formatCurrency(totalPemasukan)],
      ['Total Pengeluaran', formatCurrency(totalPengeluaran)],
      ['Saldo', formatCurrency(totalPemasukan - totalPengeluaran)],
      ['Total Transaksi', data.length.toString()],
    ],
    theme: 'grid',
    ...tableStyles,
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  if (data.length > 0) {
    y = addPageIfNeeded(doc, y);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Detail Transaksi', 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Tanggal', 'Tipe', 'Kategori', 'Nominal', 'Keterangan']],
      body: data.map(d => [
        new Date(d.tanggal).toLocaleDateString('id-ID'),
        d.tipe === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran',
        d.kategori,
        formatCurrency(d.nominal),
        d.keterangan || '-',
      ]),
      theme: 'grid',
      ...tableStyles,
    });
  }

  addFooter(doc, 'Laporan Keuangan');
  doc.save(`laporan-keuangan-${new Date().toISOString().split('T')[0]}.pdf`);
}

export function generateSapiPdf(data: Sapi[], userName: string) {
  const doc = new jsPDF('p', 'mm', 'a4');
  let y = createHeader(doc, 'Data Sapi', userName);

  const aktif = data.filter(d => d.status === 'aktif').length;
  const dijual = data.filter(d => d.status === 'dijual').length;
  const sakit = data.filter(d => d.status === 'sakit').length;

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Ringkasan Populasi', 14, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Status', 'Jumlah']],
    body: [
      ['Aktif', aktif.toString()],
      ['Dijual', dijual.toString()],
      ['Sakit', sakit.toString()],
      ['Total', data.length.toString()],
    ],
    theme: 'grid',
    ...tableStyles,
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  if (data.length > 0) {
    y = addPageIfNeeded(doc, y);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Daftar Sapi', 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Kode', 'Nama', 'Jenis', 'Kelamin', 'Berat Awal', 'Berat Sekarang', 'Status']],
      body: data.map(d => [
        d.kode_sapi,
        d.nama_sapi || '-',
        d.jenis_sapi || '-',
        d.jenis_kelamin || '-',
        d.berat_awal ? `${d.berat_awal} kg` : '-',
        d.berat_sekarang ? `${d.berat_sekarang} kg` : '-',
        d.status,
      ]),
      theme: 'grid',
      ...tableStyles,
    });
  }

  addFooter(doc, 'Laporan Data Sapi');
  doc.save(`laporan-sapi-${new Date().toISOString().split('T')[0]}.pdf`);
}

export function generateKesehatanPdf(
  data: (Kesehatan & { sapi: { nama_sapi: string; kode_sapi: string } | null })[],
  userName: string
) {
  const doc = new jsPDF('p', 'mm', 'a4');
  let y = createHeader(doc, 'Kesehatan', userName);

  const pending = data.filter(d => d.status === 'pending').length;
  const selesai = data.filter(d => d.status === 'selesai').length;

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Ringkasan Kesehatan', 14, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Status', 'Jumlah']],
    body: [
      ['Pending', pending.toString()],
      ['Selesai', selesai.toString()],
      ['Total', data.length.toString()],
    ],
    theme: 'grid',
    ...tableStyles,
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  if (data.length > 0) {
    y = addPageIfNeeded(doc, y);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Detail Kesehatan', 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Tanggal', 'Jenis', 'Sapi', 'Status', 'Catatan']],
      body: data.map(d => [
        new Date(d.tanggal).toLocaleDateString('id-ID'),
        d.jenis,
        d.sapi?.nama_sapi || '-',
        d.status === 'pending' ? 'Pending' : 'Selesai',
        d.catatan || '-',
      ]),
      theme: 'grid',
      ...tableStyles,
    });
  }

  addFooter(doc, 'Laporan Kesehatan');
  doc.save(`laporan-kesehatan-${new Date().toISOString().split('T')[0]}.pdf`);
}

export function generateBeratPdf(
  data: (BeratBadan & { sapi: { nama_sapi: string; kode_sapi: string } | null })[],
  userName: string
) {
  const doc = new jsPDF('p', 'mm', 'a4');
  let y = createHeader(doc, 'Berat Badan', userName);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Ringkasan Timbangan', 14, y);
  y += 8;

  const beratValues = data.map(d => d.berat);
  const avgBerat = beratValues.length > 0
    ? (beratValues.reduce((a, b) => a + b, 0) / beratValues.length).toFixed(1)
    : '0';
  const maxBerat = beratValues.length > 0 ? Math.max(...beratValues).toString() : '0';
  const minBerat = beratValues.length > 0 ? Math.min(...beratValues).toString() : '0';

  autoTable(doc, {
    startY: y,
    head: [['Metrik', 'Nilai']],
    body: [
      ['Total Record', data.length.toString()],
      ['Berat Rata-rata', `${avgBerat} kg`],
      ['Berat Tertinggi', `${maxBerat} kg`],
      ['Berat Terendah', `${minBerat} kg`],
    ],
    theme: 'grid',
    ...tableStyles,
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  if (data.length > 0) {
    y = addPageIfNeeded(doc, y);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Detail Timbangan', 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Tanggal', 'Sapi', 'Kode', 'Berat (kg)', 'Catatan']],
      body: data.map(d => [
        new Date(d.tanggal).toLocaleDateString('id-ID'),
        d.sapi?.nama_sapi || '-',
        d.sapi?.kode_sapi || '-',
        d.berat.toString(),
        d.catatan || '-',
      ]),
      theme: 'grid',
      ...tableStyles,
    });
  }

  addFooter(doc, 'Laporan Berat Badan');
  doc.save(`laporan-berat-${new Date().toISOString().split('T')[0]}.pdf`);
}
