import os
import sys
import json
import urllib.parse
import subprocess
from huggingface_hub import HfApi, list_repo_files, hf_hub_download

REPO_ID = "SARWARFX/stream-vault"
REPO_TYPE = "dataset"
HF_TOKEN = os.environ.get("HF_TOKEN")

if not HF_TOKEN:
    print("Error: HF_TOKEN environment variable is required.")
    sys.exit(1)

api = HfApi(token=HF_TOKEN)
LOCAL_THUMB_DIR = "./temp_thumbnails"
os.makedirs(LOCAL_THUMB_DIR, exist_ok=True)

def get_duration(url, token):
    quoted_path = urllib.parse.quote(url, safe=":/")
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1"
    ]
    if token:
        cmd.extend(["-headers", f"Authorization: Bearer {token}\r\n"])
    cmd.append(quoted_path)

    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        val = float(res.stdout.strip())
        return val if val > 0 else None
    except Exception:
        return None

def main():
    print(f"Fetching current file manifest from Hugging Face dataset: {REPO_ID}...")
    all_files = list_repo_files(repo_id=REPO_ID, repo_type=REPO_TYPE, token=HF_TOKEN)
    existing_files_set = set(all_files)

    video_files = [
        f for f in all_files 
        if f.lower().endswith(('.mp4', '.mov', '.webm', '.mkv', '.avi'))
        and not f.lower().startswith(('thumbnails/', '.thumbnails/'))
    ]

    print(f"Total video files in vault: {len(video_files)}")

    manifest = {}
    if "thumbnails.json" in existing_files_set:
        try:
            manifest_path = hf_hub_download(repo_id=REPO_ID, filename="thumbnails.json", repo_type=REPO_TYPE, token=HF_TOKEN)
            with open(manifest_path, "r", encoding="utf-8") as mf:
                manifest = json.load(mf)
            print(f"Loaded existing manifest with {len(manifest)} items from Hugging Face dataset.")
        except Exception as e:
            print(f"Note: Could not parse remote thumbnails.json: {e}")

    generated_count = 0

    for idx, v in enumerate(video_files, 1):
        base_name = os.path.splitext(v)[0]
        thumb_rel_path = f"Thumbnails/{base_name}.webp"
        dest_path = os.path.join(LOCAL_THUMB_DIR, thumb_rel_path)

        # Incremental check against Hugging Face dataset
        if thumb_rel_path in existing_files_set or os.path.exists(dest_path):
            manifest[v] = thumb_rel_path
            print(f"[{idx}/{len(video_files)}] [SKIP] Already on Hugging Face: {thumb_rel_path}")
            continue

        print(f"[{idx}/{len(video_files)}] [PROCESSING] Capturing 30% frame for: {v}")
        quoted_v = urllib.parse.quote(v, safe="/")
        video_url = f"https://huggingface.co/datasets/{REPO_ID}/resolve/main/{quoted_v}"

        duration = get_duration(video_url, HF_TOKEN)
        if not duration or duration <= 0:
            duration = 10.0

        seek_time = max(0.5, round(duration * 0.30, 2))
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)

        cmd = ["ffmpeg", "-y"]
        if HF_TOKEN:
            cmd.extend(["-headers", f"Authorization: Bearer {HF_TOKEN}\r\n"])
        cmd.extend([
            "-ss", str(seek_time),
            "-i", video_url,
            "-frames:v", "1",
            "-vf", "scale='min(640,iw)':-2",
            "-c:v", "libwebp",
            "-quality", "80",
            dest_path
        ])

        res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
        if res.returncode == 0 and os.path.exists(dest_path) and os.path.getsize(dest_path) > 0:
            generated_count += 1
            manifest[v] = thumb_rel_path
            print(f"  [SUCCESS] Generated WebP ({os.path.getsize(dest_path)} B) @ {seek_time}s: {thumb_rel_path}")
        else:
            print(f"  [Error] Capture failed for {v}: {res.stderr.strip()[:150]}")

    print(f"\nTotal new thumbnails generated: {generated_count}")

    # Save manifest directly to temporary directory for Hugging Face upload
    with open(os.path.join(LOCAL_THUMB_DIR, "thumbnails.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    if generated_count > 0:
        print(f"Directly uploading generated thumbnails and manifest to Hugging Face dataset {REPO_ID}...")
        api.upload_folder(
            folder_path=LOCAL_THUMB_DIR,
            repo_id=REPO_ID,
            repo_type=REPO_TYPE,
            commit_message=f"feat(thumbnails): upload {generated_count} single-frame 30% WebP thumbnails to Hugging Face dataset"
        )
        print("Upload complete!")

if __name__ == "__main__":
    main()
