
(function(window, undefined){

function define(dependencies, name, func){
    if(dependencies){
        dependencies.split(".");
    }
    if(name in window){
        console.error(`window["${name}"] already exists`);
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


window.readAs = File.prototype.readAs = function readAs(type){
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
    
    }).then(e => e.target.result);
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

Image.prototype.convert = function convertImage(img, type){

};

window.randomstring = function randomstring(length){
    return crypto.getRandomValues(new Uint8Array(length)).reduce((l, r) => (
    l + "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[
        Math.trunc(r * 62 / 256) // String.prototype.charAt() works too
    ]), "");
};

Object.defineProperty(window, "MONTH_SHORT", {
    value: Object.freeze([
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ]),
    configurable: false,
    enumerable: false,
    writable: false,
});
window.datestr = function datestr(d, s=""){
    if(!d) d = new Date();
    return [
        d.getDate(), MONTH_SHORT[d.getMonth()], d.getFullYear()
    ].join(s);
};
window.timestr = function timestr(d, s=""){
    if(!d) d = new Date();
    return [
        d.getHours(), d.getMinutes(), d.getSeconds()
    ].reduce((l, r) => l + (l?s:"") + ("00" + r).slice(-2), "");
}

Object.defineProperty(Promise.prototype, "state", {
    async get(){
        const o = {};
        try{
            let out = await Promise.race([this, o]);
            return out === o ? "pending" : "resolved";
        } catch(e){
            return "rejected";
        }
    }
});


window.sleep = (time=200) => new Promise(resolve => setTimeout(resolve, time));

function Lock(){
    let release;
    let self = new Promise(resolve => release = resolve);
    self.release = release;
    return self;
}
window.Lock = Lock;

window.isPrimitive = function isPrimitive(o){ return Object(o) !== o; }

Object.value_equals = function value_equals(x, y){
    if(x === y) return true;
    if(!x || !y) return false;

    let remain = Object.keys(y);
    for(let [k, xv] of Object.entries(x)){
        let yv = y[k];
        let i = remain.indexOf(k);
        if(i < 0) return false;
        remain.splice(i, 1);
        if(xv === yv) continue;
        if(!Object.value_equals(xv, yv)) return false;
    }
    if(remain.length) return false;
    return true;
};

window.isIterable = function isIterable(obj){
    return obj != null &&
            typeof obj[Symbol.iterator] === "function" ||
            typeof obj[Symbol.asyncIterator] === "function";
};

})(window);

/*
Blob
ArrayBuffer
ArrayBufferView
String - Data URL
String - Binary String


*/