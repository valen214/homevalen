
/* global gapi:false, GoogleAuth:false */

(function(window, undefined){

/*
about GoogleAuth and gapi:
https://developers.google.com/api-client-library/javascript/
reference/referencedocs#googleauthcurrentuserget

*/

new Promise(resolve => {
    var s = document.createElement("script");
    s.addEventListener("load", resolve);
    s.src = "https://apis.google.com/js/api.js";
    document.head.appendChild(s);
}).then(() => new Promise(resolve => gapi.load("client:auth2", resolve)
)).then(() => gapi.client.init({
    "apiKey": "AIzaSyCp8Rwg-WfaxkOz5MfdOGaXJI9R2ZXb5GM",
    "clientId": "948862535396-niamq8hq8ta57649seimp4olv9ktlii9" +
                ".apps.googleusercontent.com",
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
})).then(() => {
    window.GoogleAuth = gapi.auth2.getAuthInstance();
    GoogleAuth.isSignedIn.listen(userSigninStatus);

    var isAuthed = userSigninStatus();
    if(!isAuthed){
        GoogleAuth.signIn();
        userSigninStatus();
    }
});

function grantScope(scope){
    const user = GoogleAuth.currentUser.get();
    user.grant({
        'scope': scope
    });
    userSigninStatus(scope);
}

window.userSigninStatus = function userSigninStatus(status){
    if(status){
        console.log("%cuser has signed in", "color:#22d");
    } else{
        console.log("%cuser has not signed in", "color:#d22");
    }

    const user = GoogleAuth.currentUser.get();
    // const isAuthed = user.hasGrantedScopes(scope);
    const scopes = user.getGrantedScopes();
    if(scopes){
        console.log("%cuser granted scope:", "color:#22d",
                JSON.stringify(scopes.split(" "), null, 4));
        console.log("%caccess token:", "color:#22d",
                user.getAuthResponse().access_token);
    }

    return scopes;
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
window.uploadGoogleImage = function uploadGoogleImage(filename, data){
    var album;
    getOrCreateAlbumByName("homevalen.com album one" // ).then(shareAlbum
    ).then(al => (album = al)
    ).then(() => fetch(
        "https://photoslibrary.googleapis.com/v1/uploads", {
        "method": "POST",
        "headers": {
            "Content-Type": "application/octet-stream",
            "Authorization": "Bearer " + gapi.auth.getToken().access_token,
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
                "files(id, name, originalFilename)",
    }).then(res => {
        const obj = res.result;
        console.log(obj);
        console.log("files:", JSON.stringify(obj.files, null, 4));
        return obj.files;
    });
};
window.listAppFolder = listAppFolder;

// application/vnd.google-apps.folder

function uploadToAppFolder(data, type, name){
    const nl = "\r\n";
    let meta = "Content-Type: application/json; charset=UTF-8" + nl + nl +
        JSON.stringify({
            "name": name,
            "parents": ["appDataFolder"],
        });
    let body;
    if(typeof data === "string"){
        body = data;
    } else{
        body = new TextDecoder("utf-8").decode(data);
    }

    let boundary = randomstring(16);
    while(meta.includes(boundary) || body.includes(boundary)){
        boundary = randomstring(boundary.length + 16);
        if(boundary.length > 256){
            console.error("something's probably wrong",
                    "in creation of POST multipart boundary");
        }
    }

    body =  "--" + boundary + nl + meta + nl +
            "--" + boundary + nl +
            "Content-Type: " + type + nl + nl + body + nl +
            "--" + boundary + "--";

    console.log("multipart post body:", body.slice(0, 200));

    return fetch("https://www.googleapis.com/upload/drive/v3/files" +
            "?uploadType=multipart", {
        "method": "POST",
        "headers": {
            "Authorization": "Bearer " + gapi.auth.getToken().access_token,
            "Content-Type": "multipart/related; boundary=" + boundary,
            "Content-Length": body.length
        },
        "body": body,
    }).then(res => res.json()
    ).then(obj => {
        console.log("file upload to app folder completed: res:", obj);
        return obj;
    });
}
window.uploadToAppFolder = uploadToAppFolder;

async function getFromAppFolderByID(id){
    console.log("called on ID:", id);
    var res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
        "method": "GET",
        "headers": {
            "Authorization": "Bearer " + gapi.auth.getToken().access_token,
            "Accept": "text/plain,application/json;q=0.9,*/*;q=0.8",
        },
    });
    return await res.blob();
}
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
        out[f.name] = getFromAppFolderByID(f.id);
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
    }).then(res => console.log("delete id:%s completed, res:", id, res),
        e => console.log("delete failed:", e));
}
window.deleteFromAppFolderByID = deleteFromAppFolderByID;

