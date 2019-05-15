#!/bin/python3

"""
What app.py does:

starts an BaseHTTPServer wrapped WSGIServer
import modules in ./pages/
calling initialze(wsgi_application_handlers) in each module where
    wsgi_application_handlers contains information directing how the
    WSGI handler pass request to each module,
    by matching method and regex to the request.

    each module has to invoke
    `wsgi_application_handlers.add(method, regex, func)`
    in order to receive request




https://stackoverflow.com/questions/287871/print-in-terminal-with-colors

aws ec2: get public ip
curl http://169.254.169.254/latest/meta-data/public-ipv4


https://www.sslforfree.com/create?
domains=ec2-18-222-252-221.us-east-2.compute.amazonaws.com

"""




import contextlib # redirect_stdout
import http
import importlib
import importlib.util
import inspect
import io
import os
import re
import ssl
import subprocess
import sys
import textwrap
import time
import traceback

try:
    import threading
except ImportError:
    import dummy_threading as threading

try:
    from http.server import HTTPServer, BaseHTTPRequestHandler
except ImportError as ie:
    from BaseHTTPServer import HTTPServer, BaseHTTPRequestHandler

def print_stack_trace():
    print(" " * 8 + ("\n" + " " * 8).join(
            traceback.format_exc(6).split("\n")))

from pages.util import * # self-defined

excluded_info = set([
    "/", "/index.htm"
])


class WSGIApplicationHandler:
    def __init__(self):
        self.__handlers = {
            "GET": [], # (module __name__, regex, func)
            "POST": [],
            "HEAD": [],
        }


    def add(self, method, regex=None, func=None):
        if regex == func == None:
            for obj in method:
                for m, obj in obj.items():
                    for r, f in obj.items():
                        self.add(m, r, f)
        elif func == None:
            for r, f in regex.items():
                self.add(method, r, f)
        elif isinstance(regex, str):
            regex = re.compile("/?" + regex + "\Z")
            caller_module_frame = inspect.currentframe().f_back
            self.__handlers[method].append(
                    (caller_module_frame.f_globals["__name__"], regex, func, ))
        else:
            raise Exception("invalid type of regex, must be str")
    
    def exclude_log(self, abs_path):
        excluded_info.add(abs_path)


    def remove_handlers_by_module(self, module_name):
        for l in self.__handlers.values():
            for i in range(len(l)-1, -1, -1):
                # print(f"{G}check {l[i]}{E}")
                if l[i][0] == module_name:
                    # print(f"{R}removing {l[i]}{E}")
                    del l[i]
                    # l.pop(i)

    def print_handlers(self):
        for method in self.__handlers:
            print(" " * 8 + method)
            for m, regex, func in self.__handlers[method]:
                print(f"{' '*12} <module {m}> " +
                    f"{regex.pattern:>25}: {func.__name__}()")

    def error_handler(self, start_res, message):
        err_msg = message + "\nsorry"
        start_res(message, [
                ("Content-Type", "text/plain; charset=utf-8"),
                ("Content-Length", str(len(err_msg)))
        ])
        return err_msg

    def default_handler(self, env, start_res):
        method = env["REQUEST_METHOD"]
        path = env["PATH_INFO"]

        def is_page(path):
            return any([path.endswith(x) for x in [
                    ".htm", ".html", ".php", ".js", ".css"
            ]])
        
        if not os.path.exists("." + path) and is_page(path) and (
                os.path.exists("./pages/" + path)):
            path = "/pages" + path
        
        if (path == "/") or os.path.isdir(path):
            path = "/pages/index.htm"

        if method == "GET":
            content = ""
            if os.path.exists("." + path):
                with open("." + path, "rb") as f:
                    content = f.read()
                start_res("200 OK", [
                        ("Content-Type", content_type(path)),
                        ("Content-Length", str(len(content))),
                        ("Access-Control-Allow-Origin", "*")
                ])
            else:
                content = "File Not Found"
                start_res("404 Not Found", [
                        ("Content-Type", content_type(".txt")),
                        ("Content-Length", str(len(content))),
                ])
            return content
        elif method == "POST":
            print(env["wsgi.input"].read())
            start_res("201 Created", [
                    ("Location", "index.htm"),
                    ("Content-Type", "text/html; charset=utf-8")
            ])
            return ('<html><head><meta http-equiv="refresh" ' +
                    'content="0;URL=index.htm" /></head></html>')
        else:
            return self.error_handler(start_res, "501 Not Implemented")

    def __call__(self, env, start_res):
        method = env["REQUEST_METHOD"]
        path = env["PATH_INFO"]
        ___ = " " * 8
        try:
            for m, regex, func in self.__handlers[method]:
                if regex.match(path):
                    if not path in excluded_info:
                        print(f'{___}"{method} {path}"')
                        print(f'{___*2}=> r"{regex.pattern}"')
                        print(f'{___*2}=> <module {m}>.{func.__name__}() ')
                    content = func(env, start_res) or ""
                    break
            else:
                print(f'{___}"{method} {path}" did not match any handler')
                print(f'{___*2}=> default_handler() invoked')
                content = self.default_handler(env, start_res)
            return content
        except Exception:
            print(" " * 8 + ("\n" + " " * 8).join(
                    traceback.format_exc(5).split("\n")))
            return self.error_handler(start_res, "500 Internal Server Error")
        
