# Generates synthetic e-wallet receipt images for testing receipt capture.
# Plain generic layout with GCash-style fields; no real logos or branding.
# Values must match SAMPLE_RECEIPTS in src/lib/seed.ts.
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot '..\public\samples'
New-Item -ItemType Directory -Force $out | Out-Null

$receipts = @(
  @{ file='receipt-1-matched-ref.png';     ref='1012 345 678901'; amt='4,385.50'; dt='Mar 14, 2025 10:22 AM'; type='Send Money'; to='KALAYAAN OFFICE SUPPLY';   mob='+63 917 123 4321'; note='Office supplies March' },
  @{ file='receipt-2-matched-amount.png';  ref='2023 456 789012'; amt='2,150.75'; dt='Jul 8, 2025 2:41 PM';   type='Send Money'; to='MABILIS COURIER SERVICES'; mob='+63 918 234 5678'; note='Courier fees' },
  @{ file='receipt-3-matched-ref.png';     ref='3045 678 912345'; amt='8,920.40'; dt='Oct 21, 2025 9:05 AM';  type='Pay Bills';  to='LIWANAG ELECTRIC COOP';    mob='+63 919 345 6789'; note='Electric bill Oct' },
  @{ file='receipt-4-amount-mismatch.png'; ref='5067 891 234567'; amt='6,480.00'; dt='Sep 3, 2025 4:18 PM';   type='Send Money'; to='DELA CRUZ PRINTING';       mob='+63 920 456 7890'; note='Brochure printing' },
  @{ file='receipt-5-duplicate-ref.png';   ref='1012 345 678901'; amt='4,385.50'; dt='Mar 14, 2025 10:22 AM'; type='Send Money'; to='KALAYAAN OFFICE SUPPLY';   mob='+63 917 123 4321'; note='Office supplies March' }
)

$peso = [char]0x20B1
foreach ($r in $receipts) {
  $bmp = New-Object System.Drawing.Bitmap 720, 1100
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear([System.Drawing.Color]::White)
  $head = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(30, 64, 120))
  $g.FillRectangle($head, 0, 0, 720, 120)
  $white = [System.Drawing.Brushes]::White
  $dark = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(20, 24, 32))
  $muted = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(90, 98, 112))
  $fTitle = New-Object System.Drawing.Font 'Segoe UI', 30, ([System.Drawing.FontStyle]::Bold)
  $fLabel = New-Object System.Drawing.Font 'Segoe UI', 20
  $fValue = New-Object System.Drawing.Font 'Segoe UI', 24, ([System.Drawing.FontStyle]::Bold)
  $fBig = New-Object System.Drawing.Font 'Segoe UI', 40, ([System.Drawing.FontStyle]::Bold)

  $g.DrawString('Payment Receipt', $fTitle, $white, 40, 35)
  $y = 160
  $g.DrawString($r.type, $fValue, $dark, 40, $y); $y += 70
  $g.DrawString('Sent to', $fLabel, $muted, 40, $y); $y += 38
  $g.DrawString($r.to, $fValue, $dark, 40, $y); $y += 45
  $g.DrawString($r.mob, $fLabel, $dark, 40, $y); $y += 65
  $g.DrawString('Sent by', $fLabel, $muted, 40, $y); $y += 38
  $g.DrawString('BAYANIHAN TRADING CORP', $fValue, $dark, 40, $y); $y += 75
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(220, 224, 230)), 2
  $g.DrawLine($pen, 40, $y, 680, $y); $y += 30
  $g.DrawString("Amount $peso$($r.amt)", $fValue, $dark, 40, $y); $y += 60
  $g.DrawString("Total Amount Sent $peso$($r.amt)", $fValue, $dark, 40, $y); $y += 75
  $g.DrawLine($pen, 40, $y, 680, $y); $y += 30
  $g.DrawString("Message $($r.note)", $fLabel, $dark, 40, $y); $y += 60
  $g.DrawString("Ref No. $($r.ref)", $fValue, $dark, 40, $y); $y += 50
  $g.DrawString($r.dt, $fLabel, $dark, 40, $y)

  $bmp.Save((Join-Path $out $r.file), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
Write-Output "Wrote $($receipts.Count) receipts to $out"
