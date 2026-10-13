#!/usr/bin/env python3
"""
generate_thumbnails.py
Automated multi-frame video thumbnail generator for SARWARFX/stream-vault.
Scans the dataset for videos, extracts up to 5 WebP frames via ffmpeg,
and uploads them to .thumbnails/{album}/{video_name}/ in Hugging Face.
"""

import os
import sys
import subprocess
import tempfile
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from huggingface_hub import HfApi, HfFileSystem

DATASET_REPO = "SARWARFX/stream-vault"
VIDEO_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm"}
TIMESTAMPS = [5, 35, 65, 95, 125]  # in seconds


def get_video_duration(video_url: str, token: str | None = None) -> float | None:
    """Probe video duration in seconds via ffprobe using HTTP range requests."""
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
    ]
    if token:
        cmd.extend(["-headers", f"Authorization: Bearer {token}\r\n"])
    cmd.append(video_url)

    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=25)
        if res.returncode == 0 and res.stdout.strip():
            return float(res.stdout.strip())
    except Exception:
        pass
    return None


def extract_frames_for_video(
    video_path: str,
    output_dir: Path,
    token: str | None = None
) -> int:
    """
    Extract up to 5 .webp frames from a Hugging Face video using ffmpeg.
    Saves to output_dir/thumb_{0..4}.webp.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    
    encoded_path = urllib.parse.quote(video_path)
    video_url = f"https://huggingface.co/datasets/{DATASET_REPO}/resolve/main/{encoded_path}"

    duration = get_video_duration(video_url, token)

    # Determine probe timestamps
    if duration and duration > 0:
        if duration <= 6.0:
            # Very short clip: sample densely across available duration
            timestamps = [round(duration * (i + 1) / 6.0, 2) for i in range(5)]
        elif duration < 130.0:
            # Proportional distribution across the duration
            timestamps = [round(min(t, duration - 0.5), 2) for t in TIMESTAMPS]
            # Ensure strictly increasing
            timestamps = sorted(list(set(timestamps)))
            while len(timestamps) < 5 and duration > 1.0:
                step = duration / 6.0
                timestamps = [round(step * (i + 1), 2) for i in range(5)]
        else:
            timestamps = TIMESTAMPS
    else:
        timestamps = TIMESTAMPS

    extracted_count = 0

    for idx, ts in enumerate(timestamps):
        out_file = output_dir / f"thumb_{idx}.webp"
        if out_file.exists() and out_file.stat().st_size > 0:
            extracted_count += 1
            continue

        cmd = ["ffmpeg", "-y"]
        if token:
            cmd.extend(["-headers", f"Authorization: Bearer {token}\r\n"])
        cmd.extend([
            "-ss", str(ts),
            "-i", video_url,
            "-frames:v", "1",
            "-vf", "scale=640:-1",
            "-c:v", "libwebp",
            "-quality", "75",
            str(out_file)
        ])

        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=35)
            if res.returncode == 0 and out_file.exists() and out_file.stat().st_size > 0:
                extracted_count += 1
            else:
                # If seeking past end failed, try an earlier safe fallback timestamp
                if idx == 0:
                    fallback_cmd = ["ffmpeg", "-y"]
                    if token:
                        fallback_cmd.extend(["-headers", f"Authorization: Bearer {token}\r\n"])
                    fallback_cmd.extend([
                        "-ss", "0.5",
                        "-i", video_url,
                        "-frames:v", "1",
                        "-vf", "scale=640:-1",
                        "-c:v", "libwebp",
                        "-quality", "75",
                        str(out_file)
                    ])
                    fallback_res = subprocess.run(fallback_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=35)
                    if fallback_res.returncode == 0 and out_file.exists() and out_file.stat().st_size > 0:
                        extracted_count += 1
        except Exception as e:
            print(f"  [!] Frame extraction error for {video_path} at {ts}s: {e}")

    return extracted_count


def main():
    token = os.environ.get("HF_TOKEN")
    if not token:
        print("[!] HF_TOKEN environment variable not set. Checking read-only mode...")

    api = HfApi(token=token)
    fs = HfFileSystem(token=token)

    print(f"[*] Scanning Hugging Face repository: datasets/{DATASET_REPO}...")
    try:
        # Use HfFileSystem to list all items recursively
        raw_items = fs.glob(f"datasets/{DATASET_REPO}/**")
    except Exception as e:
        print(f"[!] HfFileSystem glob failed ({e}), falling back to HfApi tree list...")
        tree = api.list_repo_tree(repo_id=DATASET_REPO, repo_type="dataset", recursive=True)
        raw_items = [f"datasets/{DATASET_REPO}/{item.path}" for item in tree]

    prefix = f"datasets/{DATASET_REPO}/"
    all_files = []
    existing_thumbs = set()

    for item in raw_items:
        clean_path = item[len(prefix):] if item.startswith(prefix) else item
        clean_path = clean_path.lstrip("/")
        
        if ".thumbnails/" in clean_path:
            existing_thumbs.add(clean_path)
        else:
            ext = os.path.splitext(clean_path)[1].lower()
            if ext in VIDEO_EXTENSIONS:
                all_files.append(clean_path)

    print(f"[*] Found {len(all_files)} total video files in repository.")
    print(f"[*] Found {len(existing_thumbs)} existing thumbnail assets.")

    # Identify videos needing thumbnails
    pending_videos = []
    for vpath in all_files:
        parent_dir = os.path.dirname(vpath)
        base_name = os.path.basename(vpath)
        stem = os.path.splitext(base_name)[0]
        
        thumb_dir = f".thumbnails/{parent_dir}/{stem}" if parent_dir else f".thumbnails/{stem}"
        # A video is considered complete if thumb_0.webp exists
        first_thumb = f"{thumb_dir}/thumb_0.webp"
        
        if first_thumb not in existing_thumbs:
            pending_videos.append((vpath, thumb_dir))

    print(f"[*] Pending videos requiring thumbnail extraction: {len(pending_videos)}")

    if not pending_videos:
        print("[+] All video thumbnails are up-to-date! No action required.")
        return

    with tempfile.TemporaryDirectory(prefix="hf_thumbs_") as temp_dir:
        temp_path = Path(temp_dir)
        generated_count = 0

        print(f"[*] Extracting multi-frame WebP thumbnails using worker pool (temp: {temp_path})...")

        def process_entry(entry):
            video_path, rel_thumb_dir = entry
            # Destination path inside temp folder
            target_subfolder = rel_thumb_dir[len(".thumbnails/"):].lstrip("/")
            local_target_dir = temp_path / target_subfolder
            num_frames = extract_frames_for_video(video_path, local_target_dir, token)
            return video_path, num_frames

        # Limit concurrent ffmpeg jobs to avoid network or CPU thrashing
        max_workers = min(6, os.cpu_count() or 4)
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_video = {executor.submit(process_entry, entry): entry for entry in pending_videos}
            for idx, future in enumerate(as_completed(future_to_video), start=1):
                video_path, frames = future.result()
                if frames > 0:
                    generated_count += 1
                print(f"  [{idx}/{len(pending_videos)}] {video_path} -> {frames} frames extracted")

        print(f"[+] Total videos processed with thumbnails: {generated_count}/{len(pending_videos)}")

        if generated_count > 0:
            if not token:
                print("[!] HF_TOKEN not set, skipping upload step.")
                sys.exit(1)

            print(f"[*] Uploading generated thumbnails to datasets/{DATASET_REPO}/.thumbnails/...")
            api.upload_folder(
                folder_path=str(temp_path),
                path_in_repo=".thumbnails",
                repo_id=DATASET_REPO,
                repo_type="dataset",
                commit_message=f"feat(thumbnails): auto-generate multi-frame webp thumbnails [{generated_count} videos]",
            )
            print("[+] Successfully uploaded all thumbnails to Hugging Face CDN!")
        else:
            print("[!] No new frames generated to upload.")


if __name__ == "__main__":
    main()
