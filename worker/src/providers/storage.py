import os
import shutil
from abc import ABC, abstractmethod

class StorageProvider(ABC):
    @abstractmethod
    def download_file(self, s3_key: str, local_path: str) -> bool:
        pass

    @abstractmethod
    def upload_file(self, local_path: str, s3_key: str, content_type: str = "application/octet-stream") -> bool:
        pass

class LocalFileSystemProvider(StorageProvider):
    def __init__(self):
        # Resolve path safely relative to repository root regardless of current working directory
        current_file_dir = os.path.dirname(os.path.abspath(__file__))
        root_dir = os.path.abspath(os.path.join(current_file_dir, "..", "..", ".."))
        self.base_dir = os.path.join(root_dir, "local_storage")
    
    def download_file(self, s3_key: str, local_path: str) -> bool:
        # Prevent path traversal
        clean_key = os.path.normpath(s3_key).lstrip("/\\")
        base_dir_abs = os.path.abspath(self.base_dir)
        source_path = os.path.realpath(os.path.join(base_dir_abs, clean_key))
        
        # Enforce canonical path boundary
        if not source_path.startswith(base_dir_abs + os.sep):
            print("[Storage] Path traversal attempt blocked: invalid key sequence")
            return False
        
        if not os.path.exists(source_path) or not os.path.isfile(source_path):
            print(f"[Storage] File not found at: {source_path}")
            return False
        
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        shutil.copy2(source_path, local_path)
        print(f"[Storage] Successfully retrieved {clean_key} -> {local_path}")
        return True

    def upload_file(self, local_path: str, s3_key: str, content_type: str = "application/octet-stream") -> bool:
        clean_key = os.path.normpath(s3_key).lstrip("/\\")
        destination = os.path.realpath(os.path.join(self.base_dir, clean_key))
        if not destination.startswith(os.path.abspath(self.base_dir) + os.sep) or not os.path.isfile(local_path):
            return False
        os.makedirs(os.path.dirname(destination), exist_ok=True)
        shutil.copy2(local_path, destination)
        return True

class S3StorageProvider(StorageProvider):
    def __init__(self):
        import boto3
        self.bucket = os.environ.get("AWS_S3_BUCKET", "").strip()
        if not self.bucket:
            raise RuntimeError("AWS_S3_BUCKET is required when STORAGE_DRIVER=s3")
        self.client = boto3.client("s3", region_name=os.environ.get("AWS_REGION") or None)

    def download_file(self, s3_key: str, local_path: str) -> bool:
        try:
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            self.client.download_file(self.bucket, s3_key, local_path)
            return True
        except Exception as err:
            print(f"[Storage] S3 download failed ({type(err).__name__})")
            return False

    def upload_file(self, local_path: str, s3_key: str, content_type: str = "application/octet-stream") -> bool:
        try:
            self.client.upload_file(local_path, self.bucket, s3_key, ExtraArgs={"ContentType": content_type})
            return True
        except Exception as err:
            print(f"[Storage] S3 upload failed ({type(err).__name__})")
            return False

def get_storage_provider() -> StorageProvider:
    driver = os.environ.get('STORAGE_DRIVER', 'local')
    if driver == 's3':
        return S3StorageProvider()
    return LocalFileSystemProvider()
