from src.providers.storage import LocalFileSystemProvider


def test_download_file_blocks_path_traversal(tmp_path):
    provider = LocalFileSystemProvider()
    provider.base_dir = str(tmp_path)

    result = provider.download_file("../../etc/passwd", str(tmp_path / "out.pdf"))

    assert result is False


def test_download_file_blocks_absolute_path_escape(tmp_path):
    provider = LocalFileSystemProvider()
    provider.base_dir = str(tmp_path / "sandbox")

    result = provider.download_file("/etc/passwd", str(tmp_path / "out.pdf"))

    assert result is False


def test_download_file_succeeds_for_valid_key(tmp_path):
    provider = LocalFileSystemProvider()
    provider.base_dir = str(tmp_path)

    src_dir = tmp_path / "uploads"
    src_dir.mkdir()
    src_file = src_dir / "doc.pdf"
    src_file.write_bytes(b"%PDF-1.4 fake content")

    dest = tmp_path / "downloaded" / "doc.pdf"
    result = provider.download_file("uploads/doc.pdf", str(dest))

    assert result is True
    assert dest.read_bytes() == b"%PDF-1.4 fake content"
