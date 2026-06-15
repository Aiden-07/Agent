import http.server
import socketserver
import os
import sys

PORT = int(os.environ.get("PORT", 8000))
if getattr(sys, 'frozen', False):
    # If the application is run as a bundle, the PyInstaller bootloader
    # extends the sys module by a flag frozen=True and sets the app 
    # path into variable _MEIPASS'.
    # However, for serving static files relative to the executable (external assets),
    # we should use sys.executable directory.
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

class SimpleHandler(http.server.SimpleHTTPRequestHandler):
    def guess_type(self, path):
        ctype = super().guess_type(path)
        if not ctype:
            return ctype
        if 'charset=' in ctype:
            return ctype
        if ctype.startswith('text/') or ctype in ('application/javascript', 'application/json', 'application/xml', 'image/svg+xml'):
            return f'{ctype}; charset=utf-8'
        return ctype

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

class ThreadingServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True

    def handle_error(self, request, client_address):
        exc = sys.exc_info()[1]
        if isinstance(exc, (BrokenPipeError, ConnectionResetError, ConnectionAbortedError)):
            return
        return super().handle_error(request, client_address)

if __name__ == "__main__":
    with ThreadingServer(("", PORT), SimpleHandler) as httpd:
        print(f"Serving at port {PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
