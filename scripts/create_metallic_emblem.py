import zlib
import struct
import math

def make_png(width, height, rgba_data):
    """Create a valid PNG file from RGBA byte buffer using pure Python stdlib."""
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))

    raw_lines = bytearray()
    for y in range(height):
        raw_lines.append(0)  # filter type 0 (None)
        start = y * width * 4
        raw_lines.extend(rgba_data[start:start + width * 4])

    idat = chunk(b'IDAT', zlib.compress(bytes(raw_lines), 9))
    iend = chunk(b'IEND', b'')
    return header + ihdr + idat + iend

def render_metallic_emblem(size=512):
    buffer = bytearray(size * size * 4)
    cx, cy = size / 2.0, size / 2.0
    r_outer = size * 0.44
    r_inner = size * 0.25

    for y in range(size):
        for x in range(size):
            dx = x - cx
            dy = y - cy
            dist = math.sqrt(dx * dx + dy * dy)
            angle = math.atan2(dy, dx) # -pi to pi

            # Design: Stylized futuristic open circular/hexagonal metallic emblem (faceted 'C' / iris)
            # Opening on right side: angle between -0.42 and 0.42 radians
            in_ring = r_inner <= dist <= r_outer
            in_opening = -0.40 < angle < 0.40

            # Chamfered facet cuts
            facet = math.sin(angle * 6.0) * 0.5 + 0.5
            dist_norm = (dist - r_inner) / (r_outer - r_inner) if in_ring else 0

            pixel_idx = (y * size + x) * 4

            if in_ring and not in_opening:
                # Edge antialiasing
                edge_outer = min(1.0, max(0.0, (r_outer - dist) * 1.5))
                edge_inner = min(1.0, max(0.0, (dist - r_inner) * 1.5))
                edge_angle = min(1.0, max(0.0, (abs(angle) - 0.40) * 15.0))
                alpha_factor = edge_outer * edge_inner * edge_angle

                # Metallic chrome lighting calculation
                # Light coming from top-left (-1, -1)
                lx, ly = -0.6, -0.8
                nx = dx / dist
                ny = dy / dist
                # Specular chrome sweep
                spec = max(0.0, -(nx * lx + ny * ly))
                chrome_sweep = (math.sin(angle * 2.5 + dist_norm * 3.0) + 1.0) * 0.5

                # Bevel profile (curved metallic crest)
                bevel = math.sin(dist_norm * math.pi)

                # Color: Vibrant luxury violet-indigo metallic base with silver-cyan highlights
                # Violet: rgb(168, 85, 247) -> Indigo: rgb(99, 102, 241) -> Cyan/Silver crest: rgb(240, 245, 255)
                base_r = int(140 + 70 * chrome_sweep + 45 * bevel)
                base_g = int(75 + 85 * chrome_sweep + 75 * spec)
                base_b = int(230 + 25 * chrome_sweep + 25 * bevel)

                # Specular sheen on top crest
                if bevel > 0.7:
                    highlight = (bevel - 0.7) / 0.3
                    base_r = int(base_r * (1 - highlight) + 255 * highlight)
                    base_g = int(base_g * (1 - highlight) + 245 * highlight)
                    base_b = int(base_b * (1 - highlight) + 255 * highlight)

                buffer[pixel_idx] = min(255, max(0, base_r))
                buffer[pixel_idx + 1] = min(255, max(0, base_g))
                buffer[pixel_idx + 2] = min(255, max(0, base_b))
                buffer[pixel_idx + 3] = int(255 * alpha_factor)

            # Central futuristic core: glowing metallic prism diamond
            core_dist = abs(dx) + abs(dy)
            if core_dist < size * 0.14:
                c_norm = core_dist / (size * 0.14)
                core_alpha = min(1.0, max(0.0, (1.0 - c_norm) * 2.0))
                core_light = math.sin(math.atan2(dy, dx) * 4.0) * 0.3 + 0.7

                cr = int(180 * core_light)
                cg = int(100 * core_light)
                cb = int(255 * core_light)

                if buffer[pixel_idx + 3] == 0:
                    buffer[pixel_idx] = cr
                    buffer[pixel_idx + 1] = cg
                    buffer[pixel_idx + 2] = cb
                    buffer[pixel_idx + 3] = int(255 * core_alpha)

    return make_png(size, size, buffer)

if __name__ == '__main__':
    import os
    png_data = render_metallic_emblem(512)
    os.makedirs('public', exist_ok=True)
    with open('public/brand-logo.png', 'wb') as f:
        f.write(png_data)
    with open('public/favicon-emblem.png', 'wb') as f:
        f.write(png_data)
    print("Successfully generated public/brand-logo.png and public/favicon-emblem.png")
