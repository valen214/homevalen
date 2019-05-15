
(function(window, undefined){

function define(dependencies, name, func){
    dependencies.split(".");
    if(name in window){
        console.error(`window["${name}"] is non null`);
    } else{
        if(!func.name){
            func.name = name;
        }
        window[name] = func;
    }
}

Image.prototype.isLoaded = function(){
    return this.complete && this.naturalWidth !== 0;
};


File.prototype.readAs = function readAs(type){
    return new Promise(resolve => {
        var reader = new FileReader();
        reader.addEventListener("loadend", resolve);
    
        switch(type){
        case "array":
        case "array_buffer":
        case "buffer":
            reader.readAsArrayBuffer(this);
            break;
        case "string":
        case "binary_string":
        case "binarystring":
            reader.readAsBinaryString(this);
            break;
        case "text":
            reader.readAsText(this);
            break;
        case "dataurl":
        case "url":
            reader.readAsDataURL(this);
            break;
        default:
            console.error("unsupported reader action type");
            break;
        }
    
    });
};


define("Image.isLoaded", "scaleImage",
function scaleImage(img, width, height, callback){
    var src;

    if(img instanceof Image){

    } else if(typeof(img) === "string" ||
            img instanceof String){
        src = img;
        img = new Image();
    }
    
    
    new Promise(resolve => {
        if(src){
            img.addEventListener("load", resolve);
            img.src = src;
        } else if(!img.isLoaded()){
            img.addEventListener("load", resolve);
        } else{
            resolve();
        }
    }).then(e => new Promise(resolve => {
        console.assert(e.target === img);

        var cvs = scaleImage.canvas || (
                scaleImage.canvas = document.createElement("canvas"));
        var ctx = cvs.getContext("2d");
        
        cvs.width = width;
        cvs.height = height;

        ctx.drawImage(img, 0, 0, width, height);
        var data = cvs.toDataURL("image/png");
        var newImg = new Image();
        newImg.addEventListener("load", resolve);
        newImg.src = data;
        
    })).then(e => {
        callback(e.target);
    });
});


})(window);