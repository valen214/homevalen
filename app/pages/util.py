#!/bin/python

import base64
import hashlib
import struct




# from cryptography import x509 # dependencies
# from cryptography.hazmat.backends import default_backend
# from cryptography.hazmat.primitives import hashes, serialization
# from cryptography.hazmat.primitives.asymmetric import padding





def content_type(path, default="text/plain"):
    ctype = default
    if isinstance(path, str):
        for ext, t in content_type.EXT_DICT.items():
            if path.endswith(ext):
                ctype = t
                break
    if ctype.startswith("text/") or ext == ".js":
        ctype += "; charset=utf-8"
    return ctype

content_type.EXT_DICT = {
    ".htm": "text/html",
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".png": "image/png"
}



# return str
def decode_socket_data(data):
    # https://tools.ietf.org/html/rfc6455#page-28
    # https://gist.github.com/rich20bb/4190781

    # https://developer.mozilla.org/en-US/docs/
    # Web/API/WebSockets_API/Writing_WebSocket_servers
    
    if data[0] == 0x81:
        pass # content is text
    else:
        print(f"{G}util.py:",
                f"data[0] == {data[0]} != 0x81, data is not text{E}")
    payload_len = data[1] & 127
    
    index_first_mask = 2
    if payload_len == 126:
        index_first_mask = 4
        payload_len = (data[2] << 8) + data[3]
    elif payload_len == 127:
        index_first_mask = 10

    masks = list(data[index_first_mask:index_first_mask+4])
    index_first_data_byte = index_first_mask + 4

    decoded_chars = []
    i = index_first_data_byte
    j = 0
    
    last_index = payload_len + index_first_data_byte
    # last_index = min(last_index, len(data))
    while i < last_index:
        decoded_chars.append(chr(data[i] ^ masks[j]))
        i += 1
        j = (j+1) % 4
    
    return "".join(decoded_chars), data[last_index:]

# ''.join(format(byte, '08b') for byte in _bytes)
def get_next_websocket_message(socket):
    while True:
        data = socket.recv(2)
        if not data:
            print(f"{' '*8}{G}util.py: received empty data{E}")
            return ""
        FIN_RSV123 = 0xf0 & data[0]
        OPCODE = 0x0f & data[0]
        MASKED = data[1] & 0x80
        LENGTH = data[1] & 0x7f
        
        if FIN_RSV123 != 0x80:
            print("util.py: get_next_websocket_message():",
                    f"unexpected frame starting bits({bin(FIN_RSV123)})")
        if not MASKED:
            print(f"{' '*8}{G}util.py: get_next_websocket_message():",
                    f"client-to-server message should be masked{E}")

        if LENGTH == 126:
            data = socket.recv(2)
            LENGTH = struct.unpack("!H", data)[0]
        elif LENGTH == 127:
            data = socket.recv(8)
            LENGTH = struct.unpack("!Q", data)[0]


        if OPCODE == 9: # ping
            if LENGTH >= 126:
                print(f"{' '*8}{G}util.py: get_next_websocket_message():",
                        f"invalid ping frame payload length{E}")
            data = socket.recv()
            pong = bytearray([0x8a, MASKED+LENGTH, data])
            socket.sendall(pong)

            print(f"{' ' *8}{G}util.py: ping received,",
                    f"payload: {pong.decode('utf-8')}{E}")
            continue


        masks = socket.recv(4)
        i = 0
        data = bytearray()
        for b in socket.recv(LENGTH):
            data.append(b ^ masks[i])
            i = (i + 1) % 4

        
        if OPCODE == 8:
            print(f"{' '*8}{G}util.py: socket closing signal received{E}")
            if data == b"\x03\xe9":
                print(f"{' '*8}{G}return code: 1001{E}")
                return
            for ln in [
                    "closing message:",
                    data.hex(),
                    "remaining data:",
                    socket.recv(4096).hex()]:
                print(f"{' '*8}{G}" + ln + {E})
            return
        
        # bytes.fromhex(
        return data


def handle_websocket_message(socket, handler, *args):
    """https://tools.ietf.org/html/rfc6455#page-28



    Opcode:
        - 0: continuation frame
        - 1: text frame
        - 2: binary frame
        - 8: connection close
        - 9: ping
        - a: pong

    """
    return_code = True
    while return_code:
        data = get_next_websocket_message(socket)
        # bytes.fromhex(
        return_code = handler(data, *args)



