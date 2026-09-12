"""Local test-only Upstash REST adapter for an actual Redis on port 6379.

Run in WSL: python3 scripts/redis-rest-bridge.py
Listens only on loopback port 8079. No credentials or production data are used.
"""
import json
import socket
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def read_resp(stream):
    marker = stream.read(1)
    line = stream.readline().removesuffix(b"\r\n")
    if marker == b"+":
        return line.decode()
    if marker == b"-":
        raise RuntimeError("Redis command failed")
    if marker == b":":
        return int(line)
    if marker == b"$":
        size = int(line)
        if size == -1:
            return None
        value = stream.read(size)
        stream.read(2)
        return value.decode()
    if marker == b"*":
        return [read_resp(stream) for _ in range(int(line))]
    raise RuntimeError("Invalid Redis response")


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            if self.headers.get("Authorization") != "Bearer local-test":
                self.send_error(401)
                return
            args = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            if args[0] not in ("EVAL", "GET", "SET"):
                self.send_error(400)
                return
            command = b"*" + str(len(args)).encode() + b"\r\n"
            for arg in args:
                encoded = str(arg).encode()
                command += b"$" + str(len(encoded)).encode() + b"\r\n" + encoded + b"\r\n"
            with socket.create_connection(("127.0.0.1", 6379), timeout=5) as conn:
                conn.sendall(command)
                with conn.makefile("rb") as stream:
                    result = read_resp(stream)
            body = json.dumps({"result": result}).encode()
            self.send_response(200)
        except Exception:
            body = b'{"error":"Local Redis unavailable"}'
            self.send_response(503)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        pass


if __name__ == "__main__":
    print("Local Redis REST test adapter listening on 127.0.0.1:8079", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 8079), Handler).serve_forever()
