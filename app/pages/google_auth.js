

(function (){

var GoogleAuth;

// https://developers.google.com/identity/protocols/OAuth2UserAgent#example
const SCOPE = "https://www.googleapis.com/auth/drive.file";

new Promise(resolve => {
    if(gapi){
        resolve();
    } else{
        return new Promise(resolve => {
            var s = document.createElement("script");
            s.addEventListener("load", resolve);
            s.src = "https://apis.google.com/js/api.js";
            document.head.appendChild(s);
        }).then(() => new Promise(
            resolve => gapi.load("client:auth2", resolve)
        ));
    }
}).then(() => gapi.client.init({
    "apiKey": "AIzaSyCp8Rwg-WfaxkOz5MfdOGaXJI9R2ZXb5GM",
    "clientId": "948862535396-niamq8hq8ta57649seimp4olv9ktlii9" +
                ".apps.googleusercontent.com",
    "scope": "https://www.googleapis.com/auth/drive.file",
    "discoveryDocs": [
        "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"
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

    grantScope("https://www.googleapis.com/auth/photoslibrary");

    var isAuthed = userSigninStatus();
    if(!isAuthed){
        GoogleAuth.signIn();
    }
});

})();