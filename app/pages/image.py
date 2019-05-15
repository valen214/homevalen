







import json




images = []

def clear_images(env, start_res):
    del images[:]
    start_res("200 OK", [
        ("Content-Length", "0")
    ])
    return ""


def upload_image(env, start_res):
    data = env["wsgi.input"].read(int(env["CONTENT_LENGTH"]))
    images.append(data.decode("utf-8"))
    start_res("200 OK", [
        ("Content-Length", "0")
    ])
    return ""

def retrieve_images(env, start_res):

    # print(env["PATH_INFO"]) # /iamges/get_images
    content = json.dumps(images)
    
    content = content.encode("utf-8")
    start_res("200 OK", [
        ("Content-Length", len(content))
    ])
    return content


initialized = False
def initialize(wsgi_application_handler):
    global initialized
    if initialized:
        raise Exception("<module " + __name__ + "> already initialized")
    else:
        initialized = True
    
    for regex, func in {
            "/(images?/)?images?(.html?)?": upload_image,
    }.items():
        wsgi_application_handler.add("POST", regex, func)

    for regex, func in {
            "/(images?/)?get_images": retrieve_images,
            "/(images?/)?clear_images": clear_images,
    }.items():
        wsgi_application_handler.add("GET", regex, func)