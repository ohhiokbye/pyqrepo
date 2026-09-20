import os
import shutil
from abc import ABC, abstractmethod

class StorageProvider(ABC):
    @abstractmethod
    def download_file(self, s3_key: str, local_path: str) -> bool:
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
        source_path = os.path.abspath(os.path.join(base_dir_abs, clean_key))
        
        # Enforce canonical path boundary
        if not source_path.startswith(base_dir_abs + os.sep):
            print(f"[Storage] Path traversal attempt blocked: {s3_key}")
            return False
        
        if not os.path.exists(source_path) or not os.path.isfile(source_path):
            print(f"[Storage] File not found at: {source_path}")
            return False
        
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        shutil.copy2(source_path, local_path)
        print(f"[Storage] Successfully retrieved {clean_key} -> {local_path}")
        return True

class S3StorageProvider(StorageProvider):
    def download_file(self, s3_key: str, local_path: str) -> bool:
        raise NotImplementedError("S3 provider not implemented yet.")

def get_storage_provider() -> StorageProvider:
    driver = os.environ.get('STORAGE_DRIVER', 'local')
    if driver == 's3':
        return S3StorageProvider()
    return LocalFileSystemProvider()
