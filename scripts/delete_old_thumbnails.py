import os
from huggingface_hub import HfApi

REPO_ID = "SARWARFX/stream-vault"
REPO_TYPE = "dataset"
HF_TOKEN = os.environ.get("HF_TOKEN")

api = HfApi(token=HF_TOKEN)
files = api.list_repo_files(repo_id=REPO_ID, repo_type=REPO_TYPE)
old_thumbs = [f for f in files if f.startswith("thumbnails/")]

print(f"Found {len(old_thumbs)} old thumbnail files to delete.")
for thumb_file in old_thumbs:
    api.delete_file(
        path_in_repo=thumb_file,
        repo_id=REPO_ID,
        repo_type=REPO_TYPE,
        commit_message=f"Delete old thumbnail {thumb_file}"
    )
print("Old thumbnails directory completely purged.")
