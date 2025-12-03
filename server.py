import http.server
import socketserver
import json
import os
import urllib.parse
import sys

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOCS_DIR = os.path.join(BASE_DIR, "prototype_comments")

class DocumentationHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def do_GET(self):
        # Handle API request for documentation
        if self.path.startswith('/api/doc'):
            self.handle_get_doc()
        else:
            # Serve static files as usual
            super().do_GET()

    def do_POST(self):
        # Handle API request to save documentation
        if self.path.startswith('/api/doc'):
            self.handle_save_doc()
        else:
            self.send_error(404, "Not Found")

    def handle_get_doc(self):
        try:
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            doc_path = params.get('path', [''])[0]
            doc_type = params.get('type', ['req'])[0] # 'req' (requirement) or 'dev' (development)

            if not doc_path:
                self.send_response(400)
                self.end_headers()
                return

            # Sanitize and construct full path
            safe_path = os.path.normpath(doc_path).lstrip(os.sep).lstrip('/')
            if '..' in safe_path: 
                 self.send_error(403, "Forbidden")
                 return

            # Determine filename suffix based on type
            suffix = '.dev.md' if doc_type == 'dev' else '.md'
            
            full_path = os.path.join(DOCS_DIR, safe_path)
            if not full_path.endswith(suffix):
                # Remove existing extension if present to avoid duplication (e.g. .md.dev.md)
                if full_path.endswith('.md'):
                     full_path = full_path[:-3]
                full_path += suffix

            content = ""
            last_modified = 0
            
            if os.path.exists(full_path):
                with open(full_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                last_modified = os.path.getmtime(full_path)
            else:
                # Create directory if needed
                os.makedirs(os.path.dirname(full_path), exist_ok=True)
                
                # Default content based on type
                title = "Development Guide" if doc_type == 'dev' else "Requirement Documentation"
                default_content = f"# {title}\n\nEdit this file to add content."
                
                with open(full_path, 'w', encoding='utf-8') as f:
                    f.write(default_content)
                content = default_content
                last_modified = os.path.getmtime(full_path)

            response_data = {
                "content": content,
                "last_modified": last_modified
            }

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode('utf-8'))

        except Exception as e:
            self.send_error(500, str(e))

    def handle_save_doc(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            doc_path = data.get('path')
            content = data.get('content')
            doc_type = data.get('type', 'req')

            if not doc_path or content is None:
                self.send_response(400)
                self.end_headers()
                return

            safe_path = os.path.normpath(doc_path).lstrip(os.sep).lstrip('/')
            if '..' in safe_path:
                 self.send_error(403, "Forbidden")
                 return

            suffix = '.dev.md' if doc_type == 'dev' else '.md'
            full_path = os.path.join(os.getcwd(), DOCS_DIR, safe_path)
            
            if not full_path.endswith(suffix):
                if full_path.endswith('.md'):
                     full_path = full_path[:-3]
                full_path += suffix

            # Ensure directory exists
            os.makedirs(os.path.dirname(full_path), exist_ok=True)

            # Write content
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True}).encode('utf-8'))

        except Exception as e:
            self.send_error(500, str(e))

if __name__ == "__main__":
    if not os.path.exists(DOCS_DIR):
        os.makedirs(DOCS_DIR)
        print(f"Created documentation directory: {DOCS_DIR}")

    with socketserver.TCPServer(("", PORT), DocumentationHandler) as httpd:
        print(f"Serving at port {PORT}")
        print(f"Documentation API enabled at /api/doc")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
