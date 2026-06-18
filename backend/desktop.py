"""Desktop entry point: starts FastAPI in a background thread then opens a pywebview window."""
import threading
import time
import uvicorn
import webview
from main import app

PORT = 8765


def _run_server():
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")


if __name__ == "__main__":
    t = threading.Thread(target=_run_server, daemon=True)
    t.start()
    time.sleep(0.8)
    webview.create_window("Scraper", f"http://127.0.0.1:{PORT}", width=1100, height=740)
    webview.start()
