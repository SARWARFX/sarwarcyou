#!/usr/bin/env python3
"""
Server-side file reorganization script for Hugging Face dataset SARWARFX/stream-vault.

Performs atomic server-side moves via CommitOperationCopy and CommitOperationDelete:
1. Under "Images/Bandhobis/":
   - "Images/Bandhobis/asha8.mp4" -> "Images/Bandhobis/Video Clips/asha8.mp4"
   - All other current files -> "Images/Bandhobis/Images/<original_filename>"
2. "Shorts/Screen_Recording_20260323-035012_Facebook.mp4" -> "Images/Bandhobis/Shorts/Screen_Recording_20260323-035012_Facebook.mp4"
   (and companion thumbnail if present).
"""

import argparse
import os
import sys
from huggingface_hub import HfApi, CommitOperationCopy, CommitOperationDelete, get_token

REPO_ID = "SARWARFX/stream-vault"
REPO_TYPE = "dataset"

def run_reorganization(token: str | None = None, dry_run: bool = False):
    effective_token = token or os.environ.get("HF_TOKEN") or get_token()

    api = HfApi(token=effective_token)
    print(f"Fetching repo file list for {REPO_ID} ({REPO_TYPE})...")
    files = api.list_repo_files(REPO_ID, repo_type=REPO_TYPE)
    print(f"Total files in repository: {len(files)}")

    # 1. Inspect files directly in "Images/Bandhobis/" (top-level only, ignoring already nested subdirs)
    bandhobis_prefix = "Images/Bandhobis/"
    bandhobis_files = [
        f for f in files
        if f.startswith(bandhobis_prefix)
        and "/" not in f[len(bandhobis_prefix):]  # direct children only
    ]

    print(f"\nFound {len(bandhobis_files)} direct file(s) in '{bandhobis_prefix}':")
    for f in bandhobis_files:
        print(f"  - {f}")

    moves: list[tuple[str, str]] = []

    for src_file in bandhobis_files:
        filename = src_file[len(bandhobis_prefix):]
        if filename == "asha8.mp4":
            dest_file = f"Images/Bandhobis/Video Clips/{filename}"
        elif filename == "asha8_thumb.jpg":
            # Also keep thumbnail aligned with asha8.mp4 in Video Clips, or in Images
            dest_file = f"Images/Bandhobis/Video Clips/{filename}"
        else:
            dest_file = f"Images/Bandhobis/Images/{filename}"
        moves.append((src_file, dest_file))

    # 2. Inspect target Shorts file
    target_short = "Shorts/Screen_Recording_20260323-035012_Facebook.mp4"
    if target_short in files:
        dest_short = "Images/Bandhobis/Shorts/Screen_Recording_20260323-035012_Facebook.mp4"
        moves.append((target_short, dest_short))
        print(f"\nFound target short: {target_short}")
    else:
        print(f"\nWARNING: '{target_short}' not found in repo (might have already been moved).")

    # Companion thumbnail for the short, if present
    target_short_thumb = "Shorts/Screen_Recording_20260323-035012_Facebook_thumb.jpg"
    if target_short_thumb in files:
        dest_short_thumb = "Images/Bandhobis/Shorts/Screen_Recording_20260323-035012_Facebook_thumb.jpg"
        moves.append((target_short_thumb, dest_short_thumb))
        print(f"Found target short thumbnail: {target_short_thumb}")

    print(f"\nTotal planned move operations: {len(moves)}")
    print("-" * 70)
    for src, dst in moves:
        print(f"  MOVE: {src} -> {dst}")
    print("-" * 70)

    # 3. Build atomic commit operations
    operations = []
    for src, dst in moves:
        operations.append(CommitOperationCopy(src_path_in_repo=src, path_in_repo=dst))
        operations.append(CommitOperationDelete(path_in_repo=src))

    if dry_run:
        print("\n[DRY RUN] No changes were committed. Planned operations count:", len(operations))
        return

    if not effective_token:
        print("\nERROR: No Hugging Face token found. A token with write access is required to commit to this repository.")
        print("Please provide it via --token <token> or set the HF_TOKEN environment variable.")
        sys.exit(1)

    print(f"\nExecuting atomic commit with {len(operations)} operations ({len(moves)} moves) on {REPO_ID}...")
    commit_info = api.create_commit(
        repo_id=REPO_ID,
        repo_type=REPO_TYPE,
        operations=operations,
        commit_message="refactor: reorganize Images/Bandhobis and Shorts into subfolders",
        commit_description="Atomic server-side file reorganization:\n- Moved asha8 video into Images/Bandhobis/Video Clips/\n- Moved Bandhobis photos into Images/Bandhobis/Images/\n- Moved Facebook short into Images/Bandhobis/Shorts/",
    )
    print("\nSUCCESS! Commit created successfully:")
    print("Commit URL:", getattr(commit_info, "commit_url", commit_info))

def main():
    parser = argparse.ArgumentParser(description="Reorganize Hugging Face dataset stream-vault files server-side.")
    parser.add_argument("--token", type=str, default=None, help="Hugging Face access token with write permission")
    parser.add_argument("--dry-run", action="store_true", help="Print planned operations without committing")
    args = parser.parse_args()

    run_reorganization(token=args.token, dry_run=args.dry_run)

if __name__ == "__main__":
    main()
