
(function(window, undefined){

var GoogleAuth;

// https://developers.google.com/identity/protocols/OAuth2UserAgent#example
const SCOPE = "https://www.googleapis.com/auth/photoslibrary.sharing";
// "https://www.googleapis.com/auth/drive.file";
new Promise(resolve => {
    var s = document.createElement("script");
    s.addEventListener("load", resolve);
    s.src = "https://apis.google.com/js/api.js";
    document.head.appendChild(s);
}).then(e => new Promise(resolve => gapi.load("client:auth2", resolve)
)).then(() => gapi.client.init({
    "apiKey": "AIzaSyD2iz78mL4gcovcdIwiPsmN9llPEMDt9vU",
    "clientId": "948862535396-niamq8hq8ta57649seimp4olv9ktlii9" +
                ".apps.googleusercontent.com",
    "scope": SCOPE,
    "discoveryDocs": [
        // "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"
        "https://photoslibrary.googleapis.com/$discovery/rest?version=v1"
    ]
})).then(() => {
    GoogleAuth = gapi.auth2.getAuthInstance();
    GoogleAuth.isSignedIn.listen(userSigninStatus);

/*
https://developers.google.com/photos/library/
guides/authentication-authorization

    var photosScope = "https://www.googleapis.com/auth/photoslibrary.sharing";
    user.grant({
        'scope': photosScope
    });
*/

    var isAuthed = userSigninStatus();
    if(!isAuthed) GoogleAuth.signIn();
});

function userSigninStatus(scope=SCOPE){
    const user = GoogleAuth.currentUser.get();
    const isAuthed = user.hasGrantedScopes(scope);
    if(isAuthed){
        console.log("%cuser has signed in", "color:#22d");
        console.log("%caccess token:", "color:#22d",
                user.getAuthResponse().access_token);
    } else{
        console.log("%cuser signed in failed", "color:#d22");
    }
    return isAuthed;
}




/*
uploadGoogleImage("a.png", Uint8Array.from(atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAA" +
    "AAC0lEQVR42mP8Xw8AAoMBgDTD2qgAAAAASUVORK5CYII="), c => c.charCodeAt(0)))
*/

// https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
function uploadGoogleImage(filename, data){
/*
https://developers.google.com/api-client-library/
javascript/reference/referencedocs

    // one time authroize
    gapi.auth2.authorize({

    });
*/
/*
https://developers.google.com/photos/library/reference/rest/v1/albums
*/
    const gapi_albums = gapi.client.photoslibrary.albums;
    var album;
    gapi_albums.create({
        "album": {
            "title": "homevalen.com album"
        }
    }).then((a, c, f) => {
        album = a.result ;// JSON.parse(a.body);
        return gapi_albums.share({
            "albumId": album.id,
            "sharedAlbumOptions": {
                "isCollaborative": false,
                "isCommentable": false
            }
        });
    }).then((a, c, f) => {
        var shareInfo = JSON.parse(a.body).shareInfo;
        console.log("album created with share info:", shareInfo);
        return fetch("https://photoslibrary.googleapis.com/v1/uploads", {
            "method": "POST",
            "headers": {
                "Content-Type": "application/octet-stream",
                "Authorization": "Bearer " + gapi.auth.getToken().access_token,
                "X-Goog-Upload-File-Name": filename,
                "X-Goog-Upload-Protocol": "raw",
            },
            "body": data
        });
    }).then(res => res.text()
    ).then(data => {
        // gapi.client.photoslibrary.albums.get()
        console.log("upload completed, media item created");
        console.log("upload token:", data);
        return gapi.client.photoslibrary.mediaItems.batchCreate({
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
        });
    }).then(res => {
/*
https://developers.google.com/photos/library/
reference/rest/v1/mediaItems/batchCreate#body.response_body
*/
        var newMediaItemResults = res.result.newMediaItemResults;
        for(const obj of newMediaItemResults){
            console.log(obj);
        }
    });
}
window.uploadGoogleImage = uploadGoogleImage;


})(window);