wsgi_application_handler = WSGIApplicationHandler()

class HTTPRequestHandler(BaseHTTPRequestHandler):
    
    # overrided parent method
    def log_message(self, format, *args):
        if hasattr(self, "path") and not self.path in excluded_info:
            print(" " * 8 + "{} {}\n{}[{}] {}".format(
                    self.address_string(), self.version_string(), " "*8,
                    self.log_date_time_string(), format % args),
                    end="\n"*3+"-"*80+"\n")

    def do_HEAD(self):
        self.do_method()

    def do_GET(self):
        self.do_method()

    def do_POST(self):
        self.do_method()

    def do_CONNECT(self):
        print(f"{G}DOING HTTP CONNECT{E}")

    def do_method(self):
        # self.headers is an instance of
        # http.client.HTTPMessage < email.message.Message

        """
        > dir(self)
        "request": <socket.socket>,
        "client_address": ("ip", port),
        "server": <http.server.HTTPServer>,
        "connection": <socket.socket>,
        "rfile": <_io.BufferedReader>,
        "wfile": <socketserver._SocketWriter>,
        "close_connection": <boolean>,
        "raw_requestline": <bytes>,
        "command": "GET",
        "request_version": "HTTP/1.1",
        "requestline": "GET / HTTP/1.1",
        "path": "/",
        "headers": <http.client.HTTPMessage>

        """
        env = {
            "REQUEST_METHOD": self.command,
            "PATH_INFO": self.path,
            "QUERY_STRING": None,
            "SERVER_PORT": None,
            "SERVER_PROTOCOL": self.protocol_version, # "request_version"
            "CONTENT_LENGTH": self.headers["Content-Length"],
            
            "GATEWAY_INTERFACE": "",
            "HTTP_ACCEPT": "",
            "HTTP_USER_AGENT": "",
            "HTTP_CONNECTION": "", # keep-alive
            "HTTP_PRAGMA": "no-cache",
            "HTTP_CACHE_CONTROL": "no-cache",

            "wsgi.input": self.rfile,
            "wsgi.errors": None,
            "wsgi.version": (1, 0),
            "wsgi.run_once": None,
            "wsgi.url_scheme": None,
            "wsgi.multithread": None,
            "wsgi.multiprocess": None,
            "wsgi.file_wrapper": None, # <class wsgiref.util.FileWrapper>

            "HTTP_REQUEST": self,
        }

        print("headers")
        for k, v in self.headers.items():
            print(f"{k}: {v}")

        content = wsgi_application_handler(env, self.start_res)
        if isinstance(content, str):
            content = bytes(content, "utf-8")
        self.wfile.write(content)
        self.wfile.flush()

    def start_res(self, msg, headers = []):
        self.send_response(code=int(msg[:3]), message=msg[4:])
        for key, value in headers:
            self.send_header(str(key), str(value))
        self.end_headers()





