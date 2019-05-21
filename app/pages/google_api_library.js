
/* global gapi:false, GoogleAuth:false */

(async function(window, undefined){

/*
about GoogleAuth and gapi:
https://developers.google.com/api-client-library/javascript/
reference/referencedocs#googleauthcurrentuserget

*/
const API_KEY = "AIzaSyCp8Rwg-WfaxkOz5MfdOGaXJI9R2ZXb5GM";
const CLIENT_ID = "948862535396-niamq8hq8ta57649seimp4olv9ktlii9" +
                ".apps.googleusercontent.com";

async function uninitializedAccessToken(){
    let token = localStorage.getItem("gapi_access_token");
    let expires_at = parseInt(localStorage.getItem("gapi_expires_at"));

    console.log("cached access token:", token);
    console.log("expires_at - Date.now():", expires_at - Date.now());
    let d = new Date(expires_at);
    console.log(`expires_at: ${datestr(d, ' ')} ${timestr(d, ':')}`);
    if((expires_at < Date.now()) || !token){
        console.log("invalid cahce");
        return regularLogin();
    }
    let res = await fetch("https://www.googleapis.com/" +
        "oauth2/v1/tokeninfo?access_token=" + token);
    if(res.status !== 200){
        console.group();
        console.error("token validation failed", res);
        console.error("body:", await res.json());
        console.groupEnd();
        return regularLogin();
    }

    let obj = await res.json();
    // console.log(obj);
    if(obj.issued_to !== CLIENT_ID || "error" in obj){
        console.error("erroneous/invalid validation response");
        return regularLogin();
    }
    if(typeof obj.expires_in !== "number" && obj.expires_in <= 60){
        console.error("unusable token");
        return regularLogin();
    }
    console.log("%cusing cached access token", "color: #2f2");
    window.signIn = true;
    window.signOut = signOut; // hoisted above access_token

    return token;
}

var GoogleAuth;
var access_token = uninitializedAccessToken();
Object.defineProperty(window, "access_token", {
    get(){
        return access_token;
    },
    set(){ throw new Error("cannot assign access_token"); }
});
initGAPI();


function signOut(){
    localStorage.removeItem("gapi_access_token");
    localStorage.removeItem("gapi_expires_at");

    if(GoogleAuth){
        GoogleAuth.disconnect();
    }
}

async function initGAPI(){
    /*
    race the mtfk, most discovery function is the first function called,
    would exit immediately if not defined yet.
    */
    if(initGAPI.initialized || !(initGAPI.initialized = true)) return;

    if(!window.hasOwnProperty("gapi")){
        console.log("gapi script not imported, consider put it in <head>");
        await new Promise(resolve => {
            var s = document.createElement("script");
            s.addEventListener("load", resolve);
            s.src = "https://apis.google.com/js/api.js";
            document.head.appendChild(s);
        });
    }
    await new Promise(resolve => gapi.load("client:auth2", resolve));
    await gapi.client.init({
        "apiKey": API_KEY,
        "clientId": CLIENT_ID,
        "scope": [
            "https://www.googleapis.com/auth/photoslibrary.sharing",
            // "https://www.googleapis.com/auth/photoslibrary",
            "https://www.googleapis.com/auth/drive.appfolder",
            // "https://www.googleapis.com/auth/drive",
            // "https://www.googleapis.com/auth/drive.photos.readonly",
        ].join(" "),
        "discoveryDocs": [
            "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
            "https://photoslibrary.googleapis.com/$discovery/rest?version=v1"
        ]
    });
    
    console.log("%cfinished gapi initialization, took %s sec",
            "color: #22d", performance.now() / 1000);
}

async function regularLogin(){
    localStorage.removeItem("gapi_access_token");
    localStorage.removeItem("gapi_expires_at");

    await initGAPI();

    function userSigninStatus(status){
        let out = GoogleAuth.isSignedIn.get();
        console.log(`%cuserSigninStatus(status=${status}): ${out}`,
                out ? "color:#2f2" : "color:#d22");
        return out;
    }
    window.userSigninStatus = userSigninStatus;

    GoogleAuth = gapi.auth2.getAuthInstance();
    GoogleAuth.isSignedIn.listen(userSigninStatus);

    if(!GoogleAuth.isSignedIn.get()){
        console.log("not signed in, adding global signIn() function");
        await new Promise(resolve => {
            GoogleAuth.isSignedIn.listen(status => {
                if(status){
                    console.log("signed in");
                    resolve();
                }
            });
            window.signIn = () => {
                GoogleAuth.signIn();
            };
        });
    }

    const user = GoogleAuth.currentUser.get();
    let auth_res = user.getAuthResponse();
    // const isAuthed = user.hasGrantedScopes(scope);
    const scopes = user.getGrantedScopes();
    if(scopes){
        console.log("%cuser granted scope:", "color:#22d",
                JSON.stringify(scopes.split(" "), null, 4));
        console.log("%caccess token:", "color:#22d", auth_res.access_token);
        console.log("%cexpires at:", "color:#22d", auth_res.expires_at);
        console.log("%cnow: %d, diff: %d", "color:#22d", Date.now(),
                auth_res.expires_at - Date.now(), auth_res.expires_in)
    }


    // gapi.auth.getToken().access_token
    localStorage.setItem("gapi_access_token", auth_res.access_token);
    localStorage.setItem("gapi_expires_at", auth_res.expires_at);
    console.log("regular login finished: token:", auth_res.access_token);
    window.signIn = true;
    window.signOut = signOut;

    return auth_res.access_token;
}



function grantScope(scope){
    const user = GoogleAuth.currentUser.get();
    user.grant({
        'scope': scope
    });
}


window.getAlbumByName = function getAlbumByName(name, nextPageToken=null){
    return gapi.client.photoslibrary.albums.list(
        Object.assign({
            "pageSize": 50,
            "excludeNonAppCreatedData": true
        }, nextPageToken && { "pageToken": nextPageToken })
    ).then(res => {
        var result = res.result;
        var found = false;
        if(result.albums && result.albums.length){
            for(const al of result.albums){
                console.log(al);
                if(name === al.title){
                    found = al;
                    break;
                }
            }
        }

        if(found){
            console.log(`album "<${name}>" found`);
        }

        return found || ( result.nextPageToken ?
                getAlbumByName(name, result.nextPageToken) : null);
    });

};

window.getOrCreateAlbumByName = function getOrCreateAlbumByName(name){
    return new Promise(resolve => {
        var al = getAlbumByName(name);
        if(al) return resolve(al); // return value is ignored
        // create one
        console.log(`album "<${name}>" not found, creating`);
        return gapi.client.photoslibrary.albums.create({
            "album": {
                "title": name
            }
        }).then(res => res.result);
    });
};

window.shareAlbum = function shareAlbum(album){
    if("shareInfo" in album){
        return new Promise(resolve => resolve(album));
    }

    var id = album;
    if(typeof album !== "string"){
        id = album.id;
    }
    return gapi.client.photoslibrary.albums.share({
        "albumId": id,
        "sharedAlbumOptions": {
            "isCollaborative": false,
            "isCommentable": false
        }
    }).then(res => res.result);
};
/*
uploadGoogleImage("a.png", Uint8Array.from(atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAA" +
    "AAC0lEQVR42mP8Xw8AAoMBgDTD2qgAAAAASUVORK5CYII="), c => c.charCodeAt(0)))
*/

// https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
window.uploadGoogleImage = async function uploadGoogleImage(filename, data){
    var album;
    getOrCreateAlbumByName("homevalen.com album one" // ).then(shareAlbum
    ).then(al => (album = al)
    ).then(async () => fetch(
        "https://photoslibrary.googleapis.com/v1/uploads", {
        "method": "POST",
        "headers": {
            "Content-Type": "application/octet-stream",
            "Authorization": "Bearer " + await access_token,
            "X-Goog-Upload-File-Name": filename,
            "X-Goog-Upload-Protocol": "raw",
        },
        "body": data
    })).then(res => res.text()
    ).then(data => {
        console.log("upload completed, media item created");
        console.log("upload token:", data);
        return data;
    }).then(data => gapi.client.photoslibrary.mediaItems.batchCreate({
        "albumId": album.id,
        "newMediaItems": [
            {
                "description": "<item description>",
                "simpleMediaItem": {
                    "uploadToken": data
                }
            }
        ],
        /*
        "albumPosition": {
            "position": "AFTER_MEDIA_ITEM",
            "relativeMediaItemId": "<media item id>",
        }
        */
    })).then(res => {
/*
https://developers.google.com/photos/library/
reference/rest/v1/mediaItems/batchCreate#body.response_body
*/
        var newMediaItemResults = res.result.newMediaItemResults;
        for(const obj of newMediaItemResults){
            console.log("image uploaded:", JSON.stringify(obj, null, 4));
        }
    });
};

/*
(await listAppFolder()).forEach((f, i) => {
    deleteFromAppFolderByID(f.id);
    console.log("deleting:", f.id);
})
*/
function listAppFolder(){
    return gapi.client.drive.files.list({
        "spaces": "appDataFolder",
        "maxResults": 100,
        "fields": "incompleteSearch, nextPageToken, " +
                "files(id, name)",
    }).then(res => {
        const obj = res.result;
        console.log(obj);
        console.log("files:", JSON.stringify(obj.files, null, 4));
        return obj.files;
    });
};
window.listAppFolder = listAppFolder;

// application/vnd.google-apps.folder

async function uploadToAppFolder(data, type, name){
    /*
    if(ArrayBuffer.isView(data) || data instanceof ArrayBuffer){
        data = await new Response(data).blob();
    }
    */

    const nl = "\r\n";
    let meta = "Content-Type: application/json; charset=UTF-8" + nl + nl +
        JSON.stringify({
            "name": name,
            "parents": ["appDataFolder"],
        });
    let body = await new Response(data).text();

    let boundary = randomstring(16);
    while(meta.includes(boundary) || body.includes(boundary)){
        boundary = randomstring(boundary.length + 16);
        if(boundary.length > 256){
            console.error("something's probably wrong",
                    "in creation of POST multipart boundary");
        }
    }

    body =  new Blob([
            "--", boundary, nl, meta, nl,
            "--", boundary, nl,
            "Content-Type: ", type, nl,
            // "Content-Transfer-Encoding: BASE64", nl,
            nl, data, nl,
            "--", boundary, "--"
    ]);

    let res = await fetch("https://www.googleapis.com/" +
            "upload/drive/v3/files?uploadType=multipart", {
        "method": "POST",
        "headers": {
            "Authorization": "Bearer " + await access_token,
            "Content-Type": "multipart/related; boundary=" + boundary,
            "Content-Length": body.size
        },
        "body": body,
    });
    let obj = await res.json();
    console.log("file upload to app folder completed: res:", obj);
    return obj;
}
window.uploadToAppFolder = uploadToAppFolder;

async function fetchFromAppFolderByID(id){
    console.log("fetchFromAppFolderByID(id = %s)", id);
    let res =  await fetch(
        `https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
        "method": "GET",
        "headers": {
            "Authorization": "Bearer " + await access_token,
            "Accept": "text/plain,application/json;q=0.9,*/*;q=0.8",
        },
    });
    return res;
}
window.fetchFromAppFolderByID = fetchFromAppFolderByID;

async function getFromAppFolderByNames(names){
    let query = "";
    if(typeof names === "string"){
        names = [names];
    }
    for(const n of names){
        query += `name = '${n}' or`;
    }
    query = query.slice(0, -3);

    let res = await gapi.client.drive.files.list({
        "spaces": "appDataFolder",
        "maxResults": 100,
        "q": query,
        "fields": "nextPageToken, files(id, name)",
    });
    let out = {};
    
    for(const f of res.result.files){
        out[f.name] = fetchFromAppFolderByID(f.id).blob();
    }
    await Promise.all(Object.values(out));
    for(const [k, v] of Object.entries(out)){
        out[k] = await v;
    }
    return out;
}
window.getFromAppFolderByNames = getFromAppFolderByNames;

function deleteFromAppFolderByID(id){
    return gapi.client.drive.files.delete({
        "fileId": id
    }).then(
        res => console.log("deleted id:%s completed, res:", id, res),
        e => console.log("delete failed:", e));
}
window.deleteFromAppFolderByID = deleteFromAppFolderByID;

async function getPasteInfoID(){
// https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams
    try{
        let res = await fetch(
            "https://www.googleapis.com/drive/v3/files" +
            "?pageSize=100" +
            "&q=name%20%3D%20%27paste_info.json%27" +
            "&spaces=appDataFolder" +
            "&fields=files%2Fid" +
            "&key=" + API_KEY, {
            "method": "GET",
            "headers": {
                "Authorization": "Bearer " + await access_token,
                "Accept": "application/json",
            }
        });
        let files = (await res.json()).files;
        if(files.length){
            if(files.length > 1){ // evil type cast
                console.log("multiple paste_info.json found:");
                console.log("    res.result.files:",
                        JSON.stringify(files, null, 4
                        ).replace(/\n/g, "\n    "));
            }
            return files[0].id;
        } else{
            console.log("paste_info.json does not exists, creating");
            res = await uploadToAppFolder(JSON.stringify({
                "length": 0,
            }), "application/json", "paste_info.json");
            return res.id;
        }
    } catch(e){
        console.error("FATAL: paste_info.json creation failed, e:", e);
    }
};

async function getPasteInfo(){
    let id = await getPasteInfoID();
    let res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
        "method": "GET",
        "headers": {
            "Authorization": "Bearer " + await access_token,
            "Accept": "text/plain,application/json;q=0.9,*/*;q=0.8",
        },
    });
    let obj = await res.json();
    
    let str = JSON.stringify(obj, null, 4);
    if(str != getPasteInfo.last_info){
        getPasteInfo.last_info = str;
        console.log("paste_info.json changed:", str);
    }
    return obj;
}
window.getPasteInfo = getPasteInfo;

// @ts-check
async function setPasteInfo(paste_info){
    let id = await getPasteInfoID();
    let res = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files/" +
                id + "?uploadType=media", {
        "method": "PATCH",
        "headers": {
            "Authorization": "Bearer " + await access_token,
            "Content-Type": "application/json",
        },
        "body": JSON.stringify(paste_info)
    });
    let obj = await res.json();
    /* return:
    uploaded file's id, kind, mimeType, name
    */
   return obj;
};

async function addPasteItem(data, type, name){
    let last_lock = addPasteItem.lock;
    let mylock = Lock();
    addPasteItem.lock = mylock;
    await last_lock;

    let out;
    if(type.startsWith("text") && data.length < 500){
        let info = await getPasteInfo();
        info[info.length] = {
            "type": type,
            "body": data,
            "id": [
                "text", Date.now(), info.length, randomstring(5),
                datestr(), timestr()
            ].join("_"),
        };
        info.length += 1;
        setPasteInfo(info);
    } else{
        let info = await getPasteInfo();
        let path = [
            Date.now(), info.length, randomstring(5),
            datestr(), timestr(), name
        ].join("_");
        let res = await uploadToAppFolder(data, type, path);

        info[info.length] = {
            "type": type,
            "name": name,
            "location": path,
            "id": res.id,
        };
        info.length += 1;

        setPasteInfo(info);
        out = Object.create(info[info.length-1]);
    }

    mylock.release();
    return out;
}
window.addPasteItem = addPasteItem;

async function getPasteItem(index){
    let info = await getPasteInfo();
    let out = info[index];
    if(!out){
        console.error("no clip found at index:", index);
        return;
    }
    if(out.id){
        out.blob = await fetchFromAppFolderByID(out.id).blob();
    }
    return out;
}
window.getPasteItem = getPasteItem;

async function getPasteItems(){
    let info = await getPasteInfo();
    let ids = [...Array(info.length).keys()].map(i => info[i].id);
    let responses = await Promise.all(ids.map((v, i) => {
        if(v){
            return fetchFromAppFolderByID(v)
        } else if(info[i].type.match(/^text/)){
            return new Response(info[i].body);
        }
    }));
    let blobs = await Promise.all(responses.map(v => v.blob()));
    blobs.forEach((v, i) => { info[i].blob = v; });
    return info;
}
window.getPasteItems = getPasteItems;

async function removePasteItemByID(id){
    deleteFromAppFolderByID(id);
    let info = await getPasteInfo();

    let delete_index = -1;
    for(let [i, v] of Object.entries(info)){
        if(v.id === id){
            delete_index = i;
            break;
        }
    }

    if(delete_index >= 0){
        for(let i = delete_index; i+1 < info.length; ++i){
            info[i] = info[i+1];
        }
        delete info[info.length];
        info.length -= 1;

        console.log(`deleted item at #${id}, info: ${info}`);

        setPasteInfo(info);
    } else{
        console.error("FATAL: removePasteItemByID():",
                "invalid clip item delete index");
    }
}
window.removePasteItemByID = removePasteItemByID;

console.log("%cgoogle_api_library.js: loaded successfully", "color: #0f0");

})(window);