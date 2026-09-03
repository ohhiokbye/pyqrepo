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
        clean_key = s3_key.lstrip('/')
        source_path = os.path.join(self.base_dir, clean_key)
        
        if not os.path.exists(source_path):
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