def module_thread(event):
    print("loading modules...\n")

    scripts = []

    for (dirpath, dirnames, filenames) in os.walk("./pages/"):
        for f in filenames:
            if f.endswith(".py"):
                # print("PATH:", os.path.join(dirpath, f))
                scripts.append(os.path.join(dirpath, f))

    info = {}
    
    def add_script(path):
        def load_module_from_path(path):

            # name = os.path.basename(path[:-3])
            name = path[2:-3].replace("/", ".")

            spec = importlib.util.spec_from_file_location(name, path)
            
            m = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(m)
            sys.modules[name] = m

            print("- load_module_from_path():\n" +
                    f"-     path: {path};\n" +
                    f"-     __name__: {m.__name__};")

            return m


        try:
            m = load_module_from_path(path)
            n = m.__name__
            info[path] = [m, os.stat(path).st_mtime]
            if hasattr(m, "initialize") and callable(m.initialize):
                m.initialize(wsgi_application_handler)
            else:
                print(f'{R}<module "{n}"> has no initialize(){END}')
            print(f'{R}>{E} load <module "{n}"> end\n')
        except:
            print_stack_trace()
            print(path + " not loaded")

    for path in scripts:
        add_script(path)

    # keep track of file info
    while not event.is_set():
        remaining = list(info.keys()) # unhandled
        # iterate files system
        for (dirpath, dirnames, filenames) in os.walk("./pages/"):
            for path in [os.path.join(dirpath, f)
                    for f in filenames if f.endswith(".py")]:
                # script newly created
                if not path in info:
                    add_script(path)
                    continue
                
                remaining.remove(path) # script still exists

                if os.stat(path).st_mtime != info[path][1]: # script modified
                    try:
                        m = info[path][0]
                        n = m.__name__
                        print('\nmodule "{}" changed, reloading'.format(n))
                        wsgi_application_handler.remove_handlers_by_module(n)
                        if hasattr(m, "close"): m.close()
                        add_script(path)
                    except:
                        info[path][1] = os.stat(path).st_mtime
        
        # script removed
        for path in remaining:
            m = info[path][0]
            n = m.__name__
            print('module "{}" removed, unregister handlers'.format(n))
            wsgi_application_handler.remove_handlers_by_module(n)
            if hasattr(m, "close"): m.close()
            del info[path]
        
        event.wait(1)
    
    for path, [m, _] in info.items():
        if hasattr(m, "close"):
            m.close()

    print(f"{R}module thread ending{E}")

def runtime_interact():
    # print("\n".join([f"{a}: {b}" for a, b in dict(globals()).items()]))
    line = ""
    while line != "exit":
        try:
            line = input()
            eval(line)
        except KeyboardInterrupt as ki:
            print(f"{B}runtime_interact() received KeyboardInterrupt{E}")
            raise ki
    print(f"{R}runtime_interact thread ending{E}")

def print_aws_info():
    # this returns correct value, but will show the connection info
    # publiip = subprocess.check_output(["curl",
    #         "http://169.254.169.254/latest/meta-data/public-ipv4"])
    #
    proc = subprocess.Popen(["curl",
            "http://169.254.169.254/latest/meta-data/local-ipv4"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    print(f"{P}\nprivate ip: {proc.communicate()[0].decode('utf-8')}{END}")
    proc = subprocess.Popen(["curl",
            "http://169.254.169.254/latest/meta-data/public-ipv4"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    print(f"{P}public ip: {proc.communicate()[0].decode('utf-8')}{END}\n")
    print()
    print("----" * 20)

def main():
    e1 = threading.Event()
    t = threading.Thread(target=module_thread, args=(e1,))
    t.start()

    s = []
    def start_server(address, port, use_https=False):
        server = HTTPServer((address, port), HTTPRequestHandler)
        if use_https:
            ctx = ssl.SSLContext(ssl._ssl.PROTOCOL_TLS_SERVER)
            ctx.load_cert_chain('./data/cert_key.pem')
            server.socket = ctx.wrap_socket(server.socket, server_side=True)

        print(f"{G}{'https' if use_https else 'http'}",
                f"server listening at {address}:{port}{E}")

        if False:
            d_port = 443 if use_https else 80
            print(f"{G}redirecting port :{d_port} to :{port}")
            os.system("sudo iptables -A INPUT -i eth0 " +
                    f"-p tcp --dport {d_port} -j ACCEPT")
            os.system("sudo iptables -A PREROUTING -t nat -i eth0 " +
                    f"-p tcp --dport {d_port} -j REDIRECT --to-port {port}")
            print(E)

        start_server.serverCount -= 1
        if not start_server.serverCount: # args defined below
            print()
            print("----" * 20)
            print_aws_info()

        s.append(server)
        server.serve_forever()
        print(f"{R}server@{address}:{port} ended serving{E}")

    start_server.serverCount = 0
    for t in [
            ("0.0.0.0", 8128, False),
            # ("0.0.0.0", 80, False), # requires sudo
            # ("0.0.0.0", 443, True), # requires sudo
            ("0.0.0.0", 8129, True)]:
        start_server.serverCount += 1
        threading.Thread(target=start_server, args=t).start()
    
    def cleanup():
        e1.set()
        for a in s:
            a.shutdown()
        print("threads still running:")
        print(threading.enumerate())


    try:
        runtime_interact()
    except KeyboardInterrupt:
        print(f"{B}close signal received by app.py (main thread){E}")
    finally:
        cleanup()
    

    print(f"{R}main thread ending{E}")

if __name__ == "__main__":
    main()