Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\sarwa\.gemini\antigravity\brain\9d98f042-d89d-4647-be56-0b50dcdda233\brand_logo_1791991493828.jpg"
if (-not (Test-Path $srcPath)) {
    Write-Error "Source image not found: $srcPath"
    exit 1
}

$srcBmp = [System.Drawing.Bitmap]::new($srcPath)
$w = $srcBmp.Width
$h = $srcBmp.Height

# Find bounding box of the emblem
$minX = $w; $maxX = 0; $minY = $h; $maxY = 0
for ($y = 0; $y -lt $h; $y += 2) {
    for ($x = 0; $x -lt $w; $x += 2) {
        $c = $srcBmp.GetPixel($x, $y)
        $lum = [Math]::Max($c.R, [Math]::Max($c.G, $c.B))
        if ($lum -gt 24) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

# Add small margin
$pad = 16
$cropX = [Math]::Max(0, $minX - $pad)
$cropY = [Math]::Max(0, $minY - $pad)
$cropW = [Math]::Min($w - $cropX, ($maxX - $minX) + ($pad * 2))
$cropH = [Math]::Min($h - $cropY, ($maxY - $minY) + ($pad * 2))

# Make it a square bounding box centered on emblem
$size = [Math]::Max($cropW, $cropH)
$centerX = $cropX + ($cropW / 2)
$centerY = $cropY + ($cropH / 2)
$squareX = [Math]::Max(0, [int]($centerX - ($size / 2)))
$squareY = [Math]::Max(0, [int]($centerY - ($size / 2)))
if ($squareX + $size -gt $w) { $size = $w - $squareX }
if ($squareY + $size -gt $h) { $size = $h - $squareY }

Write-Host "Emblem cropped box: $squareX, $squareY, size: $size"

# Generate 512x512 transparent PNG
$outSize = 512
$outBmp = New-Object System.Drawing.Bitmap $outSize, $outSize, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

for ($oy = 0; $oy -lt $outSize; $oy++) {
    $sy = [int]($squareY + ($oy / $outSize) * $size)
    if ($sy -ge $h) { $sy = $h - 1 }

    for ($ox = 0; $ox -lt $outSize; $ox++) {
        $sx = [int]($squareX + ($ox / $outSize) * $size)
        if ($sx -ge $w) { $sx = $w - 1 }

        $c = $srcBmp.GetPixel($sx, $sy)
        $lum = [Math]::Max($c.R, [Math]::Max($c.G, $c.B))

        if ($lum -le 16) {
            $outBmp.SetPixel($ox, $oy, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } elseif ($lum -lt 55) {
            $alpha = [int]((($lum - 16) / 39.0) * 255)
            $outBmp.SetPixel($ox, $oy, [System.Drawing.Color]::FromArgb($alpha, $c.R, $c.G, $c.B))
        } else {
            $outBmp.SetPixel($ox, $oy, [System.Drawing.Color]::FromArgb(255, $c.R, $c.G, $c.B))
        }
    }
}

$destLogo = "public\brand-logo.png"
$destFav = "public\favicon-emblem.png"

$outBmp.Save($destLogo, [System.Drawing.Imaging.ImageFormat]::Png)

# Also create high-res square favicon version
$favSize = 256
$favBmp = New-Object System.Drawing.Bitmap $outBmp, $favSize, $favSize
$favBmp.Save($destFav, [System.Drawing.Imaging.ImageFormat]::Png)

$srcBmp.Dispose()
$outBmp.Dispose()
$favBmp.Dispose()

Write-Host "Successfully processed and saved $destLogo and $destFav"
