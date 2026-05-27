import os, sys, http.server, socketserver
os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3000

class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

with socketserver.TCPServer(('', PORT), H) as httpd:
    print(f'serving cwd={os.getcwd()} on port {PORT}', flush=True)
    httpd.serve_forever()
