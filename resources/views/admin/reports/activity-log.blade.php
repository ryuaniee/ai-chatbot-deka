<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Laporan Log Aktivitas Admin</title>
    <style>
        @page {
            size: A4 landscape;
            margin: 14mm;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            background: #f4f4f5;
            color: #000;
            font-family: Arial, Helvetica, sans-serif;
            line-height: 1.35;
        }

        .sheet {
            width: 297mm;
            min-height: 210mm;
            margin: 24px auto;
            padding: 16mm;
            background: #fff;
            box-shadow: 0 12px 32px rgba(15, 23, 42, 0.14);
        }

        .header {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 16px;
            border-bottom: 2px solid #000;
            padding-bottom: 12px;
        }

        h1 {
            margin: 0;
            font-size: 20px;
            text-transform: uppercase;
        }

        .subtitle {
            margin: 6px 0 0;
            font-size: 12px;
        }

        .meta {
            min-width: 230px;
            border: 1px solid #000;
            border-collapse: collapse;
            font-size: 11px;
        }

        .meta td {
            border: 1px solid #000;
            padding: 6px 8px;
        }

        .summary {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin: 16px 0;
        }

        .summary-card {
            border: 1px solid #000;
            padding: 10px;
        }

        .summary-card span {
            display: block;
            font-size: 10px;
            text-transform: uppercase;
        }

        .summary-card strong {
            display: block;
            margin-top: 6px;
            font-size: 20px;
        }

        table.report {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
        }

        .report th,
        .report td {
            border: 1px solid #000;
            padding: 6px;
            text-align: left;
            vertical-align: top;
        }

        .report th {
            background: #e6e6e6;
            text-align: center;
            text-transform: uppercase;
        }

        .number {
            text-align: center;
            white-space: nowrap;
        }

        .empty {
            padding: 18px;
            text-align: center;
        }

        .footer {
            display: grid;
            grid-template-columns: 1fr 180px;
            gap: 24px;
            margin-top: 24px;
            font-size: 11px;
        }

        .signature {
            text-align: center;
        }

        .signature-space {
            height: 54px;
        }

        @media print {
            body {
                background: #fff;
            }

            .sheet {
                width: auto;
                min-height: auto;
                margin: 0;
                padding: 0;
                box-shadow: none;
            }
        }
    </style>
</head>
<body>
    <main class="sheet">
        <header class="header">
            <div>
                <h1>Laporan Log Aktivitas Admin</h1>
                <p class="subtitle">Dashboard Admin Deka Chatbot</p>
            </div>
            <table class="meta">
                <tr>
                    <td>Periode</td>
                    <td>{{ $periodLabel }}</td>
                </tr>
                <tr>
                    <td>Pencarian</td>
                    <td>{{ $filters['search'] !== '' ? $filters['search'] : '-' }}</td>
                </tr>
                <tr>
                    <td>Dibuat</td>
                    <td>{{ $generatedAt }}</td>
                </tr>
            </table>
        </header>

        <section class="summary">
            <div class="summary-card">
                <span>Aktivitas Hari Ini</span>
                <strong>{{ number_format($totals['activityToday'] ?? 0, 0, ',', '.') }}</strong>
            </div>
            <div class="summary-card">
                <span>Aksi Feedback</span>
                <strong>{{ number_format($totals['conversationActions'] ?? 0, 0, ',', '.') }}</strong>
            </div>
            <div class="summary-card">
                <span>Export Laporan</span>
                <strong>{{ number_format($totals['reportExports'] ?? 0, 0, ',', '.') }}</strong>
            </div>
        </section>

        <table class="report">
            <thead>
                <tr>
                    <th style="width: 34px;">No</th>
                    <th style="width: 145px;">Admin</th>
                    <th style="width: 100px;">Kategori</th>
                    <th>Aktivitas</th>
                    <th style="width: 150px;">Target</th>
                    <th>Detail</th>
                    <th style="width: 95px;">IP</th>
                    <th style="width: 105px;">Waktu</th>
                </tr>
            </thead>
            <tbody>
                @forelse ($items as $item)
                    <tr>
                        <td class="number">{{ $loop->iteration }}</td>
                        <td>
                            <strong>{{ $item['admin'] }}</strong><br>
                            {{ $item['email'] }}
                        </td>
                        <td>{{ $item['category'] }}</td>
                        <td>{{ $item['action'] }}</td>
                        <td>{{ $item['target'] }}</td>
                        <td>{{ $item['detail'] }}</td>
                        <td>{{ $item['ipAddress'] }}</td>
                        <td>{{ $item['time'] }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="8" class="empty">Belum ada aktivitas admin yang tercatat.</td>
                    </tr>
                @endforelse
            </tbody>
        </table>

        <footer class="footer">
            <p>Dokumen ini dibuat otomatis dari dashboard admin Deka Chatbot.</p>
            <div class="signature">
                <p>Admin</p>
                <div class="signature-space"></div>
                <p>(________________)</p>
            </div>
        </footer>
    </main>
</body>
</html>
