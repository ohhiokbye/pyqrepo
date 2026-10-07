# Historical GPU notes

The current worker uses cloud extraction; do not follow these installation steps for the lightweight setup. See [current setup](LIGHTWEIGHT-SETUP.md).

# GPU setup for the inspected PC

Host verification succeeded: Arch Linux, NVIDIA GeForce RTX 3050 Laptop GPU, 4096 MiB VRAM, driver 615.71.09. The sandbox failed to see NVIDIA devices; the host driver is working. Do not reinstall the driver to fix the sandbox.

Use your normal terminal in `/home/arpit/CPYQ`. The existing worker virtual environment uses Python 3.12. For this driver, Paddle's documented 3.2.0 CUDA 12.6 wheel is a compatible starting point (minimum Linux driver 550.54.14). See [official installation instructions](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/paddlepaddle_installation.en.md). Pin/test this pair before upgrading either package.

```
uv pip install --python worker/venv/bin/python torch --index https://download.pytorch.org/whl/cpu
uv pip install --python worker/venv/bin/python paddlepaddle-gpu==3.2.0 --index https://www.paddlepaddle.org.cn/packages/stable/cu126/
uv pip install --python worker/venv/bin/python -r worker/requirements.txt
worker/venv/bin/python -c "import paddle; print(paddle.__version__); print('CUDA:', paddle.is_compiled_with_cuda()); print('GPUs:', paddle.device.cuda.device_count()); paddle.utils.run_check()"
```

The first command installs CPU PyTorch intentionally: OCR runs on GPU while embedding inference starts on CPU to leave the 4 GB VRAM for OCR. Do not install both `paddlepaddle` and `paddlepaddle-gpu` in this environment. The commands above have been documented, not completed here.

In `worker/.env`, set `OCR_PROVIDER=paddle`, `OCR_DEVICE=gpu:0`, `EMBEDDING_DEVICE=cpu`, and `EMBEDDING_BATCH_SIZE=16`. The provider explicitly selects mobile detection and English recognition and uses incremental GPU allocation. It enables document orientation, unwarping and text-line orientation. Use one worker process and process papers serially initially. These settings need an actual scan benchmark to confirm peak VRAM and quality.

The existing root/frontend environment files still select Tesseract, so the worker override matters. Configure the worker API/S3 secrets separately as described in [v1 launch](V1-LAUNCH.md).

After installation, run `worker/venv/bin/uvicorn src.main:app --app-dir worker --host 127.0.0.1 --port 8000`. GPU jobs must run with host GPU access, not inside the current restricted sandbox. No public worker port is necessary.

Final acceptance is a real batch of camera scans, 90/180-degree rotated pages and skewed pages: verify pages report `provider=paddleocr`, crops align with corrected images, published questions/marks match the PDFs, low-quality results remain private, and `nvidia-smi` shows worker utilization without memory exhaustion. Then compare runtime and failure rate against the fallback on the same batch.
