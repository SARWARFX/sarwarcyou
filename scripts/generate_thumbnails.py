import os
import sys
import json
import subprocess
from huggingface_hub import HfApi, hf_hub_download

REPO_ID = "SARWARFX/stream-vault"
REPO_TYPE = "dataset"
HF_TOKEN = os.environ.get("HF_TOKEN")

if not HF_TOKEN:
    print("Error: HF_TOKEN environment variable is missing.")
    sys.exit(1)

api = HfApi(token=HF_TOKEN)

def get_video_duration(file_path):
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        file_path
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        return float(result.stdout.strip())
    except Exception:
        return 0.0

def generate_5_thumbnails(video_path, output_prefix):
    duration = get_video_duration(video_path)
    if duration <= 0:
        print(f"Skipping {video_path}: unable to determine duration.")
        return []

    # 5 intervals across the video: 20%, 40%, 60%, 80%, 95%
    percentages = [0.20, 0.40, 0.60, 0.80, 0.95]
    generated_files = []

    for idx, pct in enumerate(percentages, start=1):
        timestamp = max(0.5, duration * pct)
        out_name = f"{output_prefix}_thumb_{idx}.jpg"
        
        cmd = [
            "ffmpeg", "-y",
            "-ss", f"{timestamp:.2f}",
            "-i", video_path,
            "-frames:v", "1",
            "-q:v", "3",
            "-vf", "scale='min(720,iw)':-2",
            out_name
        ]
        res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        if res.returncode == 0 and os.path.exists(out_name):
            generated_files.append(out_name)
    return generated_files

def main():
    print("Fetching repository tree...")
    files = api.list_repo_files(repo_id=REPO_ID, repo_type=REPO_TYPE)
    video_exts = ('.mp4', '.mov', '.webm', '.mkv')
    videos = [f for f in files if f.lower().endswith(video_exts) and not f.startswith("thumbnails/")]

    print(f"Found {len(videos)} videos in stream-vault.")

    os.makedirs("temp_videos", exist_ok=True)
    os.makedirs("generated_thumbs", exist_ok=True)

    for i, video_rel_path in enumerate(videos, 1):
        base_name = os.path.splitext(os.path.basename(video_rel_path))[0]
        print(f"[{i}/{len(videos)}] Processing: {video_rel_path}")

        # Download video
        local_video = hf_hub_download(repo_id=REPO_ID, repo_type=REPO_TYPE, filename=video_rel_path, token=HF_TOKEN, local_dir="temp_videos")
        
        out_prefix = os.path.join("generated_thumbs", base_name)
        thumbs = generate_5_thumbnails(local_video, out_prefix)

        # Upload each generated frame to Hugging Face under thumbnails/<video_name>/
        for thumb_path in thumbs:
            remote_thumb_path = f"thumbnails/{base_name}/{os.path.basename(thumb_path)}"
            api.upload_file(
                path_or_fileobj=thumb_path,
                path_in_repo=remote_thumb_path,
                repo_id=REPO_ID,
                repo_type=REPO_TYPE,
                commit_message=f"Add 5-frame thumb: {os.path.basename(thumb_path)}"
            )
            os.remove(thumb_path)

        if os.path.exists(local_video):
            os.remove(local_video)

    print("All 5-frame thumbnails generated and pushed successfully.")

if __name__ == "__main__":
    main()