# return bytes
def encode_socket_data(message):
    TEXT = 0x01
    
    return_value = b""
    payload = None

    b1 = 0x80

    if type(message) == str:
        b1 |= TEXT
        payload = message.encode("utf-8")
    elif type(message) == bytes:
        b1 |= TEXT
        payload = message
    
    return_value += bytes([b1])

    b2 = 0
    length = len(payload)
    if length < 126:
        b2 |= length
        return_value += bytes([b2])
    elif length < (2 ** 16) -1:
        b2 |= 126
        return_value += bytes([b2])
        return_value += struct.pack(">H", length)
    else:
        b2 |= 127
        return_value += bytes([b2])
        return_value += struct.pack(">Q", length)
    
    # print("\n"*5 + "#"*20 + " payload " + "#"*20)
    # print(payload.decode("utf-8"))
    # print("#"*20 + " return value " + "#"*20)
    # print(repr(return_value))
    # print("#" * 50 + "\n"*2)
    # return_value += payload
    return return_value + payload




# data in bytes, return bytes
def handle_socket_handshake(socket):
    """
    https://stackoverflow.com/questions/7000885/
    python-is-there-a-good-way-to-check-if-text-is-encrypted
    """

    data = socket.recv(4096)

    try:
        # print(f"{G}data received:{data.hex()}{E}")
        data.decode("utf-8")
    except UnicodeDecodeError:
        print(f"{G}data probably encrypted{E}")
        """
        probably encrypted
        with open("./data/cert_key.pem", "rb") as f:
            prv_key = serialization.load_pem_private_key(
                    f.read(), password=None, backend=default_backend())
            print(prv_key.key_size)
            print(prv_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption(),
            ))
    
        pem = prv_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )

https://www.cisco.com/c/en/us/support/docs/security-vpn/
secure-socket-layer-ssl/116181-technote-product-00.html

https://security.stackexchange.com/questions/20803/
how-does-ssl-tls-work?newreg=d52a281bb1e049b8aa1ae26ecd1d3732

https://wiki.openssl.org/index.php/Simple_TLS_Server

https://www.ibm.com/support/knowledgecenter/en/
SSFKSJ_7.1.0/com.ibm.mq.doc/sy10660_.htm



        # ssl record type
        ssl_type = data[0]
        version = (data[1], data[2])
        length = data[3]*256 + data[4]

        if ssl_type == 22: # handshake
            print(f"{G}SSL Record Version: {version}{E}")
        elif ssl_type == 20: # change cipher spec
            pass
        elif ssl_type == 21: # alert
            pass
        elif ssl_type == 23: # application data
            pass
        else:
            raise Exception("Invalid ssl record type")

        # record protocol
        data = prv_key.decrypt(data[5:], padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
        ))
        print(f"{G}decrypted data:{data}{E}")

        """


    sec_websocket_key = None
    # print("="*80)
    for line in data.split(b"\r\n"):
        # print(line.decode("utf-8"))
        if line.startswith(b"Sec-WebSocket-Key:"):
            sec_websocket_key = bytearray(line[19:].strip())
            break
    # print("="*80)


    if not data:
        print(f"{G}handshake not happened{E}")
        socket.sendall(b"")
        return

    h = hashlib.sha1()
    # type(sec_websocket_key) == bytearray
    h.update(sec_websocket_key)
    h.update(WEBSOCKET_HANDSHAKE_MAGIC.encode("utf-8"))
    h = h.digest()
    sec_websocket_accept = base64.b64encode(h).decode("utf-8")
    # print("Sec-WebSocket-Key:", sec_websocket_key.decode("utf-8"))
    # print("Sec-WebSocket-Accept:", sec_websocket_accept)

    socket.sendall(WEBSOCKET_HANDSHAKE_RESPONSE_HEANDER.format(
            sec_websocket_accept).encode("utf-8"))


WEBSOCKET_HANDSHAKE_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

WEBSOCKET_HANDSHAKE_RESPONSE_HEANDER = (
        "HTTP/1.1 101 Switching Protocols\r\n"
        "Upgrade: WebSocket\r\n"
        "Connection: Upgrade\r\n"
        "Sec-WebSocket-Accept: {}\r\n"
        "Server: TestTest\r\n"
        "Access-Control-Allow-Oripin: *\r\n"
        "Access-Control-Allow-Credentials: true\r\n"
        "\r\n"
)




def C(foreground, background=None):
    """
https://stackoverflow.com/questions/287871/print-in-terminal-with-colors
https://en.wikipedia.org/wiki/ANSI_escape_code

a;bb;ccm

open tag \033 == \x1b

a is probably text style
bb foreground, cc background

1; is brighter
2; is dimmer
22; is normal
4; is underlined

    """
    return "\33[1;34;40m" + "HI" + "\33[0m"


R = RED    = "\33[1;31;40m"
G = GREEN  = "\33[1;32;40m"
Y = YELLOW = "\33[1;33;40m"
B = BLUE   = "\33[1;34;40m"
P = PURPLE = "\33[1;35;40m"
C = CYAN   = "\33[1;36;40m"
W = WHITE  = "\33[1;37;40m"
E = END    = "\33[0m"