window.deleteFromAppFolder = function deleteFromAppFolder(name){
    return gapi.client.drive.files.list({
        "spaces": "appDataFolder",
        "maxResults": 100,
        "q": `name = '${name}'`,
        "fields": "files/id",
    }).then(res => new Promise((resolve, reject) => {
        var files = res.result.files;
        if(files.length){
            resolve(files[0].id);
        } else{
            reject(`cannot find ${name} from AppFolder`);
        }
    })).then(id => gapi.client.drive.files.delete({
        "fileId": id
    })).then(res => console.log("delete %s completed, res:", name, res),
        e => console.log("delete failed:", e));
};

function getPasteInfoID(first=true){
    return gapi.client.drive.files.list({
        "spaces": "appDataFolder",
        "maxResults": 100,
        "q": "name = 'paste_info.json'"
    }).then(res => new Promise(resolve => {
        var files = res.result.files;
        if(files.length){
            if(files.length > 1){ // evil type cast
                console.log("multiple paste_info.json found:");
                console.log("    res.result.files:",
                        JSON.stringify(files, null, 4
                        ).replace(/\n/g, "\n    "));
            }
            resolve(files[0].id);
        } else if(first){
            console.log("paste_info.json does not exists, creating");
            uploadToAppFolder(JSON.stringify({
                "length": 0,
            }), "application/json", "paste_info.json"
            ).then(() => getPasteInfoID(false));
        } else{
            console.error("FATAL: paste_info.json creation failed");
        }
    }));
};

function getPasteInfo(){
    return getPasteInfoID().then(id => fetch(
        `https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
        "method": "GET",
        "headers": {
            "Authorization": "Bearer " + gapi.auth.getToken().access_token,
            "Accept": "text/plain,application/json;q=0.9,*/*;q=0.8",
        },
    })).then(res => res.json(
    )).then(obj => {
        console.log("paste_info.json retrived:",
                JSON.stringify(obj, null, 4));
        return obj;
    });
}
window.getPasteInfo = getPasteInfo;

function setPasteInfo(paste_info){
    getPasteInfoID().then(id => fetch(
        "https://www.googleapis.com/upload/drive/v3/files/" +
                id + "?uploadType=media", {
        "method": "PATCH",
        "headers": {
            "Authorization": "Bearer " + gapi.auth.getToken().access_token,
            "Content-Type": "application/json",
        },
        "body": JSON.stringify(paste_info)
    })).then(res => res.json());
    /* return:
    uploaded file's id, kind, mimeType, name
    */
};

async function addPasteItem(data, type, name){
    if(type.startsWith("text") && data.length < 500){
        getPasteInfo().then(info => {
            info[info.length] = {
                "type": type,
                "body": data
            };
            info.length += 1;
            setPasteInfo(info);
        });
    } else{
        let info = await getPasteInfo();
        let path = [
            Date.now(), info.length, randomstring(5),
            date_string(), time_string(), name
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
    }
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
        out.blob = await getFromAppFolderByID(out.id);
    }
    return blob;
}
window.getPasteItem = getPasteItem;

async function getPasteItems(){
    let info = await getPasteInfo();
    let indices = new Array(info.length).filter((e, i) => info[i].id);
    let blobs = indices.map(v => getFromAppFolderByID(v));
    await Promise.all(blobs);
    indices.forEach(async (v, i) => {
        info[v].blob = await blobs[i];
    });
    return info;
}
window.getPasteItems = getPasteItems;

console.log("%cgoogle_api_library.js: loaded successfully", "color: #0f0");

// 

})(window);