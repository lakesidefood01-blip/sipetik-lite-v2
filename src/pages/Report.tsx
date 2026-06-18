import { useState } from 'react';
import { useAppStore } from '@/src/store/useAppStore';
import { supabase } from '@/src/lib/supabase';
import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { 
  Download, 
  Wallet, 
  Beef, 
  HeartPulse, 
  Scale,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import {
  generateKeuanganPdf,
  generateSapiPdf,
  generateKesehatanPdf,
  generateBeratPdf,
} from '@/src/lib/generateReportPdf';
import type { Sapi, TransaksiKeuangan, Kesehatan, BeratBadan } from '@/src/types';

type ReportType = 'keuangan' | 'sapi' | 'kesehatan' | 'berat';

const reportOptions = [
  {
    type: 'keuangan' as ReportType,
    title: 'Laporan Keuangan',
    description: 'Ringkasan pemasukan, pengeluaran, dan saldo peternakan.',
    icon: Wallet,
    color: 'bg-emerald-600',
  },
  {
    type: 'sapi' as ReportType,
    title: 'Laporan Data Sapi',
    description: 'Daftar lengkap data sapi, status, dan informasi pembelian.',
    icon: Beef,
    color: 'bg-blue-600',
  },
  {
    type: 'kesehatan' as ReportType,
    title: 'Laporan Kesehatan',
    description: 'Riwayat dan jadwal vaksin, vitamin, serta pengobatan.',
    icon: HeartPulse,
    color: 'bg-rose-500',
  },
  {
    type: 'berat' as ReportType,
    title: 'Laporan Berat Badan',
    description: 'Data timbangan dan tren pertumbuhan berat sapi.',
    icon: Scale,
    color: 'bg-indigo-600',
  },
];

export default function Report() {
  const { user, profile } = useAppStore();
  const [loadingType, setLoadingType] = useState<ReportType | null>(null);

  const displayName = profile?.full_name || user?.email?.split('@')?.[0] || 'User';

  const handleGenerate = async (type: ReportType) => {
    if (!user) return;
    setLoadingType(type);
    toast.info(`Membuat laporan ${type}...`);

    try {
      if (type === 'keuangan') {
        const { data } = await supabase
          .from('transaksi_keuangan')
          .select('*')
          .eq('user_id', user.id)
          .order('tanggal', { ascending: false });
        generateKeuanganPdf((data as TransaksiKeuangan[]) || [], displayName);
      }

      if (type === 'sapi') {
        const { data } = await supabase
          .from('sapi')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        generateSapiPdf((data as Sapi[]) || [], displayName);
      }

      if (type === 'kesehatan') {
        const { data } = await supabase
          .from('kesehatan')
          .select('*, sapi(nama_sapi, kode_sapi)')
          .order('tanggal', { ascending: false });
        generateKesehatanPdf((data as (Kesehatan & { sapi: { nama_sapi: string; kode_sapi: string } | null })[]) || [], displayName);
      }

      if (type === 'berat') {
        const { data } = await supabase
          .from('berat_badan')
          .select('*, sapi(nama_sapi, kode_sapi)')
          .order('tanggal', { ascending: false });
        generateBeratPdf((data as (BeratBadan & { sapi: { nama_sapi: string; kode_sapi: string } | null })[]) || [], displayName);
      }

      toast.success(`Laporan ${type} berhasil diunduh!`);
    } catch (err) {
      console.error(err);
      toast.error('Gagal membuat laporan. Coba lagi.');
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Laporan</h1>
        <p className="text-muted-foreground">Pilih jenis laporan yang ingin dicetak ke PDF.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {reportOptions.map((opt) => (
          <Card key={opt.type} className="overflow-hidden border-none shadow-sm hover:shadow-md transition-shadow bg-card">
            <CardContent className="p-0">
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-4 p-6 pb-0">
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${opt.color}`}>
                    <opt.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{opt.title}</h3>
                    <p className="text-sm text-muted-foreground">{opt.description}</p>
                  </div>
                </div>
                <div className="p-6 pt-4">
                  <Button
                    onClick={() => handleGenerate(opt.type)}
                    disabled={loadingType !== null}
                    variant="outline"
                    className="w-full gap-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                  >
                    {loadingType === opt.type ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Membuat...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Cetak PDF
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
