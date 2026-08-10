import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sahabat Telur | Buku Keuangan Usaha',
    short_name: 'Sahabat Telur',
    description: 'Aplikasi pencatatan keuangan usaha perdagangan telur, rekap penjualan, operasional, dan tagihan piutang bakul.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      {
        src: '/icon.png',
        sizes: 'any',
        type: 'image/png',
      },
    ],
  }
}